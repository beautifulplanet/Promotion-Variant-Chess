/**
 * Sideways Chess - Main Entry Point (Refactored)
 * 
 * Clean architecture:
 * - constants.ts    → All config values
 * - gameController.ts → Game logic (no rendering)
 * - renderer2d.ts   → Canvas rendering (no game logic)
 * - main.ts         → Wiring only
 * 
 * To switch to 3D: Replace renderer2d with renderer3d, no other changes needed!
 */

import * as Game from './gameController';
import * as Renderer from './renderer2d';
import { getLevelForElo, getLevelProgress } from './levelSystem';
import { TIMING, COLORS } from './constants';

// =============================================================================
// DOM SETUP
// =============================================================================

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}

// Sidebar DOM elements (may be null if HTML doesn't include them)
const eloElem = document.getElementById('elo');
const gamesWonElem = document.getElementById('games-won');
const gamesLostElem = document.getElementById('games-lost');
const gamesPlayedElem = document.getElementById('games-played');
const sidebarTurnElem = document.getElementById('sidebar-turn');
const playerLevelElem = document.getElementById('player-level');
const levelNameElem = document.getElementById('level-name');
const eloProgressElem = document.getElementById('elo-progress') as HTMLElement | null;
const eloMinElem = document.getElementById('elo-min');
const eloMaxElem = document.getElementById('elo-max');
const levelNotificationElem = document.getElementById('level-notification') as HTMLElement | null;

// =============================================================================
// UI UPDATE FUNCTIONS
// =============================================================================

function updateSidebar(state: Game.GameState): void {
  const level = getLevelForElo(state.elo);
  const progress = getLevelProgress(state.elo);
  const turn = Game.getCurrentTurn();
  
  if (eloElem) eloElem.textContent = String(state.elo);
  if (gamesWonElem) gamesWonElem.textContent = String(state.gamesWon);
  if (gamesLostElem) gamesLostElem.textContent = String(state.gamesLost);
  if (gamesPlayedElem) gamesPlayedElem.textContent = String(state.gamesPlayed);
  if (sidebarTurnElem) sidebarTurnElem.textContent = turn.charAt(0).toUpperCase() + turn.slice(1);
  if (playerLevelElem) playerLevelElem.textContent = String(level.level);
  if (levelNameElem) levelNameElem.textContent = level.name;
  if (eloProgressElem) eloProgressElem.style.width = `${progress}%`;
  if (eloMinElem) eloMinElem.textContent = String(level.minElo);
  if (eloMaxElem) eloMaxElem.textContent = String(level.maxElo);
}

function showLevelNotification(levelName: string, isUp: boolean): void {
  if (levelNotificationElem) {
    levelNotificationElem.style.display = 'block';
    levelNotificationElem.style.background = isUp ? COLORS.levelUpBackground : COLORS.levelDownBackground;
    levelNotificationElem.innerHTML = `
      <div style="font-weight:bold;">${isUp ? 'LEVEL UP!' : 'LEVEL DOWN'}</div>
      <div style="font-size:0.9em;">${levelName}</div>
    `;
    setTimeout(() => {
      levelNotificationElem.style.display = 'none';
    }, TIMING.levelNotificationDuration);
  }
}

// =============================================================================
// RENDER LOOP
// =============================================================================

let gameOverMessage: string | null = null;

function renderFrame(): void {
  const state = Game.getState();
  
  // Update renderer with current game state
  Renderer.updateState(
    Game.getBoard(),
    state.selectedSquare,
    state.legalMovesForSelected,
    Game.getCurrentTurn(),
    Game.isInCheck()
  );
  
  // Render the board
  Renderer.render();
  
  // Draw game over overlay if needed
  if (gameOverMessage) {
    Renderer.drawGameOverOverlay(gameOverMessage);
  }
  
  // Update sidebar
  updateSidebar(state);
}

// =============================================================================
// INPUT HANDLING
// =============================================================================

canvas.addEventListener('click', (event: MouseEvent) => {
  const state = Game.getState();
  
  if (state.gameOver) {
    // Start new game
    gameOverMessage = null;
    Game.newGame();
    renderFrame();
  } else {
    // Handle board click
    const boardPos = Renderer.screenToBoard(event.clientX, event.clientY);
    if (boardPos) {
      Game.handleSquareClick(boardPos.row, boardPos.col);
      renderFrame();
    }
  }
});

// =============================================================================
// GAME CALLBACKS
// =============================================================================

Game.registerCallbacks({
  onStateChange: (state) => {
    renderFrame();
  },
  
  onLevelChange: (levelName, isUp) => {
    showLevelNotification(levelName, isUp);
  },
  
  onGameOver: (message) => {
    gameOverMessage = message;
    renderFrame();
  },
  
  onAIThinking: (thinking) => {
    // Could show a "thinking..." indicator here
    if (thinking) {
      canvas.style.cursor = 'wait';
    } else {
      canvas.style.cursor = 'default';
    }
  }
});

// =============================================================================
// STARTUP
// =============================================================================

console.log('[Main] Initializing...');

// Initialize renderer
Renderer.initRenderer(canvas);

// Initialize game
const initialState = Game.initGame();
console.log('[Main] Game ready! ELO:', initialState.elo);

// Initial render
renderFrame();
