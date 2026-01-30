/**
 * Sideways Chess - Main Entry Point
 * Uses chess.js engine for move validation and game state
 * Features: Infinite ribbon board with 3D perspective
 */

// Imports must be at the top
import type { PieceType, PieceColor, Piece } from './types';
export type { PieceType, PieceColor, Piece } from './types';

import { engine, type Move } from './chessEngine';
import { getLevelForElo, getLevelProgress, checkLevelChange } from './levelSystem';
import { loadGame, saveGame, updateStatsAfterGame } from './saveSystem';
import { calculateEloChange } from './gameState';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}
const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('Could not get 2D context');
}

// Board settings
const TILE_SIZE = 70;  // Slightly smaller to fit perspective
const BOARD_SIZE = 8;
const BOARD_OFFSET_X = 170;  // Center the playable board horizontally
const BOARD_OFFSET_Y = 70;   // Top margin for infinite extension
const TILT_ANGLE = 3 * Math.PI / 180;  // 3 degrees in radians

// Colors
const LIGHT_SQUARE = '#f0d9b5';
const DARK_SQUARE = '#b58863';
const SELECTED_SQUARE = '#7fc97f';
const LEGAL_MOVE_HIGHLIGHT = 'rgba(100, 200, 100, 0.6)';
const INFINITE_LIGHT = '#d4c4a8';
const INFINITE_DARK = '#9a7b5a';
const VOID_COLOR = '#1a1a2e';

// Game state - load from localStorage
let saveData = loadGame();

// Validate ELO bounds (prevent corrupted/cheated data)
if (typeof saveData.elo !== 'number' || isNaN(saveData.elo) || saveData.elo < 100 || saveData.elo > 10000) {
  console.warn('[Init] Invalid ELO detected, resetting to 400');
  saveData.elo = 400;
  saveGame(saveData);
}

console.log('[Init] Loaded save:', { elo: saveData.elo, games: saveData.gamesPlayed });

let elo = saveData.elo;
let gamesWon = saveData.gamesWon;
let gamesLost = saveData.gamesLost;
let gamesPlayed = saveData.gamesPlayed;

let playerColor: PieceColor = 'white';
let gameOver = false;
let selectedSquare: { row: number; col: number } | null = null;
let legalMovesForSelected: Move[] = [];

// DOM elements
const eloElem = document.getElementById('elo');
const gamesWonElem = document.getElementById('games-won');
const gamesLostElem = document.getElementById('games-lost');
const gamesPlayedElem = document.getElementById('games-played');
const sidebarTurnElem = document.getElementById('sidebar-turn');
const playerLevelElem = document.getElementById('player-level');
const levelNameElem = document.getElementById('level-name');
const eloProgressElem = document.getElementById('elo-progress');
const eloMinElem = document.getElementById('elo-min');
const eloMaxElem = document.getElementById('elo-max');
const levelNotificationElem = document.getElementById('level-notification');

function getAIElo(): number {
  const level = getLevelForElo(elo);
  return Math.floor((level.minElo + level.maxElo) / 2);
}

function updateSidebar(): void {
  const level = getLevelForElo(elo);
  const progress = getLevelProgress(elo);
  const currentTurn = engine.turn();
  
  if (eloElem) eloElem.textContent = String(elo);
  if (gamesWonElem) gamesWonElem.textContent = String(gamesWon);
  if (gamesLostElem) gamesLostElem.textContent = String(gamesLost);
  if (gamesPlayedElem) gamesPlayedElem.textContent = String(gamesPlayed);
  if (sidebarTurnElem) sidebarTurnElem.textContent = currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1);
  if (playerLevelElem) playerLevelElem.textContent = String(level.level);
  if (levelNameElem) levelNameElem.textContent = level.name;
  if (eloProgressElem) eloProgressElem.style.width = `${progress}%`;
  if (eloMinElem) eloMinElem.textContent = String(level.minElo);
  if (eloMaxElem) eloMaxElem.textContent = String(level.maxElo);
}

