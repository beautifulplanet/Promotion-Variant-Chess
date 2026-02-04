// Rust Chess Engine WASM Integration
// Provides a TypeScript interface to the high-performance Rust engine
// The WASM module is OPTIONAL - gracefully degrades if not available

import type { Piece, PieceColor, PieceType } from './types';

// =============================================================================
// TYPES
// =============================================================================

// These types describe what the WASM module exports
// The actual module is loaded dynamically at runtime
interface WasmModule {
  default: () => Promise<void>;
  ping: () => string;
  engine_info: () => string;
  new_game: () => Position;
  from_fen: (fen: string) => Position;
  to_fen: (pos: Position) => string;
  get_legal_moves: (pos: Position) => string[];
  count_legal_moves: (pos: Position) => number;
  make_move_uci: (pos: Position, uci: string) => boolean;
  is_in_check: (pos: Position) => boolean;
  get_best_move: (pos: Position, depth: number) => string | null;
  get_best_move_iterative: (pos: Position, maxDepth: number) => string | null;
  eval_position: (pos: Position) => number;
  search_position: (pos: Position, depth: number) => SearchResult;
}

interface Position {
  piece_count: () => number;
  is_white_turn: () => boolean;
  free: () => void;
}

interface SearchResult {
  best_move: string;
  score: number;
  nodes: bigint;
  depth: number;
}

// =============================================================================
// ENGINE STATE
// =============================================================================

// Using 'any' for wasmModule since it's dynamically loaded
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmModule: any = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the Rust WASM engine
 * Call this once at startup
 * Returns false if WASM is not available (graceful fallback)
 */
