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
type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
type PieceColor = 'white' | 'black';

interface Piece {
  type: PieceType;
  color: PieceColor;
}

// Board state: 8x8 grid, null = empty square
const board: (Piece | null)[][] = [];

// Selection state
let selectedSquare: { row: number; col: number } | null = null;

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
    // If clicking a different square, move the piece there
    else if (movingPiece) {
      // Can't capture your own piece
      if (clickedPiece && clickedPiece.color === movingPiece.color) {
        // Select the new piece instead
        selectedSquare = { row, col };
      } else {
        // Move piece (no rule validation yet)
        board[row][col] = movingPiece;
        board[fromRow][fromCol] = null;
        selectedSquare = null;
        
        // Switch turns
        currentTurn = currentTurn === 'white' ? 'black' : 'white';
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

// Run
initBoard();
render();
