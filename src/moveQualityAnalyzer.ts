// src/moveQualityAnalyzer.ts
// Analyzes move quality by comparing player's move to engine's best move

import { engine, type Move } from './chessEngine';

export type MoveQuality = 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | null;

// Store the engine's best move BEFORE the player moves
let preMoveEngineEval: number | null = null;
let preMoveEngineBestMove: Move | null = null;
let lastMoveQuality: MoveQuality = null;
let lastBestMove: Move | null = null;  // Store what the best move WAS for display

/**
 * Call BEFORE the player moves - captures current evaluation for comparison
 * NOTE: Does NOT call getBestMove() as that would block the UI
 */
export function capturePreMoveAnalysis(_depth: number = 3): void {
    try {
        // Only capture the current evaluation - this is instant and non-blocking
        preMoveEngineEval = engine.evaluate();
        
        // Don't call getBestMove() - it's synchronous and freezes the UI
        // We'll detect brilliant/best moves based on eval change only
        preMoveEngineBestMove = null;

        console.log('[MoveQuality] Captured pre-move eval:', preMoveEngineEval);
    } catch (e) {
        console.error('[MoveQuality] Failed to capture pre-move analysis:', e);
        preMoveEngineEval = null;
        preMoveEngineBestMove = null;
    }
}

/**
 * Call AFTER the player moves - uses eval difference to classify move quality
 */
export function analyzePlayerMove(_playerMove: Move): MoveQuality {
    // Need pre-move eval to compare
    if (preMoveEngineEval === null) {
        console.log('[MoveQuality] No pre-move eval available');
        lastMoveQuality = null;
        lastBestMove = null;
        return null;
    }

    // Get post-move evaluation to measure how the position changed
    const postMoveEval = engine.evaluate();
    const isPlayerWhite = engine.turn() === 'black'; // After move, it's opponent's turn

    // Calculate eval difference from player's perspective
    // Positive diff means the position got worse for the player
    let evalDiff = 0;
    if (isPlayerWhite) {
        // Player is white - positive pre-move eval is good, so higher post-move = better
        evalDiff = preMoveEngineEval - postMoveEval;
    } else {
        // Player is black - negative pre-move eval is good, so lower post-move = better
        evalDiff = postMoveEval - preMoveEngineEval;
    }

    console.log('[MoveQuality] Eval diff:', evalDiff, 'cp');

    // No best move tracking (would freeze UI)
    lastBestMove = null;

    // Classify move quality based on centipawn loss
    if (evalDiff < -50) {
        // Move actually IMPROVED position significantly beyond expectation = brilliant
        // This catches sacrifices and unexpected tactical shots
        lastMoveQuality = 'brilliant';
    } else if (evalDiff < 10) {
        // Essentially equal to best move
        lastMoveQuality = 'best';
    } else if (evalDiff < 30) {
        lastMoveQuality = 'good';
    } else if (evalDiff < 80) {
        lastMoveQuality = 'inaccuracy';
    } else if (evalDiff < 200) {
        lastMoveQuality = 'mistake';
    } else {
        lastMoveQuality = 'blunder';
    }

    console.log('[MoveQuality] Move classified as:', lastMoveQuality);
    return lastMoveQuality;
}

/**
 * Get the quality of the last analyzed move
 */
export function getLastMoveQuality(): MoveQuality {
    return lastMoveQuality;
}

/**
 * Get the best move from the last analysis (null if player found it)
 */
export function getLastBestMove(): Move | null {
    return lastBestMove;
}

/**
 * Convert a move to algebraic notation for display
 */
export function moveToAlgebraic(move: Move): string {
    const files = 'abcdefgh';
    const ranks = '87654321';
    const from = files[move.from.col] + ranks[move.from.row];
    const to = files[move.to.col] + ranks[move.to.row];
    const piece = move.piece?.type?.toUpperCase() || '';
    const pieceSymbol = piece === 'P' ? '' : piece;
    return pieceSymbol + from + '-' + to;
}

/**
 * Reset move quality tracking (call on new game)
 */
export function resetMoveQualityTracking(): void {
    preMoveEngineEval = null;
    preMoveEngineBestMove = null;
    lastMoveQuality = null;
    lastBestMove = null;
}

/**
 * Get emoji and color for move quality display
 */
export function getMoveQualityDisplay(quality: MoveQuality): { emoji: string; color: string; label: string } | null {
    switch (quality) {
        case 'brilliant':
            return { emoji: '💎', color: '#00ffff', label: 'Brilliant!' };
        case 'best':
            return { emoji: '⭐', color: '#ffd700', label: 'Best Move!' };
        case 'good':
            return { emoji: '✓', color: '#4CAF50', label: 'Good' };
        case 'inaccuracy':
            return { emoji: '?!', color: '#FFC107', label: 'Inaccuracy' };
        case 'mistake':
            return { emoji: '?', color: '#FF9800', label: 'Mistake' };
        case 'blunder':
            return { emoji: '??', color: '#f44336', label: 'Blunder' };
        default:
            return null;
    }
}
