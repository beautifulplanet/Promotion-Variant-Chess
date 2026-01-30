// src/knightMoves.ts
// Generates all legal knight moves for a given board state

import type { Piece } from './types';
import type { Move } from './moveGenerator';

/**
 * Generate all legal knight moves for a given color
 */
export function generateKnightMoves(board: (Piece | null)[][], color: 'white' | 'black'): Move[] {
  const moves: Move[] = [];

  // All 8 possible knight move offsets (L-shape)
  const offsets = [
    [-2, -1], [-2, 1],
    [-1, -2], [-1, 2],
    [1, -2], [1, 2],
    [2, -1], [2, 1]
  ];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'N' && piece.color === color) {
        for (const [dRow, dCol] of offsets) {
          const toRow = row + dRow;
          const toCol = col + dCol;

          // Check bounds
          if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) continue;

          const target = board[toRow][toCol];
          // Can move to empty or capture enemy
          if (!target || target.color !== color) {
            moves.push({
              from: { row, col },
              to: { row: toRow, col: toCol },
              piece,
              captured: target ?? undefined
            });
          }
        }
      }
    }
  }
  return moves;
}
