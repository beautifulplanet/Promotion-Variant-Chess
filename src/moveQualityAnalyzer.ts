// src/moveQualityAnalyzer.ts
// Rates each player move by comparing position eval before and after.
// Uses simple, intuitive labels instead of chess jargon.

import { engine, type Move } from './engineProvider';

export type MoveQuality = 'great' | 'good' | 'decent' | 'poor' | 'blunder' | null;

// Eval snapshot taken BEFORE the player moves
let preMoveEngineEval: number | null = null;
let lastMoveQuality: MoveQuality = null;

/**
 * Call BEFORE the player moves — snapshots the current position eval.
 * This is instant (no search), so it won't block the UI.
 */
export function capturePreMoveAnalysis(_depth: number = 3): void {
    try {
        preMoveEngineEval = engine.evaluate();
        console.log('[MoveQuality] Pre-move eval:', preMoveEngineEval);
    } catch (e) {
        console.error('[MoveQuality] Failed to capture pre-move eval:', e);
        preMoveEngineEval = null;
    }
}

/**
 * Call AFTER the player moves — compares pre/post eval to rate the move.
 *
 * Categories (by centipawn loss from the player's perspective):
 *   great  — lost < 10 cp  (basically the best move available)
 *   good   — lost < 40 cp  (solid, keep it up)
 *   decent — lost < 100 cp (fine, no big deal)
 *   poor   — lost < 200 cp (you're leaking advantage)
 *   blunder — lost ≥ 200 cp (big mistake)
 */
export function analyzePlayerMove(_playerMove: Move): MoveQuality {
    if (preMoveEngineEval === null) {
        console.log('[MoveQuality] No pre-move eval available');
        lastMoveQuality = null;
        return null;
    }

    const postMoveEval = engine.evaluate();
    const isPlayerWhite = engine.turn() === 'black'; // After move it's opponent's turn

    // Positive evalDiff = position got worse for the player
    const evalDiff = isPlayerWhite
        ? preMoveEngineEval - postMoveEval
        : postMoveEval - preMoveEngineEval;

    console.log('[MoveQuality] Eval diff:', evalDiff, 'cp');

    // Simple, honest classification
    if (evalDiff < 10) {
        lastMoveQuality = 'great';
    } else if (evalDiff < 40) {
        lastMoveQuality = 'good';
    } else if (evalDiff < 100) {
        lastMoveQuality = 'decent';
    } else if (evalDiff < 200) {
        lastMoveQuality = 'poor';
    } else {
        lastMoveQuality = 'blunder';
    }

    console.log('[MoveQuality] Classified as:', lastMoveQuality);
    return lastMoveQuality;
}

/** Get the quality of the last analyzed move */
export function getLastMoveQuality(): MoveQuality {
    return lastMoveQuality;
}

/** Convert a move to algebraic notation for display */
export function moveToAlgebraic(move: Move): string {
    const files = 'abcdefgh';
    const ranks = '87654321';
    const from = files[move.from.col] + ranks[move.from.row];
    const to = files[move.to.col] + ranks[move.to.row];
    const piece = move.piece?.type?.toUpperCase() || '';
    const pieceSymbol = piece === 'P' ? '' : piece;
    return pieceSymbol + from + '-' + to;
}

/** Reset move quality tracking (call on new game) */
export function resetMoveQualityTracking(): void {
    preMoveEngineEval = null;
    lastMoveQuality = null;
}

/** Get emoji and colour for move quality display */
export function getMoveQualityDisplay(quality: MoveQuality): { emoji: string; color: string; label: string } | null {
    switch (quality) {
        case 'great':
            return { emoji: '✨', color: '#4CAF50', label: 'Great!' };
        case 'good':
            return { emoji: '✅', color: '#8BC34A', label: 'Good Move' };
        case 'decent':
            return { emoji: '👍', color: '#FFC107', label: 'Decent' };
        case 'poor':
            return { emoji: '⚠️', color: '#FF9800', label: 'Poor Move' };
        case 'blunder':
            return { emoji: '❌', color: '#f44336', label: 'Blunder!' };
        default:
            return null;
    }
}
