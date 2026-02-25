// src/gameController.ts
// Pure game logic - NO rendering code here
// This can be used with Canvas2D, WebGL, Three.js, or any renderer

import { engine, type Move, promoteEngine } from './engineProvider';
import { aiService } from './aiService';
import { stockfishEngine } from './stockfishEngine'; // Hybrid AI system
import { learningAI, runTrainingSession } from './learningAI';
import { getLevelForElo, getLevelProgress, checkLevelChange, type LevelInfo } from './levelSystem';
import { calculateEloChange } from './gameState';
import { TIMING, BALANCE, PIECE_POINTS } from './constants';
import type { SaveData, PromotedPiece, BoardProfile, PieceInventory } from './saveSystem';
import { createDefaultSave, downloadSave, loadSaveFromFile, updateStatsAfterGame, recordPromotion, saveBoardProfile, getBoardProfile, deleteBoardProfile, getBoardProfileNames } from './saveSystem';
import { resetOpeningTracking, updateOpeningName } from './openingBook';
import { capturePreMoveAnalysis, analyzePlayerMove, resetMoveQualityTracking, getLastMoveQuality, type MoveQuality } from './moveQualityAnalyzer';
import type { PieceColor, Piece, PieceType } from './types';

// Production-safe logging: stripped by Vite in production builds
const DEBUG_LOG = import.meta.env.DEV
  ? (...args: unknown[]) => console.log(...args)
  : (..._args: unknown[]) => {};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Detect if a move string represents a promotion.
 * Handles both SAN format (e.g. "a8=Q") and UCI format (e.g. "a7a8q").
 */
function isMovePromotion(move: string): boolean {
  if (!move) return false;
  // SAN format: contains '='
  if (move.includes('=')) return true;
  // UCI format: 5-char string ending in promotion piece letter
  if (move.length === 5 && 'qrbnQRBN'.includes(move[4])) return true;
  return false;
}

// Piece values for capture priority (used in AI move selection)
function getPieceValueForCapture(type: PieceType): number {
  switch (type) {
    case 'Q': return 9;
    case 'R': return 5;
    case 'B': return 3;
    case 'N': return 3;
    case 'P': return 1;
    case 'K': return 100; // King captures should never happen legally but just in case
    default: return 0;
  }
}

// =============================================================================
// GAME STATE
// =============================================================================

export interface GameState {
  elo: number;
  gamesWon: number;
  gamesLost: number;
  gamesPlayed: number;
  playerColor: PieceColor;
  gameOver: boolean;
  gameStarted: boolean;  // NEW: Has the game actually started (vs waiting for player to arrange pieces)
  selectedSquare: { row: number; col: number } | null;
  legalMovesForSelected: Move[];
  pendingPromotion: { from: { row: number; col: number }; to: { row: number; col: number } } | null;  // NEW: Awaiting promotion choice
}

// Internal mutable state
let state: GameState = {
  elo: BALANCE.startingElo,
  gamesWon: 0,
  gamesLost: 0,
  gamesPlayed: 0,
  playerColor: 'white',
  gameOver: false,
  gameStarted: false,
  selectedSquare: null,
  legalMovesForSelected: [],
  pendingPromotion: null,
};

// Track promotions made during current game (only saved if player wins)
let currentGamePromotions: Array<'Q' | 'R' | 'B' | 'N'> = [];

// Saved promoted pieces from previous wins (LEGACY - still used for migration)
let savedPromotedPieces: PromotedPiece[] = [];

// NEW: Simple piece inventory - how many of each piece type player has stored
// Includes all pieces except King (P, N, B, R, Q)
let pieceInventory: PieceInventory = { P: 0, N: 0, B: 0, R: 0, Q: 0 };

// Track how many pieces are currently deployed from inventory (reset each game)
let deployedFromInventory: PieceInventory = { P: 0, N: 0, B: 0, R: 0, Q: 0 };

// Max extra pieces that can be deployed (24 = all 3 rows filled)
const MAX_EXTRA_PIECES = 24;

// AI vs AI spectator mode
let aiVsAiMode = false;

// Multiplayer online mode — when true, AI is disabled and moves go to/from server
let multiplayerMode = false;

// AI move speed (multiplier, 1 = normal, 0.5 = fast, 2 = slow)
let aiMoveSpeedMultiplier = 1;

// AI Aggression slider (1-20, default 10)
// 1 = vanilla chess (no AI bonus), 10 = current balanced behavior, 20 = brutal
let aiAggressionLevel = 10;

// Callbacks for UI updates (renderer will register these)
type StateChangeCallback = (state: GameState) => void;
type LevelChangeCallback = (levelName: string, isUp: boolean) => void;
type GameOverCallback = (message: string) => void;
type AIThinkingCallback = (thinking: boolean) => void;
type WinAnimationCallback = () => Promise<void>;
type PlayerWinCallback = () => void;
type MoveAnimationCallback = (data: {
  fromRow: number; fromCol: number;
  toRow: number; toCol: number;
  isCapture: boolean;
  capturedType?: string;
  movingPieceType?: string;
  isCastling?: boolean;
  rookFromCol?: number;
  rookToCol?: number;
}) => void;
let onStateChange: StateChangeCallback | null = null;
let onLevelChange: LevelChangeCallback | null = null;
let onGameOver: GameOverCallback | null = null;
let onAIThinking: AIThinkingCallback | null = null;
let onWinAnimation: WinAnimationCallback | null = null;
let onPlayerWin: PlayerWinCallback | null = null;
let onMultiplayerMove: ((san: string) => void) | null = null;
let onMoveAnimation: MoveAnimationCallback | null = null;

// Current session save data (in-memory, not persisted until player saves)
let currentSaveData: SaveData = createDefaultSave();

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Initialize the game with fresh state (no auto-load)
 */
export function initGame(): GameState {
  // Try upgrading to Rust WASM at game boundary (safe — no history to lose)
  promoteEngine();

  // Start fresh each time - player must manually load their save
  currentSaveData = createDefaultSave();

  state.elo = currentSaveData.elo;
  state.gamesWon = currentSaveData.gamesWon;
  state.gamesLost = currentSaveData.gamesLost;
  state.gamesPlayed = currentSaveData.gamesPlayed;
  state.gameOver = false;
  state.gameStarted = false;  // Wait for player to click Start
  state.selectedSquare = null;
  state.legalMovesForSelected = [];

  // Load saved promoted pieces (LEGACY) and inventory
  savedPromotedPieces = currentSaveData.promotedPieces || [];
  pieceInventory = currentSaveData.pieceInventory || { P: 0, N: 0, B: 0, R: 0, Q: 0 };
  deployedFromInventory = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
  currentGamePromotions = [];

  // Start with standard position
  setupBoardWithPromotions();

  notifyStateChange();

  console.log('[Game] Initialized fresh game - ELO:', state.elo, 'Inventory:', pieceInventory);
  return { ...state };
}

/**
 * Save current progress to a file (manual save)
 */
export function saveProgress(): void {
  currentSaveData = {
    ...currentSaveData,
    elo: state.elo,
    gamesWon: state.gamesWon,
    gamesLost: state.gamesLost,
    gamesPlayed: state.gamesPlayed,
    playerColor: state.playerColor,  // Save player's preferred color
    promotedPieces: savedPromotedPieces,
    pieceInventory: pieceInventory,
    highestElo: Math.max(currentSaveData.highestElo, state.elo),
    // Save current game state for resume
    currentGameFEN: state.gameStarted && !state.gameOver ? engine.getFEN() : undefined,
    currentGameStarted: state.gameStarted && !state.gameOver,
    // Save custom board arrangement (from setup mode)
    customArrangement: currentArrangement.map(p => ({ row: p.row, col: p.col, type: p.type as string })),
    deployedFromInventory: { ...deployedFromInventory },
    // Save AI aggression setting
    aiAggressionLevel: aiAggressionLevel,
  };
  downloadSave(currentSaveData);
}

/**
 * Load progress from a file (manual load)
 */
export async function loadProgress(): Promise<boolean> {
  const data = await loadSaveFromFile();
  if (data) {
    currentSaveData = data;
    state.elo = data.elo;
    state.gamesWon = data.gamesWon;
    state.gamesLost = data.gamesLost;
    state.gamesPlayed = data.gamesPlayed;
    state.playerColor = data.playerColor || 'white';  // Restore player color from save
    savedPromotedPieces = data.promotedPieces || [];
    pieceInventory = data.pieceInventory || { P: 0, N: 0, B: 0, R: 0, Q: 0 };
    // Restore custom arrangement and deployed pieces from save
    deployedFromInventory = data.deployedFromInventory || { P: 0, N: 0, B: 0, R: 0, Q: 0 };
    currentArrangement = (data.customArrangement || []).map(p => ({
      row: p.row,
      col: p.col,
      type: p.type as PieceType
    }));
    console.log('[Game] Restored arrangement:', currentArrangement.length, 'pieces, deployed:', deployedFromInventory);

    // Restore AI aggression setting
    aiAggressionLevel = data.aiAggressionLevel ?? 10;

    // Reset current game state
    state.gameOver = false;
    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    currentGamePromotions = [];

    // Check if there was a game in progress
    if (data.currentGameFEN && data.currentGameStarted) {
      // Restore the game position
      try {
        engine.loadFEN(data.currentGameFEN);
        state.gameStarted = true;
        console.log('[Game] Restored game in progress from FEN:', data.currentGameFEN);
      } catch (e) {
        console.warn('[Game] Failed to restore game position, starting fresh:', e);
        setupBoardWithPromotions();
        state.gameStarted = false;
      }
    } else {
      // Setup board fresh (no auto-deploy - player uses setup mode)
      setupBoardWithPromotions();
      state.gameStarted = false;
    }

    notifyStateChange();
    console.log('[Game] Loaded save - ELO:', state.elo, 'Inventory:', pieceInventory);
    return true;
  }
  return false;
}

/**
 * Get current save data (for display purposes)
 */
export function getCurrentSaveData(): SaveData {
  return { ...currentSaveData };
}

/**
 * Update style preferences in the save data (called when user changes styles)
 */
