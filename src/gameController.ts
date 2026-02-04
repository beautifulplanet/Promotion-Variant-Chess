// src/gameController.ts
// Pure game logic - NO rendering code here
// This can be used with Canvas2D, WebGL, Three.js, or any renderer

import { engine, type Move } from './chessEngine';
import { aiService } from './aiService';
import { stockfishEngine } from './stockfishEngine'; // Hybrid AI system
import { learningAI, runTrainingSession } from './learningAI';
import { getLevelForElo, getLevelProgress, checkLevelChange, type LevelInfo } from './levelSystem';
import { calculateEloChange } from './gameState';
import { TIMING, BALANCE, PIECE_POINTS } from './constants';
import type { SaveData, PromotedPiece, BoardProfile, PieceInventory } from './saveSystem';
import { createDefaultSave, downloadSave, loadSaveFromFile, updateStatsAfterGame, recordPromotion, saveBoardProfile, getBoardProfile, deleteBoardProfile, getBoardProfileNames } from './saveSystem';
import type { PieceColor, Piece, PieceType } from './types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
let pieceInventory: PieceInventory = { Q: 0, R: 0, B: 0, N: 0 };

// Track how many pieces are currently deployed from inventory (reset each game)
let deployedFromInventory: PieceInventory = { Q: 0, R: 0, B: 0, N: 0 };

// AI vs AI spectator mode
let aiVsAiMode = false;

// AI move speed (multiplier, 1 = normal, 0.5 = fast, 2 = slow)
let aiMoveSpeedMultiplier = 1;

// Callbacks for UI updates (renderer will register these)
type StateChangeCallback = (state: GameState) => void;
type LevelChangeCallback = (levelName: string, isUp: boolean) => void;
type GameOverCallback = (message: string) => void;
type AIThinkingCallback = (thinking: boolean) => void;
type WinAnimationCallback = () => Promise<void>;
type PlayerWinCallback = () => void;

let onStateChange: StateChangeCallback | null = null;
let onLevelChange: LevelChangeCallback | null = null;
let onGameOver: GameOverCallback | null = null;
let onAIThinking: AIThinkingCallback | null = null;
let onWinAnimation: WinAnimationCallback | null = null;
let onPlayerWin: PlayerWinCallback | null = null;

// Current session save data (in-memory, not persisted until player saves)
let currentSaveData: SaveData = createDefaultSave();

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Initialize the game with fresh state (no auto-load)
 */
