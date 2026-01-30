// src/boardEvaluator.ts
// Responsible for evaluating a board state for a given color

import type { Piece } from './types';

const PIECE_VALUES: Record<string, number> = {
  'K': 0,
  'Q': 9,
  'R': 5,
  'B': 3,
  'N': 3,
  'P': 1
};

/**
 * Simple material evaluation (placeholder)
 */
export function evaluateBoard(board: (Piece | null)[][], color: 'white' | 'black'): number {
  let score = 0;
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece) {
        const value = PIECE_VALUES[piece.type];
        score += (piece.color === color ? value : -value);
      }
    }
  }
  return score;
}