export function updateStylePreferences(pieceStyle3D?: string, pieceStyle2D?: string, boardStyle?: string): void {
  if (pieceStyle3D !== undefined) {
    currentSaveData = { ...currentSaveData, pieceStyle3D };
  }
  if (pieceStyle2D !== undefined) {
    currentSaveData = { ...currentSaveData, pieceStyle2D };
  }
  if (boardStyle !== undefined) {
    currentSaveData = { ...currentSaveData, boardStyle };
  }
}

/**
 * Get current game state (immutable copy)
 */
export function getState(): GameState {
  return { ...state };
}

/**
 * Set player ELO (for debug purposes)
 */
export function setPlayerElo(newElo: number): void {
  state.elo = Math.max(BALANCE.minimumElo, Math.min(BALANCE.maximumElo, newElo));
  notifyStateChange();
}

/**
 * Get current level info
 */
export function getCurrentLevel(): LevelInfo {
  return getLevelForElo(state.elo);
}

/**
 * Get level progress percentage (0-100)
 */
export function getCurrentProgress(): number {
  return getLevelProgress(state.elo);
}

/**
 * Get whose turn it is
 */
export function getCurrentTurn(): PieceColor {
  return engine.turn();
}

/**
 * Get the board state for rendering
 */
export function getBoard(): (Piece | null)[][] {
  return engine.getBoard();
}

/**
 * Get SAN move history strings (e.g. ["e4","e5","Nf3","Nc6"])
 */
export function getMoveHistoryStrings(): string[] {
  return engine.getMoveHistory();
}

/**
 * Compute captured pieces by comparing current board to starting material.
 * Returns { white: string[], black: string[] } where each string is a Unicode piece symbol.
 */
