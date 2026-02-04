// Bitboard - 64-bit integer representing chess board
// Each bit corresponds to a square (bit 0 = a1, bit 63 = h8)

use crate::types::Square;
use std::fmt;

/// A bitboard is a 64-bit integer where each bit represents a square
#[derive(Clone, Copy, PartialEq, Eq, Default)]
pub struct Bitboard(pub u64);

impl Bitboard {
    pub const EMPTY: Bitboard = Bitboard(0);
    pub const ALL: Bitboard = Bitboard(!0);

    // ==========================================================================
    // RANK MASKS (rows)
    // ==========================================================================
    pub const RANK_1: Bitboard = Bitboard(0x0000_0000_0000_00FF);
    pub const RANK_2: Bitboard = Bitboard(0x0000_0000_0000_FF00);
    pub const RANK_3: Bitboard = Bitboard(0x0000_0000_00FF_0000);
    pub const RANK_4: Bitboard = Bitboard(0x0000_0000_FF00_0000);
    pub const RANK_5: Bitboard = Bitboard(0x0000_00FF_0000_0000);
    pub const RANK_6: Bitboard = Bitboard(0x0000_FF00_0000_0000);
    pub const RANK_7: Bitboard = Bitboard(0x00FF_0000_0000_0000);
    pub const RANK_8: Bitboard = Bitboard(0xFF00_0000_0000_0000);

    // ==========================================================================
    // FILE MASKS (columns)
    // ==========================================================================
    pub const FILE_A: Bitboard = Bitboard(0x0101_0101_0101_0101);
    pub const FILE_B: Bitboard = Bitboard(0x0202_0202_0202_0202);
    pub const FILE_C: Bitboard = Bitboard(0x0404_0404_0404_0404);
    pub const FILE_D: Bitboard = Bitboard(0x0808_0808_0808_0808);
    pub const FILE_E: Bitboard = Bitboard(0x1010_1010_1010_1010);
    pub const FILE_F: Bitboard = Bitboard(0x2020_2020_2020_2020);
    pub const FILE_G: Bitboard = Bitboard(0x4040_4040_4040_4040);
    pub const FILE_H: Bitboard = Bitboard(0x8080_8080_8080_8080);

    // Edges (for move generation bounds)
    pub const NOT_FILE_A: Bitboard = Bitboard(!Self::FILE_A.0);
    pub const NOT_FILE_H: Bitboard = Bitboard(!Self::FILE_H.0);
    pub const NOT_FILE_AB: Bitboard = Bitboard(!(Self::FILE_A.0 | Self::FILE_B.0));
    pub const NOT_FILE_GH: Bitboard = Bitboard(!(Self::FILE_G.0 | Self::FILE_H.0));

    // ==========================================================================
    // CONSTRUCTORS
    // ==========================================================================

    #[inline]
    pub const fn new(val: u64) -> Self {
        Bitboard(val)
    }

    /// Create bitboard with single bit set at square
    #[inline]
    pub const fn from_square(sq: Square) -> Self {
        Bitboard(1u64 << sq.0)
    }

    // ==========================================================================
    // BIT OPERATIONS
    // ==========================================================================

    /// Check if bitboard is empty
    #[inline]
    pub const fn is_empty(self) -> bool {
        self.0 == 0
    }

    /// Check if bitboard is not empty
    #[inline]
    pub const fn is_not_empty(self) -> bool {
        self.0 != 0
    }

    /// Count number of set bits (population count)
    #[inline]
    pub const fn count(self) -> u32 {
        self.0.count_ones()
    }

    /// Check if a specific square is set
    #[inline]
    pub const fn has(self, sq: Square) -> bool {
        (self.0 & (1u64 << sq.0)) != 0
    }

    /// Set a bit at square
    #[inline]
    pub fn set(&mut self, sq: Square) {
        self.0 |= 1u64 << sq.0;
    }

    /// Clear a bit at square
    #[inline]
    pub fn clear(&mut self, sq: Square) {
        self.0 &= !(1u64 << sq.0);
    }

    /// Toggle a bit at square
    #[inline]
    pub fn toggle(&mut self, sq: Square) {
        self.0 ^= 1u64 << sq.0;
    }

    /// Get index of least significant bit (first set bit)
    /// Returns None if bitboard is empty
    #[inline]
    pub fn lsb(self) -> Option<Square> {
        if self.0 == 0 {
            None
        } else {
            Some(Square(self.0.trailing_zeros() as u8))
        }
    }

    /// Pop least significant bit and return its square
    #[inline]
    pub fn pop_lsb(&mut self) -> Option<Square> {
        if self.0 == 0 {
            None
        } else {
            let sq = Square(self.0.trailing_zeros() as u8);
            self.0 &= self.0 - 1; // Clear the LSB
            Some(sq)
        }
    }

    /// Get index of most significant bit (last set bit)
    #[inline]
    pub fn msb(self) -> Option<Square> {
        if self.0 == 0 {
            None
        } else {
            Some(Square(63 - self.0.leading_zeros() as u8))
        }
    }

