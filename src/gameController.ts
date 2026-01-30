// src/gameController.ts
// Pure game logic - NO rendering code here
// This can be used with Canvas2D, WebGL, Three.js, or any renderer

import { engine, type Move } from './chessEngine';
import { aiService } from './aiService';
import { getLevelForElo, getLevelProgress, checkLevelChange, type LevelInfo } from './levelSystem';
import { createDefaultSave, downloadSave, loadSaveFromFile, updateStatsAfterGame, recordPromotion, type SaveData, type PromotedPiece } from './saveSystem';
import { calculateEloChange } from './gameState';
import { BALANCE, TIMING } from './constants';
import type { PieceColor, Piece, PieceType } from './types';

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
  selectedSquare: { row: number; col: number } | null;
  legalMovesForSelected: Move[];
}

// Internal mutable state
let state: GameState = {
  elo: BALANCE.startingElo,
  gamesWon: 0,
  gamesLost: 0,
  gamesPlayed: 0,
  playerColor: 'white',
  gameOver: false,
  selectedSquare: null,
  legalMovesForSelected: [],
};

// Track promotions made during current game (only saved if player wins)
let currentGamePromotions: Array<'Q' | 'R' | 'B' | 'N'> = [];

// Saved promoted pieces from previous wins
let savedPromotedPieces: PromotedPiece[] = [];

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
  state.selectedSquare = null;
  state.legalMovesForSelected = [];

  // Load saved promoted pieces
  savedPromotedPieces = currentSaveData.promotedPieces || [];
  currentGamePromotions = [];

  // Start with custom position if we have promoted pieces
  setupBoardWithPromotions();

  notifyStateChange();

  console.log('[Game] Initialized fresh game - ELO:', state.elo);
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
    promotedPieces: savedPromotedPieces,
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
    savedPromotedPieces = data.promotedPieces || [];

    // Reset current game state
    state.gameOver = false;
    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    currentGamePromotions = [];

    // Setup board with loaded promoted pieces
    setupBoardWithPromotions();

    notifyStateChange();
    console.log('[Game] Loaded save - ELO:', state.elo, 'Promoted pieces:', savedPromotedPieces.length);
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
 * Handle a click on a board square
 * Returns true if a move was made
 */
