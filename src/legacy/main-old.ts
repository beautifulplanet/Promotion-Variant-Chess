/**
 * Sideways Chess - Entry Point
 * Step 4: Click to select a piece
 */

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Board settings
const TILE_SIZE = 80;  // Each square is 80x80 pixels
const BOARD_SIZE = 8;  // 8x8 board

// Colors for the board
const LIGHT_SQUARE = '#f0d9b5';
const DARK_SQUARE = '#b58863';
const SELECTED_SQUARE = '#7fc97f';  // Green highlight for selected

// Piece types
import type { PieceType, PieceColor, Piece } from './types';
export type { PieceType, PieceColor, Piece } from './types';

// Chess engine (replaces custom move generation)
import { engine, type Move } from './chessEngine';

// Level system and save system
import { getLevelForElo, getLevelProgress, checkLevelChange, getAISettingsForLevel } from './levelSystem';
import { loadGame, saveGame, updateStatsAfterGame, recordPromotion, type SaveData } from './saveSystem';
import { calculateEloChange } from './gameState';

// Load saved game or create new
let saveData = loadGame();
let elo = saveData.elo;
let gamesWon = saveData.gamesWon;
let gamesLost = saveData.gamesLost;
let gamesPlayed = saveData.gamesPlayed;

// AI settings
let aiEnabled = true;  // Toggle AI opponent
let playerColor: PieceColor = 'white';  // Player is always white for now
let gameOver = false;  // Track if game has ended

// AI ELO (scales with player ELO based on level)
function getAIElo(): number {
  const level = getLevelForElo(elo);
  // AI ELO is roughly in the middle of current level range
  return Math.floor((level.minElo + level.maxElo) / 2);
}

// Sidebar DOM elements
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
const newLevelNameElem = document.getElementById('new-level-name');

function updateSidebar() {
  const level = getLevelForElo(elo);
  const progress = getLevelProgress(elo);
  
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

function showLevelUpNotification(levelName: string, isUp: boolean) {
  if (levelNotificationElem && newLevelNameElem) {
    levelNotificationElem.style.display = 'block';
    levelNotificationElem.style.background = isUp ? '#2a9d8f' : '#e76f51';
    levelNotificationElem.innerHTML = `<div style="font-weight:bold;">${isUp ? 'LEVEL UP!' : 'LEVEL DOWN'}</div><div style="font-size:0.9em;">${levelName}</div>`;
    
    setTimeout(() => {
      levelNotificationElem.style.display = 'none';
    }, 3000);
  }
}

// Selection state
let selectedSquare: { row: number; col: number } | null = null;

// En passant state: if set, is { row, col } of the square that can be captured en passant (where the pawn would land)
let enPassantTarget: { row: number; col: number } | null = null;

// Castling rights state
let castlingRights: CastlingRights = createInitialCastlingRights();

// Turn state
let currentTurn: PieceColor = 'white';  // White moves first

// Initialize board with starting positions
function initBoard(): void {
  // Create empty 8x8 grid
  for (let row = 0; row < BOARD_SIZE; row++) {
    board[row] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      board[row][col] = null;
    }
  }

  // Back row pieces order
  const backRow: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

  // Place black pieces (top: rows 0-1)
  for (let col = 0; col < BOARD_SIZE; col++) {
    board[0][col] = { type: backRow[col], color: 'black' };
    board[1][col] = { type: 'P', color: 'black' };
  }

  // Place white pieces (bottom: rows 6-7)
  for (let col = 0; col < BOARD_SIZE; col++) {
    board[6][col] = { type: 'P', color: 'white' };
    board[7][col] = { type: backRow[col], color: 'white' };
  }
}

// Draw the chessboard
function drawBoard(): void {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      // Check if this square is selected
      const isSelected = selectedSquare && selectedSquare.row === row && selectedSquare.col === col;
      
      if (isSelected) {
        ctx.fillStyle = SELECTED_SQUARE;
      } else {
        // Alternate colors based on row + col
        const isLight = (row + col) % 2 === 0;
        ctx.fillStyle = isLight ? LIGHT_SQUARE : DARK_SQUARE;
      }
      
      // Draw the square
      ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

// Draw a single piece (placeholder: colored circle with letter)
function drawPiece(piece: Piece, row: number, col: number): void {
  const x = col * TILE_SIZE + TILE_SIZE / 2;
  const y = row * TILE_SIZE + TILE_SIZE / 2;
  const radius = TILE_SIZE * 0.35;

  // Draw circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = piece.color === 'white' ? '#ffffff' : '#333333';
  ctx.fill();
  ctx.strokeStyle = piece.color === 'white' ? '#333333' : '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw letter
  ctx.fillStyle = piece.color === 'white' ? '#333333' : '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(piece.type, x, y);
}

// Draw all pieces on the board
function drawPieces(): void {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (piece) {
        drawPiece(piece, row, col);
      }
    }
  }
}

