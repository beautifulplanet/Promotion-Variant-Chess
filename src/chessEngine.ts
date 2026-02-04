// src/chessEngine.ts
// Chess engine wrapper using chess.js library

import { Chess, Square, Move as ChessMove, PieceSymbol } from 'chess.js';
import type { Piece, PieceColor, PieceType } from './types';
import {
  PIECE_VALUES, PST_PAWN, PST_KNIGHT, PST_BISHOP, PST_ROOK, PST_QUEEN, PST_KING_MID, PST_KING_END, BONUSES
} from './evaluationConstants';

// =============================================================================
// EVALUATION HELPERS
// =============================================================================

// Our internal move format
export interface Move {
  from: { row: number; col: number };
  to: { row: number; col: number };
  piece: Piece;
  capture?: Piece;
  promotion?: PieceType;
  castling?: 'kingSide' | 'queenSide';
}

// Convert our board to FEN string
export function boardToFEN(
  board: (Piece | null)[][],
  currentTurn: PieceColor,
  castlingRights?: { whiteKingSide: boolean; whiteQueenSide: boolean; blackKingSide: boolean; blackQueenSide: boolean },
  enPassantTarget?: { row: number; col: number } | null
): string {
  let fen = '';

  // Board position (from rank 8 to rank 1)
  for (let row = 0; row < 8; row++) {
    let emptyCount = 0;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        if (emptyCount > 0) {
          fen += emptyCount;
          emptyCount = 0;
        }
        let char = piece.type === 'N' ? 'N' : piece.type;
        fen += piece.color === 'white' ? char.toUpperCase() : char.toLowerCase();
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) fen += emptyCount;
    if (row < 7) fen += '/';
  }

  // Active color
  fen += ' ' + (currentTurn === 'white' ? 'w' : 'b');

  // Castling availability
  let castling = '';
  if (castlingRights) {
    if (castlingRights.whiteKingSide) castling += 'K';
    if (castlingRights.whiteQueenSide) castling += 'Q';
    if (castlingRights.blackKingSide) castling += 'k';
    if (castlingRights.blackQueenSide) castling += 'q';
  }
  fen += ' ' + (castling || '-');

  // En passant target
  if (enPassantTarget) {
    const file = String.fromCharCode(97 + enPassantTarget.col);
    const rank = 8 - enPassantTarget.row;
    fen += ' ' + file + rank;
  } else {
    fen += ' -';
  }

  // Halfmove clock and fullmove number (default values)
  fen += ' 0 1';

  return fen;
}

// Convert algebraic square to our row/col format
function squareToRowCol(square: Square): { row: number; col: number } {
  const col = square.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
  const row = 8 - parseInt(square[1]);    // '8' = 0, '7' = 1, etc.
  return { row, col };
}

// Convert our row/col to algebraic square
function rowColToSquare(row: number, col: number): Square {
  const file = String.fromCharCode(97 + col);
  const rank = (8 - row).toString();
  return (file + rank) as Square;
}

// Convert chess.js piece to our piece format
function chessJsPieceToOurs(piece: { type: PieceSymbol; color: 'w' | 'b' }): Piece {
  const typeMap: Record<PieceSymbol, PieceType> = {
    'p': 'P', 'n': 'N', 'b': 'B', 'r': 'R', 'q': 'Q', 'k': 'K'
  };
  return {
    type: typeMap[piece.type],
    color: piece.color === 'w' ? 'white' : 'black'
  };
}

// Chess engine class that wraps chess.js
export class ChessEngine {
  private chess: Chess;
  private boardCache: (Piece | null)[][] | null = null; // Cached board state
  private boardDirty = true; // Flag to indicate cache needs refresh

  constructor() {
    this.chess = new Chess();
  }

