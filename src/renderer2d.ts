// src/renderer2d.ts
// Canvas 2D Renderer - Victorian Theme with SVG pieces
// Can be swapped for renderer3d.ts later without touching game logic

import type { Piece } from './types';
import type { Move } from './chessEngine';
import { TILE_SIZE, BOARD_SIZE, BOARD_OFFSET_X, BOARD_OFFSET_Y, TILT_ANGLE, COLORS, RIBBON, TIMING } from './constants';
import { getPieceImage, preloadPieces } from './pieces';

// =============================================================================
// RENDERER STATE
// =============================================================================

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let piecesLoaded = false;

// Cached from game controller
let cachedBoard: (Piece | null)[][] = [];
let cachedSelectedSquare: { row: number; col: number } | null = null;
let cachedLegalMoves: Move[] = [];
let cachedTurn: 'white' | 'black' = 'white';
let cachedInCheck: boolean = false;

// Animation state
let scrollOffset = 0;  // For win animation
let isAnimating = false;

// Offscreen canvas for infinite ribbon (expensive to render, rarely changes)
let ribbonCanvas: OffscreenCanvas | null = null;
let ribbonCtx: OffscreenCanvasRenderingContext2D | null = null;
let ribbonDirty = true; // Flag to indicate ribbon needs redraw

// =============================================================================
// INITIALIZATION
// =============================================================================

export function initRenderer(canvasElement: HTMLCanvasElement): void {
  canvas = canvasElement;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get 2D context');
  }
  ctx = context;

  // Initialize offscreen canvas for ribbon caching
  initRibbonCanvas();

  // Preload piece images
  preloadPieces().then(() => {
    piecesLoaded = true;
    console.log('[Renderer2D] Pieces loaded');
  });

  console.log('[Renderer2D] Initialized with Victorian theme');
}

/**
 * Initialize or reinitialize the offscreen ribbon canvas
 */
