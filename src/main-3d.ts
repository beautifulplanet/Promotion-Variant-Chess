/**
 * Sideways Chess - 3D Entry Point
 * 
 * Uses the full 3D renderer with:
 * - Era-based procedural worlds (20 eras from Cretaceous to Type 3 Civilization)
 * - Procedural skybox and dynamic lighting
 * - Wormhole transitions between eras
 * - PBR materials and reflections
 * 
 * Architecture:
 * - gameController.ts → Game logic
 * - renderer3d.ts     → 3D Three.js rendering
 * - main-3d.ts        → Wiring
 */

import * as Game from './gameController';
import * as Renderer from './renderer3d';
import { getLevelForElo, getLevelProgress } from './levelSystem';
import { TIMING, COLORS } from './constants';
import { ARTICLES } from './newspaperArticles';
import type { PieceType } from './types';

// =============================================================================
// DOM SETUP
// =============================================================================

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}

// Sidebar DOM elements
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
const worldNameElem = document.getElementById('world-name');
const fpsElem = document.getElementById('fps');

// Control buttons
const viewModeBtn = document.getElementById('view-mode-btn');
const pieceStyleBtn = document.getElementById('piece-style-btn');
const boardStyleBtn = document.getElementById('board-style-btn');
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const setupBtn = document.getElementById('setup-btn') as HTMLButtonElement;

// Setup Overlay Controls
const setupOverlay = document.getElementById('setup-overlay');
const setupConfirm = document.getElementById('setup-confirm');
const setupCancel = document.getElementById('setup-cancel');
const setupReset = document.getElementById('setup-reset');

// =============================================================================
// NEWSPAPER ARTICLES
// =============================================================================

function loadRandomArticles(): void {
  // Shuffle and pick 6 random articles
  const shuffled = [...ARTICLES].sort(() => Math.random() - 0.5);

  for (let i = 1; i <= 6; i++) {
    const article = shuffled[i - 1];
    const headlineElem = document.getElementById(`article-${i}-headline`);
    const snippetElem = document.getElementById(`article-${i}-snippet`);

    if (headlineElem && snippetElem && article) {
      headlineElem.textContent = article.headline;
      snippetElem.textContent = article.snippet;
    }
  }
}

// Load articles on page load
loadRandomArticles();

// =============================================================================
// UI UPDATE FUNCTIONS
// =============================================================================

// PERFORMANCE: Throttle sidebar updates
let _lastSidebarUpdate = 0;
const SIDEBAR_UPDATE_INTERVAL = 100; // Update every 100ms max

function updateSidebar(state: Game.GameState): void {
  const now = performance.now();
  if (now - _lastSidebarUpdate < SIDEBAR_UPDATE_INTERVAL) {
    return;
  }
  _lastSidebarUpdate = now;

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

  // Update FPS counter
  if (fpsElem) fpsElem.textContent = String(Renderer.getFPS());
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
// STATE SYNC - Keep renderer in sync with game state
// =============================================================================

function syncRendererState(): void {
  const state = Game.getState();

  // Update 3D renderer with current game state
  Renderer.updateState(
    Game.getBoard(),
    state.selectedSquare,
    state.legalMovesForSelected,
    Game.getCurrentTurn(),
    Game.isInCheck()
  );

  // Update ELO-based era system
  Renderer.setElo(state.elo);

  // Update sidebar
  updateSidebar(state);
}

// =============================================================================
// INPUT HANDLING
// =============================================================================

// Handle square selection via raycasting (done inside renderer)
Renderer.onSquareClick((row: number, col: number) => {
  const state = Game.getState();

  if (state.gameOver) {
    // Start new game - refresh articles!
    Game.newGame();
    loadRandomArticles();
    syncRendererState();
  } else {
    Game.handleSquareClick(row, col);
    syncRendererState();
  }
});

// View mode toggle
if (viewModeBtn) {
  viewModeBtn.addEventListener('click', () => {
    Renderer.toggleViewMode();
    const mode = Renderer.getViewMode();
    viewModeBtn.textContent = mode === 'pan' ? '🎥 Pan Mode' : '🎯 Play Mode';
  });
}

// Piece style cycling
if (pieceStyleBtn) {
  pieceStyleBtn.addEventListener('click', () => {
    Renderer.cyclePieceStyle();
    pieceStyleBtn.textContent = `♟️ ${Renderer.getPieceStyle()}`;
  });
}

// Board style cycling
if (boardStyleBtn) {
  boardStyleBtn.addEventListener('click', () => {
    Renderer.cycleBoardStyle();
    boardStyleBtn.textContent = `🏁 ${Renderer.getBoardStyle()}`;
  });
}

// Save/Load buttons
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    Game.saveProgress();
  });
}

