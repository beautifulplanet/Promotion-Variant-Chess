// src/aiService.ts
// AI Service - provides async interface to AI worker
// Falls back to synchronous computation if workers unavailable
// NOW WITH RUST WASM ENGINE SUPPORT!

import type { Move } from './engineProvider';
import type { PieceType } from './types';
import { TIMING } from './constants';

// Production-safe logging: stripped by Vite in production builds
const DEBUG_LOG = import.meta.env.DEV
  ? (...args: unknown[]) => console.log(...args)
  : (..._args: unknown[]) => {};

// Lazy import for Rust engine to prevent blocking on load
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rustEngineModule: any = null;

// =============================================================================
// TYPES
// =============================================================================

interface AIMove {
  from: { row: number; col: number };
  to: { row: number; col: number };
  promotion?: string;
}

interface WorkerResponse {
  type: 'bestMove' | 'ready';
  requestId?: number;  // Echo back request ID to validate response
  move?: AIMove | null;
  score?: number;
  nodesSearched?: number;
  timeMs?: number;
}

// =============================================================================
// AI SERVICE
// =============================================================================

class AIService {
  private worker: Worker | null = null;
  private workerReady = false;
  private currentRequestId = 0;  // Track request ID to prevent race conditions
  private pendingRequest: {
    requestId: number;
    resolve: (move: Move | null) => void;
    reject: (error: Error) => void;
  } | null = null;
  private fallbackEngine: typeof import('./engineProvider').engine | null = null;
  private rustEngineReady = false;
  private rustEngineInitializing = false;

  constructor() {
    this.initWorker();
    // Enable Rust engine (loads async, won't block)
    setTimeout(() => {
      this.initRustEngine().catch(e => {
        console.warn('[AIService] Rust init failed:', e);
      });
    }, 500);
  }

  private async initRustEngine(): Promise<void> {
    if (this.rustEngineInitializing) return;
    this.rustEngineInitializing = true;

    try {
      console.log('[AIService] Initializing Rust WASM engine...');

      // Lazy load the Rust engine module - this is optional!
      if (!rustEngineModule) {
        rustEngineModule = await import('./rustEngine').catch(() => null);
      }

      if (rustEngineModule) {
        await rustEngineModule.initEngine();
        this.rustEngineReady = rustEngineModule.isEngineReady();
        if (this.rustEngineReady) {
          console.log('[AIService] 🦀 Rust WASM engine ready! (10-100x faster)');
        }
      }
    } catch (e) {
      console.warn('[AIService] Rust engine unavailable, using fallbacks:', e);
      this.rustEngineReady = false;
    }
    this.rustEngineInitializing = false;
  }

  private initWorker(): void {
    try {
      // Create worker from the aiWorker module
      this.worker = new Worker(
        new URL('./aiWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'ready') {
          this.workerReady = true;
          console.log('[AIService] Worker ready');
          return;
        }

        if (event.data.type === 'bestMove' && this.pendingRequest) {
          const { move, score, nodesSearched, timeMs, requestId } = event.data;

          // Validate request ID to prevent stale responses from timed-out requests
          if (requestId !== undefined && requestId !== this.pendingRequest.requestId) {
            console.warn(`[AIService] Ignoring stale worker response (got ${requestId}, expected ${this.pendingRequest.requestId})`);
            return;
          }

          DEBUG_LOG(`[AIService] Worker found move in ${timeMs?.toFixed(0)}ms, ${nodesSearched} nodes, score: ${score}`);

          const { resolve } = this.pendingRequest;
          this.pendingRequest = null;

          if (move) {
            // Convert to our Move format (need piece info from caller)
            resolve({
              from: move.from,
              to: move.to,
              piece: { type: 'P', color: 'black' }, // Placeholder - actual piece handled by caller
              promotion: move.promotion as PieceType | undefined
            });
          } else {
            resolve(null);
          }
        }
      };

      this.worker.onerror = (error) => {
        console.error('[AIService] Worker error:', error);
        if (this.pendingRequest) {
          this.pendingRequest.reject(new Error('Worker error'));
          this.pendingRequest = null;
        }
      };

      console.log('[AIService] Worker initialized');
    } catch (e) {
      console.warn('[AIService] Failed to create worker, will use fallback:', e);
      this.worker = null;
    }
  }