export function handleSquareClick(row: number, col: number): boolean {
  if (state.gameOver) return false;
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
      let promotion: 'Q' | 'R' | 'B' | 'N' | undefined;

      // Auto-queen for now (TODO: promotion UI)
      if (movingPiece?.type === 'P' && (row === 0 || row === 7)) {
        promotion = 'Q';
        // Track this promotion (will be saved if player wins)
        currentGamePromotions.push(promotion);
        console.log('[Game] Pawn promoted to', promotion, '- will be saved if you win!');
      }

      const result = engine.makeMove(state.selectedSquare, { row, col }, promotion);

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
 * Start a new game
 */
export function newGame(): void {
  state.gameOver = false;
  state.selectedSquare = null;
  state.legalMovesForSelected = [];
  currentGamePromotions = [];

  // CRITICAL: Ensure savedPromotedPieces and currentSaveData.promotedPieces stay synced
  // Use whichever has more pieces (they should match, but sync if not)
  if (currentSaveData.promotedPieces.length > savedPromotedPieces.length) {
    savedPromotedPieces = currentSaveData.promotedPieces;
  } else if (savedPromotedPieces.length > currentSaveData.promotedPieces.length) {
    currentSaveData = { ...currentSaveData, promotedPieces: savedPromotedPieces };
  }

  console.log('[Game] newGame - savedPromotedPieces:', savedPromotedPieces.length, 'currentSaveData:', currentSaveData.promotedPieces.length);

  // Setup board with any saved promoted pieces
  setupBoardWithPromotions();

  notifyStateChange();
  console.log('[Game] New game started with', savedPromotedPieces.length, 'bonus pieces');
}

// Current piece arrangement (can be customized by player after wins)
let currentArrangement: Array<{ row: number, col: number, type: PieceType }> = [];

/**
 * Setup the board with custom arrangement or promoted pieces
 * Custom arrangement (from setup mode) takes priority and replaces ALL white pieces
 * Otherwise, promoted pieces replace pawns first, then back rank pieces
 */
function setupBoardWithPromotions(): void {
  engine.reset();

  // Get current board to modify
  const board = engine.getBoard();

  // Track player pieces for castling rights
  let piecesToPlace: typeof savedPromotedPieces = [];

  // If we have a custom arrangement from setup mode, use it
  if (currentArrangement.length > 0) {
    console.log('[Game] Applying custom arrangement with', currentArrangement.length, 'pieces');

    // Clear white's rows (6 and 7) first
    for (let col = 0; col < 8; col++) {
      board[6][col] = null;
      board[7][col] = null;
    }

    // Apply custom arrangement - this is the FULL white setup from the UI
    for (const item of currentArrangement) {
      board[item.row][item.col] = { type: item.type as PieceType, color: 'white' };
    }
  } else {
    // No custom arrangement - use default with any promoted pieces
    if (savedPromotedPieces.length > 0) {
      piecesToPlace = savedPromotedPieces.slice(0, 14);

      // Default slots to place extra pieces
      const defaultSlots = [
        // Pawns first (row 6 = rank 2)
        { row: 6, col: 3 }, // d2
        { row: 6, col: 4 }, // e2
        { row: 6, col: 2 }, // c2
        { row: 6, col: 5 }, // f2
        { row: 6, col: 1 }, // b2
        { row: 6, col: 6 }, // g2
        { row: 6, col: 0 }, // a2
        { row: 6, col: 7 }, // h2
        // Back rank pieces (row 7 = rank 1) - not King(e1) or Queen(d1)
        { row: 7, col: 1 }, // b1 (knight)
        { row: 7, col: 6 }, // g1 (knight)
        { row: 7, col: 2 }, // c1 (bishop)
        { row: 7, col: 5 }, // f1 (bishop)
        { row: 7, col: 0 }, // a1 (rook)
        { row: 7, col: 7 }, // h1 (rook)
      ];

      // Use default placement for promoted pieces
      for (let i = 0; i < piecesToPlace.length; i++) {
        const slot = defaultSlots[i];
        const piece = piecesToPlace[i];
        board[slot.row][slot.col] = { type: piece.type as PieceType, color: 'white' };
      }
    }
  }

  // === AI BONUS PIECES ===
  // Calculate AI bonus pieces based on ELO and player advantage (by value)
  console.log(`[Game] Current ELO: ${state.elo}, calculating AI bonus pieces...`);
  const aiBonusPieces = getAIBonusPieces(state.elo, piecesToPlace);
  console.log(`[Game] AI will get ${aiBonusPieces.length} bonus pieces:`, aiBonusPieces);

  // Apply AI bonus pieces to black side
  applyAIBonusPieces(board, aiBonusPieces);

  // Load the modified position
  // Use Manual Load if we have Custom Arrangement OR AI Bonus Pieces (to ensure they stick)
  const useManualLoad = currentArrangement.length > 0 || aiBonusPieces.length > 0;
  
  console.log(`[Game] useManualLoad: ${useManualLoad} (customArrangement: ${currentArrangement.length}, aiBonusPieces: ${aiBonusPieces.length})`);

  if (useManualLoad) {
    console.log('[Game] Using manual load mode to force AI bonus pieces');
    // For custom arrangements, use manual placement (put) to allow "illegal" pawns
    // Convert board to list of pieces
    const customPieces: Array<{ row: number, col: number, type: PieceType, color: PieceColor }> = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) customPieces.push({ row: r, col: c, type: p.type, color: p.color });
      }
    }
    console.log(`[Game] Manual load with ${customPieces.length} pieces`);
    // Default turn to white for setup (first move)
    engine.loadCustomBoard(customPieces, 'white');
  } else {
    console.log('[Game] Using standard FEN load mode');
    // Standard loading with FEN validation logic
    const whiteKingSide = piecesToPlace.length < 14;
    const whiteQueenSide = piecesToPlace.length < 13;
    const blackKingSide = aiBonusPieces.length < 14;
    const blackQueenSide = aiBonusPieces.length < 13;

    engine.loadPosition(board, 'white', {
      whiteKingSide,
      whiteQueenSide,
      blackKingSide,
      blackQueenSide
    });
  }

  console.log('[Game] Board setup - Player pieces:', piecesToPlace.length, ', AI bonus pieces:', aiBonusPieces.length);
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
 * Check if player has promoted pieces (for showing rearrange button)
 */
export function hasPromotedPieces(): boolean {
  return savedPromotedPieces.length > 0;
}

/**
 * Get the saved promoted pieces list
 */