if (loadBtn) {
  loadBtn.addEventListener('click', async () => {
    await Game.loadProgress();
    syncRendererState();
  });
}


// Debug menu logic
const debugMenu = document.getElementById('debug-menu');
const debugWinBtn = document.getElementById('debug-win-btn');
const debugEloInput = document.getElementById('debug-elo-input') as HTMLInputElement | null;
const debugEloBtn = document.getElementById('debug-elo-btn');
const debugEnvToggle = document.getElementById('debug-env-toggle') as HTMLInputElement | null;
const debugParticlesToggle = document.getElementById('debug-particles-toggle') as HTMLInputElement | null;
const debugSkyboxToggle = document.getElementById('debug-skybox-toggle') as HTMLInputElement | null;
const debugLightingToggle = document.getElementById('debug-lighting-toggle') as HTMLInputElement | null;
const debugShadowsToggle = document.getElementById('debug-shadows-toggle') as HTMLInputElement | null;
const debugAnimToggle = document.getElementById('debug-anim-toggle') as HTMLInputElement | null;
const debugWormholeToggle = document.getElementById('debug-wormhole-toggle') as HTMLInputElement | null;
const debugRenderScale = document.getElementById('debug-render-scale') as HTMLInputElement | null;
const debugMotionToggle = document.getElementById('debug-motion-toggle') as HTMLInputElement | null;
const debugAutoFps = document.getElementById('debug-auto-fps') as HTMLInputElement | null;
const debugTargetFps = document.getElementById('debug-target-fps') as HTMLInputElement | null;
const debugFixedStep = document.getElementById('debug-fixed-step') as HTMLInputElement | null;
const debugFixedFps = document.getElementById('debug-fixed-fps') as HTMLInputElement | null;
const debugAnimQuality = document.getElementById('debug-anim-quality') as HTMLInputElement | null;
const debugTravelSpeed = document.getElementById('debug-travel-speed') as HTMLInputElement | null;
const debugAssetDensity = document.getElementById('debug-asset-density') as HTMLInputElement | null;
const debugParticleDensity = document.getElementById('debug-particle-density') as HTMLInputElement | null;

function toggleDebugMenu() {
  if (debugMenu) {
    debugMenu.style.display = debugMenu.style.display === 'none' ? 'flex' : 'none';
  }
}

// Keyboard shortcut: Shift+D to toggle debug menu
document.addEventListener('keydown', (event) => {
  if (event.shiftKey && event.key.toLowerCase() === 'd') {
    toggleDebugMenu();
  }
});

if (debugWinBtn) {
  debugWinBtn.addEventListener('click', () => {
    console.log('[Debug] Win button clicked!');
    Game.debugForceWin();
    syncRendererState();
  });
}

if (debugEloBtn && debugEloInput) {
  debugEloBtn.addEventListener('click', () => {
    const val = parseInt(debugEloInput.value, 10);
    if (!isNaN(val)) {
      Game.setPlayerElo(val);
      // Auto-start new game to apply AI bonus pieces at new ELO
      Game.newGame();
      loadRandomArticles();
      // Force immediate UI update by resetting the throttle
      _lastSidebarUpdate = 0;
      syncRendererState();
      debugEloInput.value = '';
      console.log('[Debug] Set ELO to', val, 'and started new game');
    }
  });
}