function initRibbonCanvas(): void {
  ribbonCanvas = new OffscreenCanvas(canvas.width, canvas.height);
  const context = ribbonCanvas.getContext('2d');
  if (context) {
    ribbonCtx = context;
    ribbonDirty = true;
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Update renderer with new game state
 */
export function updateState(
  board: (Piece | null)[][],
  selectedSquare: { row: number; col: number } | null,
  legalMoves: Move[],
  turn: 'white' | 'black',
  inCheck: boolean
): void {
  cachedBoard = board;
  cachedSelectedSquare = selectedSquare;
  cachedLegalMoves = legalMoves;
  cachedTurn = turn;
  cachedInCheck = inCheck;
}

/**
 * Full render pass
 */
export function render(): void {
  drawInfiniteRibbon();
  drawBoard();
  drawPieces();
  drawTurnIndicator();
}

/**
 * Play the win animation - scroll the ribbon forward
 * Returns a promise that resolves when animation is complete
 */
export function playWinAnimation(): Promise<void> {
  return new Promise((resolve) => {
    if (isAnimating) {
      resolve();
      return;
    }

    isAnimating = true;
    const startTime = performance.now();
    const duration = TIMING.winScrollDuration;
    const distance = TIMING.winScrollDistance;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      scrollOffset = easeOut * distance;

      // Render with offset
      render();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete - reset for next game
        scrollOffset = 0;
        isAnimating = false;
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Check if animation is currently playing
 */
export function isAnimationPlaying(): boolean {
  return isAnimating;
}

/**
 * Draw game over overlay
 */
export function drawGameOverOverlay(message: string): void {
  ctx.fillStyle = COLORS.gameOverOverlay;
  ctx.fillRect(canvas.width / 2 - 200, canvas.height / 2 - 60, 400, 120);

  ctx.strokeStyle = COLORS.gameOverBorder;
  ctx.lineWidth = 3;
  ctx.strokeRect(canvas.width / 2 - 200, canvas.height / 2 - 60, 400, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 15);

  ctx.font = '18px Arial';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText('Click to play again', canvas.width / 2, canvas.height / 2 + 25);
}

/**
 * Convert screen coordinates to board coordinates (accounting for tilt)
 */
export function screenToBoard(screenX: number, screenY: number): { row: number; col: number } | null {
  const rect = canvas.getBoundingClientRect();
  let x = screenX - rect.left;
  let y = screenY - rect.top;

  // Reverse the tilt transformation
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const cos = Math.cos(-TILT_ANGLE);
  const sin = Math.sin(-TILT_ANGLE);

  const dx = x - cx;
  const dy = y - cy;
  x = cx + dx * cos - dy * sin;
  y = cy + dx * sin + dy * cos;

  // Account for board offset
  const boardX = x - BOARD_OFFSET_X;
  const boardY = y - BOARD_OFFSET_Y;

  const col = Math.floor(boardX / TILE_SIZE);
  const row = Math.floor(boardY / TILE_SIZE);

  if (row < 0 || row >= 8 || col < 0 || col >= 8) {
    return null;
  }

  return { row, col };
}

// =============================================================================
// DRAWING FUNCTIONS
// =============================================================================

function drawInfiniteRibbon(): void {
  // Use cached ribbon if available and not dirty (major performance improvement)
  if (!ribbonDirty && ribbonCanvas && ribbonCtx && scrollOffset === 0) {
    ctx.drawImage(ribbonCanvas, 0, 0);
    return;
  }

  // Target context: use offscreen if no animation, main canvas if animating
  const targetCtx = (scrollOffset === 0 && ribbonCtx) ? ribbonCtx : ctx;

  targetCtx.save();

  // Fill background with void color
  targetCtx.fillStyle = COLORS.voidColor;
  targetCtx.fillRect(0, 0, canvas.width, canvas.height);

  // Apply tilt transformation
  targetCtx.translate(canvas.width / 2, canvas.height / 2);
  targetCtx.rotate(TILT_ANGLE);
  targetCtx.translate(-canvas.width / 2, -canvas.height / 2);

  // Apply scroll offset for win animation (scroll upward = positive offset moves content up)
  targetCtx.translate(0, -scrollOffset);

  const boardWidth = TILE_SIZE * 8;
  const boardHeight = TILE_SIZE * 8;

  // Draw infinite extension UPWARD (past boards, fading)
  for (let ext = 1; ext <= RIBBON.extensionCount; ext++) {
    const alpha = Math.max(RIBBON.minAlpha, 1 - ext * RIBBON.alphaFadeRate);
    const scale = 1 - ext * RIBBON.scaleShrinkRate;

    targetCtx.save();
    const extOffsetY = BOARD_OFFSET_Y - ext * boardHeight * scale;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const baseColor = isLight ? COLORS.infiniteLight : COLORS.infiniteDark;

        targetCtx.globalAlpha = alpha * RIBBON.fadedBoardOpacity;
        targetCtx.fillStyle = baseColor;

        const x = BOARD_OFFSET_X + col * TILE_SIZE * scale;
        const y = extOffsetY + row * TILE_SIZE * scale;
        targetCtx.fillRect(x, y, TILE_SIZE * scale + 1, TILE_SIZE * scale + 1);
      }
    }
    targetCtx.restore();
  }

  // Draw infinite extension DOWNWARD (future boards, fading)
  for (let ext = 1; ext <= RIBBON.extensionCount; ext++) {
    const alpha = Math.max(RIBBON.minAlpha, 1 - ext * RIBBON.alphaFadeRate);
    const scale = 1 - ext * RIBBON.scaleShrinkRate;

    targetCtx.save();
    const extOffsetY = BOARD_OFFSET_Y + boardHeight + (ext - 1) * boardHeight * scale;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const baseColor = isLight ? COLORS.infiniteLight : COLORS.infiniteDark;

        targetCtx.globalAlpha = alpha * RIBBON.fadedBoardOpacity;
        targetCtx.fillStyle = baseColor;

        const x = BOARD_OFFSET_X + col * TILE_SIZE * scale;
        const y = extOffsetY + row * TILE_SIZE * scale;
        targetCtx.fillRect(x, y, TILE_SIZE * scale + 1, TILE_SIZE * scale + 1);
      }
    }
    targetCtx.restore();
  }

  // Draw edge glow/fade gradients
  targetCtx.globalAlpha = 1;

  // Top fade gradient
  const topGrad = targetCtx.createLinearGradient(0, 0, 0, RIBBON.gradientFadeHeight);
  topGrad.addColorStop(0, COLORS.voidColor);
  topGrad.addColorStop(1, 'transparent');
  targetCtx.fillStyle = topGrad;
  targetCtx.fillRect(0, 0, canvas.width, RIBBON.gradientFadeHeight);

  // Bottom fade gradient
  const bottomGrad = targetCtx.createLinearGradient(0, canvas.height - RIBBON.gradientFadeHeight, 0, canvas.height);
  bottomGrad.addColorStop(0, 'transparent');
  bottomGrad.addColorStop(1, COLORS.voidColor);
  targetCtx.fillStyle = bottomGrad;
  targetCtx.fillRect(0, canvas.height - RIBBON.gradientFadeHeight, canvas.width, RIBBON.gradientFadeHeight);

  targetCtx.restore();

  // If we rendered to offscreen canvas, copy to main canvas and mark clean
  if (scrollOffset === 0 && ribbonCanvas && targetCtx === ribbonCtx) {
    ribbonDirty = false;
    ctx.drawImage(ribbonCanvas, 0, 0);
  }
}

function drawBoard(): void {
  ctx.save();

  // Apply tilt
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(TILT_ANGLE);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  const borderWidth = 12;
  const boardWidth = TILE_SIZE * 8;
  const boardHeight = TILE_SIZE * 8;

  // Draw ornate Victorian frame
  // Outer shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 8;

  // Frame base (dark wood)
  ctx.fillStyle = COLORS.boardBorder;
  ctx.fillRect(
    BOARD_OFFSET_X - borderWidth,
    BOARD_OFFSET_Y - borderWidth,
    boardWidth + borderWidth * 2,
    boardHeight + borderWidth * 2
  );
  ctx.shadowColor = 'transparent';

  // Inner gold inlay
  ctx.strokeStyle = COLORS.goldAccent;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    BOARD_OFFSET_X - borderWidth + 3,
    BOARD_OFFSET_Y - borderWidth + 3,
    boardWidth + borderWidth * 2 - 6,
    boardHeight + borderWidth * 2 - 6
  );

  // Inner bronze accent
  ctx.strokeStyle = COLORS.bronzeAccent;
  ctx.lineWidth = 1;
  ctx.strokeRect(
    BOARD_OFFSET_X - 2,
    BOARD_OFFSET_Y - 2,
    boardWidth + 4,
    boardHeight + 4
  );

  // Draw corner ornaments
  const cornerSize = 8;
  ctx.fillStyle = COLORS.goldAccent;
  const corners = [
    [BOARD_OFFSET_X - borderWidth + 2, BOARD_OFFSET_Y - borderWidth + 2],
    [BOARD_OFFSET_X + boardWidth + borderWidth - cornerSize - 2, BOARD_OFFSET_Y - borderWidth + 2],
    [BOARD_OFFSET_X - borderWidth + 2, BOARD_OFFSET_Y + boardHeight + borderWidth - cornerSize - 2],
    [BOARD_OFFSET_X + boardWidth + borderWidth - cornerSize - 2, BOARD_OFFSET_Y + boardHeight + borderWidth - cornerSize - 2]
  ];
  for (const [cx, cy] of corners) {
    // Diamond shape
    ctx.beginPath();
    ctx.moveTo(cx + cornerSize / 2, cy);
    ctx.lineTo(cx + cornerSize, cy + cornerSize / 2);
    ctx.lineTo(cx + cornerSize / 2, cy + cornerSize);
    ctx.lineTo(cx, cy + cornerSize / 2);
    ctx.closePath();
    ctx.fill();
  }

  // Draw board border inner line
  ctx.strokeStyle = COLORS.boardInlay;
  ctx.lineWidth = 1;
  ctx.strokeRect(BOARD_OFFSET_X, BOARD_OFFSET_Y, boardWidth, boardHeight);

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const isSelected = cachedSelectedSquare &&
        cachedSelectedSquare.row === row &&
        cachedSelectedSquare.col === col;

      if (isSelected) {
        ctx.fillStyle = COLORS.selectedSquare;
      } else {
        const isLight = (row + col) % 2 === 0;
        ctx.fillStyle = isLight ? COLORS.lightSquare : COLORS.darkSquare;
      }

      ctx.fillRect(
        BOARD_OFFSET_X + col * TILE_SIZE,
        BOARD_OFFSET_Y + row * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }

  // Draw legal move highlights
  for (const move of cachedLegalMoves) {
    ctx.fillStyle = COLORS.legalMoveHighlight;
    ctx.beginPath();
    ctx.arc(
      BOARD_OFFSET_X + move.to.col * TILE_SIZE + TILE_SIZE / 2,
      BOARD_OFFSET_Y + move.to.row * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE / 4,
      0, Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();
}

// Internal helper: draws a piece at the given position (assumes transform already applied)
function drawPieceInternal(piece: Piece, row: number, col: number): void {
  const x = BOARD_OFFSET_X + col * TILE_SIZE;
  const y = BOARD_OFFSET_Y + row * TILE_SIZE;
  const pieceSize = TILE_SIZE * 0.85;
  const offset = (TILE_SIZE - pieceSize) / 2;

  // Draw piece shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  // Try to draw SVG image, fallback to letter if not loaded
  const image = getPieceImage(piece.type, piece.color);
  if (piecesLoaded && image && image.complete) {
    ctx.drawImage(image, x + offset, y + offset, pieceSize, pieceSize);
  } else {
    // Fallback: draw circle with letter
    const centerX = x + TILE_SIZE / 2;
    const centerY = y + TILE_SIZE / 2;
    const radius = TILE_SIZE * 0.38;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = piece.color === 'white' ? '#f5f5dc' : '#2d2d2d';
    ctx.fill();
    ctx.strokeStyle = piece.color === 'white' ? '#8b7355' : '#c9a227';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = piece.color === 'white' ? '#1a1a2e' : '#c9a227';
    ctx.font = 'bold 26px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(piece.type, centerX, centerY);
  }

  // Reset shadow after each piece
  ctx.shadowColor = 'transparent';
}

// Batched piece rendering: apply tilt transform once for all pieces
function drawPieces(): void {
  ctx.save();

  // Apply tilt transform ONCE for all pieces (was previously done per-piece)
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(TILT_ANGLE);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = cachedBoard[row]?.[col];
      if (piece) {
        drawPieceInternal(piece, row, col);
      }
    }
  }

  ctx.restore();
}

function drawTurnIndicator(): void {
  // Draw at bottom, outside the tilted area
  ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
  ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${cachedTurn.toUpperCase()}'s turn${cachedInCheck ? ' - CHECK!' : ''}`,
    canvas.width / 2,
    canvas.height - 20
  );
}
