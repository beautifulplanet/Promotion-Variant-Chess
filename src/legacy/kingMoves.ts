// src/kingMoves.ts
// Generates all legal king moves for a given board state

import type { Piece } from './types';
import type { Move } from './moveGenerator';
import type { CastlingRights } from './castlingState';

export interface CastlingMove extends Move {
  castling: 'kingSide' | 'queenSide';
}

/**
 * Generate all legal king moves for a given color
 * Includes castling when rights are available
 */
export function generateKingMoves(
  board: (Piece | null)[][],
  color: 'white' | 'black',
  castlingRights?: CastlingRights
): Move[] {
  const moves: Move[] = [];

  // 8 directions: one square each
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'K' && piece.color === color) {
        // Normal king moves
        for (const [dRow, dCol] of directions) {
          const toRow = row + dRow;
          const toCol = col + dCol;

          if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) continue;

          const target = board[toRow][toCol];
          if (!target || target.color !== color) {
            moves.push({
              from: { row, col },
              to: { row: toRow, col: toCol },
              piece,
              captured: target ?? undefined
            });
          }
        }

        // Castling
        if (castlingRights) {
          const kingRow = color === 'white' ? 7 : 0;
          if (row === kingRow && col === 4) {
            // King side castling
            const canKingSide = color === 'white' ? castlingRights.whiteKingSide : castlingRights.blackKingSide;
            if (canKingSide) {
              const rook = board[kingRow][7];
              if (
                rook && rook.type === 'R' && rook.color === color &&
                !board[kingRow][5] && !board[kingRow][6]
              ) {
                const castleMove: CastlingMove = {
                  from: { row: kingRow, col: 4 },
                  to: { row: kingRow, col: 6 },
                  piece,
                  castling: 'kingSide'
                };
                moves.push(castleMove);
              }
            }

            // Queen side castling
            const canQueenSide = color === 'white' ? castlingRights.whiteQueenSide : castlingRights.blackQueenSide;
            if (canQueenSide) {
              const rook = board[kingRow][0];
              if (
                rook && rook.type === 'R' && rook.color === color &&
                !board[kingRow][1] && !board[kingRow][2] && !board[kingRow][3]
              ) {
                const castleMove: CastlingMove = {
                  from: { row: kingRow, col: 4 },
                  to: { row: kingRow, col: 2 },
                  piece,
                  castling: 'queenSide'
                };
                moves.push(castleMove);
              }
            }
          }
        }
      }
    }
  }
  return moves;
}
