// src/engineProvider.ts
// Unified chess engine facade — Rust WASM primary, chess.js fallback
// Task 2.3: Multi-engine support for device compatibility
//
// Architecture:
//   1. App starts → engine uses chess.js (instant, sync, universal)
//   2. Background → WASM loads asynchronously
//   3. When WASM ready → engine switches to RustGameState (faster search/eval)
//   4. If WASM fails → engine stays on chess.js (graceful degradation)
//
// All consumers import { engine } from './engineProvider' — they never
// need to know which backend is active.

import { engine as chessJsEngine, ChessEngine, boardToFEN } from './chessEngine';
import type { Move } from './chessEngine';
import { RustGameState, initRustGameState, isRustGameStateReady } from './rustGameState';

// Re-export types so consumers don't need to import from chessEngine directly
export type { Move };
export { boardToFEN };

// =============================================================================
// ENGINE STATE
// =============================================================================

// Reuse the existing chess.js singleton so tests and legacy code stay in sync
let activeEngine: ChessEngine | RustGameState = chessJsEngine;
let engineType: 'chess.js' | 'rust-wasm' = 'chess.js';

// =============================================================================
// PROXY-BASED SINGLETON
// =============================================================================

// The engine singleton uses a Proxy so that swapping the active backend
// is transparent to all consumers. Method calls are automatically forwarded
// to whichever engine is active, with correct `this` binding.

export const engine = new Proxy({} as ChessEngine & RustGameState, {
  get(_target, prop, _receiver) {
    const value = (activeEngine as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return (value as Function).bind(activeEngine);
    }
    return value;
  }
});

// =============================================================================
// ENGINE INITIALIZATION
// =============================================================================

/**
 * Initialize the Rust WASM engine in the background.
 * If successful, swaps the active engine to Rust.
 * If it fails, chess.js remains active — the game works either way.
 *
 * Call this once at app startup (non-blocking).
 */
export async function initEngine(): Promise<'rust-wasm' | 'chess.js'> {
  try {
    console.log('[EngineProvider] Attempting Rust WASM initialization...');
    const ok = await initRustGameState();

    if (ok && isRustGameStateReady()) {
      // Sync the current position from chess.js → Rust
      const currentFen = activeEngine.fen();
      const rustEngine = new RustGameState();

      // If we're not at starting position, load the current FEN
      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      if (currentFen !== startFen) {
        rustEngine.loadFEN(currentFen);
      }

      activeEngine = rustEngine;
      engineType = 'rust-wasm';
      console.log('[EngineProvider] 🦀 Upgraded to Rust WASM engine');
      return 'rust-wasm';
    }
  } catch (e) {
    console.warn('[EngineProvider] Rust WASM not available:', e);
  }

  console.log('[EngineProvider] Using chess.js fallback engine');
  return 'chess.js';
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
 * Force switch to a specific engine backend.
 * Useful for debugging or user preference.
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
    if (!isRustGameStateReady()) {
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
