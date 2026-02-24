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

// Expose game API for automated playtest agent (e2e tests)
(window as any).__GAME__ = Game;
(window as any).__RENDERER__ = Renderer;
import type { GamePerformanceData } from './gameReactiveArticles';
import * as MoveListUI from './moveListUI';
import * as Sound from './soundSystem';
import * as Stats from './statsSystem';
import * as Theme from './themeSystem';
import * as ClassicMode from './classicMode';
import * as Overlay from './overlayRenderer';
import { getCurrentOpeningName } from './openingBook';
import { getLastMoveQuality, getMoveQualityDisplay } from './moveQualityAnalyzer';
import { initEngine, getEngineType } from './engineProvider';
import { getPieceStyleConfig } from './pieceStyles';
import type { PieceType } from './types';

// Classic mode DOM elements
const cpbTopName = document.getElementById('cpb-top-name');
const cpbTopCaptured = document.getElementById('cpb-top-captured');
const cpbTopClock = document.getElementById('cpb-top-clock');
const cpbBottomName = document.getElementById('cpb-bottom-name');
const cpbBottomCaptured = document.getElementById('cpb-bottom-captured');
const cpbBottomClock = document.getElementById('cpb-bottom-clock');
const classicMovesElem = document.getElementById('classic-moves');

// =============================================================================
// DOM SETUP
// =============================================================================

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
if (!canvas || !overlayCanvas) {
  throw new Error('Canvas elements not found');
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

// Board overlay toast elements
const openingToast = document.getElementById('opening-toast') as HTMLElement | null;
const moveQualityToast = document.getElementById('move-quality-toast') as HTMLElement | null;
let lastShownOpening: string | null = null;
let lastShownQuality: string | null = null;
let openingToastTimer: ReturnType<typeof setTimeout> | null = null;
let qualityToastTimer: ReturnType<typeof setTimeout> | null = null;

function showBoardToast(elem: HTMLElement | null, text: string, timerRef: 'opening' | 'quality', durationMs = 4000): void {
  if (!elem) return;
  elem.classList.remove('fade-out');
  elem.style.display = 'block';
  elem.textContent = text;
  // Clear existing timer
  if (timerRef === 'opening' && openingToastTimer) clearTimeout(openingToastTimer);
  if (timerRef === 'quality' && qualityToastTimer) clearTimeout(qualityToastTimer);
  const tid = setTimeout(() => {
    elem.classList.add('fade-out');
    setTimeout(() => { elem.style.display = 'none'; elem.classList.remove('fade-out'); }, 400);
  }, durationMs);
  if (timerRef === 'opening') openingToastTimer = tid;
  else qualityToastTimer = tid;
}

// Control buttons
const viewModeBtn = document.getElementById('view-mode-btn');
const style3dBtn = document.getElementById('style-3d-btn');
const style2dBtn = document.getElementById('style-2d-btn');
const boardStyleBtn = document.getElementById('board-style-btn');
const flipBtn = document.getElementById('flip-btn');
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const setupBtn = document.getElementById('setup-btn') as HTMLButtonElement;
const startGameBtn = document.getElementById('start-game-btn') as HTMLButtonElement;
const resignBtn = document.getElementById('resign-btn') as HTMLButtonElement;
const watchAiBtn = document.getElementById('watch-ai-btn') as HTMLButtonElement;
const trainAiBtn = document.getElementById('train-ai-btn') as HTMLButtonElement;
const aiSpeedBtn = document.getElementById('ai-speed-btn') as HTMLButtonElement;

// Setup Overlay Controls
const setupOverlay = document.getElementById('setup-overlay');
const setupConfirm = document.getElementById('setup-confirm');
const setupCancel = document.getElementById('setup-cancel');
const setupReset = document.getElementById('setup-reset');

// Promotion Overlay Controls
const promotionOverlay = document.getElementById('promotion-overlay');
const promotionChoices = document.querySelectorAll('.promotion-choice');

// =============================================================================
// PAWN PROMOTION UI
// =============================================================================

function showPromotionUI(isBlackPiece: boolean): void {
  if (!promotionOverlay) return;

  // Update piece symbols based on color
  promotionChoices.forEach(choice => {
    const piece = choice.getAttribute('data-piece');
    const symbols: Record<string, string> = isBlackPiece
      ? { Q: '♛', R: '♜', B: '♝', N: '♞' }
      : { Q: '♕', R: '♖', B: '♗', N: '♘' };

    if (piece && symbols[piece]) {
      choice.textContent = symbols[piece];
    }

    choice.classList.toggle('black-piece', isBlackPiece);
  });

  promotionOverlay.style.display = 'flex';
}

function hidePromotionUI(): void {
  if (promotionOverlay) {
    promotionOverlay.style.display = 'none';
  }
}

// Wire up promotion choice clicks
promotionChoices.forEach(choice => {
  choice.addEventListener('click', () => {
    const piece = choice.getAttribute('data-piece') as 'Q' | 'R' | 'B' | 'N';
    if (piece) {
      Game.completePromotion(piece);
      hidePromotionUI();
      syncRendererState();
    }
  });
});

// =============================================================================
// NEWSPAPER ARTICLES (lazy-loaded — ~230 KB of pure data deferred from initial bundle)
// =============================================================================

// Cache the article data after first lazy load
let _cachedArticles: { headline: string; snippet: string }[] | null = null;

async function getArticles(): Promise<{ headline: string; snippet: string }[]> {
  if (!_cachedArticles) {
    const { ARTICLES } = await import('./newspaperArticles');
    _cachedArticles = ARTICLES;
  }
  return _cachedArticles;
}

async function loadRandomArticles(reactiveArticle?: { headline: string; snippet: string }): Promise<void> {
  // Lazy-load articles on first call
  const articles = await getArticles();
  const shuffled = [...articles].sort(() => Math.random() - 0.5);

  for (let i = 1; i <= 10; i++) {
    // Slot 1 gets the reactive article (if any), rest are random
    const article = (i === 1 && reactiveArticle) ? reactiveArticle : shuffled[i - 1];
    const headlineElem = document.getElementById(`article-${i}-headline`);
    const snippetElem = document.getElementById(`article-${i}-snippet`);

    if (headlineElem && snippetElem && article) {
      headlineElem.textContent = article.headline;
      snippetElem.textContent = article.snippet;
    }
  }
}

// Track last game performance for reactive articles
let lastGamePerformance: GamePerformanceData | null = null;

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

  // Update opening display
  const openingSection = document.getElementById('opening-section');
  const openingNameElem = document.getElementById('opening-name');
  const openingName = getCurrentOpeningName();
  if (openingSection && openingNameElem) {
    if (openingName) {
      openingSection.style.display = 'block';
      openingNameElem.textContent = openingName;
    } else {
      openingSection.style.display = 'none';
    }
  }
  // Board toast for opening name (fires once per new opening detected)
  if (openingName && openingName !== lastShownOpening) {
    lastShownOpening = openingName;
    showBoardToast(openingToast, `📖 ${openingName}`, 'opening', 5000);
  } else if (!openingName) {
    lastShownOpening = null;
  }

  // Update move quality indicator
  const moveQualitySection = document.getElementById('move-quality-section');
  const moveQualityEmoji = document.getElementById('move-quality-emoji');
  const moveQualityLabel = document.getElementById('move-quality-label');
  const lastMoveQuality = getLastMoveQuality();
  const qualityDisplay = getMoveQualityDisplay(lastMoveQuality);
  
  if (moveQualitySection && moveQualityEmoji && moveQualityLabel) {
    if (qualityDisplay) {
      moveQualitySection.style.display = 'block';
      moveQualityEmoji.textContent = qualityDisplay.emoji;
      moveQualityLabel.textContent = qualityDisplay.label;
      moveQualityLabel.style.color = qualityDisplay.color;
    } else {
      moveQualitySection.style.display = 'none';
    }
  }
  // Board toast for move quality (fires once per new quality result)
  const qualityKey = qualityDisplay ? `${qualityDisplay.emoji}${qualityDisplay.label}` : null;
  if (qualityKey && qualityKey !== lastShownQuality) {
    lastShownQuality = qualityKey;
    showBoardToast(moveQualityToast, `${qualityDisplay!.emoji} ${qualityDisplay!.label}`, 'quality', 3500);
  } else if (!qualityKey) {
    lastShownQuality = null;
  }

  // ===== Classic mode: player bars + compact move list =====
  if (ClassicMode.isClassicMode()) {
    const playerColor = state.playerColor || 'white';
    // Board appears flipped when playing black OR when user toggled the flip button
    const colorFlipped = playerColor === 'black';
    const isFlipped = Renderer.isViewFlipped() ? !colorFlipped : colorFlipped;

    // Names
    if (cpbTopName) cpbTopName.textContent = isFlipped ? 'You' : 'Stockfish';
    if (cpbBottomName) cpbBottomName.textContent = isFlipped ? 'Stockfish' : 'You';
    // Avatar king symbols
    const topAvatar = document.querySelector('#classic-player-top .cpb-avatar') as HTMLElement | null;
    const botAvatar = document.querySelector('#classic-player-bottom .cpb-avatar') as HTMLElement | null;
    if (topAvatar) topAvatar.textContent = isFlipped ? '♔' : '♚';
    if (botAvatar) botAvatar.textContent = isFlipped ? '♚' : '♔';

    // Captured pieces
    const captured = Game.getCapturedPieces();
    if (cpbTopCaptured) cpbTopCaptured.textContent = isFlipped ? captured.black.join('') : captured.white.join('');
    if (cpbBottomCaptured) cpbBottomCaptured.textContent = isFlipped ? captured.white.join('') : captured.black.join('');

    // Clocks (read from existing timer elements)
    const wTime = document.getElementById('white-time')?.textContent || '0:00';
    const bTime = document.getElementById('black-time')?.textContent || '0:00';
    if (cpbTopClock) cpbTopClock.textContent = isFlipped ? wTime : bTime;
    if (cpbBottomClock) cpbBottomClock.textContent = isFlipped ? bTime : wTime;

    // Move list (grid: num | white-move | black-move)
    if (classicMovesElem) {
      const moves = Game.getMoveHistoryStrings();
      if (moves.length === 0) {
        classicMovesElem.innerHTML = '<div class="cm-empty">Starting Position</div>';
      } else {
        let html = '<div class="classic-moves-inner">';
        for (let i = 0; i < moves.length; i += 2) {
          const moveNum = Math.floor(i / 2) + 1;
          const isLastWhite = i === moves.length - 1;
          const isLastBlack = i + 1 === moves.length - 1;
          html += `<div class="cm-row">`;
          html += `<span class="cm-num">${moveNum}.</span>`;
          html += `<span class="cm-w${isLastWhite ? ' active' : ''}">${moves[i]}</span>`;
          html += `<span class="cm-b${isLastBlack ? ' active' : ''}">${moves[i + 1] || ''}</span>`;
          html += `</div>`;
        }
        html += '</div>';
        classicMovesElem.innerHTML = html;
        // Auto-scroll to bottom of move list
        classicMovesElem.scrollTop = classicMovesElem.scrollHeight;
      }
    }
  }

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
    Game.isInCheck(),
    state.playerColor
  );

  // Update ELO-based era system
  Renderer.setElo(state.elo);

  // Update sidebar
  updateSidebar(state);

  // Update move list panel (throttled for performance)
  MoveListUI.refreshMoveList();
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
    MoveListUI.resetGameTimer(); // Reset timer for new game
    loadRandomArticles();
    syncRendererState();
    updateStartButton();
  } else {
    Game.handleSquareClick(row, col);
    syncRendererState();
  }
});