export async function initEngine(): Promise<boolean> {
  if (isInitialized) return true;
  
  if (initPromise) {
    await initPromise;
    return isInitialized;
  }
  
  initPromise = (async () => {
    try {
      console.log('[RustEngine] Loading WASM module...');
      
      // Fetch the JS glue code and eval it (Vite doesn't allow import from /public)
      const jsResponse = await fetch('/wasm/chess_engine.js');
      if (!jsResponse.ok) throw new Error('Failed to fetch WASM JS');
      const jsCode = await jsResponse.text();
      
      // Create module from the JS code
      const blob = new Blob([jsCode], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const wasm = await import(/* @vite-ignore */ blobUrl);
      URL.revokeObjectURL(blobUrl);
      
      // Initialize WASM
      await wasm.default('/wasm/chess_engine_bg.wasm');
      
      wasmModule = wasm;
      isInitialized = true;
      
      console.log('[RustEngine] 🦀 Initialized:', wasm.ping());
      console.log('[RustEngine] Info:', wasm.engine_info());
    } catch (error) {
      console.error('[RustEngine] Failed to initialize (WASM not available):', error);
      isInitialized = false;
    }
  })();
  
  await initPromise;
  return isInitialized;
}

/**
 * Check if engine is ready
 */
export function isEngineReady(): boolean {
  return isInitialized && wasmModule !== null;
}

// =============================================================================
// MOVE GENERATION
// =============================================================================

/**
 * Get all legal moves for a position in UCI format
 * @param fen - FEN string of the position
 * @returns Array of moves in UCI format (e.g., ["e2e4", "d2d4", ...])
 */
export function getLegalMoves(fen: string): string[] {
  if (!wasmModule) {
    console.warn('[RustEngine] Not initialized, returning empty moves');
    return [];
  }
  
  try {
    const pos = wasmModule.from_fen(fen);
    const moves = wasmModule.get_legal_moves(pos);
    pos.free(); // Free WASM memory
    return moves;
  } catch (error) {
    console.error('[RustEngine] getLegalMoves error:', error);
    return [];
  }
}

/**
 * Count legal moves (faster than getting all moves if you only need the count)
 */
export function countLegalMoves(fen: string): number {
  if (!wasmModule) return 0;
  
  try {
    const pos = wasmModule.from_fen(fen);
    const count = wasmModule.count_legal_moves(pos);
    pos.free();
    return count;
  } catch (error) {
    console.error('[RustEngine] countLegalMoves error:', error);
    return 0;
  }
}

/**
 * Check if a move is legal
 */
export function isMoveLegal(fen: string, moveUci: string): boolean {
  const legalMoves = getLegalMoves(fen);
  return legalMoves.includes(moveUci);
}

// =============================================================================
// SEARCH & EVALUATION
// =============================================================================

export interface SearchInfo {
  bestMove: string | null;
  score: number;           // Centipawns, from side-to-move perspective
  nodes: number;           // Positions searched
  depth: number;           // Search depth reached
  nps?: number;            // Nodes per second
  timeMs?: number;         // Time taken
}

/**
 * Find the best move using alpha-beta search
 * @param fen - FEN string of the position  
 * @param depth - Search depth (3-5 recommended for real-time play)
 * @returns Best move in UCI format, or null if no legal moves
 */
export function getBestMove(fen: string, depth: number = 4): string | null {
  if (!wasmModule) {
    console.warn('[RustEngine] Not initialized');
    return null;
  }
  
  try {
    const pos = wasmModule.from_fen(fen);
    const move = wasmModule.get_best_move(pos, depth);
    pos.free();
    return move;
  } catch (error) {
    console.error('[RustEngine] getBestMove error:', error);
    return null;
  }
}

/**
 * Find the best move with iterative deepening
 * Better for time management - searches depth 1, 2, 3... up to maxDepth
 */
export function getBestMoveIterative(fen: string, maxDepth: number = 5): string | null {
  if (!wasmModule) return null;
  
  try {
    const pos = wasmModule.from_fen(fen);
    const move = wasmModule.get_best_move_iterative(pos, maxDepth);
    pos.free();
    return move;
  } catch (error) {
    console.error('[RustEngine] getBestMoveIterative error:', error);
    return null;
  }
}

/**
 * Search with full statistics
 */
export function search(fen: string, depth: number): SearchInfo {
  if (!wasmModule) {
    return { bestMove: null, score: 0, nodes: 0, depth: 0 };
  }
  
  try {
    const startTime = performance.now();
    const pos = wasmModule.from_fen(fen);
    const result = wasmModule.search_position(pos, depth);
    pos.free();
    const timeMs = performance.now() - startTime;
    
    const nodes = Number(result.nodes);
    return {
      bestMove: result.best_move || null,
      score: result.score,
      nodes,
      depth: result.depth,
      timeMs,
      nps: timeMs > 0 ? Math.round(nodes / (timeMs / 1000)) : 0
    };
  } catch (error) {
    console.error('[RustEngine] search error:', error);
    return { bestMove: null, score: 0, nodes: 0, depth: 0 };
  }
}

/**
 * Evaluate a position (quick, no search)
 * @returns Score in centipawns from side-to-move perspective
 */
export function evaluate(fen: string): number {
  if (!wasmModule) return 0;
  
  try {
    const pos = wasmModule.from_fen(fen);
    const score = wasmModule.eval_position(pos);
    pos.free();
    return score;
  } catch (error) {
    console.error('[RustEngine] evaluate error:', error);
    return 0;
  }
}

// =============================================================================
// POSITION UTILITIES
// =============================================================================

/**
 * Check if a position is in check
 */
export function isInCheck(fen: string): boolean {
  if (!wasmModule) return false;
  
  try {
    const pos = wasmModule.from_fen(fen);
    const check = wasmModule.is_in_check(pos);
    pos.free();
    return check;
  } catch (error) {
    console.error('[RustEngine] isInCheck error:', error);
    return false;
  }
}

/**
 * Make a move and return the new FEN
 * @returns New FEN string, or null if move is illegal
 */
export function makeMove(fen: string, moveUci: string): string | null {
  if (!wasmModule) return null;
  
  try {
    const pos = wasmModule.from_fen(fen);
    const success = wasmModule.make_move_uci(pos, moveUci);
    
    if (success) {
      const newFen = wasmModule.to_fen(pos);
      pos.free();
      return newFen;
    }
    
    pos.free();
    return null;
  } catch (error) {
    console.error('[RustEngine] makeMove error:', error);
    return null;
  }
}

// =============================================================================
// UCI CONVERSION HELPERS
// =============================================================================

/**
 * Convert board coordinates to UCI move string
 */
export function toUci(
  fromRow: number, fromCol: number,
  toRow: number, toCol: number,
  promotion?: 'q' | 'r' | 'b' | 'n'
): string {
  const files = 'abcdefgh';
  const ranks = '87654321'; // Row 0 = rank 8, row 7 = rank 1
  
  let uci = files[fromCol] + ranks[fromRow] + files[toCol] + ranks[toRow];
  if (promotion) uci += promotion;
  return uci;
}

/**
 * Parse UCI move string to board coordinates
 */
export function fromUci(uci: string): {
  fromRow: number; fromCol: number;
  toRow: number; toCol: number;
  promotion?: 'q' | 'r' | 'b' | 'n';
} | null {
  if (uci.length < 4) return null;
  
  const files = 'abcdefgh';
  const ranks = '87654321';
  
  const fromCol = files.indexOf(uci[0]);
  const fromRow = ranks.indexOf(uci[1]);
  const toCol = files.indexOf(uci[2]);
  const toRow = ranks.indexOf(uci[3]);
  
  if (fromCol < 0 || fromRow < 0 || toCol < 0 || toRow < 0) return null;
  
  const promotion = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined;
  
  return { fromRow, fromCol, toRow, toCol, promotion };
}

// =============================================================================
// BENCHMARK
// =============================================================================

/**
 * Run performance benchmark
 */
export function benchmark(): void {
  if (!wasmModule) {
    console.log('[RustEngine] Not initialized');
    return;
  }
  
  console.log('[RustEngine] Running benchmark...');
  
  // Perft-like: move generation speed
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  let start = performance.now();
  for (let i = 0; i < 1000; i++) {
    getLegalMoves(startFen);
  }
  let elapsed = performance.now() - start;
  console.log(`[RustEngine] Move gen: ${elapsed.toFixed(2)}ms for 1000 iterations (${(1000 / elapsed * 1000).toFixed(0)} pos/sec)`);
  
  // Search speed
  start = performance.now();
  const result = search(startFen, 4);
  elapsed = performance.now() - start;
  console.log(`[RustEngine] Search depth 4: ${elapsed.toFixed(2)}ms, ${result.nodes} nodes, ${result.nps} NPS`);
  console.log(`[RustEngine] Best move: ${result.bestMove}, Score: ${result.score}cp`);
}

// =============================================================================
// DEBUG
// =============================================================================

/**
 * Get engine info string
 */
export function getEngineInfo(): string {
  if (!wasmModule) return 'Engine not initialized';
  return wasmModule.engine_info();
}

/**
 * Ping the engine
 */
export function ping(): string {
  if (!wasmModule) return 'Engine not initialized';
  return wasmModule.ping();
}