  /**
   * Get the best move using: Rust WASM > Web Worker > Synchronous fallback
   * Priority: Rust engine (fastest) > Worker (non-blocking) > Sync (blocking)
   */
  async getBestMove(
    fen: string,
    depth: number,
    maximizing: boolean
  ): Promise<Move | null> {
    // PRIORITY 1: Rust WASM engine (10-100x faster!)
    if (this.rustEngineReady && rustEngineModule) {
      try {
        const start = performance.now();
        const result = rustEngineModule.search(fen, depth);
        const elapsed = performance.now() - start;

        if (result.bestMove) {
          DEBUG_LOG(`[AIService] 🦀 Rust found move ${result.bestMove} in ${elapsed.toFixed(0)}ms, depth ${result.depth}, score ${result.score}, ${result.nodes} nodes`);

          // Convert UCI move to our format
          const fromCol = result.bestMove.charCodeAt(0) - 97;
          const fromRow = 8 - parseInt(result.bestMove[1]);
          const toCol = result.bestMove.charCodeAt(2) - 97;
          const toRow = 8 - parseInt(result.bestMove[3]);
          const promotion = result.bestMove.length > 4 ? result.bestMove[4].toUpperCase() as PieceType : undefined;

          return {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: { type: 'P', color: maximizing ? 'white' : 'black' }, // Placeholder
            promotion
          };
        }
      } catch (e) {
        console.warn('[AIService] Rust engine error, falling back:', e);
      }
    }

    // PRIORITY 2: Web Worker (non-blocking)
    if (this.worker && this.workerReady) {
      return new Promise((resolve, reject) => {
        // Timeout based on depth - simpler now that Stockfish handles high ELO
        // This is only for low ELO custom engine via worker
        const timeoutMs = depth <= 2
          ? TIMING.workerTimeoutDepth2
          : TIMING.stockfishTimeout; // Fallback to Stockfish timeout for depth > 2

        const timeout = setTimeout(() => {
          if (this.pendingRequest) {
            console.warn(`[AIService] Worker timeout (${timeoutMs}ms) at depth ${depth}, using fallback`);
            this.pendingRequest = null;
            this.computeFallback(fen, depth, maximizing).then(resolve).catch(reject);
          }
        }, timeoutMs);

        const requestId = ++this.currentRequestId;

        this.pendingRequest = {
          requestId,
          resolve: (move) => {
            clearTimeout(timeout);
            resolve(move);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        };

        this.worker!.postMessage({
          type: 'getBestMove',
          requestId,
          fen,
          depth,
          maximizing
        });
      });
    }

    // Fallback to synchronous computation
    return this.computeFallback(fen, depth, maximizing);
  }

  private async computeFallback(
    fen: string,
    depth: number,
    maximizing: boolean
  ): Promise<Move | null> {
    // Lazy load the engine to avoid circular dependencies
    if (!this.fallbackEngine) {
      const { engine } = await import('./engineProvider');
      this.fallbackEngine = engine;
    }

    DEBUG_LOG('[AIService] Using synchronous fallback');
    // Note: This will block the UI - but it's a fallback
    return this.fallbackEngine.getBestMove(depth, maximizing);
  }

  /**
   * Check if worker is available and ready
   */
  isWorkerReady(): boolean {
    return this.worker !== null && this.workerReady;
  }

  /**
   * Terminate the worker (cleanup)
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerReady = false;
    }
  }

  /**
   * Check if Rust WASM engine is ready
   */
  isRustEngineReady(): boolean {
    return this.rustEngineReady;
  }

  /**
   * Get engine status for debugging
   */
  getEngineStatus(): { rust: boolean; worker: boolean; fallback: boolean } {
    return {
      rust: this.rustEngineReady,
      worker: this.workerReady,
      fallback: true // Always available
    };
  }
}

// Singleton instance
export const aiService = new AIService();