// Render everything
function render(): void {
  drawBoard();
  drawPieces();
  drawTurnIndicator();
  updateSidebar();
}

// Draw turn indicator
function drawTurnIndicator(): void {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${currentTurn.toUpperCase()}'s turn`, canvas.width / 2, canvas.height - 15);
}

// Handle mouse click
function handleClick(event: MouseEvent): void {
  // Ignore clicks if game is over
  if (gameOver) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // Convert to board coordinates
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  
  // Check bounds
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return;
  }
  
  const clickedPiece = board[row][col];
  
  // If we have a selected piece and click somewhere else, try to move
  if (selectedSquare) {
    const fromRow = selectedSquare.row;
    const fromCol = selectedSquare.col;
    const movingPiece = board[fromRow][fromCol];
    
    // If clicking the same square, deselect
    if (fromRow === row && fromCol === col) {
      selectedSquare = null;
    }
    // If clicking a different square, try to move
    else if (movingPiece) {
      // Can't capture your own piece
      if (clickedPiece && clickedPiece.color === movingPiece.color) {
        // Select the new piece instead
        selectedSquare = { row, col };
      } else {
        // Validate move against legal moves
        const legalMoves = getLegalMoves(board, currentTurn, enPassantTarget ?? undefined, castlingRights);
        const move = legalMoves.find(m => 
          m.from.row === fromRow && 
          m.from.col === fromCol && 
          m.to.row === row && 
          m.to.col === col
        );
        
        if (!move) {
          // Invalid move - just deselect
          selectedSquare = null;
          render();
          return;
        }
        
        // Valid move - execute it
        // Track en passant
        enPassantTarget = null;
        if (
          movingPiece?.type === 'P' &&
          Math.abs(row - fromRow) === 2 &&
          fromCol === col
        ) {
          // Pawn double move: set en passant target
          enPassantTarget = { row: (row + fromRow) / 2, col };
        }

        // Handle en passant capture
        if (
          movingPiece?.type === 'P' &&
          fromCol !== col &&
          !board[row][col]
        ) {
          // Capturing pawn en passant
          board[fromRow][col] = null;
        }

        // Handle castling
        if (
          movingPiece?.type === 'K' &&
          Math.abs(col - fromCol) === 2
        ) {
          // King moved 2 squares: castling
          if (col === 6) {
            // King side: move rook from col 7 to col 5
            board[row][5] = board[row][7];
            board[row][7] = null;
          } else if (col === 2) {
            // Queen side: move rook from col 0 to col 3
            board[row][3] = board[row][0];
            board[row][0] = null;
          }
        }

        // Handle promotion (auto-queen for now)
        let pieceToPlace = movingPiece;
        if (
          movingPiece?.type === 'P' &&
          (row === 0 || row === 7)
        ) {
          pieceToPlace = { type: 'Q', color: movingPiece.color };
        }

        board[row][col] = pieceToPlace;
        board[fromRow][fromCol] = null;
        selectedSquare = null;

        // Update castling rights
        if (movingPiece) {
          castlingRights = updateCastlingRights(castlingRights, fromRow, fromCol, movingPiece.type, movingPiece.color);
        }

        // Switch turns
        currentTurn = currentTurn === 'white' ? 'black' : 'white';
        
        // Re-render before checking game state
        render();
        
        // Check for game end
        const result = getGameResult(board, currentTurn, enPassantTarget ?? undefined, castlingRights);
        if (result !== 'ongoing') {
          handleGameEnd(result);
          return;
        }
        
        // AI makes a move if enabled and it's AI's turn
        if (aiEnabled && currentTurn !== playerColor && !gameOver) {
          setTimeout(() => makeAIMove(), 300);  // Small delay for visual feedback
        }
      }
    }
  }
  // If no selection and clicking a piece of the current turn's color, select it
  else if (clickedPiece && clickedPiece.color === currentTurn) {
    selectedSquare = { row, col };
  }
  
  // Re-render
  render();
}

// Set up click listener
canvas.addEventListener('click', handleClick);

/**
 * AI makes its move
 */