    // ==========================================================================
    // SHIFT OPERATIONS (for move generation)
    // ==========================================================================

    #[inline]
    pub const fn north(self) -> Bitboard {
        Bitboard(self.0 << 8)
    }

    #[inline]
    pub const fn south(self) -> Bitboard {
        Bitboard(self.0 >> 8)
    }

    #[inline]
    pub const fn east(self) -> Bitboard {
        Bitboard((self.0 << 1) & Self::NOT_FILE_A.0)
    }

    #[inline]
    pub const fn west(self) -> Bitboard {
        Bitboard((self.0 >> 1) & Self::NOT_FILE_H.0)
    }

    #[inline]
    pub const fn north_east(self) -> Bitboard {
        Bitboard((self.0 << 9) & Self::NOT_FILE_A.0)
    }

    #[inline]
    pub const fn north_west(self) -> Bitboard {
        Bitboard((self.0 << 7) & Self::NOT_FILE_H.0)
    }

    #[inline]
    pub const fn south_east(self) -> Bitboard {
        Bitboard((self.0 >> 7) & Self::NOT_FILE_A.0)
    }

    #[inline]
    pub const fn south_west(self) -> Bitboard {
        Bitboard((self.0 >> 9) & Self::NOT_FILE_H.0)
    }
}

// =============================================================================
// OPERATOR OVERLOADS
// =============================================================================

impl std::ops::BitOr for Bitboard {
    type Output = Bitboard;
    #[inline]
    fn bitor(self, rhs: Bitboard) -> Bitboard {
        Bitboard(self.0 | rhs.0)
    }
}

impl std::ops::BitOrAssign for Bitboard {
    #[inline]
    fn bitor_assign(&mut self, rhs: Bitboard) {
        self.0 |= rhs.0;
    }
}

impl std::ops::BitAnd for Bitboard {
    type Output = Bitboard;
    #[inline]
    fn bitand(self, rhs: Bitboard) -> Bitboard {
        Bitboard(self.0 & rhs.0)
    }
}

impl std::ops::BitAndAssign for Bitboard {
    #[inline]
    fn bitand_assign(&mut self, rhs: Bitboard) {
        self.0 &= rhs.0;
    }
}

impl std::ops::BitXor for Bitboard {
    type Output = Bitboard;
    #[inline]
    fn bitxor(self, rhs: Bitboard) -> Bitboard {
        Bitboard(self.0 ^ rhs.0)
    }
}

impl std::ops::Not for Bitboard {
    type Output = Bitboard;
    #[inline]
    fn not(self) -> Bitboard {
        Bitboard(!self.0)
    }
}

// =============================================================================
// ITERATOR - Iterate over set bits
// =============================================================================

impl Iterator for Bitboard {
    type Item = Square;

    #[inline]
    fn next(&mut self) -> Option<Square> {
        self.pop_lsb()
    }
}

// =============================================================================
// DEBUG DISPLAY - Print as 8x8 grid
// =============================================================================

impl fmt::Debug for Bitboard {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f)?;
        for rank in (0..8).rev() {
            write!(f, "{}  ", rank + 1)?;
            for file in 0..8 {
                let sq = Square::from_file_rank(file, rank);
                if self.has(sq) {
                    write!(f, "X ")?;
                } else {
                    write!(f, ". ")?;
                }
            }
            writeln!(f)?;
        }
        writeln!(f, "   a b c d e f g h")?;
        writeln!(f, "   (0x{:016X})", self.0)
    }
}

impl fmt::Display for Bitboard {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_square_basics() {
        let sq = Square::from_file_rank(4, 3); // e4
        assert_eq!(sq.file(), 4);
        assert_eq!(sq.rank(), 3);
        assert_eq!(sq.to_algebraic(), "e4");
    }

    #[test]
    fn test_bitboard_set_clear() {
        let mut bb = Bitboard::EMPTY;
        let e4 = Square::from_file_rank(4, 3);
        
        bb.set(e4);
        assert!(bb.has(e4));
        assert_eq!(bb.count(), 1);
        
        bb.clear(e4);
        assert!(!bb.has(e4));
        assert!(bb.is_empty());
    }

    #[test]
    fn test_bitboard_shifts() {
        let e4 = Bitboard::from_square(Square::from_file_rank(4, 3));
        
        // e4 north = e5
        let e5 = e4.north();
        assert!(e5.has(Square::from_file_rank(4, 4)));
        
        // e4 south = e3
        let e3 = e4.south();
        assert!(e3.has(Square::from_file_rank(4, 2)));
    }

    #[test]
    fn test_bitboard_iteration() {
        let mut bb = Bitboard::EMPTY;
        bb.set(Square::from_file_rank(0, 0)); // a1
        bb.set(Square::from_file_rank(4, 3)); // e4
        bb.set(Square::from_file_rank(7, 7)); // h8

        let squares: Vec<Square> = bb.collect();
        assert_eq!(squares.len(), 3);
    }
}
