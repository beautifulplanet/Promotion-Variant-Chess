// src/rustGameState.ts
// Drop-in replacement for ChessEngine (chess.js wrapper) using Rust WASM GameState
// Task 2.2: Stateful WASM-backed chess engine adapter

import type { Piece, PieceColor, PieceType } from './types';
import type { Move } from './chessEngine';
import { boardToFEN } from './chessEngine';
import { toUci, fromUci } from './rustEngine';
import { getBookMove, setCurrentOpeningName } from './openingBook';

// =============================================================================
// WASM MODULE TYPES
// =============================================================================

/**
 * The WASM GameState class interface — mirrors chess_engine.d.ts
 */
interface WasmGameState {
  free(): void;
  fen(): string;
  hash(): bigint;
  turn(): string;              // "w" | "b"
  make_move_uci(uci: string): boolean;
  undo(): string;              // Returns UCI of undone move, or ""
  reset(): void;
  load_fen(fen: string): boolean;
  history(): string;           // JSON array of UCI strings
  get_board_json(): string;    // JSON 8x8 array
  piece_at(file: number, rank: number): string;  // "wP", "bN", "" etc.
  is_in_check(): boolean;
  is_checkmate(): boolean;
  is_stalemate(): boolean;
  is_draw(): boolean;
  is_insufficient_material(): boolean;
  is_fifty_move_draw(): boolean;
  is_threefold_repetition(): boolean;
  is_game_over(): boolean;
  status(): string;            // "playing", "checkmate", etc.
  legal_moves(): string[];     // UCI strings
  best_move(depth: number): string | undefined;
  eval(): number;
  move_count(): number;
}

interface WasmModuleWithGameState {
  default: (wasmPath: string) => Promise<void>;
  GameState: {
    new(): WasmGameState;
    from_fen(fen: string): WasmGameState;
  };
  // Stateless functions from rustEngine
  search_position: (pos: unknown, depth: number) => { best_move: string; score: number; nodes: bigint; depth: number };
  eval_position: (pos: unknown) => number;
}

// =============================================================================
// MODULE STATE
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmModule: any = null;
let gs: WasmGameState | null = null;
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

// Board cache — avoids re-parsing JSON every frame
let boardCache: (Piece | null)[][] | null = null;
let boardDirty = true;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the WASM module and create the GameState instance.
 * Must be called before any engine operations.
 */
export async function initRustGameState(): Promise<boolean> {
  if (isInitialized) return true;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('[RustGameState] Loading WASM module...');

      const base = import.meta.env.BASE_URL ?? '/';

      // Load WASM JS glue (same pattern as rustEngine.ts)
      const jsResponse = await fetch(`${base}wasm/chess_engine.js`);
      if (!jsResponse.ok) throw new Error('Failed to fetch WASM JS');
      const jsCode = await jsResponse.text();

      const blob = new Blob([jsCode], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const wasm = await import(/* @vite-ignore */ blobUrl);
      URL.revokeObjectURL(blobUrl);

      await wasm.default(`${base}wasm/chess_engine_bg.wasm`);

      wasmModule = wasm;
      gs = new wasm.GameState();
      isInitialized = true;
      boardDirty = true;

      console.log('[RustGameState] 🦀 Initialized with stateful GameState');
      return true;
    } catch (error) {
      console.error('[RustGameState] Failed to initialize:', error);
      isInitialized = false;
      return false;
    }
  })();

  return initPromise;
}

/**
 * Check if the Rust GameState engine is ready
 */
export function isRustGameStateReady(): boolean {
  return isInitialized && gs !== null;
}

// =============================================================================
// COORDINATE CONVERSION HELPERS
// =============================================================================

/** Convert row/col (row 0 = rank 8) to algebraic square string */
function rowColToAlgebraic(row: number, col: number): string {
  const file = String.fromCharCode(97 + col);  // a-h
  const rank = (8 - row).toString();            // 8-1
  return file + rank;
}

/** Convert algebraic square to row/col */
function algebraicToRowCol(sq: string): { row: number; col: number } {
  const col = sq.charCodeAt(0) - 97;
  const row = 8 - parseInt(sq[1]);
  return { row, col };
}