// View mode: Pan button removed — right-click/two-finger drag orbits camera
// The old viewModeBtn reference is now unused; setViewMode('play') resets to overhead
if (viewModeBtn) {
  // Repurposed: "Reset Camera" — snaps back to overhead play view
  viewModeBtn.textContent = '📷 Reset';
  viewModeBtn.addEventListener('click', () => {
    Renderer.setViewMode('play');
  });
}

// Piece style cycling - separate 3D and 2D
if (style3dBtn) {
  style3dBtn.addEventListener('click', () => {
    Renderer.cycle3DPieceStyle();
    const newStyle = Renderer.get3DPieceStyle();
    style3dBtn.textContent = `🎨 ${newStyle}`;
    Game.updateStylePreferences(newStyle, undefined, undefined);
  });
}

// --- Style preview toast ---
let stylePreviewTimer: ReturnType<typeof setTimeout> | null = null;

function showStylePreview(styleId: string): void {
  const toast = document.getElementById('style-preview-toast');
  const nameEl = document.getElementById('toast-style-name');
  const descEl = document.getElementById('toast-style-desc');
  const container = document.getElementById('toast-preview-container');
  if (!toast || !nameEl || !descEl || !container) return;

  const config = getPieceStyleConfig(styleId);
  nameEl.textContent = config.name;
  descEl.textContent = config.description;

  // Generate preview canvas
  container.innerHTML = '';
  const previewCanvas = Renderer.generate2DStylePreview(styleId);
  container.appendChild(previewCanvas);

  // Show toast
  toast.classList.remove('fade-out');
  toast.classList.add('visible');

  // Auto-hide after 2s
  if (stylePreviewTimer) clearTimeout(stylePreviewTimer);
  stylePreviewTimer = setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.classList.remove('visible', 'fade-out'), 300);
  }, 2000);
}

if (style2dBtn) {
  style2dBtn.addEventListener('click', () => {
    Renderer.cycle2DPieceStyle();
    const newStyle = Renderer.get2DPieceStyle();
    style2dBtn.textContent = `🖼️ ${newStyle}`;
    Game.updateStylePreferences(undefined, newStyle, undefined);
    showStylePreview(Renderer.get2DPieceStyle());
  });
}

// Board style cycling
if (boardStyleBtn) {
  boardStyleBtn.addEventListener('click', () => {
    Renderer.cycleBoardStyle();
    const newStyle = Renderer.getBoardStyle();
    boardStyleBtn.textContent = `🏁 ${newStyle}`;
    Game.updateStylePreferences(undefined, undefined, newStyle);
  });
}

// Flip perspective button (swap piece colors without rotating board)
const boFlipBtn = document.getElementById('bo-flip-btn');
const boBoardStyleBtn = document.getElementById('bo-board-style-btn');
const boPiece2dBtn = document.getElementById('bo-piece-2d-btn');

function doFlip() {
  Renderer.toggleBoardFlip();
  const flipped = Renderer.isViewFlipped();
  if (flipBtn) flipBtn.textContent = flipped ? '🔃 Flipped' : '🔄 Flip';
  if (boFlipBtn) boFlipBtn.textContent = flipped ? '🔃 Flipped' : '🔄 Flip';
  Sound.play('move');
  console.log('[Flip] viewFlipped:', flipped);
}

if (flipBtn) {
  flipBtn.addEventListener('click', doFlip);
}
if (boFlipBtn) {
  boFlipBtn.addEventListener('click', doFlip);
}

// Board overlay: cycle board style
if (boBoardStyleBtn) {
  boBoardStyleBtn.addEventListener('click', () => {
    Renderer.cycleBoardStyle();
    const newStyle = Renderer.getBoardStyle();
    if (boardStyleBtn) boardStyleBtn.textContent = `🏁 ${newStyle}`;
    boBoardStyleBtn.textContent = `🏁 ${newStyle}`;
    Game.updateStylePreferences(undefined, undefined, newStyle);
  });
}

