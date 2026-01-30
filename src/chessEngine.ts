// src/chessEngine.ts
// Chess engine wrapper using chess.js library

import { Chess, Square, Move as ChessMove, PieceSymbol } from 'chess.js';
import type { Piece, PieceColor, PieceType } from './types';

// =============================================================================
// EVALUATION CONSTANTS (Hoisted to avoid per-call allocations)
// =============================================================================

const PIECE_VALUES_LOWER: Record<string, number> = {
  'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000
};

const PAWN_TABLE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0]
];

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
  ): void {
    const fen = boardToFEN(board, currentTurn, castlingRights, enPassantTarget);
    console.log('[ChessEngine] Loading FEN:', fen);
    try {
      this.chess.load(fen);
      this.boardDirty = true; // Invalidate cache
    } catch (e) {
      console.error('[ChessEngine] FAILED to load FEN (Invalid State):', fen, e);
      // Fallback: Reset to standard position to avoid broken state
      // this.chess.reset(); // Already reset by calling code usually, but safer to leave as is (likely standard)
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

  // Evaluate position (material + position bonuses)
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

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          let value = PIECE_VALUES_LOWER[piece.type];

          // Add position bonus for pawns
          if (piece.type === 'p') {
            const tableRow = piece.color === 'w' ? row : 7 - row;
            value += PAWN_TABLE[tableRow][col];
          }

          // Add small bonus for controlling center
          if ((row === 3 || row === 4) && (col === 3 || col === 4)) {
            value += 10;
          }

          score += piece.color === 'w' ? value : -value;
        }
      }
    }

    // Small bonus for having the move
    if (this.chess.turn() === 'w') {
      score += 10;
    } else {
      score -= 10;
    }

    return score;
  }

  // AI: Minimax with alpha-beta pruning
  getBestMove(depth: number, maximizing: boolean): Move | null {
    try {
      const moves = this.getLegalMoves();
      console.log('[Engine] getBestMove called, moves count:', moves.length);
      if (moves.length === 0) return null;

      let bestMove: Move | null = null;
      let bestScore = maximizing ? -Infinity : Infinity;

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

  private minimax(depth: number, alpha: number, beta: number, maximizing: boolean): number {
    if (depth === 0 || this.chess.isGameOver()) {
      return this.evaluate();
    }

    // Get and order moves for better pruning (captures first, then checks)
    const moves = this.chess.moves({ verbose: true });
    moves.sort((a, b) => {
      // Prioritize captures (MVV-LVA: Most Valuable Victim - Least Valuable Attacker)
      const captureA = a.captured ? this.getPieceValue(a.captured) : 0;
      const captureB = b.captured ? this.getPieceValue(b.captured) : 0;
      return captureB - captureA;
    });

    if (maximizing) {
      let maxScore = -Infinity;
      for (const m of moves) {
        this.chess.move(m);
        const score = this.minimax(depth - 1, alpha, beta, false);
        this.chess.undo();
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break; // Beta cutoff
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const m of moves) {
        this.chess.move(m);
        const score = this.minimax(depth - 1, alpha, beta, true);
        this.chess.undo();
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break; // Alpha cutoff
      }
      return minScore;
    }
  }

  private getPieceValue(piece: string): number {
    const values: Record<string, number> = {
      'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000
    };
    return values[piece.toLowerCase()] || 0;
  }
}

// Singleton instance
export const engine = new ChessEngine();
