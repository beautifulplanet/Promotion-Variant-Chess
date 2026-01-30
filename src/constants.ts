// src/constants.ts
// Centralized configuration - no more magic numbers!

// =============================================================================
// BOARD RENDERING
// =============================================================================

export const TILE_SIZE = 70;
export const BOARD_SIZE = 8;
export const BOARD_OFFSET_X = 170;  // Center the playable board horizontally
export const BOARD_OFFSET_Y = 70;   // Top margin for infinite extension
export const TILT_ANGLE_DEGREES = 3;
export const TILT_ANGLE = TILT_ANGLE_DEGREES * Math.PI / 180;

// =============================================================================
// COLORS - 2027 Modern Professional Theme
// =============================================================================

export const COLORS = {
  // Main board - refined neutral tones
  lightSquare: '#e8e0d0',      // Warm stone
  darkSquare: '#7a9a7a',       // Sage green (muted, sophisticated)
  selectedSquare: '#a8c8a8',   // Light sage highlight
  legalMoveHighlight: 'rgba(120, 160, 120, 0.55)',

  // Infinite ribbon (faded boards extending into void)
  infiniteLight: '#d8d0c0',
  infiniteDark: '#5a7a5a',

  // Background - deep charcoal with slight warmth
  voidColor: '#141414',

  // Board frame - sleek dark metal look
  boardBorder: '#2a2a2a',
  boardShadow: 'rgba(0, 0, 0, 0.6)',
  boardInlay: '#3a3a3a',

  // Pieces (fallback)
  whitePieceGradientStart: '#f8f4e8',
  whitePieceGradientEnd: '#e8e4d8',
  whitePieceStroke: '#2d2d2d',
  whitePieceText: '#2d2d2d',
  blackPieceGradientStart: '#363636',
  blackPieceGradientEnd: '#1a1a1a',
  blackPieceStroke: '#1a1a1a',
  blackPieceText: '#e0e0e0',

  // UI elements
  gameOverOverlay: 'rgba(10, 10, 10, 0.94)',
  gameOverBorder: '#4a4a4a',
  levelUpBackground: '#2a5a3a',
  levelDownBackground: '#5a2a2a',

  // Accent colors
  goldAccent: '#4a4a4a',
  bronzeAccent: '#3a3a3a',
} as const;

// =============================================================================
// TIMING (milliseconds)
// =============================================================================

export const TIMING = {
  aiMoveDelay: 300,           // Delay before AI makes a move (feels more natural)
  levelNotificationDelay: 1500, // Delay before showing level up/down notification
  levelNotificationDuration: 3000, // How long the notification stays visible

  // Win animation
  winScrollDuration: 1200,    // How long the scroll animation takes
  winScrollDistance: 560,     // How far to scroll (1 board height = TILE_SIZE * 8)
} as const;

// =============================================================================
// GAME BALANCE
// =============================================================================

export const BALANCE = {
  startingElo: 400, // Start in Cretaceous (dinosaur) era
  minimumElo: 100,
  maximumElo: 10000,
  eloKFactor: 32,  // Standard K-factor for ELO calculation

  // AI performance cap (depth 4+ freezes browser)
  maxAiDepth: 3,
} as const;

// =============================================================================
// INFINITE RIBBON EFFECT
// =============================================================================

export const RIBBON = {
  extensionCount: 6,        // Number of faded boards in each direction
  alphaFadeRate: 0.18,      // How quickly boards fade out (per extension)
  scaleShrinkRate: 0.03,    // Perspective shrink per extension
  minAlpha: 0,              // Minimum opacity for faded boards
  fadedBoardOpacity: 0.5,   // Base opacity multiplier for extensions
  gradientFadeHeight: 100,  // Height of top/bottom void gradients
} as const;

// =============================================================================
// CANVAS
// =============================================================================

export const CANVAS = {
  width: 800,   // Default canvas width
  height: 700,  // Default canvas height
} as const;