function showLevelUpNotification(levelName: string, isUp: boolean): void {
  if (levelNotificationElem) {
    levelNotificationElem.style.display = 'block';
    levelNotificationElem.style.background = isUp ? '#2a9d8f' : '#e76f51';
    levelNotificationElem.innerHTML = `<div style="font-weight:bold;">${isUp ? 'LEVEL UP!' : 'LEVEL DOWN'}</div><div style="font-size:0.9em;">${levelName}</div>`;
    setTimeout(() => {
      levelNotificationElem.style.display = 'none';
    }, 3000);
  }
}

// Drawing functions

/**
 * Draw the infinite ribbon effect - board extending into the void (vertical)
 */
function drawInfiniteRibbon(): void {
  ctx.save();
  
  // Fill background with void color
  ctx.fillStyle = VOID_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Apply tilt transformation
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(TILT_ANGLE);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  
  const boardWidth = TILE_SIZE * 8;
  const boardHeight = TILE_SIZE * 8;
  
  // Draw infinite extension UPWARD (past boards, fading)
  for (let ext = 1; ext <= 6; ext++) {
    const alpha = Math.max(0, 1 - ext * 0.18);
    const scale = 1 - ext * 0.03;  // Slight perspective shrink
    
    ctx.save();
    const extOffsetY = BOARD_OFFSET_Y - ext * boardHeight * scale;
    
    // Draw faded board extension
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const baseColor = isLight ? INFINITE_LIGHT : INFINITE_DARK;
        
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = baseColor;
        
        const x = BOARD_OFFSET_X + col * TILE_SIZE * scale;
        const y = extOffsetY + row * TILE_SIZE * scale;
        ctx.fillRect(x, y, TILE_SIZE * scale + 1, TILE_SIZE * scale + 1);
      }
    }
    ctx.restore();
  }
  
  // Draw infinite extension DOWNWARD (future boards, fading)
  for (let ext = 1; ext <= 6; ext++) {
    const alpha = Math.max(0, 1 - ext * 0.18);
    const scale = 1 - ext * 0.03;
    
    ctx.save();
    const extOffsetY = BOARD_OFFSET_Y + boardHeight + (ext - 1) * boardHeight * scale;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const baseColor = isLight ? INFINITE_LIGHT : INFINITE_DARK;
        
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = baseColor;
        
        const x = BOARD_OFFSET_X + col * TILE_SIZE * scale;
        const y = extOffsetY + row * TILE_SIZE * scale;
        ctx.fillRect(x, y, TILE_SIZE * scale + 1, TILE_SIZE * scale + 1);
      }
    }
    ctx.restore();
  }
  
  // Draw edge glow/fade gradients
  ctx.globalAlpha = 1;
  
  // Top fade gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, 100);
  topGrad.addColorStop(0, VOID_COLOR);
  topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, canvas.width, 100);
  
  // Bottom fade gradient
  const bottomGrad = ctx.createLinearGradient(0, canvas.height - 100, 0, canvas.height);
  bottomGrad.addColorStop(0, 'transparent');
  bottomGrad.addColorStop(1, VOID_COLOR);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
  
  ctx.restore();
}

/**
 * Draw the main playable board
 */
