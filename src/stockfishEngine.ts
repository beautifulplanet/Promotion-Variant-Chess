// src/stockfishEngine.ts
// Stockfish.js wrapper for ALL chess AI (non-blocking via Web Worker)
// Skill levels 0-20 provide appropriate difficulty for all ELO ranges

import type { Move } from './engineProvider';
import type { PieceType, Piece } from './types';

// =============================================================================
// ELO TO STOCKFISH SKILL LEVEL MAPPING
// =============================================================================

/**
 * Convert player ELO to Stockfish skill level (0-20)
 * Calibrated for chess.com parity:
 * - Skill 0 = ~100-400 Elo (complete beginner, makes many mistakes)
 * - Skill 3 = ~600 Elo (novice)
 * - Skill 5 = ~1000 Elo (chess.com Nelson-level)
 * - Skill 10 = ~1500 Elo (club player)
 * - Skill 15 = ~2000 Elo (expert)
 * - Skill 20 = ~2850+ Elo (super GM)
 */
function eloToSkillLevel(elo: number): number {
    if (elo <= 100) return 0;
    if (elo >= 2850) return 20;

    // Linear mapping: 100 ELO = skill 0, 2850 ELO = skill 20
    // This gives approximately 137 Elo per skill level
    const skill = Math.floor((elo - 100) / 137.5);
    return Math.max(0, Math.min(20, skill));
}

/**
 * Get move time in milliseconds based on ELO
 * Lower ELO = faster response (beginner opponents shouldn't make you wait)
 * Higher ELO = more thinking time for stronger play
 * @param elo - Player ELO rating
 * @param fastMode - If true, use reduced thinking time (for AI vs AI mode)
 */
function getMoveTime(elo: number, fastMode: boolean = false): number {
    // In fast mode (AI vs AI), use reduced but still reasonable thinking time
    if (fastMode) {
        if (elo < 600) return 200;    // Very weak: 200ms (instant feel)
        if (elo < 1000) return 300;   // Beginner: 300ms
        if (elo < 1500) return 500;   // Intermediate: 500ms
        if (elo < 2000) return 800;   // Advanced: 800ms
        return 1200;                  // Master+: 1.2s
    }

    // Normal mode (player vs AI) - give humans time to process
    if (elo < 600) return 300;    // Very weak: 0.3s (feels responsive)
    if (elo < 1000) return 500;   // Beginner: 0.5s
    if (elo < 1500) return 1000;  // Intermediate: 1s
    if (elo < 2000) return 1500;  // Advanced: 1.5s
    return 2500;                  // Master+: 2.5s
}

// =============================================================================
// STOCKFISH ENGINE CLASS
// =============================================================================

export class StockfishEngine {
    private worker: Worker | null = null;
    private isReady = false;
    private messageQueue: string[] = [];
    private resolveMap = new Map<string, (value: any) => void>();
    private currentMoveResolver: ((move: Move | null) => void) | null = null;
    private initFailed = false;

    constructor() {
        this.initWorker();
    }

    /**
     * Initialize Stockfish Web Worker
     * Loads from CDN to avoid WASM MIME type issues with Vite
     */
    private initWorker(): void {
        try {
            console.log('[Stockfish] Initializing from local file...');

            // Load Stockfish from public folder (copied from node_modules)
            // This avoids CORS issues with CDN loading
            const workerUrl = '/stockfish.js';

            this.worker = new Worker(workerUrl);

            this.worker.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.worker.onerror = (error) => {
                console.error('[Stockfish] Worker error:', error);
                this.isReady = false;
                this.initFailed = true;
            };

            // Initialize UCI protocol
            this.sendCommand('uci');

            console.log('[Stockfish] Worker created, waiting for UCI ready...');
        } catch (e) {
            console.error('[Stockfish] Failed to initialize worker:', e);
            console.warn('[Stockfish] AI will use fallback custom engine');
            this.isReady = false;
            this.initFailed = true;
        }
    }

    /**
     * Handle messages from Stockfish worker
     */
    private handleMessage(message: string): void {
        console.log('[Stockfish] <<<', message);

        if (message === 'uciok') {
            this.isReady = true;
            this.sendCommand('isready');
            console.log('[Stockfish] UCI protocol ready');
        } else if (message === 'readyok') {
            // Process any queued messages
            this.processQueue();
        } else if (message.startsWith('bestmove')) {
            // Extract best move from response
            // Format: "bestmove e2e4" or "bestmove e7e8q" (promotion)
            const parts = message.split(' ');
            const uciMove = parts[1];

            if (this.currentMoveResolver) {
                const move = this.uciToMove(uciMove);
                this.currentMoveResolver(move);
                this.currentMoveResolver = null;
            }
        }
    }