export function getCapturedPieces(): { white: string[]; black: string[] } {
  const STARTING: Record<string, number> = { P: 8, R: 2, N: 2, B: 2, Q: 1, K: 1 };
  const board = engine.getBoard();
  const current: Record<string, Record<string, number>> = {
    white: { P: 0, R: 0, N: 0, B: 0, Q: 0, K: 0 },
    black: { P: 0, R: 0, N: 0, B: 0, Q: 0, K: 0 },
  };
  for (const row of board) {
    for (const cell of row) {
      if (cell) current[cell.color][cell.type] = (current[cell.color][cell.type] || 0) + 1;
    }
  }
  const SYMBOLS_W: Record<string, string> = { P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔' };
  const SYMBOLS_B: Record<string, string> = { P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚' };
  // "captured by white" = black pieces missing from the board
  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];
  for (const piece of ['Q', 'R', 'B', 'N', 'P']) {
    const missingBlack = Math.max(0, (STARTING[piece] || 0) - (current.black[piece] || 0));
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(SYMBOLS_B[piece]);
    const missingWhite = Math.max(0, (STARTING[piece] || 0) - (current.white[piece] || 0));
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(SYMBOLS_W[piece]);
  }
  return { white: capturedByWhite, black: capturedByBlack };
}

/**
 * Get number of moves made in current game
 */
export function getMoveCount(): number {
  return engine.getMoveHistory().length;
}

/**
 * Generate PGN (Portable Game Notation) for the current game
 */
export function generatePGN(): string {
  const history = engine.getMoveHistory();
  if (history.length === 0) return '';

  const date = new Date();
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

  // Determine result
  let result = '*'; // ongoing
  if (state.gameOver) {
    if (engine.isCheckmate()) {
      // If it's white's turn and checkmate, black won (and vice versa)
      result = engine.turn() === 'white' ? '0-1' : '1-0';
    } else {
      result = '1/2-1/2';
    }
  }

  // Build PGN headers
  const headers = [
    `[Event "Promotion Variant Chess"]`,
    `[Site "https://promotion-variant-chess.vercel.app"]`,
    `[Date "${dateStr}"]`,
    `[White "${state.playerColor === 'white' ? 'Player' : 'Stockfish AI'}"]`,
    `[Black "${state.playerColor === 'black' ? 'Player' : 'Stockfish AI'}"]`,
    `[Result "${result}"]`,
    `[WhiteElo "${state.elo}"]`,
  ];

  // Build move text: "1. e4 e5 2. Nf3 Nc6 ..."
  let moveText = '';
  for (let i = 0; i < history.length; i++) {
    if (i % 2 === 0) {
      moveText += `${Math.floor(i / 2) + 1}. `;
    }
    moveText += history[i] + ' ';
  }
  moveText += result;

  return headers.join('\n') + '\n\n' + moveText.trim();
}

/**
 * Check if in check
 */
export function isInCheck(): boolean {
  return engine.isCheck();
}

/**
 * Undo the last move
 * @returns true if undo was successful
 */
export function undoMove(): boolean {
  if (!state.gameStarted || state.gameOver) {
    console.log('[Game] Cannot undo - game not active');
    return false;
  }

  if (aiVsAiMode) {
    console.log('[Game] Cannot undo during AI vs AI mode');
    return false;
  }

  const moveHistory = engine.getMoveHistory();
  if (moveHistory.length === 0) {
    console.log('[Game] No moves to undo');
    return false;
  }

  // CRITICAL: Cancel any pending or in-progress AI move FIRST.
  // This bumps moveGeneration so any in-flight Stockfish result is discarded,
  // clears the scheduled timeout, sends 'stop' to Stockfish, and resets
  // the AI-thinking UI state.
  cancelPendingAIMove();

  // Always undo moves in pairs (player + AI) so the player gets their turn back.
  // Scenario 1: It's the player's turn (AI already responded) → undo AI move, then player move.
  // Scenario 2: It's the AI's turn (player just moved, AI was in-flight/pending) → undo player move.
  //             BUT this leaves it on the AI's turn, so also undo the PREVIOUS AI move
  //             to give the player back their previous turn. Otherwise the AI just
  //             re-fires and the undo appears to do nothing.
  const currentTurn = engine.turn();

  if (currentTurn === state.playerColor) {
    // Player's turn — AI already moved. Undo AI move first.
    if (engine.undo()) {
      console.log('[Game] Undid AI move');
    } else {
      console.warn('[Game] Failed to undo AI move (no move to undo)');
      return false;
    }
    
    // Now undo the player's move
    if (engine.getMoveHistory().length > 0) {
      const history = engine.getMoveHistory();
      const lastMove = history[history.length - 1];
      if (lastMove && isMovePromotion(lastMove)) {
        currentGamePromotions.pop();
        console.log('[Game] Rolled back promotion credit');
      }
      if (engine.undo()) {
        console.log('[Game] Also undid player move');
      }
    }
  } else {
    // AI's turn — player just moved, AI hasn't responded yet (was cancelled).
    // Just undo the player's move. This puts the player back to the same
    // position they were in before making that move, ready to choose differently.
    const history1 = engine.getMoveHistory();
    const lastMove1 = history1[history1.length - 1];
    if (lastMove1 && isMovePromotion(lastMove1)) {
      currentGamePromotions.pop();
      console.log('[Game] Rolled back promotion credit');
    }
    if (engine.undo()) {
      console.log('[Game] Undid player move (AI was cancelled)');
    } else {
      console.warn('[Game] Failed to undo player move');
      return false;
    }
    // Player is now back to where they were before their move. Their turn.
  }

  // Clear selection
  state.selectedSquare = null;
  state.legalMovesForSelected = [];
  state.pendingPromotion = null;

  notifyStateChange();
  console.log('[Game] Undo complete, now', engine.turn(), 'to move');

  // T2: After undo, if it's now the AI's turn, reschedule the AI move
  // (e.g., player is black and undid to the start — white/AI must move)
  if (!state.gameOver && engine.turn() !== state.playerColor) {
    scheduleAIMove();
  }

  return true;
}

/**
 * Parse algebraic notation (e.g., "e2e4") to row/col coordinates
 */
function parseAlgebraic(move: string): { from: { row: number; col: number }; to: { row: number; col: number } } | null {
  // Handle both "e2e4" and "e2-e4" formats
  const cleaned = move.replace(/[^a-h1-8]/gi, '');
  if (cleaned.length < 4) return null;

  const fromFile = cleaned.charCodeAt(0) - 97; // 'a' = 0
  const fromRank = 8 - parseInt(cleaned[1]);   // '8' = 0, '1' = 7
  const toFile = cleaned.charCodeAt(2) - 97;
  const toRank = 8 - parseInt(cleaned[3]);

  if (fromFile < 0 || fromFile > 7 || fromRank < 0 || fromRank > 7) return null;
  if (toFile < 0 || toFile > 7 || toRank < 0 || toRank > 7) return null;

  return {
    from: { row: fromRank, col: fromFile },
    to: { row: toRank, col: toFile }
  };
}

/**
 * Get the last move made (for highlighting)
 * @returns {from, to} squares or null if no moves
 */
export function getLastMove(): { from: { row: number; col: number }; to: { row: number; col: number } } | null {
  const history = engine.getMoveHistory();
  if (history.length === 0) return null;

  const lastMoveStr = history[history.length - 1];
  return parseAlgebraic(lastMoveStr);
}

/**
 * Handle a click on a board square
 * Returns true if a move was made
 */
// BUGFIX: Reentrance guard — prevent stacked clicks while a click is being processed
let _processingClick = false;

export function handleSquareClick(row: number, col: number): boolean {
  if (_processingClick) return false;
  _processingClick = true;
  try {
    return _handleSquareClickInner(row, col);
  } finally {
    _processingClick = false;
  }
}

function _handleSquareClickInner(row: number, col: number): boolean {
  if (state.gameOver) return false;
  if (!state.gameStarted) {
    // Auto-start the game on first move
    startGame();
  }
  if (row < 0 || row >= 8 || col < 0 || col >= 8) return false;

  const currentTurn = engine.turn();

  // T8: Explicit turn guard — reject all clicks when it's not the player's turn
  if (currentTurn !== state.playerColor && !aiVsAiMode) return false;

  const board = engine.getBoard();
  const clickedPiece = board[row][col];

  // Capture pre-move analysis when player first selects a piece (not already selected)
  if (!state.selectedSquare && clickedPiece && clickedPiece.color === currentTurn && currentTurn === state.playerColor) {
    capturePreMoveAnalysis(3);  // Shallow depth for performance
  }

  // If we have a selection, try to move
  if (state.selectedSquare) {
    const isLegalMove = state.legalMovesForSelected.some(
      m => m.to.row === row && m.to.col === col
    );

    if (isLegalMove) {
      const movingPiece = board[state.selectedSquare.row][state.selectedSquare.col];

      // Check if this is a pawn promotion - show UI instead of auto-queen
      if (movingPiece?.type === 'P' && (row === 0 || row === 7)) {
        // Store pending promotion and wait for player choice
        state.pendingPromotion = {
          from: { row: state.selectedSquare.row, col: state.selectedSquare.col },
          to: { row, col }
        };
        state.selectedSquare = null;
        state.legalMovesForSelected = [];
        notifyStateChange();
        DEBUG_LOG('[Game] Promotion pending - waiting for player choice');
        return false;  // Move not complete yet
      }

      const result = engine.makeMove(state.selectedSquare, { row, col }, undefined);

      if (result) {
        DEBUG_LOG('[Game] Move made:', result.san);

        // Fire move animation BEFORE state change
        fireMoveAnimation(state.selectedSquare, { row, col }, result.piece, result.captured, result.flags);

        // In multiplayer mode, send the move to the server
        if (multiplayerMode && onMultiplayerMove) {
          onMultiplayerMove(result.san);
        }

        // Analyze the player's move quality
        const playerMove = state.legalMovesForSelected.find(
          m => m.to.row === row && m.to.col === col
        );
        if (playerMove) {
          analyzePlayerMove(playerMove);
        }

        // Update opening name detection after the move
        updateOpeningName(engine.getFEN());

        state.selectedSquare = null;
        state.legalMovesForSelected = [];
        notifyStateChange();

        checkGameEnd();

        // If game not over and it's AI's turn, trigger AI move
        if (!state.gameOver && engine.turn() !== state.playerColor) {
          scheduleAIMove();
        }
        return true;
      }
    } else if (clickedPiece && clickedPiece.color === currentTurn) {
      // Clicked on another piece of same color - select it
      selectSquare(row, col);
    } else {
      // Deselect
      clearSelection();
    }
  } else {
    // No selection - select a piece if it's the current player's turn
    if (clickedPiece && clickedPiece.color === currentTurn && currentTurn === state.playerColor) {
      selectSquare(row, col);
    }
  }

  notifyStateChange();
  return false;
}

/**
 * Complete a pending pawn promotion with the chosen piece
 * Called from UI after player selects Q/R/B/N
 */
export function completePromotion(pieceType: 'Q' | 'R' | 'B' | 'N'): boolean {
  if (!state.pendingPromotion) {
    console.warn('[Game] No pending promotion to complete');
    return false;
  }

  const { from, to } = state.pendingPromotion;
  state.pendingPromotion = null;

  // Track this promotion (will be saved if player wins)
  currentGamePromotions.push(pieceType);
  DEBUG_LOG('[Game] Pawn promoted to', pieceType, '- will be saved if you win!');

  const result = engine.makeMove(from, to, pieceType);

  if (result) {
    DEBUG_LOG('[Game] Promotion move made:', result.san);

    // Fire move animation BEFORE state change
    fireMoveAnimation(from, to, result.piece, result.captured, result.flags);

    // In multiplayer mode, send the promotion move to the server
    if (multiplayerMode && onMultiplayerMove) {
      onMultiplayerMove(result.san);
    }

    notifyStateChange();

    checkGameEnd();

    // If game not over and it's AI's turn, trigger AI move
    if (!state.gameOver && engine.turn() !== state.playerColor) {
      scheduleAIMove();
    }
    return true;
  } else {
    console.error('[Game] Promotion move rejected by engine!');
    return false;
  }
}

/**
 * Cancel a pending promotion (e.g., if user clicks elsewhere)
 */
export function cancelPromotion(): void {
  if (state.pendingPromotion) {
    DEBUG_LOG('[Game] Promotion cancelled');
    state.pendingPromotion = null;
    notifyStateChange();
  }
}

/**
 * Prepare a new game (player can arrange pieces before starting)
 */
export function newGame(): void {
  // Cancel any pending/in-flight AI moves from previous game
  cancelPendingAIMove();

  state.gameOver = false;
  state.gameStarted = false;  // Wait for player to click Start
  state.selectedSquare = null;
  state.legalMovesForSelected = [];
  state.pendingPromotion = null;
  currentGamePromotions = [];

  // Reset opening tracking for new game
  resetOpeningTracking();

  // Reset move quality tracking for new game
  resetMoveQualityTracking();

  // Alternate colors each game
  state.playerColor = state.playerColor === 'white' ? 'black' : 'white';
  console.log('[Game] Player will play as:', state.playerColor);

  // Sync inventory to currentSaveData
  currentSaveData = { ...currentSaveData, pieceInventory: pieceInventory };

  console.log('[Game] newGame - inventory:', pieceInventory, 'deployed:', deployedFromInventory);

  // Setup board with custom arrangement (includes any deployed pieces)
  setupBoardWithPromotions();

  notifyStateChange();
  console.log('[Game] New game prepared - waiting for Start');
}

/**
 * Actually start the game (after player has arranged pieces)
 */
export function startGame(): void {
  console.log('[Game] startGame called, current state:', {
    gameStarted: state.gameStarted,
    gameOver: state.gameOver,
    playerColor: state.playerColor
  });

  if (state.gameStarted && !state.gameOver) {
    console.log('[Game] Already started and in progress, returning');
    return;  // Already started and game is active - don't restart mid-game
  }

  // Reset game state for new game (or restart after previous game ended)
  state.gameOver = false;
  state.gameStarted = true;
  state.selectedSquare = null;
  state.legalMovesForSelected = [];
  currentGamePromotions = [];  // Reset promotions for new game
  aiVsAiMode = false;  // Normal player game

  // Re-setup board to apply any changes made in setup mode
  setupBoardWithPromotions();

  // Show opening name for starting position
  updateOpeningName(engine.getFEN());

  console.log('[Game] Game started! Player is', state.playerColor, 'Engine turn:', engine.turn());

  // If player is black, AI moves first
  if (state.playerColor === 'black') {
    console.log('[Game] AI (white) moves first - scheduling AI move');
    scheduleAIMove();
  }

  notifyStateChange();
}

/**
 * Start AI vs AI spectator mode
 */
export function startAiVsAi(): void {
  if (state.gameStarted) return;  // Already started

  state.gameStarted = true;
  aiVsAiMode = true;

  // Reset to standard board for AI vs AI
  currentArrangement = [];
  deployedFromInventory = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
  setupBoardWithPromotions();

  console.log('[Game] AI vs AI mode started!');

  // White AI moves first
  scheduleAIMove();

  notifyStateChange();
}

/**
 * Check if currently in AI vs AI mode
 */
export function isAiVsAiMode(): boolean {
  return aiVsAiMode;
}

/**
 * Set AI move speed (0.25 = very fast, 1 = normal, 2 = slow)
 */
export function setAiSpeed(speed: number): void {
  aiMoveSpeedMultiplier = Math.max(0.1, Math.min(10, speed));
  console.log('[Game] AI speed set to:', aiMoveSpeedMultiplier);
}

/**
 * Get current AI speed multiplier
 */
export function getAiSpeed(): number {
  return aiMoveSpeedMultiplier;
}

/**
 * Set AI aggression level (1-20)
 * 1 = vanilla chess, AI gets no bonus pieces
 * 10 = current balanced behavior (default)
 * 20 = brutal — AI gets 2x bonus, rearranges pieces, lower ELO threshold
 */
export function setAiAggression(level: number): void {
  aiAggressionLevel = Math.max(1, Math.min(20, Math.round(level)));
  console.log('[Game] AI aggression set to:', aiAggressionLevel);
}

/**
 * Get current AI aggression level (1-20)
 */
export function getAiAggression(): number {
  return aiAggressionLevel;
}

/**
 * Get the AI bonus material multiplier for the current aggression level.
 * Level 1 = 0.0 (no bonus), Level 10 = 1.0 (standard), Level 20 = 2.0 (double)
 */
export function getAggressionBonusMultiplier(level?: number): number {
  const l = level ?? aiAggressionLevel;
  if (l <= 1) return 0.0;
  if (l <= 10) return (l - 1) / 9;       // 1→0.0, 2→0.111, 5→0.444, 10→1.0
  return 1.0 + (l - 10) * 0.1;           // 11→1.1, 15→1.5, 20→2.0
}

/**
 * Get the ELO threshold for AI bonus pieces at the current aggression level.
 * Levels 1-10: standard threshold (3000)
 * Levels 11-20: progressively lower (2800 down to 1000)
 */
export function getAggressionEloThreshold(level?: number): number {
  const l = level ?? aiAggressionLevel;
  if (l <= 10) return BALANCE.aiBonusThresholdElo;  // 3000
  // Levels 11-20: lower by 200 per level above 10
  return Math.max(1000, BALANCE.aiBonusThresholdElo - (l - 10) * 200);
}

/**
 * Get description text for the current aggression level
 */
export function getAggressionDescription(level?: number): string {
  const l = level ?? aiAggressionLevel;
  if (l <= 1) return 'Passive — AI uses standard pieces only';
  if (l <= 3) return 'Gentle — AI gets minimal bonus pieces';
  if (l <= 5) return 'Easy — AI gets reduced bonus pieces';
  if (l <= 7) return 'Moderate — AI gets most of its bonus pieces';
  if (l <= 9) return 'Balanced — AI nearly matches your advantage';
  if (l === 10) return 'Fair — AI fully matches your deployed pieces';
  if (l <= 12) return 'Tough — AI gets extra bonus + shuffles pieces';
  if (l <= 14) return 'Hard — AI gets 1.4x bonus + piece upgrades';
  if (l <= 16) return 'Very Hard — AI gets 1.6x bonus + pawn upgrades';
  if (l <= 18) return 'Extreme — AI gets 1.8x bonus + full rearrangement';
  return 'Brutal — AI gets 2x bonus + maximum rearrangement';
}

// =============================================================================
// LEARNING AI TRAINING
// =============================================================================

let isTraining = false;

/**
 * Start AI self-play training session
 */
export async function startTraining(
  games: number = 100,
  onProgress?: (current: number, total: number) => void
): Promise<{ wins: number; losses: number; draws: number }> {
  if (isTraining) {
    console.log('[Training] Already training!');
    return { wins: 0, losses: 0, draws: 0 };
  }

  isTraining = true;
  console.log(`[Training] Starting ${games} self-play games...`);

  return new Promise((resolve, reject) => {
    try {
      runTrainingSession({
        gamesPerSession: games,
        depthWhite: BALANCE.trainingDepth,
        depthBlack: BALANCE.trainingDepth,
        onProgress: (current, total) => {
          if (onProgress) onProgress(current, total);
          if (current % 10 === 0) {
            console.log(`[Training] Game ${current}/${total}`);
          }
        },
        onComplete: (stats) => {
          isTraining = false;
          console.log(`[Training] Complete! W:${stats.wins} L:${stats.losses} D:${stats.draws}`);
          resolve(stats);
        },
        onError: (error: Error) => {
          isTraining = false;
          console.error('[Training] Error:', error);
          reject(error);
        }
      });
    } catch (error) {
      isTraining = false;
      console.error('[Training] Failed to start:', error);
      reject(error);
    }
  });
}

/**
 * Get learning AI stats
 */
export function getLearningAIStats(): { generation: number; gamesPlayed: number; winRate: number } {
  return learningAI.getStats();
}

/**
 * Reset learning AI to fresh state
 */
export function resetLearningAI(): void {
  learningAI.reset();
}

/**
 * Check if currently training
 */
export function isCurrentlyTraining(): boolean {
  return isTraining;
}

// Current piece arrangement (can be customized by player in setup mode)
let currentArrangement: Array<{ row: number, col: number, type: PieceType }> = [];

/**
 * Setup the board with custom arrangement from setup mode
 * The setup UI handles deploying pieces from inventory
 * AI gets bonus pieces based on total deployed count
 */
function setupBoardWithPromotions(): void {
  engine.reset();

  // Get current board to modify - this should have all 32 pieces after reset
  const board = engine.getBoard();

  // DEBUG: Count pieces after reset
  let pieceCount = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]) pieceCount++;
    }
  }
  console.log('[Game] Board after reset has', pieceCount, 'pieces');

  // Player's color and opponent's color
  const playerColor = state.playerColor;
  const opponentColor = playerColor === 'white' ? 'black' : 'white';

  // Player's rows: white = 5-7 (3 rows), black = 0-2 (3 rows)
  const playerStartRow = playerColor === 'white' ? 5 : 0;
  const playerEndRow = playerColor === 'white' ? 7 : 2;

  // Calculate player's total deployed bonus pieces for AI matching
  const totalDeployed = deployedFromInventory.P + deployedFromInventory.N +
    deployedFromInventory.B + deployedFromInventory.R + deployedFromInventory.Q;

  // If we have a custom arrangement from setup mode, use it
  // AND infer the player's color from arrangement row positions (fixes save/load issue)
  if (currentArrangement.length > 0) {
    // Infer player color from where pieces are placed
    // Rows 0-2 = Black's home (3 rows), Rows 5-7 = White's home (3 rows)
    const hasBlackHome = currentArrangement.some(item => item.row <= 2);
    const hasWhiteHome = currentArrangement.some(item => item.row >= 5);

    let inferredPlayerColor: PieceColor = state.playerColor;
    if (hasBlackHome && !hasWhiteHome) {
      inferredPlayerColor = 'black';
    } else if (hasWhiteHome && !hasBlackHome) {
      inferredPlayerColor = 'white';
    }

    // Update state if we inferred a different color
    if (inferredPlayerColor !== state.playerColor) {
      console.log('[Game] Inferred player color from arrangement:', inferredPlayerColor);
      state.playerColor = inferredPlayerColor;
    }

    console.log('[Game] Applying custom arrangement with', currentArrangement.length, 'pieces for', inferredPlayerColor);

    // Recalculate rows with corrected player color (3 rows each)
    const correctedPlayerStartRow = inferredPlayerColor === 'white' ? 5 : 0;
    const correctedPlayerEndRow = inferredPlayerColor === 'white' ? 7 : 2;

    // Clear player's 3 rows first
    for (let col = 0; col < 8; col++) {
      for (let row = correctedPlayerStartRow; row <= correctedPlayerEndRow; row++) {
        board[row][col] = null;
      }
    }

    // Apply custom arrangement from setup UI - use INFERRED player's color!
    for (const item of currentArrangement) {
      board[item.row][item.col] = { type: item.type as PieceType, color: inferredPlayerColor };
    }
  }

  // Ensure opponent keeps their standard starting pieces if they were lost (e.g., cached board without them)
  // Only fill empty squares on opponent home ranks
  const fillOpponentHome = (color: PieceColor): void => {
    const homeBackRank = color === 'white' ? 7 : 0;
    const homePawnRank = color === 'white' ? 6 : 1;
    const backRankPieces: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

    // Pawns
    for (let c = 0; c < 8; c++) {
      if (!board[homePawnRank][c]) {
        board[homePawnRank][c] = { type: 'P', color };
      }
    }

    // Back rank pieces
    for (let c = 0; c < 8; c++) {
      if (!board[homeBackRank][c]) {
        board[homeBackRank][c] = { type: backRankPieces[c], color };
      }
    }
  };

  // Fill opponent defaults if missing - use updated state.playerColor (may have been inferred)
  const correctedOpponentColor = state.playerColor === 'white' ? 'black' : 'white';
  fillOpponentHome(correctedOpponentColor);

  // === AI BONUS PIECES ===
  // Convert deployed inventory to PromotedPiece array for AI bonus calculation
  const playerBonusPieces: PromotedPiece[] = [];
  const pieceTypes: Array<'P' | 'N' | 'B' | 'R' | 'Q'> = ['P', 'N', 'B', 'R', 'Q'];
  for (const pieceType of pieceTypes) {
    const count = deployedFromInventory[pieceType];
    for (let i = 0; i < count; i++) {
      playerBonusPieces.push({
        type: pieceType,
        earnedAtElo: state.elo, // Approximate - we don't track exact earn ELO for deployed pieces
        gameNumber: 0 // Unknown for deployed pieces
      });
    }
  }

  console.log(`[Game] Current ELO: ${state.elo}, Player (${playerColor}) deployed: ${totalDeployed}`);
  // Use getAIBonusPieces which respects the 3000 ELO threshold
  const aiBonusPieces = getAIBonusPieces(state.elo, playerBonusPieces);
  console.log(`[Game] AI (${opponentColor}) will get ${aiBonusPieces.length} bonus pieces:`, aiBonusPieces);

  // Apply AI bonus pieces to opponent's side
  applyAIBonusPieces(board, aiBonusPieces, opponentColor);

  // === AI REARRANGEMENT (Aggression levels 11-20) ===
  const aiRearranged = applyAIRearrangement(board, opponentColor);

  // Load the modified position
  const useManualLoad = currentArrangement.length > 0 || totalDeployed > 0 || aiBonusPieces.length > 0 || aiRearranged;

  console.log(`[Game] useManualLoad: ${useManualLoad} (customArrangement: ${currentArrangement.length}, deployed: ${totalDeployed}, aiBonusPieces: ${aiBonusPieces.length})`);

  if (useManualLoad) {
    console.log('[Game] Using manual load mode');
    const customPieces: Array<{ row: number, col: number, type: PieceType, color: PieceColor }> = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) customPieces.push({ row: r, col: c, type: p.type, color: p.color });
      }
    }
    console.log(`[Game] Manual load with ${customPieces.length} pieces`);
    engine.loadCustomBoard(customPieces, 'white');
  } else {
    console.log('[Game] Using standard FEN load mode');
    engine.loadPosition(board, 'white', {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true
    });
  }

  console.log('[Game] Board setup complete - Deployed:', totalDeployed, ', AI bonus:', aiBonusPieces.length);
}