export function getPromotedPieces(): PromotedPiece[] {
  return [...savedPromotedPieces];
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
 * Get value of a piece type for balancing
 */
// Helper to value pieces
function getPieceValue(type: string): number {
  switch (type) {
    case 'P': return 1;
    case 'N': return 3;
    case 'B': return 3;
    case 'R': return 5;
    case 'Q': return 9;
    case 'K': return 100;
    default: return 0;
  }
}

/**
 * Calculate AI bonus pieces based on ELO (≥3000) OR player having advantage
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

  // ELO Scaling (Base difficulty) - Continuous ramping
  // Formula: For every 50 ELO above 3000, add ~3 points of material (Knight/Bishop value)
  if (elo >= 3000) {
    const eloDiff = elo - 3000;
    // Rate: 3 points per 50 ELO
    // 3100 (+100) => +6 pts (2 Knights)
    // 3500 (+500) => +30 pts (3 Queens + 3 Pawns)
    // 4000 (+1000) => +60 pts (6 Queens + 6 Pawns)
    const extraValue = Math.floor(eloDiff / 50) * 3;
    aiMaterialValue += extraValue;
    console.log(`[AI BONUS] High ELO Bonus: +${extraValue} points for ${eloDiff} ELO above 3000`);
  } else {
    console.log(`[AI BONUS] ELO ${elo} is below 3000 - no ELO bonus`);
  }

  // Compensation: Match player's bonus value (if player has advantage)
  // AI matches player's bonus pieces, allowing 2 free points
  if (playerMaterialValue > 2) {
    const valueNeededToMatch = playerMaterialValue - 2; // Allow 2 points free
    aiMaterialValue += valueNeededToMatch;
    console.log(`[AI BONUS] Compensation for player advantage: +${valueNeededToMatch} points`);
  }

  console.log('[AI BONUS] Total AI material value before cap:', aiMaterialValue);

  // Cap max value to prevent crashes/insanity (max ~15 Queens = 135 pts)
  aiMaterialValue = Math.min(130, aiMaterialValue);
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
function applyAIBonusPieces(board: (Piece | null)[][], bonusPieces: PieceType[]): void {
  if (bonusPieces.length === 0) {
    console.log('[AI] No bonus pieces to apply');
    return;
  }

  console.log(`[AI] Applying ${bonusPieces.length} bonus pieces:`, bonusPieces);

  // Slots to place AI bonus pieces (black side)
  const aiSlots = [
    // Black pawns first (row 1 = rank 7)
    { row: 1, col: 3 }, // d7
    { row: 1, col: 4 }, // e7
    { row: 1, col: 2 }, // c7
    { row: 1, col: 5 }, // f7
    { row: 1, col: 1 }, // b7
    { row: 1, col: 6 }, // g7
    { row: 1, col: 0 }, // a7
    { row: 1, col: 7 }, // h7
    // Black back rank (row 0 = rank 8) - not King(e8) or Queen(d8)
    { row: 0, col: 1 }, // b8 (knight)
    { row: 0, col: 6 }, // g8 (knight)
    { row: 0, col: 2 }, // c8 (bishop)
    { row: 0, col: 5 }, // f8 (bishop)
    { row: 0, col: 0 }, // a8 (rook)
    { row: 0, col: 7 }, // h8 (rook)
  ];

  // Place up to 14 bonus pieces
  const toPlace = bonusPieces.slice(0, 14);
  for (let i = 0; i < toPlace.length; i++) {
    const slot = aiSlots[i];
    const oldPiece = board[slot.row][slot.col];
    board[slot.row][slot.col] = { type: toPlace[i], color: 'black' };
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

function scheduleAIMove(): void {
  if (onAIThinking) onAIThinking(true);

  setTimeout(() => {
    makeAIMoveAsync();
  }, TIMING.aiMoveDelay);
}

async function makeAIMoveAsync(): Promise<void> {
  if (state.gameOver) {
    if (onAIThinking) onAIThinking(false);
    return;
  }

  const level = getLevelForElo(state.elo);

  // Use level system's AI settings (capped for browser performance)
  const depth = Math.min(level.aiDepth, BALANCE.maxAiDepth);
  const blunderChance = level.aiRandomness;

  console.log(`[AI] Level ${level.level} (${level.name}), Depth ${depth}, Blunder: ${(blunderChance * 100).toFixed(0)}%`);

  let move: Move | null = null;

  if (Math.random() < blunderChance) {
    // Make a random move (blunder)
    const legalMoves = engine.getLegalMoves();
    if (legalMoves.length > 0) {
      move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      console.log('[AI] Blundered! Random move');
    }
  } else {
    // Use Web Worker for AI computation (non-blocking)
    try {
      const fen = engine.getFEN();
      const workerMove = await aiService.getBestMove(fen, depth, false);
      
      if (workerMove) {
        // Get actual piece info from the board
        const board = engine.getBoard();
        const piece = board[workerMove.from.row][workerMove.from.col];
        if (piece) {
          move = {
            from: workerMove.from,
            to: workerMove.to,
            piece,
            promotion: workerMove.promotion
          };
        }
      }
    } catch (e) {
      console.error('[AI] Worker error, using fallback:', e);
      move = engine.getBestMove(depth, false);
    }
  }

  if (move) {
    engine.makeMove(move.from, move.to, move.promotion);
    notifyStateChange();
    checkGameEnd();
  } else {
    console.error('[AI] No move found!');
  }

  if (onAIThinking) onAIThinking(false);
}

function checkGameEnd(): void {
  if (engine.isCheckmate()) {
    const winner = engine.turn() === 'white' ? 'black' : 'white';
    handleGameEnd(winner === state.playerColor ? 'win' : 'loss');
  } else if (engine.isStalemate() || engine.isDraw()) {
    handleGameEnd('draw');
  }
}

function handleGameEnd(result: 'win' | 'loss' | 'draw'): void {
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
    message = `Draw! ${eloChange >= 0 ? '+' : ''}${eloChange} ELO`;
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

  // Update in-memory save data (NOT auto-saved to file)
  if (result === 'win') {
    // Count how many pieces SURVIVED on the board
    const board = engine.getBoard();
    let survivingQueens = 0;
    let survivingRooks = 0;
    let survivingBishops = 0;
    let survivingKnights = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.color === state.playerColor) {
          if (piece.type === 'Q') survivingQueens++;
          else if (piece.type === 'R') survivingRooks++;
          else if (piece.type === 'B') survivingBishops++;
          else if (piece.type === 'N') survivingKnights++;
        }
      }
    }

    // Starting amounts (base): 1 Queen, 2 Rooks, 2 Bishops, 2 Knights
    // BONUS pieces = survived pieces minus base amounts
    const bonusQueens = Math.max(0, survivingQueens - 1);
    const bonusRooks = Math.max(0, survivingRooks - 2);
    const bonusBishops = Math.max(0, survivingBishops - 2);
    const bonusKnights = Math.max(0, survivingKnights - 2);

    // Build new promoted pieces list based on what SURVIVED
    // This handles BOTH: new promotions that survived AND old bonus pieces that survived
    const newPromotedPieces: PromotedPiece[] = [];
    for (let i = 0; i < bonusQueens; i++) newPromotedPieces.push({ type: 'Q', earnedAtElo: state.elo, gameNumber: state.gamesPlayed });
    for (let i = 0; i < bonusRooks; i++) newPromotedPieces.push({ type: 'R', earnedAtElo: state.elo, gameNumber: state.gamesPlayed });
    for (let i = 0; i < bonusBishops; i++) newPromotedPieces.push({ type: 'B', earnedAtElo: state.elo, gameNumber: state.gamesPlayed });
    for (let i = 0; i < bonusKnights; i++) newPromotedPieces.push({ type: 'N', earnedAtElo: state.elo, gameNumber: state.gamesPlayed });

    const prevBonusCount = savedPromotedPieces.length;
    const newBonusCount = newPromotedPieces.length;

    console.log('[Game] Previous bonus pieces:', prevBonusCount, '- Surviving bonus pieces:', newBonusCount);

    // Update saved pieces to reflect only what survived
    savedPromotedPieces = newPromotedPieces;
    currentSaveData = { ...currentSaveData, promotedPieces: newPromotedPieces };

    if (newBonusCount > prevBonusCount) {
      const gained = newBonusCount - prevBonusCount;
      console.log('[Game] Earned', gained, 'NEW bonus pieces!');
      message += ` +${gained} piece${gained > 1 ? 's' : ''} earned!`;
    } else if (newBonusCount < prevBonusCount) {
      const lost = prevBonusCount - newBonusCount;
      console.log('[Game] Lost', lost, 'bonus pieces (captured)');
      message += ` -${lost} piece${lost > 1 ? 's' : ''} lost!`;
    }

    console.log('[Game] Total bonus pieces after win:', savedPromotedPieces.length);
  }

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
