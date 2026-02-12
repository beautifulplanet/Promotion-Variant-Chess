// Precomputed Attack Tables
// Generated at compile time for O(1) lookup

use crate::bitboard::Bitboard;
use crate::types::Square;

// =============================================================================
// KNIGHT ATTACKS - Precomputed for all 64 squares
// =============================================================================

/// Knight attack table - indexed by square
pub static KNIGHT_ATTACKS: [Bitboard; 64] = {
    let mut attacks = [Bitboard::EMPTY; 64];
    let mut sq = 0u8;
    
    while sq < 64 {
        let bb = 1u64 << sq;
        let mut attack = 0u64;
        let file = sq % 8;
        let rank = sq / 8;
        
        // All 8 knight moves using rank/file bounds checking
        // North 2, West 1: rank+2, file-1
        if rank < 6 && file > 0 { attack |= bb << 15; }
        // North 2, East 1: rank+2, file+1
        if rank < 6 && file < 7 { attack |= bb << 17; }
        // North 1, West 2: rank+1, file-2
        if rank < 7 && file > 1 { attack |= bb << 6; }
        // North 1, East 2: rank+1, file+2
        if rank < 7 && file < 6 { attack |= bb << 10; }
        // South 1, West 2: rank-1, file-2
        if rank > 0 && file > 1 { attack |= bb >> 10; }
        // South 1, East 2: rank-1, file+2
        if rank > 0 && file < 6 { attack |= bb >> 6; }
        // South 2, West 1: rank-2, file-1
        if rank > 1 && file > 0 { attack |= bb >> 17; }
        // South 2, East 1: rank-2, file+1
        if rank > 1 && file < 7 { attack |= bb >> 15; }
        
        attacks[sq as usize] = Bitboard(attack);
        sq += 1;
    }
    
    attacks
};

// =============================================================================
// KING ATTACKS - Precomputed for all 64 squares
// =============================================================================

/// King attack table - indexed by square
pub static KING_ATTACKS: [Bitboard; 64] = {
    let mut attacks = [Bitboard::EMPTY; 64];
    let mut sq = 0u8;
    
    while sq < 64 {
        let bb = 1u64 << sq;
        let mut attack = 0u64;
        
        let file = sq % 8;
        let rank = sq / 8;
        
        // All 8 directions
        if rank < 7 { attack |= bb << 8; } // North
        if rank > 0 { attack |= bb >> 8; } // South
        if file < 7 { attack |= bb << 1; } // East
        if file > 0 { attack |= bb >> 1; } // West
        if rank < 7 && file < 7 { attack |= bb << 9; } // NE
        if rank < 7 && file > 0 { attack |= bb << 7; } // NW
        if rank > 0 && file < 7 { attack |= bb >> 7; } // SE
        if rank > 0 && file > 0 { attack |= bb >> 9; } // SW
        
        attacks[sq as usize] = Bitboard(attack);
        sq += 1;
    }
    
    attacks
};

// =============================================================================
// PAWN ATTACKS - Precomputed for both colors
// =============================================================================

/// White pawn attack table (captures only, not pushes)
pub static WHITE_PAWN_ATTACKS: [Bitboard; 64] = {
    let mut attacks = [Bitboard::EMPTY; 64];
    let mut sq = 0u8;
    
    while sq < 64 {
        let bb = 1u64 << sq;
        let mut attack = 0u64;
        let file = sq % 8;
        let rank = sq / 8;
        
        // White pawns attack diagonally upward
        if rank < 7 {
            if file > 0 { attack |= bb << 7; } // NW capture
            if file < 7 { attack |= bb << 9; } // NE capture
        }
        
        attacks[sq as usize] = Bitboard(attack);
        sq += 1;
    }
    
    attacks
};