/**
 * Get AI bonus pieces based on player's deployed pieces (new simpler system)
 */
function getAIBonusPiecesFromDeployed(elo: number, deployed: PieceInventory): PieceType[] {
  // Calculate player's deployed piece value
  const pieceValues: Record<string, number> = { Q: 9, R: 5, B: 3, N: 3 };
  const playerBonusValue = deployed.Q * pieceValues.Q +
    deployed.R * pieceValues.R +
    deployed.B * pieceValues.B +
    deployed.N * pieceValues.N;

  if (playerBonusValue === 0) return [];

  // ELO-based scaling: at low ELO AI gets less, at high ELO AI gets equal
  const scaleFactor = Math.min(1, Math.max(0.3, (elo - 400) / 1600));
  const aiTargetValue = Math.round(playerBonusValue * scaleFactor);

  console.log(`[Game] AI bonus calc: player value=${playerBonusValue}, scale=${scaleFactor.toFixed(2)}, AI target=${aiTargetValue}`);

  // Build AI bonus pieces to match target value
  const aiBonusPieces: PieceType[] = [];
  let remainingValue = aiTargetValue;

  // Add Queens first (most value)
  while (remainingValue >= 9) {
    aiBonusPieces.push('Q');
    remainingValue -= 9;
  }
  // Add Rooks
  while (remainingValue >= 5) {
    aiBonusPieces.push('R');
    remainingValue -= 5;
  }
  // Add minor pieces
  while (remainingValue >= 3) {
    aiBonusPieces.push(Math.random() > 0.5 ? 'B' : 'N');
    remainingValue -= 3;
  }

  return aiBonusPieces;
}

/**
 * Get current board layout for rearrangement UI
 */
export function getBoardForRearrangement(): (Piece | null)[][] {
  return engine.getBoard();
}

/**
 * Set custom piece arrangement (called from rearrangement UI)
 */
export function setCustomArrangement(arrangement: Array<{ row: number, col: number, type: PieceType }>): void {
  currentArrangement = arrangement;
  console.log('[Game] Custom arrangement set with', arrangement.length, 'pieces');
}