// Board overlay: cycle 2D piece style
if (boPiece2dBtn) {
  boPiece2dBtn.addEventListener('click', () => {
    Renderer.cycle2DPieceStyle();
    const newStyle = Renderer.get2DPieceStyle();
    if (style2dBtn) style2dBtn.textContent = `🖼️ ${newStyle}`;
    boPiece2dBtn.textContent = `🖼️ ${newStyle}`;
    Game.updateStylePreferences(undefined, newStyle, undefined);
  });
}

// Save/Load buttons
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    Game.saveProgress();
  });
}

// Valid board styles for type checking
const VALID_BOARD_STYLES = ['classic', 'tournament', 'marble', 'walnut', 'ebony', 'stone',
  'crystal', 'neon', 'newspaper', 'ocean', 'forest', 'royal'] as const;
type BoardStyleType = typeof VALID_BOARD_STYLES[number];

function isValidBoardStyle(style: string): style is BoardStyleType {
  return VALID_BOARD_STYLES.includes(style as BoardStyleType);
}

if (loadBtn) {
  loadBtn.addEventListener('click', async () => {
    const loaded = await Game.loadProgress();
    if (loaded) {
      // Apply saved style preferences
      const saveData = Game.getCurrentSaveData();
      if (saveData.pieceStyle3D) {
        Renderer.set3DPieceStyle(saveData.pieceStyle3D);
        if (style3dBtn) style3dBtn.textContent = `🎨 ${saveData.pieceStyle3D}`;
      }
      if (saveData.pieceStyle2D) {
        Renderer.set2DPieceStyle(saveData.pieceStyle2D);
        if (style2dBtn) style2dBtn.textContent = `🖼️ ${saveData.pieceStyle2D}`;
      }
      if (saveData.boardStyle && isValidBoardStyle(saveData.boardStyle)) {
        Renderer.setBoardStyle(saveData.boardStyle);
        if (boardStyleBtn) boardStyleBtn.textContent = `🏁 ${saveData.boardStyle}`;
      }
      // Restore AI aggression slider
      updateAggressionDisplay();
    }
    syncRendererState();
  });
}