function makeAIMove(): void {
  const aiColor = playerColor === 'white' ? 'black' : 'white';
  const move = chooseAIMove(board, aiColor, elo, enPassantTarget ?? undefined, castlingRights);
  
  if (!move) {
    console.log('AI has no moves!');
    return;
  }
  
  const { from, to, promotion, castling } = move;
  
  // Reset en passant
  enPassantTarget = null;
  
  // Track double pawn move for en passant
  if (move.piece.type === 'P' && Math.abs(to.row - from.row) === 2) {
    enPassantTarget = { row: (to.row + from.row) / 2, col: from.col };
  }
  
  // Handle en passant capture
  if (move.piece.type === 'P' && from.col !== to.col && !board[to.row][to.col]) {
    board[from.row][to.col] = null;
  }
  
  // Handle castling
  if (castling) {
    if (castling === 'kingSide') {
      board[to.row][5] = board[to.row][7];
      board[to.row][7] = null;
    } else {
      board[to.row][3] = board[to.row][0];
      board[to.row][0] = null;
    }
  }
  
  // Handle promotion
  let pieceToPlace = move.piece;
  if (promotion) {
    pieceToPlace = { type: promotion, color: move.piece.color };
  }
  
  // Execute the move
  board[to.row][to.col] = pieceToPlace;
  board[from.row][from.col] = null;
  
  // Update castling rights
  castlingRights = updateCastlingRights(castlingRights, from.row, from.col, move.piece.type, move.piece.color);
  
  // Switch turns back to player
  currentTurn = playerColor;
  
  // Re-render
  render();
  
  // Check for game end after AI move
  const result = getGameResult(board, currentTurn, enPassantTarget ?? undefined, castlingRights);
  if (result !== 'ongoing') {
    handleGameEnd(result);
  }
}

/**
 * Handle game end (checkmate, stalemate)
 */
function handleGameEnd(result: GameResult): void {
  gameOver = true;
  const aiElo = getAIElo();
  const oldElo = elo;
  
  gamesPlayed++;
  
  if (result === 'white-wins') {
    if (playerColor === 'white') {
      // Player wins
      gamesWon++;
      const eloChange = calculateEloChange(elo, aiElo, 'win');
      elo += eloChange;
      showGameOverMessage(`You Win! +${eloChange} ELO`);
    } else {
      // AI wins
      gamesLost++;
      const eloChange = calculateEloChange(elo, aiElo, 'loss');
      elo += eloChange;
      showGameOverMessage(`You Lose! ${eloChange} ELO`);
    }
  } else if (result === 'black-wins') {
    if (playerColor === 'black') {
      // Player wins
      gamesWon++;
      const eloChange = calculateEloChange(elo, aiElo, 'win');
      elo += eloChange;
      showGameOverMessage(`You Win! +${eloChange} ELO`);
    } else {
      // AI wins
      gamesLost++;
      const eloChange = calculateEloChange(elo, aiElo, 'loss');
      elo += eloChange;
      showGameOverMessage(`You Lose! ${eloChange} ELO`);
    }
  } else {
    // Draw
    const eloChange = calculateEloChange(elo, aiElo, 'draw');
    elo += eloChange;
    showGameOverMessage(`Draw! ${eloChange >= 0 ? '+' : ''}${eloChange} ELO`);
  }
  
  // Make sure ELO doesn't go below 100
  elo = Math.max(100, elo);
  
  // Check for level change
  const levelChange = checkLevelChange(oldElo, elo);
  if (levelChange) {
    const newLevel = getLevelForElo(elo);
    setTimeout(() => {
      showLevelUpNotification(newLevel.name, levelChange === 'up');
    }, 1500);  // Show after game over message
  }
  
  // Save game progress
  const playerWon = (result === 'white-wins' && playerColor === 'white') ||
                    (result === 'black-wins' && playerColor === 'black');
  const isDraw = result === 'stalemate';
  saveGame(updateStatsAfterGame(loadGame(), elo, playerWon, isDraw));
  
  updateSidebar();
}

/**
 * Show game over message on canvas
 */
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

/**
 * Start a new game
 */
function newGame(): void {
  gameOver = false;
  currentTurn = 'white';
  selectedSquare = null;
  enPassantTarget = null;
  castlingRights = createInitialCastlingRights();
  initBoard();
  render();
}

// Click to start new game when game is over
canvas.addEventListener('click', (event) => {
  if (gameOver) {
    newGame();
  }
}, true);

// Run
initBoard();
render();