  // Load position from our board format
  loadPosition(
    board: (Piece | null)[][],
    currentTurn: PieceColor,
    castlingRights?: { whiteKingSide: boolean; whiteQueenSide: boolean; blackKingSide: boolean; blackQueenSide: boolean },
    enPassantTarget?: { row: number; col: number } | null
  ): boolean {
    const fen = boardToFEN(board, currentTurn, castlingRights, enPassantTarget);
    console.log('[ChessEngine] Loading FEN:', fen);
    try {
      this.chess.load(fen);
      this.boardDirty = true; // Invalidate cache
      return true;
    } catch (e) {
      console.error('[ChessEngine] FAILED to load FEN (Invalid State):', fen, e);
      // Reset to standard position to avoid broken state
      console.warn('[ChessEngine] Resetting to standard position as fallback');
      this.chess.reset();
      this.boardDirty = true;
      return false;
    }
  }

  // Load position manually using put (bypasses some FEN validation like back-rank pawns)
  loadCustomBoard(arrangement: Array<{ row: number, col: number, type: PieceType, color: PieceColor }>, currentTurn: PieceColor): void {
    console.log('[ChessEngine] loadCustomBoard called with', arrangement.length, 'pieces');
    this.chess.clear();

    // Explicitly place pieces
    let placedCount = 0;
    for (const item of arrangement) {
      const square = rowColToSquare(item.row, item.col);
      try {
        const result = this.chess.put({ type: item.type.toLowerCase() as any, color: item.color === 'white' ? 'w' : 'b' }, square);
        if (result) {
          placedCount++;
        } else {
          console.warn(`[ChessEngine] Failed to place ${item.color} ${item.type} at ${square} - put() returned false`);
        }
      } catch (e) {
        console.error(`[ChessEngine] Failed to put piece at ${square}:`, e);
      }
    }

    console.log(`[ChessEngine] Successfully placed ${placedCount}/${arrangement.length} pieces`);
    console.log('[ChessEngine] Board after custom load:', this.chess.ascii());

    // Note: We cannot easily set turn/castling with clear() + put().
    // clear() defaults to 'w' turn and no castling, which is exactly what we want for custom setup.
    // If we needed black turn, we'd need to manipulate internal state or construct a minimal FEN.

    this.boardDirty = true;
  }

  // Get all legal moves
  getLegalMoves(): Move[] {
    const moves = this.chess.moves({ verbose: true });
    return moves.map(m => this.convertMove(m));
  }

  // Convert chess.js move to our format
  private convertMove(m: ChessMove): Move {
    const from = squareToRowCol(m.from as Square);
    const to = squareToRowCol(m.to as Square);

    const piece: Piece = {
      type: m.piece.toUpperCase() as PieceType,
      color: m.color === 'w' ? 'white' : 'black'
    };

    const move: Move = { from, to, piece };

    if (m.captured) {
      move.capture = {
        type: m.captured.toUpperCase() as PieceType,
        color: m.color === 'w' ? 'black' : 'white'
      };
    }

    if (m.promotion) {
      move.promotion = m.promotion.toUpperCase() as PieceType;
    }

    if (m.flags.includes('k')) {
      move.castling = 'kingSide';
    } else if (m.flags.includes('q')) {
      move.castling = 'queenSide';
    }

    return move;
  }

