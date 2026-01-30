// src/rookMoves.ts
// Generates all legal rook moves for a given board state

import type { Piece } from './types';
import type { Move } from './moveGenerator';

/**
 * Generate all legal rook moves for a given color
 * Rooks move horizontally or vertically any number of squares
 */
export function generateRookMoves(board: (Piece | null)[][], color: 'white' | 'black'): Move[] {
  const moves: Move[] = [];

  // 4 straight directions: up, down, left, right
  const directions = [
    [-1, 0], [1, 0],
    [0, -1], [0, 1]
  ];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'R' && piece.color === color) {
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
