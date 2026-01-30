// src/bishopMoves.ts
// Generates all legal bishop moves for a given board state

import type { Piece } from './types';
import type { Move } from './moveGenerator';

/**
 * Generate all legal bishop moves for a given color
 * Bishops move diagonally any number of squares
 */
export function generateBishopMoves(board: (Piece | null)[][], color: 'white' | 'black'): Move[] {
  const moves: Move[] = [];

  // 4 diagonal directions
  const directions = [
    [-1, -1], [-1, 1],
    [1, -1], [1, 1]
  ];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'B' && piece.color === color) {
        for (const [dRow, dCol] of directions) {
          let toRow = row + dRow;
          let toCol = col + dCol;

          while (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
            const target = board[toRow][toCol];

            if (!target) {
              // Empty square: can move here
              moves.push({ from: { row, col }, to: { row: toRow, col: toCol }, piece });
            } else if (target.color !== color) {
              // Enemy piece: can capture, then stop
              moves.push({ from: { row, col }, to: { row: toRow, col: toCol }, piece, captured: target });
              break;
            } else {
              // Own piece: blocked
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