  // Check if a move is legal
  isMoveLegal(from: { row: number; col: number }, to: { row: number; col: number }, promotion?: PieceType): boolean {
    const fromSquare = rowColToSquare(from.row, from.col);
    const toSquare = rowColToSquare(to.row, to.col);

    try {
      const moveObj: { from: Square; to: Square; promotion?: string } = {
        from: fromSquare,
        to: toSquare
      };
      if (promotion) {
        moveObj.promotion = promotion.toLowerCase();
      }

      // Try the move (will throw if illegal)
      const result = this.chess.move(moveObj);
      if (result) {
        this.chess.undo(); // Undo to keep position unchanged
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Make a move (modifies internal state)
  makeMove(from: { row: number; col: number }, to: { row: number; col: number }, promotion?: PieceType): ChessMove | null {
    const fromSquare = rowColToSquare(from.row, from.col);
    const toSquare = rowColToSquare(to.row, to.col);

    try {
      const moveObj: { from: Square; to: Square; promotion?: string } = {
        from: fromSquare,
        to: toSquare
      };
      if (promotion) {
        moveObj.promotion = promotion.toLowerCase();
      }
      const result = this.chess.move(moveObj);
      if (result) {
        this.boardDirty = true; // Invalidate cache
      }
      return result;
    } catch {
      return null;
    }
  }

  // Undo last move
  undo(): void {
    this.chess.undo();
    this.boardDirty = true; // Invalidate cache
  }

  // Game state checks
  isCheck(): boolean {
    return this.chess.isCheck();
  }

  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  isDraw(): boolean {
    return this.chess.isDraw();
  }

  /**
   * Get the specific type of draw (for better user feedback)
   */
  getDrawType(): 'stalemate' | 'insufficient' | 'fifty-move' | 'repetition' | 'agreement' | 'unknown' {
    if (this.chess.isStalemate()) return 'stalemate';
    if (this.chess.isInsufficientMaterial()) return 'insufficient';
    if (this.chess.isThreefoldRepetition()) return 'repetition';
    // chess.js doesn't expose 50-move directly, but isDraw covers it
    // We check the other conditions first, so if none match and it's a draw, assume 50-move
    if (this.chess.isDraw()) return 'fifty-move';
    return 'unknown';
  }

  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  // Get current turn
  turn(): PieceColor {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  // Get FEN
  fen(): string {
    return this.chess.fen();
  }

  // Alias for fen() - more explicit naming
  getFEN(): string {
    return this.chess.fen();
  }

  // Get move history (all moves made in current game)
  getMoveHistory(): string[] {
    return this.chess.history();
  }

  // Reset to starting position
  reset(): void {
    this.chess.reset();
    this.boardDirty = true; // Invalidate cache
  }

  // Get board in our format (cached for efficiency)
  getBoard(): (Piece | null)[][] {
    if (!this.boardDirty && this.boardCache) {
      return this.boardCache;
    }

    const board: (Piece | null)[][] = [];
    const chessBoard = this.chess.board();

    for (let row = 0; row < 8; row++) {
      board[row] = [];
      for (let col = 0; col < 8; col++) {
        const square = chessBoard[row][col];
        if (square) {
          board[row][col] = chessJsPieceToOurs(square);
        } else {
          board[row][col] = null;
        }
      }
    }

    this.boardCache = board;
    this.boardDirty = false;
    return board;
  }

  // Evaluate position (material + position bonuses + PST)
  evaluate(): number {
    let score = 0;
    const board = this.chess.board();

    // Check for checkmate/stalemate
    if (this.chess.isCheckmate()) {
      return this.chess.turn() === 'w' ? -100000 : 100000;
    }
    if (this.chess.isStalemate() || this.chess.isDraw()) {
      return 0;
    }

    // Naive endgame detection: if history length > 60, assume endgame for King PST
    // A better check would be material count, but this is a cheap proxy.
    const isEndgame = this.chess.history().length > 60;

    const wPawns = [0, 0, 0, 0, 0, 0, 0, 0];
    const bPawns = [0, 0, 0, 0, 0, 0, 0, 0];
    let wBishops = 0;
    let bBishops = 0;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          // 1. Material
          let value = PIECE_VALUES[piece.type] || 0;

          // 2. Piece-Square Tables
          let pstValue = 0;
          const tableRow = piece.color === 'w' ? row : 7 - row;
          const tableCol = col;

          switch (piece.type) {
            case 'p':
              pstValue = PST_PAWN[tableRow][tableCol];
              if (piece.color === 'w') wPawns[col]++; else bPawns[col]++;
              break;
            case 'n': pstValue = PST_KNIGHT[tableRow][tableCol]; break;
            case 'b':
              pstValue = PST_BISHOP[tableRow][tableCol];
              if (piece.color === 'w') wBishops++; else bBishops++;
              break;
            case 'r': pstValue = PST_ROOK[tableRow][tableCol]; break;
            case 'q': pstValue = PST_QUEEN[tableRow][tableCol]; break;
            case 'k': pstValue = isEndgame ? PST_KING_END[tableRow][tableCol] : PST_KING_MID[tableRow][tableCol]; break;
          }

          value += pstValue;

          score += piece.color === 'w' ? value : -value;
        }
      }
    }

    // 3. Positional Bonuses
    // Bishop Pair
    if (wBishops >= 2) score += BONUSES.BISHOP_PAIR;
    if (bBishops >= 2) score -= BONUSES.BISHOP_PAIR;

    // Pawn Structure
    for (let i = 0; i < 8; i++) {
      // Doubled Pawns
      if (wPawns[i] > 1) score += BONUSES.DOUBLED_PAWN;
      if (bPawns[i] > 1) score -= BONUSES.DOUBLED_PAWN;

      // Isolated Pawns
      if (wPawns[i] > 0) {
        const left = i > 0 ? wPawns[i - 1] : 0;
        const right = i < 7 ? wPawns[i + 1] : 0;
        if (left === 0 && right === 0) score += BONUSES.ISOLATED_PAWN;
      }
      if (bPawns[i] > 0) {
        const left = i > 0 ? bPawns[i - 1] : 0;
        const right = i < 7 ? bPawns[i + 1] : 0;
        if (left === 0 && right === 0) score -= BONUSES.ISOLATED_PAWN;
      }
    }

    // Small tempo bonus
    score += this.chess.turn() === 'w' ? 10 : -10;

    return score;
  }

  // Killer Heuristic: Store moves that caused a beta cutoff
  // killerMoves[depth][0] = primary killer, [1] = secondary
  private killerMoves: Move[][] = [];
  private historyMoves: Map<string, number> = new Map(); // history[move_string] = score

  // AI: Minimax with alpha-beta pruning + Quiescence Search + Killer Heuristic
  getBestMove(depth: number, maximizing: boolean): Move | null {
    try {
      // Clear heuristics for new search
      this.killerMoves = Array(depth + 1).fill(null).map(() => []);
      this.historyMoves.clear();

      const moves = this.getLegalMoves();
      console.log('[Engine] getBestMove called, moves count:', moves.length);
      if (moves.length === 0) return null;

      let bestMove: Move | null = null;
      let bestScore = maximizing ? -Infinity : Infinity;

      // Initial sorting for root moves
      moves.sort((a, b) => {
        const captureA = a.capture ? this.getPieceValue(a.capture.type) : 0;
        const captureB = b.capture ? this.getPieceValue(b.capture.type) : 0;
        return captureB - captureA;
      });

      for (const move of moves) {
        const fromSquare = rowColToSquare(move.from.row, move.from.col);
        const toSquare = rowColToSquare(move.to.row, move.to.col);

        this.chess.move({
          from: fromSquare,
          to: toSquare,
          promotion: move.promotion?.toLowerCase()
        });

        const score = this.minimax(depth - 1, -Infinity, Infinity, !maximizing);

        this.chess.undo();

        if (maximizing) {
          if (score > bestScore) {
            bestScore = score;
            bestMove = move;
          }
        } else {
          if (score < bestScore) {
            bestScore = score;
            bestMove = move;
          }
        }
      }

      console.log('[Engine] Best move found:', bestMove, 'score:', bestScore);
      return bestMove;
    } catch (e) {
      console.error('[Engine] getBestMove error:', e);
      // Fallback: return first legal move
      const moves = this.getLegalMoves();
      return moves.length > 0 ? moves[0] : null;
    }
  }

  // Quiescence Search: Continues searching capture moves at leaf nodes to prevent horizon effect
  private quiescence(alpha: number, beta: number, maximizing: boolean): number {
    const standPat = this.evaluate();

    // Pruning: If the static evaluation is already good enough, we don't need to search captures
    if (maximizing) {
      if (standPat >= beta) return beta;
      if (alpha < standPat) alpha = standPat;
    } else {
      if (standPat <= alpha) return alpha;
      if (beta > standPat) beta = standPat;
    }

    // Generate only capture moves
    const moves = this.chess.moves({ verbose: true }).filter(m => m.captured);

    // Convert to our format and Sort by MVV-LVA
    const captures = moves.map(m => this.convertMove(m));
    captures.sort((a, b) => {
      const valA = a.capture ? this.getPieceValue(a.capture.type) : 0;
      const valB = b.capture ? this.getPieceValue(b.capture.type) : 0;
      return valB - valA;
    });

    for (const move of captures) {
      const fromSquare = rowColToSquare(move.from.row, move.from.col);
      const toSquare = rowColToSquare(move.to.row, move.to.col);

      this.chess.move({
        from: fromSquare,
        to: toSquare,
        promotion: move.promotion?.toLowerCase()
      });

      const score = this.quiescence(alpha, beta, !maximizing);

      this.chess.undo();

      if (maximizing) {
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      } else {
        if (score <= alpha) return alpha;
        if (score < beta) beta = score;
      }
    }

    return maximizing ? alpha : beta;
  }

  private minimax(depth: number, alpha: number, beta: number, maximizing: boolean): number {
    if (this.chess.isGameOver()) {
      return this.evaluate();
    }

    // At leaf nodes, run Quiescence Search instead of static evaluate
    // Limit Q-Search depth implicitly by not passing depth param (it runs until quiet)
    if (depth === 0) {
      return this.quiescence(alpha, beta, maximizing);
    }

    const verboseMoves = this.chess.moves({ verbose: true });
    // Convert to our standard format immediately for easier sorting/checking
    const moves = verboseMoves.map(m => this.convertMove(m));

    // MOVE ORDERING
    moves.sort((a, b) => {
      // 1. MVV-LVA (Captures)
      const captureA = a.capture ? this.getPieceValue(a.capture.type) : 0;
      const captureB = b.capture ? this.getPieceValue(b.capture.type) : 0;
      if (captureA !== captureB) return captureB - captureA;

      // 2. Killer Heuristic
      if (this.isKillerMove(a, depth)) return 10000;
      if (this.isKillerMove(b, depth)) return -10000;

      return 0;
    });

    if (maximizing) {
      let maxScore = -Infinity;
      for (const m of moves) {
        const fromSquare = rowColToSquare(m.from.row, m.from.col);
        const toSquare = rowColToSquare(m.to.row, m.to.col);

        this.chess.move({
          from: fromSquare,
          to: toSquare,
          promotion: m.promotion?.toLowerCase()
        });

        const score = this.minimax(depth - 1, alpha, beta, false);
        this.chess.undo();

        if (score > maxScore) {
          maxScore = score;
        }
        if (score > alpha) {
          alpha = score;
        }
        if (beta <= alpha) {
          this.storeKillerMove(m, depth);
          break; // Beta cutoff
        }
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const m of moves) {
        const fromSquare = rowColToSquare(m.from.row, m.from.col);
        const toSquare = rowColToSquare(m.to.row, m.to.col);

        this.chess.move({
          from: fromSquare,
          to: toSquare,
          promotion: m.promotion?.toLowerCase()
        });

        const score = this.minimax(depth - 1, alpha, beta, true);
        this.chess.undo();

        if (score < minScore) {
          minScore = score;
        }
        if (score < beta) {
          beta = score;
        }
        if (beta <= alpha) {
          this.storeKillerMove(m, depth);
          break; // Alpha cutoff
        }
      }
      return minScore;
    }
  }

  private storeKillerMove(move: Move, depth: number) {
    if (!this.killerMoves[depth]) this.killerMoves[depth] = [];
    // Store up to 2 killer moves
    if (!this.killerMoves[depth].some(m => this.isSameMove(m, move))) {
      this.killerMoves[depth].unshift(move);
      if (this.killerMoves[depth].length > 2) this.killerMoves[depth].pop();
    }
  }

  private isKillerMove(move: Move, depth: number): boolean {
    if (!this.killerMoves[depth]) return false;
    return this.killerMoves[depth].some(m => this.isSameMove(m, move));
  }

  private isSameMove(a: Move, b: Move): boolean {
    return a.from.row === b.from.row && a.from.col === b.from.col &&
      a.to.row === b.to.row && a.to.col === b.to.col;
  }

  private getPieceValue(piece: string): number {
    // Cast to keyof typeof PIECE_VALUES to satisfy TS
    return PIECE_VALUES[piece.toLowerCase() as keyof typeof PIECE_VALUES] || 0;
  }
}

// Singleton instance
export const engine = new ChessEngine();