    /**
     * Send command to Stockfish
     */
    private sendCommand(command: string): void {
        console.log('[Stockfish] >>>', command);
        if (this.worker) {
            this.worker.postMessage(command);
        }
    }

    /**
     * Process queued commands
     */
    private processQueue(): void {
        while (this.messageQueue.length > 0 && this.isReady) {
            const command = this.messageQueue.shift();
            if (command) {
                this.sendCommand(command);
            }
        }
    }

    /**
     * Convert UCI move notation to our Move format
     * UCI format: "e2e4", "e7e8q" (with promotion)
     */
    private uciToMove(uci: string): Move | null {
        if (!uci || uci.length < 4) {
            console.error('[Stockfish] Invalid UCI move:', uci);
            return null;
        }

        try {
            // Parse UCI notation
            const fromFile = uci.charCodeAt(0) - 97; // 'a' = 0
            const fromRank = 8 - parseInt(uci[1]);    // '1' = 7, '8' = 0
            const toFile = uci.charCodeAt(2) - 97;
            const toRank = 8 - parseInt(uci[3]);

            // Check for promotion (5th character)
            const promotion = uci.length === 5 ? uci[4].toUpperCase() as PieceType : undefined;

            // We don't have the piece info here, so we'll need to get it from the board
            // This is a simplified version - the game controller will fill in the piece
            const move: Move = {
                from: { row: fromRank, col: fromFile },
                to: { row: toRank, col: toFile },
                piece: { type: 'P', color: 'white' }, // Placeholder, will be filled by controller
                promotion
            };

            return move;
        } catch (e) {
            console.error('[Stockfish] Failed to parse UCI move:', uci, e);
            return null;
        }
    }

    /**
     * Get best move for a position
     * @param fen - Position in FEN notation
     * @param elo - Player's ELO rating (determines skill level)
     * @param timeout - Max thinking time in milliseconds
     * @param fastMode - If true, use reduced thinking time (for AI vs AI mode)
     * @returns Promise that resolves to the best move
     */
    async getBestMove(
        fen: string,
        elo: number,
        timeout: number = 3000,
        fastMode: boolean = false
    ): Promise<Move | null> {
        if (!this.isReady) {
            console.warn('[Stockfish] Engine not ready, waiting...');
            // Wait up to 2 seconds for engine to be ready
            await this.waitForReady(2000);

            if (!this.isReady) {
                console.error('[Stockfish] Engine failed to initialize');
                return null;
            }
        }

        const skillLevel = eloToSkillLevel(elo);
        const moveTime = getMoveTime(elo, fastMode);

        console.log(`[Stockfish] Requesting move: ELO ${elo} → Skill ${skillLevel}, Time ${moveTime}ms, FastMode: ${fastMode}`);

        return new Promise((resolve) => {
            // Set up timeout fallback
            const timeoutId = setTimeout(() => {
                console.error('[Stockfish] Move request timed out');
                resolve(null);
                this.currentMoveResolver = null;
            }, timeout);

            // Store resolver
            this.currentMoveResolver = (move) => {
                clearTimeout(timeoutId);
                resolve(move);
            };

            // Send UCI commands
            this.sendCommand('ucinewgame');
            this.sendCommand(`setoption name Skill Level value ${skillLevel}`);
            this.sendCommand(`position fen ${fen}`);
            this.sendCommand(`go movetime ${moveTime}`);
        });
    }

    /**
     * Wait for engine to be ready
     */
    private async waitForReady(timeout: number): Promise<boolean> {
        const startTime = Date.now();
        while (!this.isReady && Date.now() - startTime < timeout) {
            await new Promise(r => setTimeout(r, 100));
        }
        return this.isReady;
    }

    /**
     * Stop current search and discard any pending result.
     * Resolves the outstanding promise with null so a stale bestmove
     * response from the worker can't confuse a future request.
     */
    stop(): void {
        if (this.currentMoveResolver) {
            this.currentMoveResolver(null);
            this.currentMoveResolver = null;
        }
        this.sendCommand('stop');
    }

    /**
     * Terminate worker and clean up
     */
    dispose(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isReady = false;
            console.log('[Stockfish] Engine disposed');
        }
    }
}

// Singleton instance
export const stockfishEngine = new StockfishEngine();

// Export helper function for external use
export { eloToSkillLevel };