/** Get file (0-7) and rank (0-7, where 0 = rank 1) from row/col */
function rowColToFileRank(row: number, col: number): { file: number; rank: number } {
  return { file: col, rank: 7 - row };
}

// =============================================================================
// RUST GAME STATE — Drop-in ChessEngine replacement
// =============================================================================

/**
 * RustGameState: Drop-in replacement for ChessEngine.
 * Wraps the Rust WASM GameState for stateful, high-performance chess.
 * 
 * All methods match the ChessEngine interface used by gameController, 
 * aiService, moveQualityAnalyzer, moveListUI, etc.
 */
export class RustGameState {

  // ── Position management ──────────────────────────────────────────────────

  /**
   * Load position from our board format.
   * Converts board to FEN, then loads via WASM.
   */
  loadPosition(
    board: (Piece | null)[][],
    currentTurn: PieceColor,
    castlingRights?: { whiteKingSide: boolean; whiteQueenSide: boolean; blackKingSide: boolean; blackQueenSide: boolean },
    enPassantTarget?: { row: number; col: number } | null
  ): boolean {
    if (!gs) return false;
    const fen = boardToFEN(board, currentTurn, castlingRights, enPassantTarget);
    console.log('[RustGameState] Loading FEN:', fen);
    const ok = gs.load_fen(fen);
    if (!ok) {
      console.error('[RustGameState] FAILED to load FEN:', fen);
      gs.reset();
    }
    boardDirty = true;
    return ok;
  }

