// src/pawnMoves.ts
// Generates all legal pawn moves for a given board state

import type { Piece } from './types';
import type { Move } from './moveGenerator';

/**
 * Generate all legal pawn moves for a given color
 */
/**
 * enPassantTarget: if set, is { row, col } of the square that can be captured en passant (where the pawn would land)
 */
export function generatePawnMoves(
  board: (Piece | null)[][],
  color: 'white' | 'black',
  enPassantTarget?: { row: number; col: number }
): Move[] {
  const moves: Move[] = [];
  const direction = color === 'white' ? -1 : 1;
  const startRow = color === 'white' ? 6 : 1;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'P' && piece.color === color) {
        // Forward move
        const nextRow = row + direction;
        const lastRank = color === 'white' ? 0 : 7;
        if (nextRow >= 0 && nextRow < 8 && !board[nextRow][col]) {
          if (nextRow === lastRank) {
            // Promotion: Q, R, B, N
            for (const promo of ['Q', 'R', 'B', 'N'] as const) {
              moves.push({ from: { row, col }, to: { row: nextRow, col }, piece, promotion: promo });
            }
          } else {
            moves.push({ from: { row, col }, to: { row: nextRow, col }, piece });
          }

          // Double move from starting position
          if (row === startRow && !board[row + 2 * direction][col]) {
            moves.push({ from: { row, col }, to: { row: row + 2 * direction, col }, piece });
          }
        }
        // Captures
        for (const dCol of [-1, 1]) {
          const captureCol = col + dCol;
          if (captureCol >= 0 && captureCol < 8) {
            const target = board[nextRow]?.[captureCol];
            if (target && target.color !== color) {
              if (nextRow === lastRank) {
                // Promotion capture
                for (const promo of ['Q', 'R', 'B', 'N'] as const) {
                  moves.push({ from: { row, col }, to: { row: nextRow, col: captureCol }, piece, captured: target, promotion: promo });
                }
              } else {
                moves.push({ from: { row, col }, to: { row: nextRow, col: captureCol }, piece, captured: target });
              }
            }
            // En passant
            if (
              enPassantTarget &&
              enPassantTarget.row === nextRow &&
              enPassantTarget.col === captureCol &&
              // There must be an enemy pawn next to us that just moved two squares
              board[row][captureCol] &&
              board[row][captureCol]?.type === 'P' &&
              board[row][captureCol]?.color !== color
            ) {
              moves.push({
                from: { row, col },
                to: { row: nextRow, col: captureCol },
                piece,
                captured: board[row][captureCol] // the pawn being captured
              });
            }
          }
        }
        // All pawn logic: forward, double, capture, en passant, promotion
      }
    }
  }
  return moves;
}
