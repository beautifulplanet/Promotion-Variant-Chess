// src/moveListUI.ts
// Move List Panel and Game Timer UI Controller
// Updates the move history display (via Overlay) and game clock
// OPTIMIZED: Uses canvas overlay for move list to prevent DOM thrashing

import { engine } from './engineProvider';
import * as Overlay from './overlayRenderer';

// =============================================================================
// STATE
// =============================================================================

let gameStartTime: number | null = null;
let lastMoveTime: number = 0;
let whiteTimeMs = 0;
let blackTimeMs = 0;
let timerInterval: number | null = null;
let currentTurn: 'white' | 'black' = 'white';
let lastMoveCount = 0;

// PERFORMANCE: Throttle updates
let lastRefreshTime = 0;
const REFRESH_THROTTLE_MS = 200; // Only refresh every 200ms max

// PERFORMANCE: Cache DOM elements (for timer only)
let cachedElements: {
    whiteTime?: HTMLElement | null;
    blackTime?: HTMLElement | null;
    totalTime?: HTMLElement | null;
    moveCount?: HTMLElement | null;
} = {};

function getCachedElement(id: string): HTMLElement | null {
    const key = id.replace(/-/g, '') as keyof typeof cachedElements;
    if (cachedElements[key] === undefined) {
        cachedElements[key] = document.getElementById(id);
    }
    return cachedElements[key] || null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format milliseconds to MM:SS or H:MM:SS
 */
function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// =============================================================================
// TIMER FUNCTIONS
// =============================================================================

/**
 * Start the game timer
 */
export function startGameTimer(): void {
    if (gameStartTime !== null) return; // Already started

    gameStartTime = Date.now();
    lastMoveTime = gameStartTime;
    whiteTimeMs = 0;
    blackTimeMs = 0;
    currentTurn = 'white';

    // Clear any existing interval
    if (timerInterval !== null) {
        clearInterval(timerInterval);
    }

    // PERFORMANCE: Update timer every 500ms
    timerInterval = window.setInterval(updateTimerDisplay, 500);

    console.log('[MoveListUI] Game timer started');
}

/**
 * Stop the game timer
 */
export function stopGameTimer(): void {
    if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

/**
 * Reset the game timer
 */
export function resetGameTimer(): void {
    stopGameTimer();
    gameStartTime = null;
    whiteTimeMs = 0;
    blackTimeMs = 0;
    lastMoveCount = 0;
    updateTimerDisplay();

    // Reset overlay
    Overlay.updateMoves([]);

    const moveCountEl = getCachedElement('move-count');
    if (moveCountEl) {
        moveCountEl.textContent = '0';
    }
}

/**
 * Record a move (updates time for the side that moved)
 */
export function recordMove(turn: 'white' | 'black'): void {
    if (gameStartTime === null) {
        startGameTimer();
    }

    const now = Date.now();
    const elapsed = now - lastMoveTime;

    // Add elapsed time to the side that just moved
    if (turn === 'white') {
        whiteTimeMs += elapsed;
    } else {
        blackTimeMs += elapsed;
    }

    // Switch turns
    currentTurn = turn === 'white' ? 'black' : 'white';
    lastMoveTime = now;

    // Force update move list (bypass throttle for actual moves)
    lastRefreshTime = 0;
    const moves = engine.getMoveHistory();
    updateMoveList(moves);
}

/**
 * Update timer display elements
 */
function updateTimerDisplay(): void {
    const whiteTimeEl = getCachedElement('white-time');
    const blackTimeEl = getCachedElement('black-time');
    const totalTimeEl = getCachedElement('total-time');

    // Calculate current times
    let currentWhite = whiteTimeMs;
    let currentBlack = blackTimeMs;

    if (gameStartTime !== null) {
        const elapsed = Date.now() - lastMoveTime;
        if (currentTurn === 'white') {
            currentWhite += elapsed;
        } else {
            currentBlack += elapsed;
        }
    }

    if (whiteTimeEl) whiteTimeEl.textContent = formatTime(currentWhite);
    if (blackTimeEl) blackTimeEl.textContent = formatTime(currentBlack);
    if (totalTimeEl) totalTimeEl.textContent = formatTime(currentWhite + currentBlack);
}

// =============================================================================
// MOVE LIST FUNCTIONS
// =============================================================================

/**
 * Update the move list display - render to canvas overlay
 */
export function updateMoveList(moves: string[]): void {
    // Update canvas overlay
    Overlay.updateMoves(moves);

    // Update move count text in DOM
    const moveCountEl = getCachedElement('move-count');
    if (moveCountEl) {
        moveCountEl.textContent = moves.length.toString();
    }

    lastMoveCount = moves.length;
}

/**
 * Refresh move list from engine - THROTTLED for performance
 */
export function refreshMoveList(): void {
    const now = performance.now();

    // PERFORMANCE: Throttle updates
    if (now - lastRefreshTime < REFRESH_THROTTLE_MS) {
        return;
    }
    lastRefreshTime = now;

    const moves = engine.getMoveHistory();

    // PERFORMANCE: Only update if move count changed
    if (moves.length === lastMoveCount) {
        return;
    }

    updateMoveList(moves);
}

/**
 * Force-refresh move list bypassing throttle and count guards.
 * Used after undo to guarantee the UI reflects the new history.
 */
export function forceRefreshMoveList(): void {
    lastRefreshTime = 0;
    lastMoveCount = -1;
    refreshMoveList();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the move list UI
 */
export function initMoveListUI(): void {
    // Clear cached elements (in case of hot reload)
    cachedElements = {};
    resetGameTimer();
    console.log('[MoveListUI] Initialized (Canvas Overlay Mode)');
}