  /**
   * Load a custom board arrangement (bypasses some FEN validation).
   * Builds a FEN from the arrangement and loads it.
   */
  loadCustomBoard(
    arrangement: Array<{ row: number; col: number; type: PieceType; color: PieceColor }>,
    currentTurn: PieceColor
  ): void {
    if (!gs) return;

    console.log('[RustGameState] loadCustomBoard called with', arrangement.length, 'pieces');

    // Build a board array from the arrangement
    const board: (Piece | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (const item of arrangement) {
      board[item.row][item.col] = { type: item.type, color: item.color };
    }

    const fen = boardToFEN(board, currentTurn);
    const ok = gs.load_fen(fen);
    if (!ok) {
      console.error('[RustGameState] Failed to load custom board FEN:', fen);
    }
    boardDirty = true;
  }

  /**
   * Reset to starting position
   */
  reset(): void {
    if (!gs) return;
    gs.reset();
    boardDirty = true;
  }

  /**
   * Load position from FEN string
   */
  loadFEN(fen: string): boolean {
    if (!gs) return false;
    const ok = gs.load_fen(fen);
    if (ok) {
      boardDirty = true;
      console.log('[RustGameState] Loaded FEN:', fen);
    } else {
      console.error('[RustGameState] Failed to load FEN:', fen);
    }
    return ok;
  }

  /**
   * Get FEN
   */
  fen(): string {
    if (!gs) return '';
    return gs.fen();
  }

  /**
   * Alias for fen()
   */
  getFEN(): string {
    return this.fen();
  }

  // ── Board & turn ────────────────────────────────────────────────────────

  /**
   * Get current turn as PieceColor
   */
  turn(): PieceColor {
    if (!gs) return 'white';
    return gs.turn() === 'w' ? 'white' : 'black';
  }

  /**
   * Get board in our (Piece | null)[][] format.
   * Cached for efficiency — only re-parses when dirty.
   */
  getBoard(): (Piece | null)[][] {
    if (!boardDirty && boardCache) return boardCache;
    if (!gs) return emptyBoard();

    try {
      const json = gs.get_board_json();
      const raw: (null | { type: string; color: string })[][] = JSON.parse(json);

      const board: (Piece | null)[][] = [];
      for (let row = 0; row < 8; row++) {
        board[row] = [];
        for (let col = 0; col < 8; col++) {
          const cell = raw[row][col];
          if (cell) {
            board[row][col] = {
              type: cell.type as PieceType,
              color: cell.color === 'w' ? 'white' : 'black'
            };
          } else {
            board[row][col] = null;
          }
        }
      }

      boardCache = board;
      boardDirty = false;
      return board;
    } catch (e) {
      console.error('[RustGameState] getBoard parse error:', e);
      return emptyBoard();
    }
  }

  // ── Move generation & execution ──────────────────────────────────────────

  /**
   * Get all legal moves in our Move format.
   * Fetches UCI strings from WASM, converts to Move objects with piece/capture info.
   */
  getLegalMoves(): Move[] {
    if (!gs) return [];

    try {
      const uciMoves: string[] = gs.legal_moves();
      const board = this.getBoard();
      const moves: Move[] = [];

      for (const uci of uciMoves) {
        const parsed = fromUci(uci);
        if (!parsed) continue;

        const { fromRow, fromCol, toRow, toCol, promotion } = parsed;
        const piece = board[fromRow]?.[fromCol];
        if (!piece) continue;

        const move: Move = {
          from: { row: fromRow, col: fromCol },
          to: { row: toRow, col: toCol },
          piece
        };

        // Detect capture
        const targetPiece = board[toRow]?.[toCol];
        if (targetPiece) {
          move.capture = targetPiece;
        } else if (piece.type === 'P') {
          // En passant: pawn moves diagonally to empty square
          if (fromCol !== toCol) {
            const epCapturedRow = fromRow;  // captured pawn is on same row as moving pawn
            const epPiece = board[epCapturedRow]?.[toCol];
            if (epPiece) {
              move.capture = epPiece;
            }
          }
        }

        // Detect promotion
        if (promotion) {
          const promoMap: Record<string, PieceType> = { q: 'Q', r: 'R', b: 'B', n: 'N' };
          move.promotion = promoMap[promotion] || 'Q';
        }

        // Detect castling
        if (piece.type === 'K' && Math.abs(toCol - fromCol) === 2) {
          move.castling = toCol > fromCol ? 'kingSide' : 'queenSide';
        }

        moves.push(move);
      }

      return moves;
    } catch (e) {
      console.error('[RustGameState] getLegalMoves error:', e);
      return [];
    }
  }

  /**
   * Check if a specific move is legal
   */
  isMoveLegal(from: { row: number; col: number }, to: { row: number; col: number }, promotion?: PieceType): boolean {
    if (!gs) return false;

    const uci = toUci(from.row, from.col, to.row, to.col,
      promotion ? promotion.toLowerCase() as 'q' | 'r' | 'b' | 'n' : undefined);

    // Check if this UCI move is in the legal moves list
    const legalMoves: string[] = gs.legal_moves();
    return legalMoves.includes(uci);
  }

  /**
   * Make a move. Returns a move result object (compatible with chess.js ChessMove shape)
   * or null if illegal.
   */
  makeMove(
    from: { row: number; col: number },
    to: { row: number; col: number },
    promotion?: PieceType
  ): MoveResult | null {
    if (!gs) return null;

    // Capture info BEFORE making the move
    const board = this.getBoard();
    const piece = board[from.row]?.[from.col];
    if (!piece) return null;

    const captured = board[to.row]?.[to.col];

    const uci = toUci(from.row, from.col, to.row, to.col,
      promotion ? promotion.toLowerCase() as 'q' | 'r' | 'b' | 'n' : undefined);

    const ok = gs.make_move_uci(uci);
    if (!ok) return null;

    boardDirty = true;

    // Build a result object compatible with what callers expect from chess.js ChessMove
    const fromSq = rowColToAlgebraic(from.row, from.col);
    const toSq = rowColToAlgebraic(to.row, to.col);

    // Determine flags
    let flags = '';
    const isCapture = !!captured;
    const isPawnDiagonal = piece.type === 'P' && from.col !== to.col;

    if (piece.type === 'K' && Math.abs(to.col - from.col) === 2) {
      flags = to.col > from.col ? 'k' : 'q';   // castling
    } else if (isPawnDiagonal && !captured) {
      flags = 'e';   // en passant
    } else if (isCapture) {
      flags = 'x';
    } else if (piece.type === 'P' && Math.abs(to.row - from.row) === 2) {
      flags = 'b';   // double pawn push
    } else {
      flags = 'n';   // quiet move
    }

    return {
      color: piece.color === 'white' ? 'w' : 'b',
      from: fromSq,
      to: toSq,
      piece: piece.type.toLowerCase(),
      captured: captured ? captured.type.toLowerCase() : undefined,
      promotion: promotion ? promotion.toLowerCase() : undefined,
      flags,
      san: uci,   // We use UCI instead of SAN — callers don't parse this
      lan: uci,
    } as MoveResult;
  }

  /**
   * Undo last move. Returns true if a move was undone.
   */
  undo(): boolean {
    if (!gs) return false;
    const undone = gs.undo();
    if (undone) {
      boardDirty = true;
      return true;
    }
    return false;
  }

  /**
   * Get move history as string array (UCI strings).
   * Compatible with chess.js history() — callers use .length for counting.
   */
  getMoveHistory(): string[] {
    if (!gs) return [];
    try {
      const json = gs.history();
      return JSON.parse(json) as string[];
    } catch {
      return [];
    }
  }

  // ── Game state queries ──────────────────────────────────────────────────

  isCheck(): boolean {
    if (!gs) return false;
    return gs.is_in_check();
  }

  isCheckmate(): boolean {
    if (!gs) return false;
    return gs.is_checkmate();
  }

  isStalemate(): boolean {
    if (!gs) return false;
    return gs.is_stalemate();
  }

  isDraw(): boolean {
    if (!gs) return false;
    return gs.is_draw();
  }

  isGameOver(): boolean {
    if (!gs) return false;
    return gs.is_game_over();
  }

  /**
   * Get the specific type of draw
   */
  getDrawType(): 'stalemate' | 'insufficient' | 'fifty-move' | 'repetition' | 'agreement' | 'unknown' {
    if (!gs) return 'unknown';
    if (gs.is_stalemate()) return 'stalemate';
    if (gs.is_insufficient_material()) return 'insufficient';
    if (gs.is_threefold_repetition()) return 'repetition';
    if (gs.is_fifty_move_draw()) return 'fifty-move';
    if (gs.is_draw()) return 'fifty-move'; // fallback
    return 'unknown';
  }

  // ── Evaluation & search ─────────────────────────────────────────────────

  /**
   * Evaluate current position.
   * Uses the Rust engine's evaluation (much faster than JS).
   */
  evaluate(): number {
    if (!gs) return 0;

    // Handle terminal states
    if (gs.is_checkmate()) {
      return gs.turn() === 'w' ? -100000 : 100000;
    }
    if (gs.is_stalemate() || gs.is_draw()) {
      return 0;
    }

    return gs.eval();
  }

  /**
   * Get best move using Rust alpha-beta search.
   * Returns Move in our format, or null.
   */
  getBestMove(depth: number, maximizing: boolean): Move | null {
    if (!gs) return null;

    try {
      // 1. Check opening book
      const currentFen = this.fen();
      const bookMove = getBookMove(currentFen);
      if (bookMove) {
        console.log(`[RustGameState] Opening Book hit: ${bookMove.name || bookMove.san}`);
        if (bookMove.name) {
          setCurrentOpeningName(bookMove.name);
        }

        // The book gives SAN — we need to find the matching legal move
        // Try each legal move and see which one matches the destination
        const legalMoves = this.getLegalMoves();
        const bookUci = this.sanToUci(bookMove.san);
        if (bookUci) {
          const parsed = fromUci(bookUci);
          if (parsed) {
            const match = legalMoves.find(m =>
              m.from.row === parsed.fromRow && m.from.col === parsed.fromCol &&
              m.to.row === parsed.toRow && m.to.col === parsed.toCol
            );
            if (match) return match;
          }
        }
      }

      // 2. Use Rust search
      const bestUci = gs.best_move(depth);
      if (!bestUci) return null;

      const parsed = fromUci(bestUci);
      if (!parsed) return null;

      // Build full Move object
      const board = this.getBoard();
      const piece = board[parsed.fromRow]?.[parsed.fromCol];
      if (!piece) return null;

      const move: Move = {
        from: { row: parsed.fromRow, col: parsed.fromCol },
        to: { row: parsed.toRow, col: parsed.toCol },
        piece
      };

      const target = board[parsed.toRow]?.[parsed.toCol];
      if (target) move.capture = target;

      if (parsed.promotion) {
        const promoMap: Record<string, PieceType> = { q: 'Q', r: 'R', b: 'B', n: 'N' };
        move.promotion = promoMap[parsed.promotion] || 'Q';
      }

      if (piece.type === 'K' && Math.abs(parsed.toCol - parsed.fromCol) === 2) {
        move.castling = parsed.toCol > parsed.fromCol ? 'kingSide' : 'queenSide';
      }

      return move;
    } catch (e) {
      console.error('[RustGameState] getBestMove error:', e);
      // Fallback: return first legal move
      const moves = this.getLegalMoves();
      return moves.length > 0 ? moves[0] : null;
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Try to convert SAN to UCI by testing legal moves.
   * Simple approach: try each legal move, make it, check if it matches.
   */
  private sanToUci(san: string): string | null {
    if (!gs) return null;

    // Strip check/mate symbols and capture notation for matching
    const cleanSan = san.replace(/[+#x]/g, '').replace(/=/, '');

    const legalUcis: string[] = gs.legal_moves();
    const board = this.getBoard();

    // For each legal move, see if it could match the SAN
    for (const uci of legalUcis) {
      const parsed = fromUci(uci);
      if (!parsed) continue;

      const piece = board[parsed.fromRow]?.[parsed.fromCol];
      if (!piece) continue;

      // Simple SAN matching heuristics
      const toAlg = rowColToAlgebraic(parsed.toRow, parsed.toCol);

      // Pawn moves: "e4", "exd5", "e8=Q"
      if (piece.type === 'P') {
        const fromFile = String.fromCharCode(97 + parsed.fromCol);
        if (cleanSan === toAlg) return uci;
        if (cleanSan === fromFile + toAlg) return uci;
        // Promotion: e8Q or e8=Q
        if (parsed.promotion) {
          const promoChar = parsed.promotion.toUpperCase();
          if (cleanSan === toAlg + promoChar || cleanSan === fromFile + toAlg + promoChar) return uci;
        }
        continue;
      }

      // Castling
      if (san === 'O-O' || san === 'O-O+' || san === 'O-O#') {
        if (piece.type === 'K' && parsed.toCol - parsed.fromCol === 2) return uci;
      }
      if (san === 'O-O-O' || san === 'O-O-O+' || san === 'O-O-O#') {
        if (piece.type === 'K' && parsed.fromCol - parsed.toCol === 2) return uci;
      }

      // Piece moves: "Nf3", "Bxe5", "Rad1", "Qh4"
      const pieceChar = piece.type === 'N' ? 'N' : piece.type;
      if (cleanSan.startsWith(pieceChar)) {
        const rest = cleanSan.slice(1);
        if (rest === toAlg) return uci;
        // Disambiguation: "Rad1" — 'a' is file disambiguator
        if (rest.length === 3) {
          const disambig = rest[0];
          const target = rest.slice(1);
          if (target === toAlg) {
            const fromFile = String.fromCharCode(97 + parsed.fromCol);
            const fromRank = (8 - parsed.fromRow).toString();
            if (disambig === fromFile || disambig === fromRank) return uci;
          }
        }
        // Double disambiguation: "Qa1b2" style (rare)
        if (rest.length === 4) {
          const target = rest.slice(2);
          if (target === toAlg) return uci;
        }
      }
    }

    console.warn('[RustGameState] Could not convert SAN to UCI:', san);
    return null;
  }
}

// =============================================================================
// MOVE RESULT TYPE (compatible subset of chess.js ChessMove)
// =============================================================================

/**
 * Result of makeMove — mimics chess.js Move fields that callers actually use.
 * Key fields: from, to, piece, captured, flags, san, color.
 */
export interface MoveResult {
  color: 'w' | 'b';
  from: string;      // algebraic
  to: string;        // algebraic
  piece: string;     // lowercase piece char
  captured?: string;  // lowercase piece char
  promotion?: string; // lowercase piece char
  flags: string;     // 'n', 'x', 'k', 'q', 'e', 'b'
  san: string;       // Move notation (UCI for now)
  lan: string;       // Long algebraic
}

// =============================================================================
// HELPERS
// =============================================================================

function emptyBoard(): (Piece | null)[][] {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Singleton RustGameState instance.
 * Must call initRustGameState() before using.
 */
export const rustEngine = new RustGameState();