export function initGame(): GameState {
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
  pieceInventory = currentSaveData.pieceInventory || { Q: 0, R: 0, B: 0, N: 0 };
  deployedFromInventory = { Q: 0, R: 0, B: 0, N: 0 };
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
    highestElo: Math.max(currentSaveData.highestElo, state.elo)
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
    pieceInventory = data.pieceInventory || { Q: 0, R: 0, B: 0, N: 0 };
    deployedFromInventory = { Q: 0, R: 0, B: 0, N: 0 };

    // Reset current game state
    state.gameOver = false;
    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    currentGamePromotions = [];

    // Setup board (no auto-deploy - player uses setup mode)
    setupBoardWithPromotions();

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
 * Get number of moves made in current game
 */
export function getMoveCount(): number {
  return engine.getMoveHistory().length;
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

  // Undo the player's last move
  engine.undo();

  // If AI had also moved, undo that too (so player is back to their turn)
  const newHistory = engine.getMoveHistory();
  const turnAfterUndo = engine.turn();
  if (turnAfterUndo !== state.playerColor && newHistory.length > 0) {
    engine.undo(); // Undo AI's move too
    console.log('[Game] Also undid AI move');
  }

  // Clear selection
  state.selectedSquare = null;
  state.legalMovesForSelected = [];
  state.pendingPromotion = null;

  notifyStateChange();
  console.log('[Game] Move undone');
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
export function handleSquareClick(row: number, col: number): boolean {
  if (state.gameOver) return false;
  if (!state.gameStarted) return false;  // Game not started yet
  if (row < 0 || row >= 8 || col < 0 || col >= 8) return false;

  const currentTurn = engine.turn();
  const board = engine.getBoard();
  const clickedPiece = board[row][col];

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
        console.log('[Game] Promotion pending - waiting for player choice');
        return false;  // Move not complete yet
      }

      const result = engine.makeMove(state.selectedSquare, { row, col }, undefined);

      if (result) {
        console.log('[Game] Move made:', result.san);
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
  console.log('[Game] Pawn promoted to', pieceType, '- will be saved if you win!');

  const result = engine.makeMove(from, to, pieceType);

  if (result) {
    console.log('[Game] Promotion move made:', result.san);
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
    console.log('[Game] Promotion cancelled');
    state.pendingPromotion = null;
    notifyStateChange();
  }
}

/**
 * Prepare a new game (player can arrange pieces before starting)
 */
export function newGame(): void {
  state.gameOver = false;
  state.gameStarted = false;  // Wait for player to click Start
  state.selectedSquare = null;
  state.legalMovesForSelected = [];
  state.pendingPromotion = null;
  currentGamePromotions = [];

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
  deployedFromInventory = { Q: 0, R: 0, B: 0, N: 0 };
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
  aiMoveSpeedMultiplier = Math.max(0.1, Math.min(3, speed));
  console.log('[Game] AI speed set to:', aiMoveSpeedMultiplier);
}

/**
 * Get current AI speed multiplier
 */
export function getAiSpeed(): number {
  return aiMoveSpeedMultiplier;
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

  // Player's rows: white = 6-7, black = 0-1
  const playerStartRow = playerColor === 'white' ? 6 : 0;
  const playerEndRow = playerColor === 'white' ? 7 : 1;

  // Calculate player's total deployed bonus pieces for AI matching
  const totalDeployed = deployedFromInventory.Q + deployedFromInventory.R +
    deployedFromInventory.B + deployedFromInventory.N;

  // If we have a custom arrangement from setup mode, use it
  // AND infer the player's color from arrangement row positions (fixes save/load issue)
  if (currentArrangement.length > 0) {
    // Infer player color from where pieces are placed
    // Rows 0-1 = Black's home, Rows 6-7 = White's home
    const hasBlackHome = currentArrangement.some(item => item.row <= 1);
    const hasWhiteHome = currentArrangement.some(item => item.row >= 6);

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

    // Recalculate rows with corrected player color
    const correctedPlayerStartRow = inferredPlayerColor === 'white' ? 6 : 0;
    const correctedPlayerEndRow = inferredPlayerColor === 'white' ? 7 : 1;

    // Clear player's rows first
    for (let col = 0; col < 8; col++) {
      board[correctedPlayerStartRow][col] = null;
      board[correctedPlayerEndRow][col] = null;
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
  // AI gets bonus pieces based on player's deployed count
  console.log(`[Game] Current ELO: ${state.elo}, Player (${playerColor}) deployed: ${totalDeployed}`);
  const aiBonusPieces = getAIBonusPiecesFromDeployed(state.elo, deployedFromInventory);
  console.log(`[Game] AI (${opponentColor}) will get ${aiBonusPieces.length} bonus pieces:`, aiBonusPieces);

  // Apply AI bonus pieces to opponent's side
  applyAIBonusPieces(board, aiBonusPieces, opponentColor);

  // Load the modified position
  const useManualLoad = currentArrangement.length > 0 || totalDeployed > 0 || aiBonusPieces.length > 0;

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
export function deployFromInventory(pieceType: 'Q' | 'R' | 'B' | 'N'): boolean {
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
export function retractToInventory(pieceType: 'Q' | 'R' | 'B' | 'N'): boolean {
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
  pieceInventory.Q += deployedFromInventory.Q;
  pieceInventory.R += deployedFromInventory.R;
  pieceInventory.B += deployedFromInventory.B;
  pieceInventory.N += deployedFromInventory.N;
  deployedFromInventory = { Q: 0, R: 0, B: 0, N: 0 };
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
 * Register callbacks for UI updates
 */
export function registerCallbacks(callbacks: {
  onStateChange?: StateChangeCallback;
  onLevelChange?: LevelChangeCallback;
  onGameOver?: GameOverCallback;
  onAIThinking?: AIThinkingCallback;
  onWinAnimation?: () => Promise<void>;
  onPlayerWin?: PlayerWinCallback;
}): void {
  if (callbacks.onStateChange) onStateChange = callbacks.onStateChange;
  if (callbacks.onLevelChange) onLevelChange = callbacks.onLevelChange;
  if (callbacks.onGameOver) onGameOver = callbacks.onGameOver;
  if (callbacks.onAIThinking) onAIThinking = callbacks.onAIThinking;
  if (callbacks.onWinAnimation) onWinAnimation = callbacks.onWinAnimation;
  if (callbacks.onPlayerWin) onPlayerWin = callbacks.onPlayerWin;
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
 * Calculate AI bonus pieces based on ELO (≥threshold) OR player having advantage
 * Returns array of piece types (Q/R/B/N) for AI to have as extras
 * Uses MATERIAL VALUE to ensure fairness
 */
function getAIBonusPieces(elo: number, playerPieces: PromotedPiece[]): PieceType[] {
  console.log('=== [AI BONUS] Calculating AI bonus pieces ===');
  console.log('[AI BONUS] Input ELO:', elo);
  console.log('[AI BONUS] Player pieces count:', playerPieces.length);

  const bonusPieces: PieceType[] = [];

  // Calculate player's bonus material value
  let playerMaterialValue = 0;
  for (const p of playerPieces) {
    const value = getPieceValue(p.type);
    playerMaterialValue += value;
    console.log(`[AI BONUS] Player piece: ${p.type} = ${value} pts`);
  }
  console.log('[AI BONUS] Total player material value:', playerMaterialValue);

  // Calculate base AI material value based on ELO
  let aiMaterialValue = 0;

  // ELO Scaling (Base difficulty) - Continuous ramping using constants
  if (elo >= BALANCE.aiBonusThresholdElo) {
    const eloDiff = elo - BALANCE.aiBonusThresholdElo;
    const extraValue = Math.floor(eloDiff / 50) * BALANCE.aiBonusPointsPer50Elo;
    aiMaterialValue += extraValue;
    console.log(`[AI BONUS] High ELO Bonus: +${extraValue} points for ${eloDiff} ELO above ${BALANCE.aiBonusThresholdElo}`);
  } else {
    console.log(`[AI BONUS] ELO ${elo} is below ${BALANCE.aiBonusThresholdElo} - no ELO bonus`);
  }

  // Compensation: Match player's bonus value (if player has advantage)
  if (playerMaterialValue > BALANCE.aiBonusPlayerFreePoints) {
    const valueNeededToMatch = playerMaterialValue - BALANCE.aiBonusPlayerFreePoints;
    aiMaterialValue += valueNeededToMatch;
    console.log(`[AI BONUS] Compensation for player advantage: +${valueNeededToMatch} points`);
  }

  console.log('[AI BONUS] Total AI material value before cap:', aiMaterialValue);

  // Cap max value using constant
  aiMaterialValue = Math.min(BALANCE.aiBonusMaxMaterial, aiMaterialValue);
  console.log('[AI BONUS] Final AI material value after cap:', aiMaterialValue);

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
    console.log('[AI BONUS] Capping at 14 pieces (had', bonusPieces.length, ')');
    return bonusPieces.slice(0, 14);
  }

  console.log('=== [AI BONUS] Final result:', bonusPieces.length, 'pieces:', bonusPieces, '===');
  return bonusPieces;
}

/**
 * Apply AI bonus pieces to the board (black side)
 * Replaces pawns first, then back rank pieces (not King/Queen)
 */
function applyAIBonusPieces(board: (Piece | null)[][], bonusPieces: PieceType[], aiColor: PieceColor = 'black'): void {
  if (bonusPieces.length === 0) {
    console.log('[AI] No bonus pieces to apply');
    return;
  }

  console.log(`[AI] Applying ${bonusPieces.length} bonus pieces for ${aiColor}:`, bonusPieces);

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
    console.log(`[AI] Placed ${toPlace[i]} at ${String.fromCharCode(97 + slot.col)}${8 - slot.row} (replaced ${oldPiece?.type || 'empty'})`);
  }

  console.log('[AI] Finished placing bonus pieces:', toPlace.join(', '));
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

function scheduleAIMove(): void {
  console.log('[AI] scheduleAIMove called, gameOver:', state.gameOver, 'gameStarted:', state.gameStarted);
  if (onAIThinking) onAIThinking(true);

  // PERFORMANCE: Cancel any pending AI move to prevent stacking
  if (pendingAIMoveTimeout !== null) {
    clearTimeout(pendingAIMoveTimeout);
    pendingAIMoveTimeout = null;
  }

  // In AI vs AI mode, use 100ms base delay (balanced: fast but UI-responsive)
  // Speed button multiplies this: 0.1x = 10ms (blitz), 2x = 200ms (slow)
  const baseDelay = aiVsAiMode ? 100 : TIMING.aiMoveDelay;
  const delay = Math.round(baseDelay * aiMoveSpeedMultiplier);
  console.log('[AI] Scheduling AI move in', delay, 'ms');

  pendingAIMoveTimeout = window.setTimeout(() => {
    pendingAIMoveTimeout = null;
    makeAIMoveAsync();
  }, delay);
}

async function makeAIMoveAsync(): Promise<void> {
  if (state.gameOver) {
    if (onAIThinking) onAIThinking(false);
    return;
  }

  // In AI vs AI mode, use ELO 1800 settings (Candidate Master level)
  // Otherwise use player's current level
  let depth: number;
  let blunderChance: number;
  let effectiveElo: number; // ELO used for AI strength calculation

  if (aiVsAiMode) {
    // AI vs AI mode: ASYMMETRIC STRENGTH
    // White (player side) = 1800 ELO (Candidate Master - uses Stockfish)  
    // Black (opponent side) = Game ELO (weak at start, scales with progression)
    const currentTurn = engine.turn(); // Returns 'white' or 'black'

    if (currentTurn === 'white') {
      // WHITE = Player's AI (strong, 1800 ELO)
      effectiveElo = 1800; // Fixed strong rating
      const level = getLevelForElo(effectiveElo);
      depth = level.aiDepth;
      blunderChance = 0; // No blunders for strong player AI
      console.log(`[AI vs AI] White: 1800 ELO (Candidate Master), Depth ${depth}, No blunders`);
    } else {
      // BLACK = Opponent AI (uses game's current ELO - starts weak)
      effectiveElo = state.elo;
      const level = getLevelForElo(effectiveElo);
      depth = Math.min(level.aiDepth, BALANCE.maxAiDepth);
      blunderChance = level.aiRandomness;
      console.log(`[AI vs AI] Black: ${effectiveElo} ELO (${level.name}), Depth ${depth}, Blunder: ${(blunderChance * 100).toFixed(0)}%`);
    }
  } else {
    const level = getLevelForElo(state.elo);
    effectiveElo = state.elo;
    depth = Math.min(level.aiDepth, BALANCE.maxAiDepth);
    blunderChance = level.aiRandomness;
    console.log(`[AI] Level ${level.level} (${level.name}), Depth ${depth}, Blunder: ${(blunderChance * 100).toFixed(0)}%`);
  }

  let move: Move | null = null;

  // Get all legal moves first
  const legalMoves = engine.getLegalMoves();

  if (legalMoves.length === 0) {
    console.log('[AI] No legal moves!');
    if (onAIThinking) onAIThinking(false);
    return;
  }

  // For VERY low ELO (high blunder chance), just play fast and random
  // This makes beginners' games feel more natural and responsive
  if (blunderChance >= BALANCE.beginnerBlunderChance) {
    // Beginner AI - mostly random with occasional smart captures
    const roll = Math.random();

    if (roll < BALANCE.beginnerCaptureChance) {
      // Chance to look for any capture (even bad ones) - beginners love captures
      const captureMoves = legalMoves.filter(m => m.capture);
      if (captureMoves.length > 0) {
        move = captureMoves[Math.floor(Math.random() * captureMoves.length)];
        console.log('[AI] Beginner capture!');
      }
    }

    if (!move) {
      // Otherwise just random move
      move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      console.log('[AI] Beginner random move');
    }
    // Beginner AI is done - skip the complex AI logic below
  } else if (blunderChance >= BALANCE.midLevelBlunderChance) {
    // Mid-level AI: Sometimes random, sometimes smart
    if (Math.random() < blunderChance) {
      // Blunder - random move
      move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      console.log('[AI] Mid-level blunder');
    } else {
      // Try to take good captures, else use engine
      const captureMoves = legalMoves.filter(m => m.capture);
      const sortedCaptures = captureMoves.sort((a, b) => {
        const valueA = getPieceValueForCapture(a.capture!.type);
        const valueB = getPieceValueForCapture(b.capture!.type);
        return valueB - valueA;
      });

      if (sortedCaptures.length > 0 && getPieceValueForCapture(sortedCaptures[0].capture!.type) >= BALANCE.valuableCaptureThreshold) {
        move = sortedCaptures[0];
        console.log('[AI] Mid-level taking capture');
      } else {
        // Use engine but with fallback
        try {
          move = engine.getBestMove(depth, false);
          console.log('[AI] Mid-level engine move');
        } catch (e) {
          move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
          console.log('[AI] Mid-level fallback random');
        }
      }
    }
  } else {
    // =========================================================================
    // HYBRID AI SYSTEM: Stockfish for high ELO, custom engine for beginners
    // =========================================================================

    // Decision: Use Stockfish for effectiveElo >= 900, custom engine for beginners
    // In AI vs AI mode: White (1800) uses Stockfish, Black (game ELO) may use custom engine
    const useStockfish = effectiveElo >= BALANCE.stockfishEloThreshold;

    if (useStockfish) {
      // HIGH ELO: Use Stockfish for true chess strength
      console.log(`[AI] Using Stockfish (ELO ${effectiveElo} >= ${BALANCE.stockfishEloThreshold})`);

      try {
        const fen = engine.getFEN();
        const timeout = TIMING.stockfishTimeout;

        // Get move from Stockfish (returns simplified Move object)
        // Pass aiVsAiMode as fastMode to reduce thinking time and prevent freezes
        const stockfishMove = await stockfishEngine.getBestMove(fen, effectiveElo, timeout, aiVsAiMode);

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
            console.log('[AI] Stockfish move:', move);
          } else {
            console.error('[AI] Stockfish returned invalid move (no piece)');
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

      // Fallback to custom engine if Stockfish fails
      if (!move) {
        console.warn('[AI] Stockfish failed, falling back to custom engine');
        try {
          move = engine.getBestMove(depth, false);
          console.log('[AI] Fallback custom engine move');
        } catch (e2) {
          console.error('[AI] Fallback engine also failed, picking random move');
          move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        }
      }

    } else {
      // LOW ELO: Use custom engine (fast, deliberately weak)
      console.log(`[AI] Using custom engine (ELO ${effectiveElo} < ${BALANCE.stockfishEloThreshold})`);

      // Keep existing blunder/capture priority logic for realistic beginner behavior
      const captureMoves = legalMoves.filter(m => m.capture);
      const sortedCaptures = captureMoves.sort((a, b) => {
        const valueA = getPieceValueForCapture(a.capture!.type);
        const valueB = getPieceValueForCapture(b.capture!.type);
        return valueB - valueA;
      });

      // High-value capture priority (even beginners take free pieces sometimes)
      const bestCapture = sortedCaptures.length > 0 ? sortedCaptures[0] : null;
      const captureValue = bestCapture ? getPieceValueForCapture(bestCapture.capture!.type) : 0;

      if (bestCapture && captureValue >= BALANCE.valuableCaptureThreshold && Math.random() > blunderChance / 2) {
        // Sometimes take high-value captures (but beginners still miss them sometimes)
        move = bestCapture;
        console.log(`[AI] Custom engine taking capture: ${bestCapture.capture!.type}`);
      } else if (Math.random() < blunderChance) {
        // Blunder: pick a suboptimal move
        const blunderPool = legalMoves.filter(m => !m.capture || getPieceValueForCapture(m.capture.type) < BALANCE.valuableCaptureThreshold);
        if (blunderPool.length > 0) {
          move = blunderPool[Math.floor(Math.random() * blunderPool.length)];
          console.log('[AI] Custom engine blundered');
        } else {
          move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
          console.log('[AI] Custom engine random (no blunder pool)');
        }
      } else {
        // Use custom engine at low depth (fast)
        try {
          move = engine.getBestMove(depth, false);
          console.log('[AI] Custom engine best move (depth', depth, ')');
        } catch (e) {
          move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
          console.log('[AI] Custom engine failed, random move');
        }
      }
    }
  }

  if (move) {
    const result = engine.makeMove(move.from, move.to, move.promotion);
    if (!result) {
      console.error('[AI] Move was rejected by engine!', move);
    }
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

  if (onAIThinking) onAIThinking(false);
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
    pieceInventory.Q += deployedFromInventory.Q;
    pieceInventory.R += deployedFromInventory.R;
    pieceInventory.B += deployedFromInventory.B;
    pieceInventory.N += deployedFromInventory.N;

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
    pieceInventory.Q += deployedFromInventory.Q;
    pieceInventory.R += deployedFromInventory.R;
    pieceInventory.B += deployedFromInventory.B;
    pieceInventory.N += deployedFromInventory.N;

    // Promotions made during a lost game are lost
    if (currentGamePromotions.length > 0) {
      console.log('[Game] Lost', currentGamePromotions.length, 'promotions (game lost)');
    }
  }

  // Reset deployed tracking
  deployedFromInventory = { Q: 0, R: 0, B: 0, N: 0 };

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
