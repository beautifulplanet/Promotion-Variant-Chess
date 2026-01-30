// src/moveGenerator.ts
// Responsible for generating all legal moves for a given board state

import type { Piece } from './types';
import type { CastlingRights } from './castlingState';
import { generatePawnMoves } from './pawnMoves';
import { generateKnightMoves } from './knightMoves';
import { generateBishopMoves } from './bishopMoves';
import { generateRookMoves } from './rookMoves';
import { generateQueenMoves } from './queenMoves';
import { generateKingMoves } from './kingMoves';

export interface Move {
  from: { row: number; col: number };
  to: { row: number; col: number };
  piece: Piece;
  captured?: Piece;
  promotion?: 'Q' | 'R' | 'B' | 'N';
  castling?: 'kingSide' | 'queenSide';
}

/**
 * Generate all pseudo-legal moves for a given color.
 * enPassantTarget: if set, is { row, col } of the square that can be captured en passant
 * castlingRights: tracks if castling is still available
 */
export function generateMoves(
  board: (Piece | null)[][],
  color: 'white' | 'black',
  enPassantTarget?: { row: number; col: number },
  castlingRights?: CastlingRights
): Move[] {
  const moves: Move[] = [];
  moves.push(...generatePawnMoves(board, color, enPassantTarget));
  moves.push(...generateKnightMoves(board, color));
  moves.push(...generateBishopMoves(board, color));
  moves.push(...generateRookMoves(board, color));
  moves.push(...generateQueenMoves(board, color));
  moves.push(...generateKingMoves(board, color, castlingRights));
  return moves;
}