// PGN export button
const exportPgnBtn = document.getElementById('export-pgn-btn');
if (exportPgnBtn) {
  exportPgnBtn.addEventListener('click', () => {
    const pgn = Game.generatePGN();
    if (!pgn) {
      alert('No moves to export. Play a game first!');
      return;
    }
    // Copy to clipboard and offer download
    navigator.clipboard.writeText(pgn).then(() => {
      console.log('[PGN] Copied to clipboard');
    }).catch(() => {
      console.log('[PGN] Clipboard write failed, offering download only');
    });
    // Also trigger download
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-game-${Date.now()}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
    Sound.play('move');
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
      updateStartButton();
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
  // Don't trigger if user is typing in an input/textarea
  const tag = (event.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  switch (event.key.toLowerCase()) {
    case 'v':
      // Reset camera to overhead play view (V = View reset)
      Renderer.setViewMode('play');
      break;
    case 'c':
      Renderer.setViewMode('play');
      break;
    case 'f':
      doFlip();
      break;
    case 'n':
      Game.newGame();
      loadRandomArticles();
      syncRendererState();
      updateStartButton();
      break;
  }
});

// =============================================================================
// START GAME BUTTON & WATCH AI BUTTON
// =============================================================================

function updateStartButton(): void {
  if (!startGameBtn) return;
  const state = Game.getState();

  if (state.gameStarted && !state.gameOver) {
    startGameBtn.style.display = 'none';
    if (resignBtn) resignBtn.style.display = 'inline-block';
    if (watchAiBtn) watchAiBtn.style.display = 'none';
  } else {
    startGameBtn.style.display = 'inline-block';
    if (resignBtn) resignBtn.style.display = 'none';
    if (state.gameOver) {
      startGameBtn.textContent = '▶ New Game';
    } else {
      startGameBtn.textContent = `▶ Start as ${state.playerColor === 'white' ? 'White' : 'Black'}`;
    }
    if (watchAiBtn) watchAiBtn.style.display = 'inline-block';
  }

  // Sync classic action bar resign visibility
  updateCabResignVisibility();
}

if (startGameBtn) {
  startGameBtn.addEventListener('click', () => {
    const state = Game.getState();
    if (state.gameOver) {
      // Game over — start fresh
      Game.newGame();
      MoveListUI.resetGameTimer();
      loadRandomArticles();
    } else {
      // Not started yet — start game
      Game.startGame();
      MoveListUI.startGameTimer();
    }
    syncRendererState();
    updateStartButton();
  });
}

// Resign button — ends the current game
if (resignBtn) {
  resignBtn.addEventListener('click', () => {
    const state = Game.getState();
    if (state.gameStarted && !state.gameOver) {
      if (confirm('Resign this game?')) {
        Game.newGame();
        MoveListUI.resetGameTimer();
        loadRandomArticles();
        syncRendererState();
        updateStartButton();
      }
    }
  });
}

if (watchAiBtn) {
  watchAiBtn.addEventListener('click', () => {
    Game.startAiVsAi();
    MoveListUI.startGameTimer(); // Start the game clock
    syncRendererState();
    updateStartButton();
    updateAiSpeedButton();
  });
}

// Train AI Button - runs self-play training
if (trainAiBtn) {
  trainAiBtn.addEventListener('click', async () => {
    if (Game.isCurrentlyTraining()) {
      alert('Training already in progress!');
      return;
    }

    const stats = Game.getLearningAIStats();
    const gamesToTrain = parseInt(prompt(
      `🧠 AI Training\n\nCurrent: Gen ${stats.generation}, ${stats.gamesPlayed} games\nWin Rate: ${(stats.winRate * 100).toFixed(1)}%\n\nHow many games to train?`,
      '50'
    ) || '0');

    if (gamesToTrain <= 0) return;

    trainAiBtn.disabled = true;
    trainAiBtn.textContent = '🧠 0%';
    trainAiBtn.style.opacity = '0.5';

    try {
      const result = await Game.startTraining(gamesToTrain, (current, total) => {
        const percent = Math.round((current / total) * 100);
        trainAiBtn.textContent = `🧠 ${percent}%`;
      });

      const newStats = Game.getLearningAIStats();
      const decisiveGames = result.wins + result.losses;
      const decisiveRate = gamesToTrain > 0 ? (decisiveGames / gamesToTrain * 100).toFixed(1) : '0';
      alert(`✅ Training Complete!\n\nSelf-Play Results:\n⚪ White wins: ${result.wins}\n⚫ Black wins: ${result.losses}\n🤝 Draws: ${result.draws}\n\nDecisive games: ${decisiveRate}%\n\nAI is now Gen ${newStats.generation}\nTotal games: ${newStats.gamesPlayed}`);
    } catch (e) {
      console.error('[Training] Error:', e);
      alert('Training error: ' + e);
    }

    trainAiBtn.disabled = false;
    trainAiBtn.textContent = '🧠 Train';
    trainAiBtn.style.opacity = '1';
  });
}

// AI Speed button - cycles through speeds
const AI_SPEEDS = [
  { value: 1, label: '1x' },
  { value: 0.5, label: '2x' },
  { value: 0.25, label: '4x' },
  { value: 0.1, label: '10x' },
  { value: 2, label: '0.5x' },
];
let currentSpeedIndex = 0;

function updateAiSpeedButton(): void {
  if (!aiSpeedBtn) return;

  // Show speed button only during AI vs AI mode
  if (Game.isAiVsAiMode() && !Game.getState().gameOver) {
    aiSpeedBtn.style.display = 'inline-block';
    aiSpeedBtn.textContent = `⏱️ ${AI_SPEEDS[currentSpeedIndex].label}`;
  } else {
    aiSpeedBtn.style.display = 'none';
  }
}

if (aiSpeedBtn) {
  aiSpeedBtn.addEventListener('click', () => {
    currentSpeedIndex = (currentSpeedIndex + 1) % AI_SPEEDS.length;
    Game.setAiSpeed(AI_SPEEDS[currentSpeedIndex].value);
    updateAiSpeedButton();
  });
}

// =============================================================================
// AI AGGRESSION SLIDER
// =============================================================================

const aggressionSlider = document.getElementById('ai-aggression-slider') as HTMLInputElement | null;
const aggressionLevelDisplay = document.getElementById('aggression-level-display');
const aggressionDescDisplay = document.getElementById('aggression-desc-display');

function updateAggressionDisplay(): void {
  const level = Game.getAiAggression();
  if (aggressionLevelDisplay) aggressionLevelDisplay.textContent = String(level);
  if (aggressionDescDisplay) aggressionDescDisplay.textContent = Game.getAggressionDescription(level);
  if (aggressionSlider) aggressionSlider.value = String(level);
}

if (aggressionSlider) {
  aggressionSlider.addEventListener('input', () => {
    const level = parseInt(aggressionSlider.value, 10);
    Game.setAiAggression(level);
    updateAggressionDisplay();
  });
}

// Initialize display on load
updateAggressionDisplay();

// =============================================================================
// SETUP MODE - Rearrange pieces and deploy from inventory
// =============================================================================

const setupBoard = document.getElementById('setup-board');
const bonusCountElem = document.getElementById('bonus-count');

console.log('[Setup] Elements found:', {
  setupBtn: !!setupBtn,
  setupOverlay: !!setupOverlay,
  setupBoard: !!setupBoard
});

// Track current setup arrangement
let setupArrangement: Array<{ row: number, col: number, type: string, symbol: string, isBonus?: boolean }> = [];
let selectedSetupSquare: number | null = null;
let selectedInventoryPiece: string | null = null; // 'Q', 'R', 'B', 'N' or null

const PIECE_SYMBOLS: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙'
};

// Inventory item click handlers
const inventoryItems = document.querySelectorAll('.inventory-item');
inventoryItems.forEach(item => {
  item.addEventListener('click', () => {
    const type = item.getAttribute('data-type');
    if (!type) return;

    const inventory = Game.getPieceInventory();
    if (inventory[type as keyof typeof inventory] <= 0) {
      console.log('[Setup] No', type, 'in inventory');
      return;
    }

    // Toggle selection
    if (selectedInventoryPiece === type) {
      selectedInventoryPiece = null;
      selectedSetupSquare = null;
    } else {
      selectedInventoryPiece = type;
      selectedSetupSquare = null;
    }
    updateInventoryUI();
    renderSetupBoard();
  });
});

function updateInventoryUI(): void {
  const inventory = Game.getPieceInventory();

  // Update counts for all piece types including Pawns
  ['P', 'N', 'B', 'R', 'Q'].forEach(type => {
    const countElem = document.getElementById(`inv-${type}`);
    if (countElem) {
      const count = inventory[type as keyof typeof inventory];
      countElem.textContent = String(count);
      countElem.classList.toggle('zero', count === 0);
    }

    // Update item visual state
    const item = document.querySelector(`.inventory-item[data-type="${type}"]`);
    if (item) {
      item.classList.toggle('disabled', inventory[type as keyof typeof inventory] <= 0);
      item.classList.toggle('selected', selectedInventoryPiece === type);
    }
  });

  // Update deployed count and hints
  const hintElem = document.getElementById('inventory-hint');
  const retractHint = document.getElementById('retract-hint');
  const deployedCountElem = document.getElementById('deployed-count');
  const total = inventory.P + inventory.N + inventory.B + inventory.R + inventory.Q;
  const totalDeployed = Game.getTotalDeployed();
  const maxExtra = Game.getMaxExtraPieces();

  if (deployedCountElem) {
    deployedCountElem.textContent = `(${totalDeployed}/${maxExtra} deployed)`;
    deployedCountElem.style.color = totalDeployed >= maxExtra ? 'var(--sidebar-accent, #ff6b6b)' : 'var(--sidebar-text-muted, #aaa)';
  }

  if (hintElem) {
    hintElem.style.display = total === 0 && totalDeployed === 0 ? 'block' : 'none';
  }
  if (retractHint) {
    // Always show the hint in setup mode
    retractHint.style.display = 'block';
  }
}

function openSetupMode(): void {
  console.log('[Setup] Opening setup mode...');
  if (!setupOverlay || !setupBoard) {
    console.error('[Setup] Missing elements!', { setupOverlay: !!setupOverlay, setupBoard: !!setupBoard });
    return;
  }

  // Get player color to determine which rows to edit
  const playerColor = Game.getState().playerColor;
  const isWhite = playerColor === 'white';

  // CRITICAL FIX: If game is over, reset the board FIRST before getting it for rearrangement
  // This ensures we have a clean starting position to work with
  const state = Game.getState();
  if (state.gameOver) {
    console.log('[Setup] Game is over, resetting board to clean state...');
    Game.newGame(); // This resets the board to starting position with any bonus pieces
    syncRendererState();
    updateStartButton();
  }

  // Get current board state (now clean after reset)
  const board = Game.getBoardForRearrangement();
  const inventory = Game.getPieceInventory();
  const deployed = Game.getDeployedFromInventory();

  console.log('[Setup] Board retrieved, player color:', playerColor, 'inventory:', inventory, 'deployed:', deployed);

  // Clear selections
  selectedSetupSquare = null;
  selectedInventoryPiece = null;

  // Build setup arrangement from current board
  // Player's rows: white = 5-7 (3 rows), black = 0-2 (3 rows)
  // Track which pieces are "bonus" (deployed from inventory)
  setupArrangement = [];

  // Count pieces by type to identify bonus pieces
  const baseCounts: Record<string, number> = { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 };
  const foundCounts: Record<string, number> = { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 };

  // Use player's 3 starting rows (expanded from 2)
  const startRow = isWhite ? 5 : 0;
  const endRow = isWhite ? 7 : 2;

  for (let row = startRow; row <= endRow; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === playerColor) {
        const type = piece.type.toUpperCase();
        foundCounts[type]++;

        // Is this a bonus piece? (more than base count)
        const isBonus = foundCounts[type] > (baseCounts[type] || 0);

        setupArrangement.push({
          row,
          col,
          type,
          symbol: PIECE_SYMBOLS[type] || '?',
          isBonus
        });
      }
    }
  }

  updateInventoryUI();
  renderSetupBoard();
  updateProfileDropdown();  // Refresh profile dropdown when opening setup
  setupOverlay.style.display = 'flex';
}

