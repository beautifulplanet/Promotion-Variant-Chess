// src/engineProvider.ts
// Unified chess engine facade — Rust WASM primary, chess.js fallback
// Task 2.3: Multi-engine support for device compatibility
//
// Architecture:
//   1. App starts → engine uses chess.js (instant, sync, universal)
//   2. Background → WASM loads asynchronously (via initEngine)
//   3. WASM ready → marked as "pending" — NOT swapped mid-game
//   4. Game boundary (reset/newGame) → promoteEngine() swaps to WASM
//   5. If WASM fails → engine stays on chess.js (graceful degradation)
//
// All consumers import { engine } from './engineProvider' — they never
// need to know which backend is active.

import { engine as chessJsEngine, ChessEngine, boardToFEN } from './chessEngine';
import type { Move } from './chessEngine';
import { RustGameState, initRustGameState, isRustGameStateReady } from './rustGameState';

// Re-export types so consumers don't need to import from chessEngine directly
export type { Move };
export { boardToFEN };

/**
 * Common engine interface — the public API that both ChessEngine and RustGameState share.
 * We use this instead of `ChessEngine & RustGameState` to avoid the TypeScript
 * "never" collapse caused by conflicting private members (both have private boardCache).
 */
export interface ChessEngineAPI {
  // Position management
  reset(): void;
  loadFEN(fen: string): boolean;
  fen(): string;
  getFEN(): string;
  loadPosition(
    board: (import('./types').Piece | null)[][],
    currentTurn: import('./types').PieceColor,
    castlingRights?: { whiteKingSide: boolean; whiteQueenSide: boolean; blackKingSide: boolean; blackQueenSide: boolean },
    enPassantTarget?: { row: number; col: number } | null
  ): boolean;
  loadCustomBoard(
    arrangement: Array<{ row: number; col: number; type: import('./types').PieceType; color: import('./types').PieceColor }>,
    currentTurn: import('./types').PieceColor
  ): void;

  // Board & turn
  turn(): import('./types').PieceColor;
  getBoard(): (import('./types').Piece | null)[][];

  // Moves
  getLegalMoves(): Move[];
  isMoveLegal(from: { row: number; col: number }, to: { row: number; col: number }, promotion?: import('./types').PieceType): boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  makeMove(from: { row: number; col: number }, to: { row: number; col: number }, promotion?: import('./types').PieceType): any;
  undo(): boolean;
  getMoveHistory(): string[];

  // Game state
  isCheck(): boolean;
  isCheckmate(): boolean;
  isStalemate(): boolean;
  isDraw(): boolean;
  isGameOver(): boolean;
  getDrawType(): string;

  // Evaluation & search
  evaluate(): number;
  getBestMove(depth: number, maximizing: boolean): Move | null;
}

// =============================================================================
// ENGINE STATE
// =============================================================================

// Reuse the existing chess.js singleton so tests and legacy code stay in sync
let activeEngine: ChessEngine | RustGameState = chessJsEngine;
let engineType: 'chess.js' | 'rust-wasm' = 'chess.js';

// WASM readiness — deferred swap to avoid mid-game corruption
let wasmReady = false;
let initInProgress = false;

// =============================================================================
// PROXY-BASED SINGLETON
// =============================================================================

// The engine singleton uses a Proxy so that swapping the active backend
// is transparent to all consumers. Method calls are automatically forwarded
// to whichever engine is active, with correct `this` binding.

export const engine = new Proxy({} as ChessEngineAPI, {
  get(_target, prop, _receiver) {
    const value = (activeEngine as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return (value as Function).bind(activeEngine);
    }
    return value;
  },
  has(_target, prop) {
    return prop in (activeEngine as unknown as Record<string | symbol, unknown>);
  }
});

// =============================================================================
// ENGINE INITIALIZATION
// =============================================================================

/**
 * Initialize the Rust WASM engine in the background.
 * Does NOT swap engines mid-game — only marks WASM as available.
 * Call promoteEngine() at a game boundary to actually switch.
 *
 * Call this once at app startup (non-blocking).
 */
export async function initEngine(): Promise<'rust-wasm' | 'chess.js'> {
  // Re-entrancy guard
  if (engineType === 'rust-wasm') return 'rust-wasm';
  if (initInProgress) {
    // Wait for existing init to complete
    try {
      const ok = await initRustGameState();
      return ok && isRustGameStateReady() ? 'rust-wasm' : 'chess.js';
    } catch {
      return 'chess.js';
    }
  }

  initInProgress = true;
  try {
    console.log('[EngineProvider] Attempting Rust WASM initialization...');
    const ok = await initRustGameState();

    if (ok && isRustGameStateReady()) {
      wasmReady = true;
      console.log('[EngineProvider] 🦀 Rust WASM ready — will activate at next game boundary');

      // If no game is in progress (starting position, no moves), swap immediately
      if (activeEngine.getMoveHistory().length === 0) {
        promoteEngine();
        return 'rust-wasm';
      }

      return 'rust-wasm';
    }
  } catch (e) {
    console.warn('[EngineProvider] Rust WASM not available:', e);
  } finally {
    initInProgress = false;
  }

  console.log('[EngineProvider] Using chess.js fallback engine');
  return 'chess.js';
}

/**
 * Promote WASM to active engine — call at game boundaries only
 * (new game, reset, loadFEN from scratch).
 * Safe because there's no move history to lose at a boundary.
 */
export function promoteEngine(): boolean {
  if (engineType === 'rust-wasm') return true;
  if (!wasmReady || !isRustGameStateReady()) return false;

  const rustEngine = new RustGameState();
  activeEngine = rustEngine;
  engineType = 'rust-wasm';
  console.log('[EngineProvider] 🦀 Activated Rust WASM engine');
  return true;
}

// =============================================================================
// ENGINE INFO
// =============================================================================

/**
 * Get the currently active engine type
 */
export function getEngineType(): 'chess.js' | 'rust-wasm' {
  return engineType;
}

/**
 * Check if Rust WASM is the active engine
 */
export function isRustActive(): boolean {
  return engineType === 'rust-wasm';
}

/**
 * Check if Rust WASM is loaded and ready (but not necessarily active)
 */
export function isWasmReady(): boolean {
  return wasmReady;
}

/**
 * Force switch to a specific engine backend.
 * Useful for debugging or user preference.
 * Only safe to call at game boundaries (no moves in progress).
 */
export function switchEngine(type: 'chess.js' | 'rust-wasm'): boolean {
  if (type === 'chess.js' && engineType !== 'chess.js') {
    const fen = activeEngine.fen();
    chessJsEngine.loadFEN(fen);
    activeEngine = chessJsEngine;
    engineType = 'chess.js';
    console.log('[EngineProvider] Switched to chess.js');
    return true;
  }

  if (type === 'rust-wasm' && engineType !== 'rust-wasm') {
    if (!wasmReady || !isRustGameStateReady()) {
      console.warn('[EngineProvider] Rust WASM not initialized');
      return false;
    }
    const fen = activeEngine.fen();
    const rustEngine = new RustGameState();
    rustEngine.loadFEN(fen);
    activeEngine = rustEngine;
    engineType = 'rust-wasm';
    console.log('[EngineProvider] Switched to Rust WASM');
    return true;
  }

  return false;
}