/**
 * Get current custom arrangement
 */
export function getCustomArrangement(): Array<{ row: number, col: number, type: PieceType }> {
  return [...currentArrangement];
}

// =============================================================================
// BOARD PROFILE MANAGEMENT
// =============================================================================

/**
 * Save current board arrangement as a named profile
 */
export function saveCurrentBoardProfile(name: string): boolean {
  if (currentArrangement.length === 0) {
    console.warn('[Game] No arrangement to save');
    return false;
  }

  const arrangementForSave = currentArrangement.map(p => ({
    row: p.row,
    col: p.col,
    type: p.type as string
  }));

  currentSaveData = saveBoardProfile(currentSaveData, name, arrangementForSave);
  console.log('[Game] Saved board profile:', name);
  return true;
}

/**
 * Load a board profile by name
 */
export function loadBoardProfile(name: string): boolean {
  const profile = getBoardProfile(currentSaveData, name);
  if (!profile) {
    console.warn('[Game] Profile not found:', name);
    return false;
  }

  // Convert to our format
  currentArrangement = profile.arrangement.map(p => ({
    row: p.row,
    col: p.col,
    type: p.type as PieceType
  }));

  console.log('[Game] Loaded board profile:', name, 'with', currentArrangement.length, 'pieces');
  return true;
}

/**
 * Delete a board profile
 */
export function deleteBoardProfileByName(name: string): boolean {
  const beforeCount = currentSaveData.boardProfiles.length;
  currentSaveData = deleteBoardProfile(currentSaveData, name);
  return currentSaveData.boardProfiles.length < beforeCount;
}

/**
 * Get list of all saved board profile names
 */
export function getSavedBoardProfileNames(): string[] {
  return getBoardProfileNames(currentSaveData);
}

/**
 * Get all board profiles
 */
export function getSavedBoardProfiles(): BoardProfile[] {
  return [...currentSaveData.boardProfiles];
}

/**
 * Get a specific board profile by name
 */
export function getBoardProfileByName(name: string): BoardProfile | null {
  return getBoardProfile(currentSaveData, name);
}

/**
 * Check if player has promoted pieces (for showing rearrange button)
 */
export function hasPromotedPieces(): boolean {
  return savedPromotedPieces.length > 0 || getTotalInventoryCount() > 0;
}

/**
 * Get the saved promoted pieces list
 */
export function getPromotedPieces(): PromotedPiece[] {
  return [...savedPromotedPieces];
}

/**
 * Get the piece inventory (NEW simpler system)
 */
export function getPieceInventory(): PieceInventory {
  return { ...pieceInventory };
}

/**
 * Get total count of pieces in inventory
 */
export function getTotalInventoryCount(): number {
  return pieceInventory.Q + pieceInventory.R + pieceInventory.B + pieceInventory.N;
}

// Re-export move quality functions for UI access
export { getLastMoveQuality, getMoveQualityDisplay } from './moveQualityAnalyzer';

/**
 * Get deployed counts (how many pieces deployed from inventory this game)
 */
export function getDeployedFromInventory(): PieceInventory {
  return { ...deployedFromInventory };
}

/**
 * Deploy a piece from inventory to board (called from setup UI)
 * Returns true if successful
 */
export function deployFromInventory(pieceType: 'P' | 'N' | 'B' | 'R' | 'Q'): boolean {
  // Check max extra pieces limit
  const totalDeployed = deployedFromInventory.P + deployedFromInventory.N + deployedFromInventory.B + deployedFromInventory.R + deployedFromInventory.Q;
  if (totalDeployed >= MAX_EXTRA_PIECES) {
    console.log('[Game] Cannot deploy - max extra pieces reached (' + MAX_EXTRA_PIECES + ')');
    return false;
  }

  if (pieceInventory[pieceType] <= 0) {
    console.log('[Game] Cannot deploy', pieceType, '- none in inventory');
    return false;
  }

  pieceInventory[pieceType]--;
  deployedFromInventory[pieceType]++;
  console.log('[Game] Deployed', pieceType, 'from inventory. Remaining:', pieceInventory[pieceType]);
  return true;
}

/**
 * Retract a piece back to inventory (called from setup UI)
 */
export function retractToInventory(pieceType: 'P' | 'N' | 'B' | 'R' | 'Q'): boolean {
  if (deployedFromInventory[pieceType] <= 0) {
    console.log('[Game] Cannot retract', pieceType, '- none deployed');
    return false;
  }

  deployedFromInventory[pieceType]--;
  pieceInventory[pieceType]++;
  console.log('[Game] Retracted', pieceType, 'to inventory. Now have:', pieceInventory[pieceType]);
  return true;
}

/**
 * Reset deployed pieces (return all to inventory)
 */
export function resetDeployedPieces(): void {
  pieceInventory.P += deployedFromInventory.P;
  pieceInventory.N += deployedFromInventory.N;
  pieceInventory.B += deployedFromInventory.B;
  pieceInventory.R += deployedFromInventory.R;
  pieceInventory.Q += deployedFromInventory.Q;
  deployedFromInventory = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
  console.log('[Game] Reset deployed pieces. Inventory:', pieceInventory);
}

/**
 * DEBUG: Force a win for testing
 */
export function debugForceWin(): void {
  console.log('[Game] DEBUG: Forcing win!');
  handleGameEnd('win');
  notifyStateChange();
}

/**
 * DEBUG: Set ELO to a specific value for testing
 */
export function debugSetElo(targetElo: number): void {
  console.log(`[Game] DEBUG: Setting ELO to ${targetElo}`);
  state.elo = targetElo;
  notifyStateChange();
}

/**
 * DEBUG: Add pieces to inventory for testing
 */
export function debugAddToInventory(type: 'P' | 'N' | 'B' | 'R' | 'Q', count: number = 1): void {
  pieceInventory[type] += count;
  console.log(`[Game] DEBUG: Added ${count} ${type} to inventory. Now have:`, pieceInventory);
}

/**
 * Add a piece to inventory (for removing pieces from board during setup)
 * Unlike retract, this doesn't decrement deployed count - it's a fresh add
 */
export function addPieceToInventory(pieceType: 'P' | 'N' | 'B' | 'R' | 'Q'): void {
  pieceInventory[pieceType]++;
  console.log('[Game] Added', pieceType, 'to inventory. Now have:', pieceInventory[pieceType]);
}

/**
 * Get the max extra pieces allowed
 */
export function getMaxExtraPieces(): number {
  return MAX_EXTRA_PIECES;
}

/**
 * Get total deployed from inventory
 */
export function getTotalDeployed(): number {
  return deployedFromInventory.P + deployedFromInventory.N + deployedFromInventory.B + deployedFromInventory.R + deployedFromInventory.Q;
}

/**
 * Register callbacks for UI updates
 */
export function registerCallbacks(callbacks: {
  onStateChange?: StateChangeCallback;
  onLevelChange?: LevelChangeCallback;
  onGameOver?: GameOverCallback;
  onAIThinking?: AIThinkingCallback;
  onWinAnimation?: () => Promise<void>;
  onPlayerWin?: PlayerWinCallback;
  onMultiplayerMove?: (san: string) => void;
  onMoveAnimation?: MoveAnimationCallback;
}): void {
  if (callbacks.onStateChange) onStateChange = callbacks.onStateChange;
  if (callbacks.onLevelChange) onLevelChange = callbacks.onLevelChange;
  if (callbacks.onGameOver) onGameOver = callbacks.onGameOver;
  if (callbacks.onAIThinking) onAIThinking = callbacks.onAIThinking;
  if (callbacks.onWinAnimation) onWinAnimation = callbacks.onWinAnimation;
  if (callbacks.onPlayerWin) onPlayerWin = callbacks.onPlayerWin;
  if (callbacks.onMultiplayerMove) onMultiplayerMove = callbacks.onMultiplayerMove;
  if (callbacks.onMoveAnimation) onMoveAnimation = callbacks.onMoveAnimation;
}

/**
 * Fire the move animation callback with data extracted from a move result.
 * Must be called BEFORE notifyStateChange() so the renderer gets animation
 * data before it rebuilds pieces.
 */
function fireMoveAnimation(
  from: { row: number; col: number },
  to: { row: number; col: number },
  movingPieceType: string,
  captured?: string,
  flags?: string
): void {
  if (!onMoveAnimation) return;
  const isCapture = !!captured || flags === 'e';
  const isCastling = flags === 'k' || flags === 'q';
  let rookFromCol: number | undefined;
  let rookToCol: number | undefined;
  if (isCastling) {
    if (flags === 'k') { rookFromCol = 7; rookToCol = 5; }
    else { rookFromCol = 0; rookToCol = 3; }
  }
  onMoveAnimation({
    fromRow: from.row, fromCol: from.col,
    toRow: to.row, toCol: to.col,
    isCapture, capturedType: captured,
    movingPieceType: movingPieceType.toUpperCase(),
    isCastling, rookFromCol, rookToCol,
  });
}

// =============================================================================
// AI BONUS PIECES SYSTEM
// =============================================================================

/**
 * Get value of a piece type for balancing (uses unified PIECE_POINTS)
 */
function getPieceValue(type: string): number {
  return PIECE_POINTS[type as keyof typeof PIECE_POINTS] || 0;
}

/**
 * Apply AI piece rearrangement based on aggression level (11-20).
 * Levels 1-10: No rearrangement.
 * Levels 11-13: Shuffle AI's knights and bishops on back rank.
 * Levels 14-16: Shuffle all back rank (except king) + upgrade 1-2 pawns to minor pieces.
 * Levels 17-19: Shuffle + upgrade 2-4 pawns to random pieces.
 * Level 20: Full Chess960-style shuffle + up to 4 pawn upgrades.
 * Returns true if any rearrangement was applied.
 */