function renderSetupBoard(): void {
  if (!setupBoard) return;

  setupBoard.innerHTML = '';

  // Get player color to determine which rows to show
  const playerColor = Game.getState().playerColor;
  const isWhite = playerColor === 'white';

  // Show player's 3 starting rows (white: 5-7, black: 0-2)
  // For black, show rows in reverse order so row 2 is at top (like looking from black's perspective)
  const rowOrder = isWhite ? [5, 6, 7] : [2, 1, 0];

  for (let rowIdx = 0; rowIdx < rowOrder.length; rowIdx++) {
    const row = rowOrder[rowIdx];
    for (let col = 0; col < 8; col++) {
      // For black, reverse columns so a-file appears on right (black's perspective)
      const actualCol = isWhite ? col : 7 - col;

      const square = document.createElement('div');
      square.className = 'setup-square ' + ((row + actualCol) % 2 === 0 ? 'light' : 'dark');

      // Find piece at this position
      const pieceHere = setupArrangement.find(p => p.row === row && p.col === actualCol);
      if (pieceHere) {
        square.textContent = pieceHere.symbol;
        if (pieceHere.isBonus) {
          square.classList.add('bonus-piece');
        }
        // Allow removing any non-King piece - add visual hint
        if (pieceHere.type !== 'K') {
          square.classList.add('removable');
        }
      }

      // idx encodes: which row in our display (0, 1, or 2) and which column in display (0-7)
      // This is then decoded in handleSetupSquareClick using the same logic
      const idx = rowIdx * 8 + col;
      if (selectedSetupSquare === idx) {
        square.classList.add('selected');
      }

      // Highlight empty squares when inventory piece selected
      if (!pieceHere && selectedInventoryPiece) {
        square.classList.add('drop-target');
      }

      // Left click/tap for move/select, right click OR long-press for remove to bank
      square.addEventListener('click', () => handleSetupSquareClick(row, actualCol, idx));
      square.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleSetupSquareRightClick(row, actualCol, pieceHere);
      });

      // Long-press support for touch (replaces right-click)
      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
      let longPressFired = false;
      square.addEventListener('touchstart', (e) => {
        longPressFired = false;
        longPressTimer = setTimeout(() => {
          longPressFired = true;
          e.preventDefault();
          handleSetupSquareRightClick(row, actualCol, pieceHere);
          // Visual feedback — brief vibration if supported
          if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
      }, { passive: false });
      square.addEventListener('touchend', (e) => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        if (longPressFired) { e.preventDefault(); } // Prevent click from also firing
      });
      square.addEventListener('touchmove', () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      });

      setupBoard.appendChild(square);
    }
  }
}

// Handle right-click to remove piece to bank
function handleSetupSquareRightClick(row: number, col: number, piece: typeof setupArrangement[0] | undefined): void {
  if (!piece) return;
  
  // Can't remove King
  if (piece.type === 'K') {
    console.log('[Setup] Cannot remove King to bank');
    return;
  }

  const type = piece.type as 'P' | 'N' | 'B' | 'R' | 'Q';
  
  // If it was a bonus piece (deployed from inventory), just retract it
  if (piece.isBonus) {
    if (Game.retractToInventory(type)) {
      const pieceIdx = setupArrangement.indexOf(piece);
      if (pieceIdx >= 0) {
        setupArrangement.splice(pieceIdx, 1);
      }
      console.log('[Setup] Retracted bonus', type, 'from', row, col);
    }
  } else {
    // It's a standard piece - add to bank and remove from board
    Game.addPieceToInventory(type);
    const pieceIdx = setupArrangement.indexOf(piece);
    if (pieceIdx >= 0) {
      setupArrangement.splice(pieceIdx, 1);
    }
    console.log('[Setup] Removed standard', type, 'to bank from', row, col);
  }
  
  updateInventoryUI();
  renderSetupBoard();
}

