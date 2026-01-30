// src/castlingState.ts
// Tracks castling rights for both players

export interface CastlingRights {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}

/**
 * Create initial castling rights (all available)
 */
export function createInitialCastlingRights(): CastlingRights {
  return {
    whiteKingSide: true,
    whiteQueenSide: true,
    blackKingSide: true,
    blackQueenSide: true
  };
}

/**
 * Update castling rights after a move
 */
export function updateCastlingRights(
  rights: CastlingRights,
  fromRow: number,
  fromCol: number,
  pieceType: string,
  pieceColor: 'white' | 'black'
): CastlingRights {
  const updated = { ...rights };

  // King moved: lose both castling rights
  if (pieceType === 'K') {
    if (pieceColor === 'white') {
      updated.whiteKingSide = false;
      updated.whiteQueenSide = false;
    } else {
      updated.blackKingSide = false;
      updated.blackQueenSide = false;
    }
  }

  // Rook moved: lose that side's castling right
  if (pieceType === 'R') {
    if (pieceColor === 'white' && fromRow === 7) {
      if (fromCol === 0) updated.whiteQueenSide = false;
      if (fromCol === 7) updated.whiteKingSide = false;
    }
    if (pieceColor === 'black' && fromRow === 0) {
      if (fromCol === 0) updated.blackQueenSide = false;
      if (fromCol === 7) updated.blackKingSide = false;
    }
  }

  return updated;
}
