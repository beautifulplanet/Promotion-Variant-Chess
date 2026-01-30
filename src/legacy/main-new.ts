/**
 * Sideways Chess - Main Entry Point
 * Uses chess.js engine for move validation and game state
 */

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Board settings
const TILE_SIZE = 80;
const BOARD_SIZE = 8;

// Colors
const LIGHT_SQUARE = '#f0d9b5';
const DARK_SQUARE = '#b58863';
const SELECTED_SQUARE = '#7fc97f';
const LEGAL_MOVE_HIGHLIGHT = 'rgba(100, 200, 100, 0.5)';

// Imports
import type { PieceType, PieceColor, Piece } from './types';
export type { PieceType, PieceColor, Piece } from './types';

import { engine, type Move } from './chessEngine';
import { getLevelForElo, getLevelProgress, checkLevelChange } from './levelSystem';
import { loadGame, saveGame, updateStatsAfterGame } from './saveSystem';
import { calculateEloChange } from './gameState';

// Game state
let saveData = loadGame();
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
function drawBoard(): void {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const isSelected = selectedSquare && selectedSquare.row === row && selectedSquare.col === col;
      
      if (isSelected) {
        ctx.fillStyle = SELECTED_SQUARE;
      } else {
        const isLight = (row + col) % 2 === 0;
        ctx.fillStyle = isLight ? LIGHT_SQUARE : DARK_SQUARE;
      }
      
      ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
  
  // Draw legal move highlights
  for (const move of legalMovesForSelected) {
    ctx.fillStyle = LEGAL_MOVE_HIGHLIGHT;
    ctx.beginPath();
    ctx.arc(
      move.to.col * TILE_SIZE + TILE_SIZE / 2,
      move.to.row * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE / 4,
      0, Math.PI * 2
    );
    ctx.fill();
  }
}

function drawPiece(piece: Piece, row: number, col: number): void {
  const x = col * TILE_SIZE + TILE_SIZE / 2;
  const y = row * TILE_SIZE + TILE_SIZE / 2;
  const radius = TILE_SIZE * 0.35;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = piece.color === 'white' ? '#ffffff' : '#333333';
  ctx.fill();
  ctx.strokeStyle = piece.color === 'white' ? '#333333' : '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = piece.color === 'white' ? '#333333' : '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(piece.type, x, y);
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
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
  
  const turn = engine.turn();
  const inCheck = engine.isCheck();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${turn.toUpperCase()}'s turn${inCheck ? ' - CHECK!' : ''}`, 
    canvas.width / 2, 
    canvas.height - 15
  );
}

function render(): void {
  drawBoard();
  drawPieces();
  drawTurnIndicator();
  updateSidebar();
}

// Click handling
function handleClick(event: MouseEvent): void {
  if (gameOver) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  
  if (row < 0 || row >= 8 || col < 0 || col >= 8) return;
  if (row >= 8) return; // Clicked on turn indicator
  
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

// AI move
function makeAIMove(): void {
  if (gameOver) return;
  
  const level = getLevelForElo(elo);
  const depth = Math.min(1 + Math.floor(level.level / 4), 4); // Depth 1-4 based on level
  
  console.log(`[AI] Thinking at depth ${depth}...`);
  
  // AI plays black (minimizing)
  const move = engine.getBestMove(depth, false);
  
  if (move) {
    engine.makeMove(move.from, move.to, move.promotion);
    console.log('[AI] Move:', move);
    render();
    checkGameState();
  } else {
    console.log('[AI] No legal moves!');
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
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 250, canvas.width, 100);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, canvas.width / 2, 280);
  
  ctx.font = '18px Arial';
  ctx.fillText('Click to play again', canvas.width / 2, 320);
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