function applyDebugToggles(): void {
  if (debugEnvToggle) Renderer.setEnvironmentEnabled(debugEnvToggle.checked);
  if (debugParticlesToggle) Renderer.setParticlesEnabled(debugParticlesToggle.checked);
  if (debugSkyboxToggle) Renderer.setSkyboxEnabled(debugSkyboxToggle.checked);
  if (debugLightingToggle) Renderer.setLightingEnabled(debugLightingToggle.checked);
  if (debugShadowsToggle) Renderer.setShadowsEnabled(debugShadowsToggle.checked);
  if (debugAnimToggle) Renderer.setEnvironmentAnimationEnabled(debugAnimToggle.checked);
  if (debugWormholeToggle) Renderer.setWormholeEnabled(debugWormholeToggle.checked);
}

[debugEnvToggle, debugParticlesToggle, debugSkyboxToggle, debugLightingToggle, debugShadowsToggle, debugAnimToggle, debugWormholeToggle]
  .forEach((toggle) => {
    if (toggle) {
      toggle.addEventListener('change', applyDebugToggles);
    }
  });

if (debugMotionToggle) {
  debugMotionToggle.addEventListener('change', () => {
    Renderer.setMotionScale(debugMotionToggle.checked ? 0.2 : 1);
  });
}

if (debugRenderScale) {
  debugRenderScale.addEventListener('input', () => {
    const scale = parseFloat(debugRenderScale.value);
    if (!isNaN(scale)) {
      Renderer.setRenderScale(scale);
    }
  });
}

if (debugAutoFps) {
  debugAutoFps.addEventListener('change', () => {
    Renderer.setAutoFpsEnabled(debugAutoFps.checked);
  });
}

if (debugTargetFps) {
  debugTargetFps.addEventListener('change', () => {
    const target = parseInt(debugTargetFps.value, 10);
    if (!isNaN(target)) {
      Renderer.setTargetFps(target);
    }
  });
}

if (debugFixedStep) {
  debugFixedStep.addEventListener('change', () => {
    Renderer.setFixedTimestepEnabled(debugFixedStep.checked);
  });
}

if (debugFixedFps) {
  debugFixedFps.addEventListener('change', () => {
    const fps = parseInt(debugFixedFps.value, 10);
    if (!isNaN(fps)) {
      Renderer.setFixedFps(fps);
    }
  });
}

if (debugAnimQuality) {
  debugAnimQuality.addEventListener('input', () => {
    const q = parseInt(debugAnimQuality.value, 10);
    if (!isNaN(q)) {
      Renderer.setAnimQuality(q);
    }
  });
}

if (debugTravelSpeed) {
  debugTravelSpeed.addEventListener('input', () => {
    const scale = parseFloat(debugTravelSpeed.value);
    if (!isNaN(scale)) {
      Renderer.setTravelSpeedScale(scale);
    }
  });
}

if (debugAssetDensity) {
  debugAssetDensity.addEventListener('input', () => {
    const scale = parseFloat(debugAssetDensity.value);
    if (!isNaN(scale)) {
      Renderer.setAssetDensityScale(scale);
    }
  });
}

if (debugParticleDensity) {
  debugParticleDensity.addEventListener('input', () => {
    const scale = parseFloat(debugParticleDensity.value);
    if (!isNaN(scale)) {
      Renderer.setParticleDensityScale(scale);
    }
  });
}

// Apply initial debug toggle state
applyDebugToggles();

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
  switch (event.key.toLowerCase()) {
    case 'v':
      Renderer.toggleViewMode();
      break;
    case 'c':
      Renderer.toggleCameraView();
      break;
    case 'n':
      Game.newGame();
      loadRandomArticles();
      syncRendererState();
      break;
  }
});

// =============================================================================
// SETUP MODE - Rearrange pieces before game
// =============================================================================

const setupBoard = document.getElementById('setup-board');
const bonusCountElem = document.getElementById('bonus-count');

console.log('[Setup] Elements found:', {
  setupBtn: !!setupBtn,
  setupOverlay: !!setupOverlay,
  setupBoard: !!setupBoard
});

// Track current setup arrangement
let setupArrangement: Array<{ row: number, col: number, type: string, symbol: string }> = [];
let selectedSetupSquare: number | null = null;

const PIECE_SYMBOLS: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙'
};