/// Black pawn attack table (captures only, not pushes)
pub static BLACK_PAWN_ATTACKS: [Bitboard; 64] = {
    let mut attacks = [Bitboard::EMPTY; 64];
    let mut sq = 0u8;
    
    while sq < 64 {
        let bb = 1u64 << sq;
        let mut attack = 0u64;
        let file = sq % 8;
        let rank = sq / 8;
        
        // Black pawns attack diagonally downward
        if rank > 0 {
            if file > 0 { attack |= bb >> 9; } // SW capture
            if file < 7 { attack |= bb >> 7; } // SE capture
        }
        
        attacks[sq as usize] = Bitboard(attack);
        sq += 1;
    }
    
    attacks
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Get knight attacks from a square
#[inline]
pub fn knight_attacks(sq: Square) -> Bitboard {
    KNIGHT_ATTACKS[sq.index()]
}

/// Get king attacks from a square
#[inline]
pub fn king_attacks(sq: Square) -> Bitboard {
    KING_ATTACKS[sq.index()]
}

/// Get pawn attacks for white from a square
#[inline]
pub fn white_pawn_attacks(sq: Square) -> Bitboard {
    WHITE_PAWN_ATTACKS[sq.index()]
}

/// Get pawn attacks for black from a square
#[inline]
pub fn black_pawn_attacks(sq: Square) -> Bitboard {
    BLACK_PAWN_ATTACKS[sq.index()]
}

/// Get pawn attacks for either color
#[inline]
pub fn pawn_attacks(sq: Square, is_white: bool) -> Bitboard {
    if is_white {
        WHITE_PAWN_ATTACKS[sq.index()]
    } else {
        BLACK_PAWN_ATTACKS[sq.index()]
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_knight_attacks_center() {
        // Knight on e4 should attack 8 squares
        let e4 = Square::from_file_rank(4, 3);
        let attacks = knight_attacks(e4);
        assert_eq!(attacks.count(), 8);
        
        // Check specific squares
        assert!(attacks.has(Square::from_file_rank(3, 5))); // d6
        assert!(attacks.has(Square::from_file_rank(5, 5))); // f6
        assert!(attacks.has(Square::from_file_rank(6, 4))); // g5
        assert!(attacks.has(Square::from_file_rank(6, 2))); // g3
    }

    #[test]
    fn test_knight_attacks_corner() {
        // Knight on a1 should only attack 2 squares
        let a1 = Square::from_file_rank(0, 0);
        let attacks = knight_attacks(a1);
        assert_eq!(attacks.count(), 2);
        
        // b3 and c2
        assert!(attacks.has(Square::from_file_rank(1, 2))); // b3
        assert!(attacks.has(Square::from_file_rank(2, 1))); // c2
    }

    #[test]
    fn test_king_attacks_center() {
        // King on e4 should attack 8 squares
        let e4 = Square::from_file_rank(4, 3);
        let attacks = king_attacks(e4);
        assert_eq!(attacks.count(), 8);
    }

    #[test]
    fn test_king_attacks_corner() {
        // King on a1 should attack 3 squares
        let a1 = Square::from_file_rank(0, 0);
        let attacks = king_attacks(a1);
        assert_eq!(attacks.count(), 3);
    }

    #[test]
    fn test_white_pawn_attacks() {
        // Pawn on e4 attacks d5 and f5
        let e4 = Square::from_file_rank(4, 3);
        let attacks = white_pawn_attacks(e4);
        assert_eq!(attacks.count(), 2);
        assert!(attacks.has(Square::from_file_rank(3, 4))); // d5
        assert!(attacks.has(Square::from_file_rank(5, 4))); // f5
    }

    #[test]
    fn test_black_pawn_attacks() {
        // Pawn on e5 attacks d4 and f4
        let e5 = Square::from_file_rank(4, 4);
        let attacks = black_pawn_attacks(e5);
        assert_eq!(attacks.count(), 2);
        assert!(attacks.has(Square::from_file_rank(3, 3))); // d4
        assert!(attacks.has(Square::from_file_rank(5, 3))); // f4
    }

    #[test]
    fn test_pawn_edge_file() {
        // Pawn on a4 can only attack b5
        let a4 = Square::from_file_rank(0, 3);
        let attacks = white_pawn_attacks(a4);
        assert_eq!(attacks.count(), 1);
        assert!(attacks.has(Square::from_file_rank(1, 4))); // b5
    }
}
