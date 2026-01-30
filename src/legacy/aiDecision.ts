// src/aiDecision.ts
// Responsible for choosing the best move for the AI

import type { Piece } from './types';
import type { Move } from './moveGenerator';
import type { CastlingRights } from './castlingState';
import { generateMoves } from './moveGenerator';
import { evaluateBoard } from './boardEvaluator';

/**
 * AI difficulty settings based on ELO
 */
interface AISettings {
  depth: number;        // Search depth for minimax
  randomness: number;   // 0-1, chance to pick random move instead of best
}

/**
 * Get AI settings based on target ELO
 */
export function getAISettings(elo: number): AISettings {
  if (elo < 600) return { depth: 1, randomness: 0.5 };
  if (elo < 1000) return { depth: 1, randomness: 0.3 };
  if (elo < 1400) return { depth: 2, randomness: 0.2 };
  if (elo < 1800) return { depth: 2, randomness: 0.1 };
  if (elo < 2200) return { depth: 3, randomness: 0.05 };
  if (elo < 2600) return { depth: 3, randomness: 0 };
  if (elo < 3000) return { depth: 4, randomness: 0 };
  return { depth: 5, randomness: 0 };
}

/**
 * Make a copy of the board for simulation
 */
function copyBoard(board: (Piece | null)[][]): (Piece | null)[][] {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

/**
 * Apply a move to a board (mutates the board)
 */
function applyMove(board: (Piece | null)[][], move: Move): void {
  const { from, to, promotion, castling } = move;
  
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
  
  // Handle en passant capture
  if (move.piece.type === 'P' && from.col !== to.col && !board[to.row][to.col]) {
    board[from.row][to.col] = null;
  }
  
  // Move the piece
  let pieceToPlace = move.piece;
  if (promotion) {
    pieceToPlace = { type: promotion, color: move.piece.color };
  }
  
  board[to.row][to.col] = pieceToPlace;
  board[from.row][from.col] = null;
}

/**
 * Minimax with alpha-beta pruning
 */
function minimax(
  board: (Piece | null)[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiColor: 'white' | 'black',
  enPassant?: { row: number; col: number },
  castling?: CastlingRights
): number {
  if (depth === 0) {
    return evaluateBoard(board, aiColor);
  }
  
  const currentColor = maximizing ? aiColor : (aiColor === 'white' ? 'black' : 'white');
  const moves = generateMoves(board, currentColor, enPassant, castling);
  
  if (moves.length === 0) {
    // No moves: could be checkmate or stalemate
    return maximizing ? -9999 : 9999;
  }
  
  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const boardCopy = copyBoard(board);
      applyMove(boardCopy, move);
      const evalScore = minimax(boardCopy, depth - 1, alpha, beta, false, aiColor);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const boardCopy = copyBoard(board);
      applyMove(boardCopy, move);
      const evalScore = minimax(boardCopy, depth - 1, alpha, beta, true, aiColor);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Pick the best move for the AI based on ELO difficulty
 */
export function chooseAIMove(
  board: (Piece | null)[][],
  color: 'white' | 'black',
  elo: number,
  enPassant?: { row: number; col: number },
  castling?: CastlingRights
): Move | null {
  const moves = generateMoves(board, color, enPassant, castling);
  if (moves.length === 0) return null;
  
  const settings = getAISettings(elo);
  
  // Random chance to pick a random move (for lower ELO)
  if (Math.random() < settings.randomness) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  
  // Find best move using minimax
  let bestMove = moves[0];
  let bestScore = -Infinity;
  
  for (const move of moves) {
    const boardCopy = copyBoard(board);
    applyMove(boardCopy, move);
    const score = minimax(boardCopy, settings.depth - 1, -Infinity, Infinity, false, color, enPassant, castling);
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  
  return bestMove;
}