function openSetupMode(): void {
  console.log('[Setup] Opening setup mode...');
  if (!setupOverlay || !setupBoard) {
    console.error('[Setup] Missing elements!', { setupOverlay: !!setupOverlay, setupBoard: !!setupBoard });
    return;
  }

  // Get current board state (white's back two ranks: rows 6-7)
  const board = Game.getBoardForRearrangement();
  const bonusPieces = Game.getPromotedPieces();

  console.log('[Setup] Board retrieved, bonus pieces:', bonusPieces.length);

  if (bonusCountElem) {
    bonusCountElem.textContent = String(bonusPieces.length);
  }

  // Build setup arrangement from current board (rows 6-7 for white)
  setupArrangement = [];
  for (let row = 6; row <= 7; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === 'white') {
        setupArrangement.push({
          row,
          col,
          type: piece.type.toUpperCase(),
          symbol: PIECE_SYMBOLS[piece.type.toUpperCase()] || '?'
        });
      }
    }
  }

  renderSetupBoard();
  setupOverlay.style.display = 'flex';
}

function renderSetupBoard(): void {
  if (!setupBoard) return;

  setupBoard.innerHTML = '';

  // Show rows 6 and 7 (white's starting area)
  for (let row = 6; row <= 7; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement('div');
      square.className = 'setup-square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');

      // Find piece at this position
      const pieceHere = setupArrangement.find(p => p.row === row && p.col === col);
      if (pieceHere) {
        square.textContent = pieceHere.symbol;
      }

      const idx = (row - 6) * 8 + col;
      if (selectedSetupSquare === idx) {
        square.classList.add('selected');
      }

      square.addEventListener('click', () => handleSetupSquareClick(row, col, idx));
      setupBoard.appendChild(square);
    }
  }
}

function handleSetupSquareClick(row: number, col: number, idx: number): void {
  const clickedPiece = setupArrangement.find(p => p.row === row && p.col === col);

  if (selectedSetupSquare === null) {
    // Select a piece (including King - user can move any piece)
    if (clickedPiece) {
      selectedSetupSquare = idx;
      renderSetupBoard();
    }
  } else {
    // Try to swap/move
    const selectedRow = Math.floor(selectedSetupSquare / 8) + 6;
    const selectedCol = selectedSetupSquare % 8;
    const selectedPiece = setupArrangement.find(p => p.row === selectedRow && p.col === selectedCol);

    if (selectedPiece) {
      // Swap with target (or move to empty)
      if (clickedPiece) {
        // Swap positions (any piece including King)
        clickedPiece.row = selectedRow;
        clickedPiece.col = selectedCol;
      }
      selectedPiece.row = row;
      selectedPiece.col = col;
    }

    selectedSetupSquare = null;
    renderSetupBoard();
  }
}

function closeSetupMode(): void {
  if (setupOverlay) {
    setupOverlay.style.display = 'none';
  }
  selectedSetupSquare = null;
}

function confirmSetup(): void {
  // Convert to game format and apply
  const arrangement = setupArrangement.map(p => ({
    row: p.row,
    col: p.col,
    type: p.type.toUpperCase() as any
  }));

  // Validate that a King exists
  const hasKing = arrangement.some(p => p.type === 'K');
  if (!hasKing) {
    alert('You must place a King to start the game!');
    return;
  }

  // ALLOW PAWNS ANYWHERE (User Request)
  // Validation for back-rank pawns is removed because we now use engine.loadCustomBoard()
  // which bypasses FEN strictness for custom setups.

  Game.setCustomArrangement(arrangement);
  Game.newGame();
  loadRandomArticles();
  syncRendererState();
  closeSetupMode();
}

function resetSetup(): void {
  // Clear custom arrangement and rebuild from default
  Game.setCustomArrangement([]);
  openSetupMode(); // Re-open to show default
}

// Setup mode event listeners
function updateSetupButton() {
  if (!setupBtn) return;
  const state = Game.getState();
  // Only enable if game has not started (no moves made) OR game is over (for next game setup)
  const movesMade = Renderer.getMoveCount ? Renderer.getMoveCount() : 0;
  if (!state.gameOver && movesMade > 0) {
    // Game in progress with moves made - disable setup
    setupBtn.disabled = true;
    setupBtn.style.opacity = '0.5';
    setupBtn.title = 'Setup only available before first move';
  } else {
    // Either no moves yet OR game is over (can setup for next game)
    setupBtn.disabled = false;
    setupBtn.style.opacity = '1';
    setupBtn.title = '';
  }
}

