// src/aiService.ts
// AI Service - provides async interface to AI worker
// Falls back to synchronous computation if workers unavailable

import type { Move } from './chessEngine';
import type { PieceType } from './types';

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
  private pendingRequest: {
    resolve: (move: Move | null) => void;
    reject: (error: Error) => void;
  } | null = null;
  private fallbackEngine: typeof import('./chessEngine').engine | null = null;

  constructor() {
    this.initWorker();
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
          const { move, score, nodesSearched, timeMs } = event.data;
          console.log(`[AIService] Worker found move in ${timeMs?.toFixed(0)}ms, ${nodesSearched} nodes, score: ${score}`);
          
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
   * Get the best move using Web Worker (non-blocking)
   * Falls back to synchronous computation if worker unavailable
   */
  async getBestMove(
    fen: string,
    depth: number,
    maximizing: boolean
  ): Promise<Move | null> {
    // If worker is available and ready, use it
    if (this.worker && this.workerReady) {
      return new Promise((resolve, reject) => {
        // Set timeout for worker response
        const timeout = setTimeout(() => {
          if (this.pendingRequest) {
            console.warn('[AIService] Worker timeout, using fallback');
            this.pendingRequest = null;
            this.computeFallback(fen, depth, maximizing).then(resolve).catch(reject);
          }
        }, 30000); // 30 second timeout

        this.pendingRequest = {
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
      const { engine } = await import('./chessEngine');
      this.fallbackEngine = engine;
    }

    console.log('[AIService] Using synchronous fallback');
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
}

// Singleton instance
export const aiService = new AIService();
