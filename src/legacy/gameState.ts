// src/gameState.ts
// Game state management: checkmate detection, ELO calculation, win/loss tracking

import type { Piece, PieceColor } from './types';
import type { Move } from './moveGenerator';
import type { CastlingRights } from './castlingState';
import { generateMoves } from './moveGenerator';

/**
 * Check if a square is attacked by a given color
 */
export function isSquareAttacked(
  board: (Piece | null)[][],
  row: number,
  col: number,
  byColor: PieceColor,
  enPassant?: { row: number; col: number },
  castling?: CastlingRights
): boolean {
  const moves = generateMoves(board, byColor, enPassant, castling);
  return moves.some(m => m.to.row === row && m.to.col === col);
}

/**
 * Find the king's position for a given color
 */
export function findKing(board: (Piece | null)[][], color: PieceColor): { row: number; col: number } | null {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'K' && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

/**
 * Check if a color's king is in check
 */
export function isInCheck(
  board: (Piece | null)[][],
  color: PieceColor,
  enPassant?: { row: number; col: number },
  castling?: CastlingRights
): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  
  const enemyColor = color === 'white' ? 'black' : 'white';
  return isSquareAttacked(board, king.row, king.col, enemyColor, enPassant, castling);
}

/**
 * Make a copy of the board
 */
function copyBoard(board: (Piece | null)[][]): (Piece | null)[][] {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

/**
 * Apply a move to a board copy and return the new board
 */
function applyMoveToBoard(board: (Piece | null)[][], move: Move): (Piece | null)[][] {
  const newBoard = copyBoard(board);
  const { from, to, promotion, castling } = move;
  
  // Handle castling
  if (castling) {
    if (castling === 'kingSide') {
      newBoard[to.row][5] = newBoard[to.row][7];
      newBoard[to.row][7] = null;
    } else {
      newBoard[to.row][3] = newBoard[to.row][0];
      newBoard[to.row][0] = null;
    }
  }
  
  // Handle en passant capture
  if (move.piece.type === 'P' && from.col !== to.col && !newBoard[to.row][to.col]) {
    newBoard[from.row][to.col] = null;
  }
  
  // Move the piece
  let pieceToPlace = move.piece;
  if (promotion) {
    pieceToPlace = { type: promotion, color: move.piece.color };
  }
  
  newBoard[to.row][to.col] = pieceToPlace;
  newBoard[from.row][from.col] = null;
  
  return newBoard;
}

/**
 * Check if a move is legal (doesn't leave own king in check)
 */
export function isMoveLegal(
  board: (Piece | null)[][],
  move: Move,
  enPassant?: { row: number; col: number },
  castling?: CastlingRights
): boolean {
  const newBoard = applyMoveToBoard(board, move);
  return !isInCheck(newBoard, move.piece.color);
}

/**
 * Get all legal moves for a color (filters out moves that leave king in check)
 */
export function getLegalMoves(
  board: (Piece | null)[][],
  color: PieceColor,
  enPassant?: { row: number; col: number },
  castling?: CastlingRights
): Move[] {
  const pseudoLegal = generateMoves(board, color, enPassant, castling);
  return pseudoLegal.filter(move => isMoveLegal(board, move, enPassant, castling));
}

/**
 * Check if a color is in checkmate
 */
export function isCheckmate(
  board: (Piece | null)[][],
  color: PieceColor,
  enPassant?: { row: number; col: number },
  castling?: CastlingRights
): boolean {
  if (!isInCheck(board, color, enPassant, castling)) return false;
  const legalMoves = getLegalMoves(board, color, enPassant, castling);
  return legalMoves.length === 0;
}

/**
 * Check if a color is in stalemate
 */
export function isStalemate(
  board: (Piece | null)[][],
  color: PieceColor,
  enPassant?: { row: number; col: number },
  castling?: CastlingRights
): boolean {
  if (isInCheck(board, color, enPassant, castling)) return false;
  const legalMoves = getLegalMoves(board, color, enPassant, castling);
  return legalMoves.length === 0;
}

/**
 * Game result type
 */
export type GameResult = 'ongoing' | 'white-wins' | 'black-wins' | 'draw';

/**
 * Get current game result
 */
export function getGameResult(
  board: (Piece | null)[][],
  currentTurn: PieceColor,
  enPassant?: { row: number; col: number },
  castling?: CastlingRights
): GameResult {
  const inCheck = isInCheck(board, currentTurn, enPassant, castling);
  const legalMoves = getLegalMoves(board, currentTurn, enPassant, castling);
  
  console.log(`[GameState] Turn: ${currentTurn}, InCheck: ${inCheck}, LegalMoves: ${legalMoves.length}`);
  
  if (inCheck && legalMoves.length === 0) {
    console.log(`[GameState] CHECKMATE! ${currentTurn === 'white' ? 'Black' : 'White'} wins!`);
    return currentTurn === 'white' ? 'black-wins' : 'white-wins';
  }
  if (!inCheck && legalMoves.length === 0) {
    console.log(`[GameState] STALEMATE!`);
    return 'draw';
  }
  return 'ongoing';
}

/**
 * Calculate ELO change after a game
 * K-factor determines how much ELO can change per game
 */
export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  result: 'win' | 'loss' | 'draw',
  kFactor: number = 32
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  
  let actualScore: number;
  if (result === 'win') actualScore = 1;
  else if (result === 'loss') actualScore = 0;
  else actualScore = 0.5;
  
  return Math.round(kFactor * (actualScore - expectedScore));
}