function handleSetupSquareClick(row: number, col: number, idx: number): void {
  const clickedPiece = setupArrangement.find(p => p.row === row && p.col === col);

  // If we have an inventory piece selected and clicking empty square, deploy it
  if (selectedInventoryPiece && !clickedPiece) {
    if (Game.deployFromInventory(selectedInventoryPiece as 'P' | 'N' | 'B' | 'R' | 'Q')) {
      // Add piece to arrangement
      setupArrangement.push({
        row,
        col,
        type: selectedInventoryPiece,
        symbol: PIECE_SYMBOLS[selectedInventoryPiece] || '?',
        isBonus: true
      });
      console.log('[Setup] Deployed', selectedInventoryPiece, 'to', row, col);

      // Check if we have more of this piece
      const inventory = Game.getPieceInventory();
      if (inventory[selectedInventoryPiece as keyof typeof inventory] <= 0) {
        selectedInventoryPiece = null;
      }
    }
    updateInventoryUI();
    renderSetupBoard();
    return;
  }

  // Regular piece movement logic (right-click handles removal to bank)
  if (selectedSetupSquare === null) {
    // Select a piece (including King - user can move any piece)
    if (clickedPiece) {
      selectedSetupSquare = idx;
      selectedInventoryPiece = null;
      updateInventoryUI();
      renderSetupBoard();
    }
  } else {
    // Try to swap/move
    // Decode the idx back to row/col
    // idx = rowIdx * 8 + displayCol where rowIdx is 0, 1, or 2, displayCol is 0-7
    const playerColor = Game.getState().playerColor;
    const isWhite = playerColor === 'white';
    const rowOrder = isWhite ? [5, 6, 7] : [2, 1, 0];

    const rowIdx = Math.floor(selectedSetupSquare / 8);
    const displayCol = selectedSetupSquare % 8;
    const selectedRow = rowOrder[rowIdx];
    const selectedCol = isWhite ? displayCol : 7 - displayCol;

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
  selectedInventoryPiece = null;
}

function confirmSetup(): void {
  // Convert to game format and apply
  const arrangement = setupArrangement.map(p => ({
    row: p.row,
    col: p.col,
    type: p.type.toUpperCase() as PieceType
  }));

  // Validate that exactly ONE King exists
  const kings = arrangement.filter(p => p.type === 'K');
  if (kings.length === 0) {
    alert('You must place a King to start the game!');
    return;
  }
  if (kings.length > 1) {
    alert('You can only have one King!');
    return;
  }

  // ALLOW PAWNS ANYWHERE (User Request)
  // Validation for back-rank pawns is removed because we now use engine.loadCustomBoard()
  // which bypasses FEN strictness for custom setups.

  Game.setCustomArrangement(arrangement);
  Game.newGame();
  loadRandomArticles();
  syncRendererState();

  // AUTO-START the game after confirming setup (so AI plays immediately)
  Game.startGame();

  updateStartButton();
  closeSetupMode();
}

function resetSetup(): void {
  // Return all deployed pieces to inventory and reset arrangement
  Game.resetDeployedPieces();
  Game.setCustomArrangement([]);
  openSetupMode(); // Re-open to show default
}

// Setup mode event listeners
function updateSetupButton() {
  if (!setupBtn) return;
  const state = Game.getState();
  // Enable setup if game hasn't started yet OR game is over
  if (state.gameStarted && !state.gameOver) {
    // Game in progress - disable setup
    setupBtn.disabled = true;
    setupBtn.style.opacity = '0.5';
    setupBtn.title = 'Setup only available before game starts';
  } else {
    // Game not started yet OR game is over - allow setup
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
// BOARD PROFILE MANAGEMENT
// =============================================================================

const profileSaveBtn = document.getElementById('profile-save') as HTMLButtonElement | null;
const profileSelect = document.getElementById('profile-select') as HTMLSelectElement | null;
const profileDeleteBtn = document.getElementById('profile-delete') as HTMLButtonElement | null;

function updateProfileDropdown(): void {
  if (!profileSelect) return;

  const profiles = Game.getSavedBoardProfileNames();

  // Clear existing options except first
  while (profileSelect.options.length > 1) {
    profileSelect.remove(1);
  }

  // Add profile options
  for (const name of profiles) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    profileSelect.add(option);
  }

  profileSelect.value = '';  // Reset to placeholder
}

function saveCurrentProfile(): void {
  const name = prompt('Enter a name for this board setup:', 'My Setup');
  if (!name || !name.trim()) return;

  // Build arrangement from current setup
  const arrangement = setupArrangement.map(p => ({
    row: p.row,
    col: p.col,
    type: p.type,
    isBonus: p.isBonus || false  // Preserve bonus status when saving
  }));

  if (arrangement.length === 0) {
    alert('No pieces placed! Place some pieces before saving.');
    return;
  }

  // Save using gameController (which updates currentSaveData)
  Game.setCustomArrangement(arrangement.map(p => ({ ...p, type: p.type as PieceType })));
  if (Game.saveCurrentBoardProfile(name.trim())) {
    alert(`Profile "${name.trim()}" saved! Remember to download your save file to keep it permanently.`);
    updateProfileDropdown();
  }
}

function loadSelectedProfile(): void {
  if (!profileSelect) return;

  const selectedName = profileSelect.value;
  if (!selectedName) return;

  if (Game.loadBoardProfile(selectedName)) {
    // Update setupArrangement from loaded profile - preserve isBonus!
    const loaded = Game.getCustomArrangement();
    const profile = Game.getBoardProfileByName(selectedName);

    setupArrangement = loaded.map((p, idx) => ({
      row: p.row,
      col: p.col,
      type: p.type,
      symbol: getPieceSymbol(p.type, 'white'),
      // Get isBonus from the saved profile if available
      isBonus: profile?.arrangement[idx]?.isBonus || false
    }));
    renderSetupBoard();
    console.log('[Profile] Loaded:', selectedName, 'with bonus tracking');
  }

  profileSelect.value = '';  // Reset dropdown
}

function deleteSelectedProfile(): void {
  if (!profileSelect) return;

  const selectedName = profileSelect.value;
  if (!selectedName) {
    alert('Select a profile to delete first.');
    return;
  }

  if (confirm(`Delete profile "${selectedName}"?`)) {
    if (Game.deleteBoardProfileByName(selectedName)) {
      updateProfileDropdown();
      console.log('[Profile] Deleted:', selectedName);
    }
  }
}

// Helper to get piece symbol for display
function getPieceSymbol(type: string, color: string): string {
  const symbols: Record<string, Record<string, string>> = {
    white: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
    black: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
  };
  return symbols[color]?.[type] || '?';
}

// Attach profile event listeners
if (profileSaveBtn) {
  profileSaveBtn.addEventListener('click', saveCurrentProfile);
}
if (profileSelect) {
  profileSelect.addEventListener('change', loadSelectedProfile);
}
if (profileDeleteBtn) {
  profileDeleteBtn.addEventListener('click', deleteSelectedProfile);
}

// Update dropdown when setup mode opens
const originalOpenSetupMode = openSetupMode;
(window as unknown as Record<string, unknown>)._openSetupModeOriginal = openSetupMode;

// =============================================================================
// GAME CALLBACKS
// =============================================================================

Game.registerCallbacks({
  onStateChange: (state) => {
    syncRendererState();
    updateSetupButton();
    updateStartButton();
    updateAiSpeedButton();

    // Show promotion UI if there's a pending promotion
    if (state.pendingPromotion) {
      showPromotionUI(state.playerColor === 'black');
    }
  },

  onLevelChange: (levelName, isUp) => {
    showLevelNotification(levelName, isUp);
  },

  onGameOver: async (message) => {
    // Determine game result from message for reactive articles
    const isWin = message.includes('You Win');
    const isLoss = message.includes('You Lose');
    const result: 'win' | 'loss' | 'draw' = isWin ? 'win' : isLoss ? 'loss' : 'draw';

    // Detect draw type from message
    let drawType: string | undefined;
    if (message.includes('Stalemate')) drawType = 'stalemate';
    else if (message.includes('repetition')) drawType = 'repetition';
    else if (message.includes('insufficient')) drawType = 'insufficient';
    else if (message.includes('50')) drawType = 'fifty-move';

    // Store performance data for reactive articles
    lastGamePerformance = {
      result,
      moveCount: Game.getMoveCount(),
      drawType,
    };

    // Load reactive article immediately into slot 1 (lazy-loaded)
    const { getGameReactiveArticle } = await import('./gameReactiveArticles');
    const reactive = getGameReactiveArticle(lastGamePerformance);
    loadRandomArticles(reactive);

    Renderer.showGameOverOverlay(message);
    updateStartButton();
    updateAiSpeedButton();
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

  onPlayerWin: async () => {
    // Refresh newspaper articles with reactive article in slot 1
    console.log('[Main] Player won! Refreshing newspaper articles...');
    if (lastGamePerformance) {
      const { getGameReactiveArticle } = await import('./gameReactiveArticles');
      const reactive = getGameReactiveArticle(lastGamePerformance);
      loadRandomArticles(reactive);
    } else {
      loadRandomArticles();
    }
  },

  onMoveAnimation: (data) => {
    Renderer.setPendingMoveAnimation(data);
  },
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
Overlay.init(overlayCanvas);
Overlay.setVisible(true);
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

// Initialize theme system
Theme.init();

// Initialize classic mode & graphics quality (restores from localStorage)
ClassicMode.init();
// If classic mode was restored, hide the canvas overlay HUD
if (ClassicMode.isClassicMode()) {
  Overlay.setVisible(false);
}

// Initialize Rust WASM engine in background (non-blocking)
// Falls back to chess.js if WASM is unavailable
initEngine().then(type => {
  console.log(`[Main-3D] Engine ready: ${type}`);
}).catch(err => {
  console.warn('[Main-3D] Engine init error (using chess.js fallback):', err);
});

// Initialize game
const initialState = Game.initGame();
console.log('[Main-3D] Game ready! ELO:', initialState.elo);

// Initialize multiplayer UI (lazy-loaded — socket.io-client deferred until needed)
import('./multiplayerUI').then(({ initMultiplayerUI }) => initMultiplayerUI());

// Start stats session tracking
Stats.startSession();

// Initial sync
syncRendererState();
updateStartButton();

console.log('[Main-3D] Current Era:', Renderer.getCurrentWorldName());
console.log('[Main-3D] Ready to play!');

// Dismiss loading screen with a smooth fade
const loadingScreen = document.getElementById('loading-screen');
if (loadingScreen) {
  loadingScreen.classList.add('hidden');
  // Remove from DOM after fade animation completes
  loadingScreen.addEventListener('transitionend', () => loadingScreen.remove(), { once: true });
}

// =============================================================================
// WELCOME DASHBOARD
// =============================================================================

const welcomeDashboard = document.getElementById('welcome-dashboard');

/** Dismiss the welcome dashboard and reveal the game */
function dismissWelcomeDashboard(): void {
  if (!welcomeDashboard) return;
  welcomeDashboard.classList.add('hidden');
  welcomeDashboard.addEventListener('transitionend', () => welcomeDashboard.remove(), { once: true });
}

// Expose for e2e tests
(window as any).__dismissWelcome__ = dismissWelcomeDashboard;

// Dashboard wiring is deferred to initWelcomeDashboard() which runs at the
// bottom of the file (after all other variables/functions are defined).

// =============================================================================
// NEW FEATURES: Undo, Sound, Theme, Stats
// =============================================================================

// --- Options pop-out overlay ---
const optionsBtn = document.getElementById('options-btn');
const optionsOverlay = document.getElementById('options-overlay');
const optionsCloseBtn = document.getElementById('options-close-btn');

if (optionsBtn && optionsOverlay) {
  optionsBtn.addEventListener('click', () => {
    optionsOverlay.classList.add('open');
  });
  optionsCloseBtn?.addEventListener('click', () => {
    optionsOverlay.classList.remove('open');
  });
  // Close on backdrop click
  optionsOverlay.addEventListener('click', (e) => {
    if (e.target === optionsOverlay) {
      optionsOverlay.classList.remove('open');
    }
  });
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && optionsOverlay.classList.contains('open')) {
      optionsOverlay.classList.remove('open');
    }
  });
}

// --- How to Play overlay ---
const htpBtn = document.getElementById('how-to-play-btn');
const htpOverlay = document.getElementById('htp-overlay');
const htpCloseBtn = document.getElementById('htp-close-btn');

if (htpBtn && htpOverlay) {
  htpBtn.addEventListener('click', () => {
    htpOverlay.classList.add('open');
  });
  htpCloseBtn?.addEventListener('click', () => {
    htpOverlay.classList.remove('open');
  });
  htpOverlay.addEventListener('click', (e) => {
    if (e.target === htpOverlay) {
      htpOverlay.classList.remove('open');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && htpOverlay.classList.contains('open')) {
      htpOverlay.classList.remove('open');
    }
  });
}

// Tutorial button (disabled — coming soon)
// No click handler needed — button is disabled in HTML

// --- Keyboard Shortcuts overlay ---
const shortcutsBtn = document.getElementById('shortcuts-btn');
const shortcutsOverlay = document.getElementById('shortcuts-overlay');
const shortcutsCloseBtn = document.getElementById('shortcuts-close-btn');

if (shortcutsBtn && shortcutsOverlay) {
  shortcutsBtn.addEventListener('click', () => {
    shortcutsOverlay.classList.add('open');
  });
  shortcutsCloseBtn?.addEventListener('click', () => {
    shortcutsOverlay.classList.remove('open');
  });
  shortcutsOverlay.addEventListener('click', (e) => {
    if (e.target === shortcutsOverlay) {
      shortcutsOverlay.classList.remove('open');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shortcutsOverlay.classList.contains('open')) {
      shortcutsOverlay.classList.remove('open');
    }
  });
}

// '?' key opens shortcuts overlay
document.addEventListener('keydown', (e) => {
  if (e.key === '?' && shortcutsOverlay) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    shortcutsOverlay.classList.add('open');
  }
});

const undoBtn = document.getElementById('undo-btn');
const sidebarUndoBtn = document.getElementById('sidebar-undo-btn');
const soundBtn = document.getElementById('sound-btn');
const themeBtn = document.getElementById('theme-btn');
const statsBtn = document.getElementById('stats-btn');
const streakDisplay = document.getElementById('streak-display');

function updateStreakDisplay(): void {
  if (streakDisplay) {
    streakDisplay.textContent = Stats.getStreakDisplay();
  }
}

function updateSoundButton(): void {
  if (soundBtn) {
    soundBtn.textContent = Sound.isEnabled() ? '🔊' : '🔇';
  }
}

updateStreakDisplay();

// Shared undo logic (used by button click AND Ctrl+Z)
let undoCooldown = false;
function performUndo(): void {
  console.log('[UNDO] performUndo called, cooldown:', undoCooldown);
  if (undoCooldown) return;

  if (Game.isAiVsAiMode()) {
    console.log('[UNDO] Disabled during AI vs AI mode');
    return;
  }

  const state = Game.getState();
  if (!state.gameStarted || state.gameOver) {
    console.log('[UNDO] No moves to undo (started=' + state.gameStarted + ', over=' + state.gameOver + ')');
    return;
  }

  const moveCountBefore = Game.getMoveCount();
  const turnBefore = Game.getCurrentTurn();
  console.log('[UNDO] Before: moves=' + moveCountBefore + ', turn=' + turnBefore + ', playerColor=' + state.playerColor);

  const result = Game.undoMove();
  console.log('[UNDO] undoMove() returned:', result);

  if (result) {
    const moveCountAfter = Game.getMoveCount();
    console.log('[UNDO] After: moves=' + moveCountAfter + ', undid ' + (moveCountBefore - moveCountAfter) + ' half-moves');

    undoCooldown = true;
    if (undoBtn) undoBtn.setAttribute('disabled', 'true');
    if (sidebarUndoBtn) sidebarUndoBtn.setAttribute('disabled', 'true');
    Sound.play('move');
    syncRendererState();
    MoveListUI.forceRefreshMoveList();
    setTimeout(() => {
      undoCooldown = false;
      if (undoBtn) undoBtn.removeAttribute('disabled');
      if (sidebarUndoBtn) sidebarUndoBtn.removeAttribute('disabled');
    }, 300);
  } else {
    console.log('[UNDO] Nothing undone');
  }
}

// Undo button click handler
console.log('[UNDO] undoBtn element:', undoBtn ? 'FOUND' : 'NULL');
if (undoBtn) {
  undoBtn.addEventListener('click', () => {
    console.log('[UNDO] Button click event fired');
    performUndo();
  });
  console.log('[UNDO] Click handler registered on button');
} else {
  console.error('[UNDO] WARNING: undo-btn element not found in DOM!');
}

// Sidebar undo button (separate from board overlay undo)
if (sidebarUndoBtn) {
  sidebarUndoBtn.addEventListener('click', () => {
    performUndo();
  });
}

// Ctrl+Z keyboard shortcut for undo (works even if button has issues)
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    // Don't trigger if user is typing in an input/textarea
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    console.log('[UNDO] Ctrl+Z pressed');
    performUndo();
  }
});