function drawBoard(): void {
  ctx.save();
  
  // Apply tilt
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(TILT_ANGLE);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  
  // Draw board shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#000';
  ctx.fillRect(BOARD_OFFSET_X - 2, BOARD_OFFSET_Y - 2, TILE_SIZE * 8 + 4, TILE_SIZE * 8 + 4);
  ctx.shadowColor = 'transparent';
  
  // Draw board border
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 4;
  ctx.strokeRect(BOARD_OFFSET_X - 2, BOARD_OFFSET_Y - 2, TILE_SIZE * 8 + 4, TILE_SIZE * 8 + 4);
  
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const isSelected = selectedSquare && selectedSquare.row === row && selectedSquare.col === col;
      
      if (isSelected) {
        ctx.fillStyle = SELECTED_SQUARE;
      } else {
        const isLight = (row + col) % 2 === 0;
        ctx.fillStyle = isLight ? LIGHT_SQUARE : DARK_SQUARE;
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
  for (const move of legalMovesForSelected) {
    ctx.fillStyle = LEGAL_MOVE_HIGHLIGHT;
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

function drawPiece(piece: Piece, row: number, col: number): void {
  ctx.save();
  
  // Apply tilt
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(TILT_ANGLE);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  
  const x = BOARD_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2;
  const y = BOARD_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2;
  const radius = TILE_SIZE * 0.38;

  // Draw piece shadow
  ctx.beginPath();
  ctx.arc(x + 3, y + 3, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fill();

  // Draw piece circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  
  // Gradient fill for 3D effect
  const grad = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
  if (piece.color === 'white') {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#cccccc');
  } else {
    grad.addColorStop(0, '#555555');
    grad.addColorStop(1, '#222222');
  }
  ctx.fillStyle = grad;
  ctx.fill();
  
  ctx.strokeStyle = piece.color === 'white' ? '#333333' : '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = piece.color === 'white' ? '#333333' : '#ffffff';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(piece.type, x, y);
  
  ctx.restore();
}

function drawPieces(): void {
  const board = engine.getBoard();
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (piece) {
        drawPiece(piece, row, col);
      }
    }
  }
}

function drawTurnIndicator(): void {
  // Draw at bottom, outside the tilted area
  ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
  ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
  
  const turn = engine.turn();
  const inCheck = engine.isCheck();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${turn.toUpperCase()}'s turn${inCheck ? ' - CHECK!' : ''}`, 
    canvas.width / 2, 
    canvas.height - 20
  );
}

function render(): void {
  drawInfiniteRibbon();  // Draw infinite board extensions first
  drawBoard();           // Draw main playable board
  drawPieces();          // Draw pieces
  drawTurnIndicator();   // Draw turn indicator
  updateSidebar();
}

// Click handling - account for board offset and tilt
function handleClick(event: MouseEvent): void {
  if (gameOver) return;
  
  const rect = canvas.getBoundingClientRect();
  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;
  
  // Reverse the tilt transformation to get true board coordinates
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
  
  if (row < 0 || row >= 8 || col < 0 || col >= 8) return;
  
  const currentTurn = engine.turn();
  const board = engine.getBoard();
  const clickedPiece = board[row][col];
  
  // If we have a selection, try to move
  if (selectedSquare) {
    // Check if this is a legal move destination
    const isLegalMove = legalMovesForSelected.some(m => m.to.row === row && m.to.col === col);
    
    if (isLegalMove) {
      // Find the move (check for promotion)
      const movingPiece = board[selectedSquare.row][selectedSquare.col];
      let promotion: PieceType | undefined;
      
      // Auto-queen for now
      if (movingPiece?.type === 'P' && (row === 0 || row === 7)) {
        promotion = 'Q';
      }
      
      // Make the move using the engine
      const result = engine.makeMove(selectedSquare, { row, col }, promotion);
      
      if (result) {
        console.log('[Main] Move made:', result.san);
        selectedSquare = null;
        legalMovesForSelected = [];
        
        render();
        checkGameState();
        
        // If game not over and it's AI's turn, make AI move
        if (!gameOver && engine.turn() !== playerColor) {
          setTimeout(makeAIMove, 300);
        }
      }
    } else if (clickedPiece && clickedPiece.color === currentTurn) {
      // Clicked on another piece of same color - select it
      selectedSquare = { row, col };
      legalMovesForSelected = engine.getLegalMoves().filter(
        m => m.from.row === row && m.from.col === col
      );
    } else {
      // Deselect
      selectedSquare = null;
      legalMovesForSelected = [];
    }
  } else {
    // No selection - select a piece if it's the current player's
    if (clickedPiece && clickedPiece.color === currentTurn && currentTurn === playerColor) {
      selectedSquare = { row, col };
      legalMovesForSelected = engine.getLegalMoves().filter(
        m => m.from.row === row && m.from.col === col
      );
    }
  }
  
  render();
}

// AI move with difficulty scaling from level system
function makeAIMove(): void {
  console.log('[AI] makeAIMove called, gameOver:', gameOver);
  if (gameOver) return;
  
  const level = getLevelForElo(elo);
  
  // Use level system's AI settings (capped at depth 3 for browser performance)
  const depth = Math.min(level.aiDepth, 3);
  const blunderChance = level.aiRandomness;
  
  console.log(`[AI] Level ${level.level} (${level.name}), Depth ${depth}, Blunder: ${(blunderChance * 100).toFixed(0)}%`);
  console.log('[AI] Current turn:', engine.turn());
  
  let move: Move | null = null;
  
  if (Math.random() < blunderChance) {
    // Make a random move (blunder)
    const legalMoves = engine.getLegalMoves();
    console.log('[AI] Legal moves count:', legalMoves.length);
    if (legalMoves.length > 0) {
      move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      console.log('[AI] Blundered! Random move selected');
    }
  } else {
    // AI plays black (minimizing)
    console.log('[AI] Calculating best move...');
    move = engine.getBestMove(depth, false);
    console.log('[AI] Best move result:', move);
  }
  
  if (move) {
    const result = engine.makeMove(move.from, move.to, move.promotion);
    console.log('[AI] Move executed:', result);
    render();
    checkGameState();
  } else {
    console.log('[AI] No move found!');
  }
}

// Check game state
function checkGameState(): void {
  console.log(`[GameState] Checkmate: ${engine.isCheckmate()}, Stalemate: ${engine.isStalemate()}, GameOver: ${engine.isGameOver()}`);
  
  if (engine.isCheckmate()) {
    const winner = engine.turn() === 'white' ? 'black' : 'white';
    console.log(`[GameState] CHECKMATE! ${winner} wins!`);
    handleGameEnd(winner === playerColor ? 'win' : 'loss');
  } else if (engine.isStalemate() || engine.isDraw()) {
    console.log('[GameState] DRAW!');
    handleGameEnd('draw');
  }
}

// Handle game end
function handleGameEnd(result: 'win' | 'loss' | 'draw'): void {
  gameOver = true;
  const aiElo = getAIElo();
  const oldElo = elo;
  
  gamesPlayed++;
  
  let message: string;
  if (result === 'win') {
    gamesWon++;
    const eloChange = calculateEloChange(elo, aiElo, 'win');
    elo += eloChange;
    message = `You Win! +${eloChange} ELO`;
  } else if (result === 'loss') {
    gamesLost++;
    const eloChange = calculateEloChange(elo, aiElo, 'loss');
    elo += eloChange;
    message = `You Lose! ${eloChange} ELO`;
  } else {
    const eloChange = calculateEloChange(elo, aiElo, 'draw');
    elo += eloChange;
    message = `Draw! ${eloChange >= 0 ? '+' : ''}${eloChange} ELO`;
  }
  
  elo = Math.max(100, elo);
  
  // Check for level change
  const levelChange = checkLevelChange(oldElo, elo);
  if (levelChange) {
    const newLevel = getLevelForElo(elo);
    setTimeout(() => showLevelUpNotification(newLevel.name, levelChange === 'up'), 1500);
  }
  
  // Save game
  saveGame(updateStatsAfterGame(loadGame(), elo, result === 'win', result === 'draw'));
  
  // Show message
  showGameOverMessage(message);
  updateSidebar();
}

function showGameOverMessage(message: string): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(canvas.width/2 - 200, canvas.height/2 - 60, 400, 120);
  
  ctx.strokeStyle = '#f4a261';
  ctx.lineWidth = 3;
  ctx.strokeRect(canvas.width/2 - 200, canvas.height/2 - 60, 400, 120);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 15);
  
  ctx.font = '18px Arial';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText('Click to play again', canvas.width / 2, canvas.height / 2 + 25);
}

// New game
function newGame(): void {
  gameOver = false;
  selectedSquare = null;
  legalMovesForSelected = [];
  engine.reset();
  render();
}

// Click listener for new game
canvas.addEventListener('click', (event) => {
  if (gameOver) {
    newGame();
  } else {
    handleClick(event);
  }
});

// Start
engine.reset();
render();
console.log('[Main] Game started! FEN:', engine.fen());