if (setupBtn) {
  setupBtn.addEventListener('click', () => {
    // Only allow if enabled
    if (!setupBtn.disabled) {
      console.log('[Setup] Button clicked!');
      openSetupMode();
    }
  });
  updateSetupButton();
  console.log('[Setup] Button listener attached');
} else {
  console.error('[Setup] Setup button not found!');
}
if (setupConfirm) {
  setupConfirm.addEventListener('click', confirmSetup);
}
if (setupCancel) {
  setupCancel.addEventListener('click', closeSetupMode);
}
if (setupReset) {
  setupReset.addEventListener('click', resetSetup);
}

// =============================================================================
// GAME CALLBACKS
// =============================================================================

Game.registerCallbacks({
  onStateChange: (state) => {
    syncRendererState();
    updateSetupButton();
  },

  onLevelChange: (levelName, isUp) => {
    showLevelNotification(levelName, isUp);
  },

  onGameOver: (message) => {
    Renderer.showGameOverOverlay(message);
  },

  onAIThinking: (thinking) => {
    if (thinking) {
      canvas.style.cursor = 'wait';
    } else {
      canvas.style.cursor = 'default';
    }
  },

  onWinAnimation: () => {
    return Renderer.playWinAnimation();
  },

  onPlayerWin: () => {
    // Refresh newspaper articles with new random selection on each win
    console.log('[Main] Player won! Refreshing newspaper articles...');
    loadRandomArticles();
  }
});

// Era/World change callback
Renderer.onWorldChange((eraName) => {
  if (worldNameElem) {
    worldNameElem.textContent = eraName;
  }
  console.log('[Main] World changed to:', eraName);
});

// =============================================================================
// STARTUP
// =============================================================================

console.log('[Main-3D] Initializing 3D Sideways Chess...');

// Initialize 3D renderer first
Renderer.initRenderer(canvas);
console.log('[Main-3D] 3D Renderer initialized');

// Apply debug toggles now that renderer is ready
applyDebugToggles();
if (debugRenderScale) {
  const scale = parseFloat(debugRenderScale.value);
  if (!isNaN(scale)) {
    Renderer.setRenderScale(scale);
  }
}
if (debugMotionToggle) {
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  debugMotionToggle.checked = prefersReducedMotion;
  Renderer.setMotionScale(prefersReducedMotion ? 0.2 : 1);
}
if (debugAutoFps) {
  Renderer.setAutoFpsEnabled(debugAutoFps.checked);
}
if (debugTargetFps) {
  const target = parseInt(debugTargetFps.value, 10);
  if (!isNaN(target)) {
    Renderer.setTargetFps(target);
  }
}
if (debugFixedStep) {
  Renderer.setFixedTimestepEnabled(debugFixedStep.checked);
}
if (debugFixedFps) {
  const fps = parseInt(debugFixedFps.value, 10);
  if (!isNaN(fps)) {
    Renderer.setFixedFps(fps);
  }
}
if (debugAnimQuality) {
  const q = parseInt(debugAnimQuality.value, 10);
  if (!isNaN(q)) {
    Renderer.setAnimQuality(q);
  }
}
if (debugTravelSpeed) {
  const scale = parseFloat(debugTravelSpeed.value);
  if (!isNaN(scale)) {
    Renderer.setTravelSpeedScale(scale);
  }
}
if (debugAssetDensity) {
  const scale = parseFloat(debugAssetDensity.value);
  if (!isNaN(scale)) {
    Renderer.setAssetDensityScale(scale);
  }
}
if (debugParticleDensity) {
  const scale = parseFloat(debugParticleDensity.value);
  if (!isNaN(scale)) {
    Renderer.setParticleDensityScale(scale);
  }
}

// Initialize game
const initialState = Game.initGame();
console.log('[Main-3D] Game ready! ELO:', initialState.elo);

// Initial sync
syncRendererState();

console.log('[Main-3D] Current Era:', Renderer.getCurrentWorldName());
console.log('[Main-3D] Ready to play!');