function applyAIRearrangement(board: (Piece | null)[][], aiColor: PieceColor): boolean {
  if (aiAggressionLevel <= 10) return false;

  const isBlack = aiColor === 'black';
  const backRow = isBlack ? 0 : 7;
  const pawnRow = isBlack ? 1 : 6;

  DEBUG_LOG(`[AI REARRANGE] Aggression level ${aiAggressionLevel}, applying rearrangement for ${aiColor}`);

  // Helper: Fisher-Yates shuffle for an array of indices
  function shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // --- BACK RANK SHUFFLING ---
  // Find the king's column (must not move)
  let kingCol = -1;
  for (let c = 0; c < 8; c++) {
    const piece = board[backRow][c];
    if (piece && piece.type === 'K' && piece.color === aiColor) {
      kingCol = c;
      break;
    }
  }

  if (kingCol === -1) {
    DEBUG_LOG('[AI REARRANGE] Warning: King not found on AI back rank, skipping rearrangement');
    return false;
  }

  if (aiAggressionLevel <= 13) {
    // Levels 11-13: Shuffle only knights and bishops (minor pieces)
    // Find columns that have N or B on AI back rank (not at king or queen col)
    const minorCols: number[] = [];
    for (let c = 0; c < 8; c++) {
      const piece = board[backRow][c];
      if (piece && piece.color === aiColor && (piece.type === 'N' || piece.type === 'B')) {
        minorCols.push(c);
      }
    }

    if (minorCols.length >= 2) {
      // Collect the piece types, shuffle them, put them back
      const minorTypes = minorCols.map(c => board[backRow][c]!.type);
      const shuffled = shuffleArray(minorTypes);
      for (let i = 0; i < minorCols.length; i++) {
        board[backRow][minorCols[i]] = { type: shuffled[i], color: aiColor };
      }
      DEBUG_LOG(`[AI REARRANGE] Shuffled minor pieces on columns:`, minorCols);
    }

  } else {
    // Levels 14-20: Shuffle all back rank pieces except King
    const nonKingCols: number[] = [];
    for (let c = 0; c < 8; c++) {
      if (c === kingCol) continue;
      const piece = board[backRow][c];
      if (piece && piece.color === aiColor) {
        nonKingCols.push(c);
      }
    }

    if (nonKingCols.length >= 2) {
      const types = nonKingCols.map(c => board[backRow][c]!.type);
      const shuffled = shuffleArray(types);
      for (let i = 0; i < nonKingCols.length; i++) {
        board[backRow][nonKingCols[i]] = { type: shuffled[i], color: aiColor };
      }
      DEBUG_LOG(`[AI REARRANGE] Shuffled all back rank pieces (except King) on columns:`, nonKingCols);
    }
  }

  // --- PAWN UPGRADES (Levels 14+) ---
  if (aiAggressionLevel >= 14) {
    // How many pawns to upgrade
    let upgradeCount: number;
    if (aiAggressionLevel <= 16) {
      upgradeCount = aiAggressionLevel - 13;  // 14→1, 15→2, 16→3
    } else {
      upgradeCount = Math.min(4, aiAggressionLevel - 14);  // 17→3, 18→4, 19→4+, 20→4
    }
    upgradeCount = Math.min(upgradeCount, 4);

    // Find pawn columns on AI's pawn row (shuffle to pick random ones)
    const pawnCols: number[] = [];
    for (let c = 0; c < 8; c++) {
      const piece = board[pawnRow][c];
      if (piece && piece.color === aiColor && piece.type === 'P') {
        pawnCols.push(c);
      }
    }

    const shuffledPawnCols = shuffleArray(pawnCols);
    const toUpgrade = shuffledPawnCols.slice(0, upgradeCount);

    // Upgrade type depends on aggression level
    const upgradePool: PieceType[] = aiAggressionLevel <= 16
      ? ['N', 'B']                      // Minor pieces only for moderate aggression
      : ['N', 'B', 'R', 'Q'];           // All piece types for extreme aggression

    for (const col of toUpgrade) {
      const newType = upgradePool[Math.floor(Math.random() * upgradePool.length)];
      board[pawnRow][col] = { type: newType, color: aiColor };
      DEBUG_LOG(`[AI REARRANGE] Upgraded pawn at ${String.fromCharCode(97 + col)}${8 - pawnRow} to ${newType}`);
    }

    DEBUG_LOG(`[AI REARRANGE] Upgraded ${toUpgrade.length} pawns`);
  }

  return true;
}

/**
 * Calculate AI bonus pieces based on ELO (≥threshold) OR player having advantage
 * Returns array of piece types (Q/R/B/N) for AI to have as extras
 * Uses MATERIAL VALUE to ensure fairness
 */
function getAIBonusPieces(elo: number, playerPieces: PromotedPiece[]): PieceType[] {
  DEBUG_LOG('=== [AI BONUS] Calculating AI bonus pieces ===');
  DEBUG_LOG('[AI BONUS] Input ELO:', elo);
  DEBUG_LOG('[AI BONUS] Player pieces count:', playerPieces.length);
  DEBUG_LOG('[AI BONUS] AI Aggression level:', aiAggressionLevel);

  const bonusPieces: PieceType[] = [];

  // At aggression level 1, AI gets zero bonus pieces — vanilla chess
  const bonusMultiplier = getAggressionBonusMultiplier();
  if (bonusMultiplier === 0) {
    DEBUG_LOG('[AI BONUS] Aggression level 1 — no bonus pieces');
    DEBUG_LOG('=== [AI BONUS] Final result: 0 pieces: [] ===');
    return bonusPieces;
  }

  // Calculate player's bonus material value
  let playerMaterialValue = 0;
  for (const p of playerPieces) {
    const value = getPieceValue(p.type);
    playerMaterialValue += value;
    DEBUG_LOG(`[AI BONUS] Player piece: ${p.type} = ${value} pts`);
  }
  DEBUG_LOG('[AI BONUS] Total player material value:', playerMaterialValue);

  // Calculate base AI material value based on ELO
  // Use aggression-adjusted ELO threshold
  let aiMaterialValue = 0;
  const eloThreshold = getAggressionEloThreshold();

  // ELO Scaling (Base difficulty) - Continuous ramping using constants
  if (elo >= eloThreshold) {
    const eloDiff = elo - eloThreshold;
    const extraValue = Math.floor(eloDiff / 50) * BALANCE.aiBonusPointsPer50Elo;
    aiMaterialValue += extraValue;
    DEBUG_LOG(`[AI BONUS] High ELO Bonus: +${extraValue} points for ${eloDiff} ELO above ${eloThreshold}`);
  } else {
    DEBUG_LOG(`[AI BONUS] ELO ${elo} is below ${eloThreshold} - no ELO bonus`);
  }

  // Compensation: Match player's bonus value (if player has advantage)
  if (playerMaterialValue > BALANCE.aiBonusPlayerFreePoints) {
    const valueNeededToMatch = playerMaterialValue - BALANCE.aiBonusPlayerFreePoints;
    aiMaterialValue += valueNeededToMatch;
    DEBUG_LOG(`[AI BONUS] Compensation for player advantage: +${valueNeededToMatch} points`);
  }

  DEBUG_LOG('[AI BONUS] Total AI material value before multiplier:', aiMaterialValue);

  // Apply aggression multiplier
  aiMaterialValue = Math.round(aiMaterialValue * bonusMultiplier);
  DEBUG_LOG(`[AI BONUS] After aggression multiplier (${bonusMultiplier.toFixed(2)}): ${aiMaterialValue}`);

  // Cap max value using constant
  aiMaterialValue = Math.min(BALANCE.aiBonusMaxMaterial, aiMaterialValue);
  DEBUG_LOG('[AI BONUS] Final AI material value after cap:', aiMaterialValue);

  // Convert aiMaterialValue into pieces
  // We fill from largest to smallest to keep piece count manageable, 
  // BUT we mix in some variety so it's not just Queens

  let remainingValue = aiMaterialValue;

  // 1. Add Queens for bulk value (Safe loop)
  let loopCount = 0;
  while (remainingValue >= 9 && loopCount < 100) {
    bonusPieces.push('Q');
    remainingValue -= 9;
    loopCount++;
  }

  // 2. Add Rooks (Safe loop)
  loopCount = 0;
  while (remainingValue >= 5 && loopCount < 100) {
    bonusPieces.push('R');
    remainingValue -= 5;
    loopCount++;
  }

  // 3. Add Bishops/Knights (random blend) (Safe loop)
  loopCount = 0;
  while (remainingValue >= 3 && loopCount < 100) {
    if (Math.random() > 0.5) {
      bonusPieces.push('B');
    } else {
      bonusPieces.push('N');
    }
    remainingValue -= 3;
    loopCount++;
  }

  // 4. Determine if we should upgrade/downgrade for variety?
  // (Optional: randomness is handled by piece mix above)

  // Cap absolute piece count at 14 (slots available)
  // If we have too many pieces (e.g. many small ones), upgrade them?
  // With the greedy approach above (Q -> R -> B/N), we shouldn't exceed 14 easily unless value > 126
  if (bonusPieces.length > 14) {
    DEBUG_LOG('[AI BONUS] Capping at 14 pieces (had', bonusPieces.length, ')');
    return bonusPieces.slice(0, 14);
  }

  DEBUG_LOG('=== [AI BONUS] Final result:', bonusPieces.length, 'pieces:', bonusPieces, '===');
  return bonusPieces;
}

/**
 * Apply AI bonus pieces to the board (black side)
 * Replaces pawns first, then back rank pieces (not King/Queen)
 */