// Sound toggle button
if (soundBtn) {
  updateSoundButton();
  soundBtn.addEventListener('click', () => {
    Sound.toggle();
    updateSoundButton();
    Sound.play('move'); // Play click to confirm sound is on
  });
}

// Theme cycle button
if (themeBtn) {
  // Initialize button text
  themeBtn.textContent = `🎨 ${Theme.getCurrentDisplayName()}`;

  themeBtn.addEventListener('click', () => {
    const newTheme = Theme.cycle();
    themeBtn.textContent = `🎨 ${Theme.getThemeDisplayName(newTheme)}`;
    console.log('[Theme] Changed to:', Theme.getThemeDisplayName(newTheme));
    Sound.play('move');
  });
}

// Stats modal button
if (statsBtn) {
  statsBtn.addEventListener('click', () => {
    const stats = Stats.getStats();
    const winRate = Stats.getWinRate();
    const playTime = Stats.getPlayTimeDisplay();

    const message = `
📊 CAREER STATS
━━━━━━━━━━━━━━━
Games: ${stats.totalGames}
Wins: ${stats.wins} | Losses: ${stats.losses} | Draws: ${stats.draws}
Win Rate: ${winRate}%

🏆 Streaks
Current: ${stats.currentStreak > 0 ? '+' + stats.currentStreak : stats.currentStreak}
Longest Win: ${stats.longestWinStreak}

📈 ELO Range
Highest: ${stats.highestElo}
Lowest: ${stats.lowestElo}

⏱️ Play Time: ${playTime}
    `.trim();

    alert(message);
    Sound.play('move');
  });
}

// Save session on page unload
window.addEventListener('beforeunload', () => {
  Stats.endSession();
});

// ── Classic Mode + Graphics Quality toggle buttons ─────────────────────────
const boClassicBtn = document.getElementById('bo-classic-btn');
const classicModeBtn = document.getElementById('classic-mode-btn');
const boGfxBtn = document.getElementById('bo-gfx-btn');
const gfxQualityBtn = document.getElementById('gfx-quality-btn');

function updateClassicButtons(): void {
  const on = ClassicMode.isClassicMode();
  const label = on ? '♟ Normal' : '♟ Classic';
  if (boClassicBtn) boClassicBtn.textContent = label;
  if (classicModeBtn) classicModeBtn.textContent = label;
}

function updateGfxButtons(): void {
  const q = ClassicMode.getGraphicsQuality();
  const label = `⚡ GFX: ${q.charAt(0).toUpperCase() + q.slice(1)}`;
  if (boGfxBtn) boGfxBtn.textContent = label;
  if (gfxQualityBtn) gfxQualityBtn.textContent = label;
}

function handleClassicToggle(): void {
  ClassicMode.toggleClassicMode();
  const isClassic = ClassicMode.isClassicMode();
  // Hide/show the canvas overlay move list (the old HUD)
  Overlay.setVisible(!isClassic);
  updateClassicButtons();
  Sound.play('move');

  // Reset scroll position when entering classic mode (articles are below the fold)
  if (isClassic) {
    const nb = document.querySelector('.newspaper-body');
    if (nb) nb.scrollTop = 0;
  }
}

