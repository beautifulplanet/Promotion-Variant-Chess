// src/queenMoves.ts
// Generates all legal queen moves for a given board state

import type { Piece } from './types';
import type { Move } from './moveGenerator';

/**
 * Generate all legal queen moves for a given color
 * Queen moves like rook + bishop (all 8 directions)
 */
export function generateQueenMoves(board: (Piece | null)[][], color: 'white' | 'black'): Move[] {
  const moves: Move[] = [];

  // 8 directions: straight + diagonal
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],  // rook-like
    [-1, -1], [-1, 1], [1, -1], [1, 1]  // bishop-like
  ];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'Q' && piece.color === color) {
        for (const [dRow, dCol] of directions) {
          let toRow = row + dRow;
          let toCol = col + dCol;

          while (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
            const target = board[toRow][toCol];

            if (!target) {
              moves.push({ from: { row, col }, to: { row: toRow, col: toCol }, piece });
            } else if (target.color !== color) {
              moves.push({ from: { row, col }, to: { row: toRow, col: toCol }, piece, captured: target });
              break;
            } else {
              break;
            }

            toRow += dRow;
            toCol += dCol;
          }
        }
      }
    }
  }
  return moves;
}