function applyAIBonusPieces(board: (Piece | null)[][], bonusPieces: PieceType[], aiColor: PieceColor = 'black'): void {
  if (bonusPieces.length === 0) {
    DEBUG_LOG('[AI] No bonus pieces to apply');
    return;
  }

  DEBUG_LOG(`[AI] Applying ${bonusPieces.length} bonus pieces for ${aiColor}:`, bonusPieces);

  // Slots to place AI bonus pieces
  // For black: rows 0-1, for white: rows 6-7
  const isBlack = aiColor === 'black';
  const pawnRow = isBlack ? 1 : 6;
  const backRow = isBlack ? 0 : 7;

  const aiSlots = [
    // Pawns first (center to edges)
    { row: pawnRow, col: 3 }, // d file
    { row: pawnRow, col: 4 }, // e file
    { row: pawnRow, col: 2 }, // c file
    { row: pawnRow, col: 5 }, // f file
    { row: pawnRow, col: 1 }, // b file
    { row: pawnRow, col: 6 }, // g file
    { row: pawnRow, col: 0 }, // a file
    { row: pawnRow, col: 7 }, // h file
    // Back rank - not King(e) or Queen(d)
    { row: backRow, col: 1 }, // b (knight)
    { row: backRow, col: 6 }, // g (knight)
    { row: backRow, col: 2 }, // c (bishop)
    { row: backRow, col: 5 }, // f (bishop)
    { row: backRow, col: 0 }, // a (rook)
    { row: backRow, col: 7 }, // h (rook)
  ];

  // Place up to 14 bonus pieces
  const toPlace = bonusPieces.slice(0, 14);
  for (let i = 0; i < toPlace.length; i++) {
    const slot = aiSlots[i];
    const oldPiece = board[slot.row][slot.col];
    board[slot.row][slot.col] = { type: toPlace[i], color: aiColor };
    const rank = isBlack ? (8 - slot.row) : (slot.row - 7 + 8); // Correct rank calculation
    DEBUG_LOG(`[AI] Placed ${toPlace[i]} at ${String.fromCharCode(97 + slot.col)}${8 - slot.row} (replaced ${oldPiece?.type || 'empty'})`);
  }

  DEBUG_LOG('[AI] Finished placing bonus pieces:', toPlace.join(', '));
}

// =============================================================================
// INTERNAL FUNCTIONS
// =============================================================================


function selectSquare(row: number, col: number): void {
  state.selectedSquare = { row, col };
  state.legalMovesForSelected = engine.getLegalMoves().filter(
    m => m.from.row === row && m.from.col === col
  );
}

function clearSelection(): void {
  state.selectedSquare = null;
  state.legalMovesForSelected = [];
}

function notifyStateChange(): void {
  if (onStateChange) {
    onStateChange({ ...state });
  }
}

function getAIElo(): number {
  const level = getLevelForElo(state.elo);
  return Math.floor((level.minElo + level.maxElo) / 2);
}

// PERFORMANCE: Track pending AI move timeout to prevent stacking
let pendingAIMoveTimeout: number | null = null;

// Move generation counter - incremented on undo/new game to invalidate stale AI moves
let moveGeneration = 0;

function scheduleAIMove(): void {
  // In multiplayer mode, opponent moves come from the server — don't use AI
  if (multiplayerMode) return;

  DEBUG_LOG('[AI] scheduleAIMove called, gameOver:', state.gameOver, 'gameStarted:', state.gameStarted);
  if (onAIThinking) onAIThinking(true);

  // PERFORMANCE: Cancel any pending AI move to prevent stacking
  if (pendingAIMoveTimeout !== null) {
    clearTimeout(pendingAIMoveTimeout);
    pendingAIMoveTimeout = null;
  }

  // In AI vs AI (Watch AI) mode, use 5000ms base delay (5s between moves so
  // humans can follow the game).  Speed button multiplies this:
  //   0.5x = 10s (slow study), 1x = 5s (default), 2x = 2.5s, 4x = 1.25s
  const baseDelay = aiVsAiMode ? 5000 : TIMING.aiMoveDelay;
  const delay = Math.round(baseDelay * aiMoveSpeedMultiplier);
  DEBUG_LOG('[AI] Scheduling AI move in', delay, 'ms');

  const generation = moveGeneration;
  pendingAIMoveTimeout = window.setTimeout(() => {
    pendingAIMoveTimeout = null;
    // Discard if undo/new game happened since we were scheduled
    if (generation !== moveGeneration) {
      DEBUG_LOG('[AI] Stale scheduled move discarded (generation mismatch)');
      if (onAIThinking) onAIThinking(false);
      return;
    }
    makeAIMoveAsync(generation);
  }, delay);
}

/**
 * Cancel any pending or in-progress AI move.
 * Called on undo, new game, etc.
 */
function cancelPendingAIMove(): void {
  moveGeneration++;
  if (pendingAIMoveTimeout !== null) {
    clearTimeout(pendingAIMoveTimeout);
    pendingAIMoveTimeout = null;
    console.log('[AI] Cancelled pending AI timeout');
  }
  // Stop Stockfish if it's currently computing
  stockfishEngine.stop();
  if (onAIThinking) onAIThinking(false);
}