function handleGfxCycle(): void {
  const q = ClassicMode.cycleGraphicsQuality();
  updateGfxButtons();
  Sound.play('move');
  console.log('[GFX] Quality:', q);
}

if (boClassicBtn) boClassicBtn.addEventListener('click', handleClassicToggle);
if (classicModeBtn) classicModeBtn.addEventListener('click', handleClassicToggle);
if (boGfxBtn) boGfxBtn.addEventListener('click', handleGfxCycle);
if (gfxQualityBtn) gfxQualityBtn.addEventListener('click', handleGfxCycle);

// ── Classic Action Bar buttons ──────────────────────────────────────────────
// These mirror the overlay buttons but are touch-friendly icons in a bottom bar
const cabNewBtn = document.getElementById('cab-new-btn');
const cabResignBtn = document.getElementById('cab-resign-btn');
const cabUndoBtn = document.getElementById('cab-undo-btn');
const cabFlipBtn = document.getElementById('cab-flip-btn');
const cabExploreBtn = document.getElementById('cab-explore-btn');
const cabSettingsBtn = document.getElementById('cab-settings-btn');
const cabExitBtn = document.getElementById('cab-exit-btn');
const exploreBackBtn = document.getElementById('explore-back-btn');

cabNewBtn?.addEventListener('click', () => {
  const state = Game.getState();
  if (state.gameOver) {
    Game.newGame();
    MoveListUI.resetGameTimer();
    loadRandomArticles();
  } else if (!state.gameStarted) {
    Game.startGame();
    MoveListUI.startGameTimer();
  }
  syncRendererState();
  updateStartButton();
});

cabResignBtn?.addEventListener('click', () => {
  const state = Game.getState();
  if (state.gameStarted && !state.gameOver) {
    if (confirm('Resign this game?')) {
      Game.newGame();
      MoveListUI.resetGameTimer();
      loadRandomArticles();
      syncRendererState();
      updateStartButton();
    }
  }
});

cabUndoBtn?.addEventListener('click', () => {
  performUndo();
});

cabFlipBtn?.addEventListener('click', () => doFlip());

cabExploreBtn?.addEventListener('click', () => {
  ClassicMode.enterExploreMode();
  Sound.play('move');
});

exploreBackBtn?.addEventListener('click', () => {
  ClassicMode.exitExploreMode();
  Sound.play('move');
});

cabSettingsBtn?.addEventListener('click', () => {
  const overlay = document.getElementById('options-overlay');
  overlay?.classList.add('open');
});

cabExitBtn?.addEventListener('click', handleClassicToggle);

// Sync cab resign button visibility with game state
function updateCabResignVisibility(): void {
  const btn = document.getElementById('cab-resign-btn');
  if (!btn) return;
  const state = Game.getState();
  btn.style.display = (state.gameStarted && !state.gameOver) ? 'flex' : 'none';
}

// Initialize button labels from saved state
updateClassicButtons();
updateGfxButtons();

// =============================================================================
// WELCOME DASHBOARD — WIRING  (placed at end so all variables are defined)
// =============================================================================

if (welcomeDashboard) {
  // Populate stats from current game state
  const state = Game.getState();
  const level = getLevelForElo(state.elo);
  const wdElo = document.getElementById('wd-elo');
  const wdWins = document.getElementById('wd-wins');
  const wdStreak = document.getElementById('wd-streak');
  const wdLevel = document.getElementById('wd-level');
  const wdDate = document.getElementById('wd-date');

  if (wdElo) wdElo.textContent = String(state.elo);
  if (wdWins) wdWins.textContent = String(state.gamesWon);
  if (wdStreak) {
    const streak = Stats.getCurrentStreak();
    wdStreak.textContent = streak > 0 ? `🔥${streak}` : streak < 0 ? `${Math.abs(streak)}` : '—';
  }
  if (wdLevel) wdLevel.textContent = String(level.level);
  if (wdDate) {
    const d = new Date();
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    wdDate.textContent = d.toLocaleDateString('en-US', opts);
  }

  // Sync GFX / Classic button text
  const wdGfxBtn = document.getElementById('wd-gfx-btn');
  const wdClassicBtn = document.getElementById('wd-classic-btn');
  if (wdGfxBtn) {
    const q = ClassicMode.getGraphicsQuality();
    wdGfxBtn.textContent = `⚡ GFX: ${q.charAt(0).toUpperCase() + q.slice(1)}`;
  }
  if (wdClassicBtn) {
    wdClassicBtn.textContent = ClassicMode.isClassicMode() ? '♟ Normal Mode' : '♟ Classic Mode';
  }

  // ── Dashboard button handlers ──

  // ▶ Play vs AI — dismiss and start the game
  document.getElementById('wd-play-btn')?.addEventListener('click', () => {
    dismissWelcomeDashboard();
    const st = Game.getState();
    if (st.gameOver) {
      Game.newGame();
      MoveListUI.resetGameTimer();
      loadRandomArticles();
    }
    if (!st.gameStarted || st.gameOver) {
      Game.startGame();
      MoveListUI.startGameTimer();
    }
    syncRendererState();
    updateStartButton();
  });

  // ⚙️ Setup Board
  document.getElementById('wd-setup-btn')?.addEventListener('click', () => {
    dismissWelcomeDashboard();
    setTimeout(() => openSetupMode(), 100);
  });

  // 🌐 Play Online — dismiss and open MP panel
  document.getElementById('wd-online-btn')?.addEventListener('click', () => {
    dismissWelcomeDashboard();
    setTimeout(() => {
      if (optionsOverlay) optionsOverlay.classList.add('open');
    }, 100);
  });

  // 📂 Load Game — trigger file load
  document.getElementById('wd-load-btn')?.addEventListener('click', async () => {
    const loaded = await Game.loadProgress();
    if (loaded) {
      const saveData = Game.getCurrentSaveData();
      if (saveData.pieceStyle3D) Renderer.set3DPieceStyle(saveData.pieceStyle3D);
      if (saveData.pieceStyle2D) Renderer.set2DPieceStyle(saveData.pieceStyle2D);
      if (saveData.boardStyle && isValidBoardStyle(saveData.boardStyle)) Renderer.setBoardStyle(saveData.boardStyle);
      updateAggressionDisplay();
    }
    syncRendererState();
    dismissWelcomeDashboard();
  });

  // ❓ How to Play — open the how-to-play modal (do NOT dismiss dashboard)
  document.getElementById('wd-howto-btn')?.addEventListener('click', () => {
    if (htpOverlay) htpOverlay.classList.add('open');
  });

  // ♟ Classic Mode toggle
  wdClassicBtn?.addEventListener('click', () => {
    handleClassicToggle();
    if (wdClassicBtn) wdClassicBtn.textContent = ClassicMode.isClassicMode() ? '♟ Normal Mode' : '♟ Classic Mode';
  });

  // ⚡ GFX quality cycle
  wdGfxBtn?.addEventListener('click', () => {
    handleGfxCycle();
    const q = ClassicMode.getGraphicsQuality();
    if (wdGfxBtn) wdGfxBtn.textContent = `⚡ GFX: ${q.charAt(0).toUpperCase() + q.slice(1)}`;
  });

  // 🎨 Theme cycle
  document.getElementById('wd-theme-btn')?.addEventListener('click', () => {
    const newTheme = Theme.cycle();
    const btn = document.getElementById('wd-theme-btn');
    if (btn) btn.textContent = `🎨 ${Theme.getThemeDisplayName(newTheme)}`;
    if (themeBtn) themeBtn.textContent = `🎨 ${Theme.getThemeDisplayName(newTheme)}`;
    Sound.play('move');
  });
}