async function makeAIMoveAsync(generation: number): Promise<void> {
  if (state.gameOver || generation !== moveGeneration) {
    if (onAIThinking) onAIThinking(false);
    return;
  }

  // =============================================================================
  // STOCKFISH-ONLY AI SYSTEM
  // All AI moves use Stockfish Web Worker for non-blocking computation.
  // Stockfish skill levels 0-20 provide appropriate difficulty scaling.
  // =============================================================================

  let effectiveElo: number; // ELO used for AI strength calculation

  if (aiVsAiMode) {
    // AI vs AI mode: ASYMMETRIC STRENGTH
    // White (player side) = 1800 ELO (Candidate Master)  
    // Black (opponent side) = Game ELO (weak at start, scales with progression)
    const currentTurn = engine.turn();

    if (currentTurn === 'white') {
      effectiveElo = 1800; // Fixed strong rating
      DEBUG_LOG(`[AI vs AI] White: 1800 ELO (Candidate Master)`);
    } else {
      effectiveElo = state.elo;
      const level = getLevelForElo(effectiveElo);
      DEBUG_LOG(`[AI vs AI] Black: ${effectiveElo} ELO (${level.name})`);
    }
  } else {
    const level = getLevelForElo(state.elo);
    effectiveElo = state.elo;
    DEBUG_LOG(`[AI] Level ${level.level} (${level.name}), ELO: ${effectiveElo}`);
  }

  let move: Move | null = null;

  // Get all legal moves first (for fallback)
  const legalMoves = engine.getLegalMoves();

  if (legalMoves.length === 0) {
    DEBUG_LOG('[AI] No legal moves!');
    if (onAIThinking) onAIThinking(false);
    return;
  }

  // Always use Stockfish (runs in Web Worker, non-blocking)
  DEBUG_LOG(`[AI] Using Stockfish with ELO ${effectiveElo}`);

  try {
    const fen = engine.getFEN();
    const timeout = TIMING.stockfishTimeout;

    // Check generation before the async call
    if (generation !== moveGeneration) {
      DEBUG_LOG('[AI] Stale AI move discarded before Stockfish call');
      if (onAIThinking) onAIThinking(false);
      return;
    }

    // Get move from Stockfish (returns simplified Move object)
    // Pass aiVsAiMode as fastMode to reduce thinking time
    const stockfishMove = await stockfishEngine.getBestMove(fen, effectiveElo, timeout, aiVsAiMode);

    // Check generation after the async Stockfish call — undo may have happened while waiting
    if (generation !== moveGeneration) {
      DEBUG_LOG('[AI] Stale AI move discarded after Stockfish returned (undo happened)');
      if (onAIThinking) onAIThinking(false);
      return;
    }

    if (stockfishMove) {
      // Fill in piece information from current board
      const board = engine.getBoard();
      const piece = board[stockfishMove.from.row][stockfishMove.from.col];

      if (piece) {
        move = {
          from: stockfishMove.from,
          to: stockfishMove.to,
          piece,
          promotion: stockfishMove.promotion
        };
        DEBUG_LOG('[AI] Stockfish move:', move);
      } else {
        console.error('[AI] Stockfish returned invalid move (no piece at source)');
        move = null;
      }
    } else {
      console.error('[AI] Stockfish returned null move');
      move = null;
    }
  } catch (e) {
    console.error('[AI] Stockfish error:', e);
    move = null;
  }

  // Fallback: pick a random legal move if Stockfish fails
  // This is non-blocking (instant) so won't freeze the UI
  if (!move) {
    console.warn('[AI] Stockfish failed, falling back to random move');
    move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  // Final generation check right before applying the move
  if (generation !== moveGeneration) {
    console.log('[AI] Stale AI move discarded before applying (undo happened)');
    if (onAIThinking) onAIThinking(false);
    return;
  }

  if (move) {
    const result = engine.makeMove(move.from, move.to, move.promotion);
    if (!result) {
      console.error('[AI] Move was rejected by engine!', move);
    }

    // Fire move animation for AI moves
    if (result) {
      fireMoveAnimation(move.from, move.to, result.piece, result.captured, result.flags);
    }

    // Update opening name detection after AI move
    updateOpeningName(engine.getFEN());

    notifyStateChange();
    checkGameEnd();

    // In AI vs AI mode, schedule next AI move if game not over
    if (aiVsAiMode && !state.gameOver) {
      scheduleAIMove();
    }
  } else {
    console.error('[AI] No move found! Checking if game should end...');
    // Check if there are legal moves - if not, game should end
    const legalMoves = engine.getLegalMoves();
    if (legalMoves.length === 0) {
      console.log('[AI] No legal moves - checking game state');
      checkGameEnd();
    }
  }

  // T7: Only reset thinking state if this is still the current generation.
  // If undo bumped the generation, cancelPendingAIMove() already handled it.
  if (generation === moveGeneration && onAIThinking) onAIThinking(false);
}

function checkGameEnd(): void {
  if (engine.isCheckmate()) {
    const winner = engine.turn() === 'white' ? 'black' : 'white';

    // In AI vs AI mode, just show result without affecting player stats
    if (aiVsAiMode) {
      state.gameOver = true;
      if (onGameOver) {
        onGameOver(`${winner.charAt(0).toUpperCase() + winner.slice(1)} wins by checkmate!`);
      }
      notifyStateChange();
      return;
    }

    handleGameEnd(winner === state.playerColor ? 'win' : 'loss');
  } else if (engine.isStalemate() || engine.isDraw()) {
    // Get specific draw type for better feedback
    const drawType = engine.getDrawType();
    const drawMessages: Record<string, string> = {
      'stalemate': 'Stalemate!',
      'insufficient': 'Draw by insufficient material',
      'fifty-move': 'Draw by 50-move rule',
      'repetition': 'Draw by threefold repetition',
      'agreement': 'Draw by agreement',
      'unknown': 'Game drawn!'
    };
    const drawMessage = drawMessages[drawType] || 'Game drawn!';

    // In AI vs AI mode, just show result without affecting player stats
    if (aiVsAiMode) {
      state.gameOver = true;
      if (onGameOver) {
        onGameOver(drawMessage);
      }
      notifyStateChange();
      return;
    }

    handleGameEnd('draw', drawMessage);
  }
}

function handleGameEnd(result: 'win' | 'loss' | 'draw', drawTypeMessage?: string): void {
  state.gameOver = true;
  const aiElo = getAIElo();
  const oldElo = state.elo;

  state.gamesPlayed++;

  let message: string;
  if (result === 'win') {
    state.gamesWon++;
    const eloChange = calculateEloChange(state.elo, aiElo, 'win');
    state.elo += eloChange;
    message = `You Win! +${eloChange} ELO`;
  } else if (result === 'loss') {
    state.gamesLost++;
    const eloChange = calculateEloChange(state.elo, aiElo, 'loss');
    state.elo += eloChange;
    message = `You Lose! ${eloChange} ELO`;
  } else {
    const eloChange = calculateEloChange(state.elo, aiElo, 'draw');
    state.elo += eloChange;
    // Use specific draw type message if provided
    const drawLabel = drawTypeMessage || 'Draw!';
    message = `${drawLabel} ${eloChange >= 0 ? '+' : ''}${eloChange} ELO`;
  }

  // Clamp ELO
  state.elo = Math.max(BALANCE.minimumElo, Math.min(BALANCE.maximumElo, state.elo));

  // Check for level change
  const levelChange = checkLevelChange(oldElo, state.elo);
  if (levelChange && onLevelChange) {
    const newLevel = getLevelForElo(state.elo);
    setTimeout(() => {
      onLevelChange!(newLevel.name, levelChange === 'up');
    }, TIMING.levelNotificationDelay);
  }

  // === NEW SIMPLER INVENTORY SYSTEM ===
  if (result === 'win') {
    // Return deployed pieces to inventory (they're safe!)
    pieceInventory.P += deployedFromInventory.P;
    pieceInventory.N += deployedFromInventory.N;
    pieceInventory.B += deployedFromInventory.B;
    pieceInventory.R += deployedFromInventory.R;
    pieceInventory.Q += deployedFromInventory.Q;

    // Add any NEW promotions made this game to inventory
    const newPiecesEarned = currentGamePromotions.length;
    for (const type of currentGamePromotions) {
      pieceInventory[type]++;
    }

    if (newPiecesEarned > 0) {
      console.log('[Game] Earned', newPiecesEarned, 'NEW pieces to inventory:', currentGamePromotions);
      message += ` +${newPiecesEarned} piece${newPiecesEarned > 1 ? 's' : ''} to bank!`;
    }

    console.log('[Game] Inventory after win:', pieceInventory);
  } else {
    // LOSS or DRAW: Return deployed pieces to inventory (no penalty for simplicity)
    pieceInventory.P += deployedFromInventory.P;
    pieceInventory.N += deployedFromInventory.N;
    pieceInventory.B += deployedFromInventory.B;
    pieceInventory.R += deployedFromInventory.R;
    pieceInventory.Q += deployedFromInventory.Q;

    // Promotions made during a lost game are lost
    if (currentGamePromotions.length > 0) {
      console.log('[Game] Lost', currentGamePromotions.length, 'promotions (game lost)');
    }
  }

  // Reset deployed tracking
  deployedFromInventory = { P: 0, N: 0, B: 0, R: 0, Q: 0 };

  // Update save data with new inventory
  currentSaveData = { ...currentSaveData, pieceInventory: pieceInventory };

  // === AI LEARNING FROM PLAYER GAMES ===
  // AI learns from every game played against the player
  // If player wins, AI lost - AI learns from loss
  // If player loses, AI won - AI learns from win
  const aiResult = result === 'win' ? 'loss' : result === 'loss' ? 'win' : 'draw';
  const aiWasWhite = state.playerColor === 'black'; // AI is opposite of player
  learningAI.learnFromGame(aiResult, aiWasWhite);
  console.log(`[AI Learning] AI played as ${aiWasWhite ? 'white' : 'black'}, result: ${aiResult}`);

  // Update in-memory save data (player must manually save to keep progress)
  currentSaveData = updateStatsAfterGame(currentSaveData, state.elo, result === 'win', result === 'draw');
  currentSaveData.highestElo = Math.max(currentSaveData.highestElo, state.elo);

  // Remind player to save
  message += '\n(Click Save button to keep progress!)';

  // ALWAYS show game over message immediately so player knows the result
  if (onGameOver) {
    onGameOver(message);
  }

  // Play win animation if player won (animation plays AFTER message is shown)
  if (result === 'win' && onWinAnimation) {
    // Trigger player win callback (for refreshing articles, etc.)
    if (onPlayerWin) {
      onPlayerWin();
    }
    onWinAnimation().then(() => {
      notifyStateChange();
    });
  } else {
    notifyStateChange();
  }
}

// =============================================================================
// MULTIPLAYER MODE
// =============================================================================

/** Check if we're in multiplayer mode */
export function isMultiplayerMode(): boolean {
  return multiplayerMode;
}

/**
 * Start a multiplayer game. Called when server sends 'game_found'.
 * Sets up board for online play with assigned color.
 */
export function startMultiplayerGame(color: 'w' | 'b', fen?: string): void {
  cancelPendingAIMove();
  multiplayerMode = true;
  aiVsAiMode = false;

  state.playerColor = color === 'w' ? 'white' : 'black';
  state.gameOver = false;
  state.gameStarted = true;
  state.selectedSquare = null;
  state.legalMovesForSelected = [];
  state.pendingPromotion = null;
  currentGamePromotions = [];

  // Reset to standard board (no custom setup in multiplayer)
  engine.reset();
  if (fen && fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    engine.loadFEN(fen);
  }

  resetOpeningTracking();
  resetMoveQualityTracking();

  console.log('[Multiplayer] Game started as', state.playerColor);
  notifyStateChange();
}

/**
 * Apply a move received from the server (opponent's move).
 * Uses the engine to validate and apply the move locally.
 */
export function applyRemoteMove(moveStr: string, serverFen?: string): boolean {
  if (!multiplayerMode || state.gameOver) return false;

  // Try to find a matching legal move by SAN
  const legalMoves = engine.getLegalMoves();

  // Find move that matches the SAN string
  for (const move of legalMoves) {
    // We need to test each legal move to see if its SAN matches
    // makeMove returns the SAN; but we can't undo since the interface lacks undoMove
    // So we match by checking if the move's algebraic notation matches
    const from = move.from;
    const to = move.to;

    // Build UCI from the move for comparison
    const fromStr = String.fromCharCode(97 + from.col) + (8 - from.row);
    const toStr = String.fromCharCode(97 + to.col) + (8 - to.row);
    const uci = fromStr + toStr + (move.promotion ? move.promotion.toLowerCase() : '');

    // Check if moveStr matches UCI
    if (moveStr === uci || moveStr === uci.toUpperCase()) {
      const result = engine.makeMove(from, to, move.promotion);
      if (result) {
        console.log('[Multiplayer] Applied opponent move (UCI match):', moveStr);
        fireMoveAnimation(from, to, result.piece, result.captured, result.flags);
        updateOpeningName(engine.getFEN());
        notifyStateChange();
        return true;
      }
    }
  }

  // Try applying the move as SAN directly via engine
  // engine.makeMove works with {from, to} — we can try to parse SAN to find matching move
  // by matching piece type, destination, etc.
  for (const move of legalMoves) {
    const result = engine.makeMove(move.from, move.to, move.promotion);
    if (result && result.san === moveStr) {
      console.log('[Multiplayer] Applied opponent move (SAN match):', moveStr);
      fireMoveAnimation(move.from, move.to, result.piece, result.captured, result.flags);
      updateOpeningName(engine.getFEN());
      notifyStateChange();
      return true;
    }
    // If the move was applied but SAN didn't match, we need to reload from FEN
    if (result) {
      // This move was applied incorrectly — recover from server FEN
      if (serverFen) {
        engine.loadFEN(serverFen);
        console.log('[Multiplayer] Synced board from server FEN after mismatch');
        updateOpeningName(engine.getFEN());
        notifyStateChange();
        return true;
      }
      return false;
    }
  }

  // Last resort: sync from server FEN
  if (serverFen) {
    engine.loadFEN(serverFen);
    console.log('[Multiplayer] Synced board from server FEN (fallback)');
    updateOpeningName(engine.getFEN());
    notifyStateChange();
    return true;
  }

  console.error('[Multiplayer] Could not apply move:', moveStr);
  return false;
}

/**
 * End a multiplayer game. Called when server sends 'game_over'.
 */
export function endMultiplayerGame(result: 'white' | 'black' | 'draw', reason: string, eloChange?: number, newElo?: number): void {
  state.gameOver = true;
  multiplayerMode = false;

  if (eloChange !== undefined && newElo !== undefined) {
    state.elo = newElo;
  }

  let message: string;
  const playerWon = (result === 'white' && state.playerColor === 'white') ||
                    (result === 'black' && state.playerColor === 'black');
  const playerLost = (result === 'white' && state.playerColor === 'black') ||
                     (result === 'black' && state.playerColor === 'white');

  if (result === 'draw') {
    message = `Draw by ${reason}`;
  } else if (playerWon) {
    message = `You win by ${reason}!`;
    state.gamesWon++;
  } else {
    message = `You lose by ${reason}`;
    state.gamesLost++;
  }

  state.gamesPlayed++;

  if (eloChange !== undefined) {
    message += ` (${eloChange >= 0 ? '+' : ''}${eloChange} ELO → ${newElo})`;
  }

  if (onGameOver) onGameOver(message);
  notifyStateChange();
}

/**
 * Leave multiplayer mode (cancel / disconnect).
 */
export function leaveMultiplayer(): void {
  multiplayerMode = false;
  cancelPendingAIMove();
  notifyStateChange();
}
