// Chess Types and Constants

use wasm_bindgen::prelude::*;

// =============================================================================
// PIECE TYPES
// =============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum PieceType {
    Pawn = 0,
    Knight = 1,
    Bishop = 2,
    Rook = 3,
    Queen = 4,
    King = 5,
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Color {
    White = 0,
    Black = 1,
}

impl Color {
    #[inline]
    pub fn flip(self) -> Color {
        match self {
            Color::White => Color::Black,
            Color::Black => Color::White,
        }
    }
}

// =============================================================================
// SQUARES - Using standard chess notation mapping
// =============================================================================
// a1 = 0, b1 = 1, ..., h1 = 7
// a2 = 8, b2 = 9, ..., h2 = 15
// ...
// a8 = 56, b8 = 57, ..., h8 = 63

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Square(pub u8);

impl Square {
    #[inline]
    pub const fn new(index: u8) -> Self {
        debug_assert!(index < 64);
        Square(index)
    }

    #[inline]
    pub const fn from_file_rank(file: u8, rank: u8) -> Self {
        debug_assert!(file < 8 && rank < 8);
        Square(rank * 8 + file)
    }

    #[inline]
    pub const fn file(self) -> u8 {
        self.0 % 8
    }

    #[inline]
    pub const fn rank(self) -> u8 {
        self.0 / 8
    }

    #[inline]
    pub const fn index(self) -> usize {
        self.0 as usize
    }

    /// Convert to algebraic notation (e.g., "e4")
    pub fn to_algebraic(self) -> String {
        let file = (b'a' + self.file()) as char;
        let rank = (b'1' + self.rank()) as char;
        format!("{}{}", file, rank)
    }

    /// Parse from algebraic notation
    pub fn from_algebraic(s: &str) -> Option<Self> {
        let bytes = s.as_bytes();
        if bytes.len() != 2 {
            return None;
        }
        let file = bytes[0].wrapping_sub(b'a');
        let rank = bytes[1].wrapping_sub(b'1');
        if file < 8 && rank < 8 {
            Some(Square::from_file_rank(file, rank))
        } else {
            None
        }
    }
}

// Named squares for convenience
#[allow(dead_code)]
impl Square {
    pub const A1: Square = Square(0);
    pub const B1: Square = Square(1);
    pub const C1: Square = Square(2);
    pub const D1: Square = Square(3);
    pub const E1: Square = Square(4);
    pub const F1: Square = Square(5);
    pub const G1: Square = Square(6);
    pub const H1: Square = Square(7);
    
    pub const A2: Square = Square(8);
    pub const B2: Square = Square(9);
    pub const C2: Square = Square(10);
    pub const D2: Square = Square(11);
    pub const E2: Square = Square(12);
    pub const F2: Square = Square(13);
    pub const G2: Square = Square(14);
    pub const H2: Square = Square(15);
    
    pub const A7: Square = Square(48);
    pub const B7: Square = Square(49);
    pub const C7: Square = Square(50);
    pub const D7: Square = Square(51);
    pub const E7: Square = Square(52);
    pub const F7: Square = Square(53);
    pub const G7: Square = Square(54);
    pub const H7: Square = Square(55);
    
    pub const A8: Square = Square(56);
    pub const B8: Square = Square(57);
    pub const C8: Square = Square(58);
    pub const D8: Square = Square(59);
    pub const E8: Square = Square(60);
    pub const F8: Square = Square(61);
    pub const G8: Square = Square(62);
    pub const H8: Square = Square(63);
}

// =============================================================================
// CASTLING RIGHTS
// =============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CastlingRights(pub u8);

impl CastlingRights {
    pub const NONE: CastlingRights = CastlingRights(0);
    pub const WHITE_KINGSIDE: u8 = 0b0001;
    pub const WHITE_QUEENSIDE: u8 = 0b0010;
    pub const BLACK_KINGSIDE: u8 = 0b0100;
    pub const BLACK_QUEENSIDE: u8 = 0b1000;
    pub const ALL: CastlingRights = CastlingRights(0b1111);

    #[inline]
    pub fn has(self, right: u8) -> bool {
        (self.0 & right) != 0
    }

    #[inline]
    pub fn remove(&mut self, right: u8) {
        self.0 &= !right;
    }

    #[inline]
    pub fn add(&mut self, right: u8) {
        self.0 |= right;
    }
}

// =============================================================================
// MOVE REPRESENTATION
// =============================================================================
// Encoded in 16 bits:
// bits 0-5: from square (0-63)
// bits 6-11: to square (0-63)
// bits 12-13: promotion piece (0=N, 1=B, 2=R, 3=Q)
// bits 14-15: move flags (0=normal, 1=promotion, 2=en passant, 3=castling)

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Move(pub u16);

impl Move {
    pub const NULL: Move = Move(0);

    const FROM_MASK: u16 = 0x003F;
    const TO_MASK: u16 = 0x0FC0;
    const TO_SHIFT: u16 = 6;
    const PROMO_MASK: u16 = 0x3000;
    const PROMO_SHIFT: u16 = 12;
    const FLAG_MASK: u16 = 0xC000;
    const FLAG_SHIFT: u16 = 14;

    // Move flags
    pub const FLAG_NORMAL: u16 = 0;
    pub const FLAG_PROMOTION: u16 = 1;
    pub const FLAG_EN_PASSANT: u16 = 2;
    pub const FLAG_CASTLING: u16 = 3;

    #[inline]
    pub fn new(from: Square, to: Square) -> Self {
        Move((from.0 as u16) | ((to.0 as u16) << Self::TO_SHIFT))
    }

    #[inline]
    pub fn new_promotion(from: Square, to: Square, promo: PieceType) -> Self {
        let promo_bits = match promo {
            PieceType::Knight => 0,
            PieceType::Bishop => 1,
            PieceType::Rook => 2,
            PieceType::Queen => 3,
            _ => 3, // Default to queen
        };
        Move(
            (from.0 as u16)
                | ((to.0 as u16) << Self::TO_SHIFT)
                | (promo_bits << Self::PROMO_SHIFT)
                | (Self::FLAG_PROMOTION << Self::FLAG_SHIFT),
        )
    }

    #[inline]
    pub fn new_en_passant(from: Square, to: Square) -> Self {
        Move(
            (from.0 as u16)
                | ((to.0 as u16) << Self::TO_SHIFT)
                | (Self::FLAG_EN_PASSANT << Self::FLAG_SHIFT),
        )
    }

    #[inline]
    pub fn new_castling(from: Square, to: Square) -> Self {
        Move(
            (from.0 as u16)
                | ((to.0 as u16) << Self::TO_SHIFT)
                | (Self::FLAG_CASTLING << Self::FLAG_SHIFT),
        )
    }

    #[inline]
    pub fn from(self) -> Square {
        Square((self.0 & Self::FROM_MASK) as u8)
    }

    #[inline]
    pub fn to(self) -> Square {
        Square(((self.0 & Self::TO_MASK) >> Self::TO_SHIFT) as u8)
    }

    #[inline]
    pub fn promotion_piece(self) -> Option<PieceType> {
        if self.is_promotion() {
            Some(match (self.0 & Self::PROMO_MASK) >> Self::PROMO_SHIFT {
                0 => PieceType::Knight,
                1 => PieceType::Bishop,
                2 => PieceType::Rook,
                _ => PieceType::Queen,
            })
        } else {
            None
        }
    }

    #[inline]
    pub fn flags(self) -> u16 {
        (self.0 & Self::FLAG_MASK) >> Self::FLAG_SHIFT
    }

    #[inline]
    pub fn is_promotion(self) -> bool {
        self.flags() == Self::FLAG_PROMOTION
    }

    #[inline]
    pub fn is_en_passant(self) -> bool {
        self.flags() == Self::FLAG_EN_PASSANT
    }

    #[inline]
    pub fn is_castling(self) -> bool {
        self.flags() == Self::FLAG_CASTLING
    }

    /// Convert to UCI notation (e.g., "e2e4", "e7e8q")
    pub fn to_uci(self) -> String {
        let from = self.from().to_algebraic();
        let to = self.to().to_algebraic();
        if let Some(promo) = self.promotion_piece() {
            let promo_char = match promo {
                PieceType::Knight => 'n',
                PieceType::Bishop => 'b',
                PieceType::Rook => 'r',
                PieceType::Queen => 'q',
                _ => 'q',
            };
            format!("{}{}{}", from, to, promo_char)
        } else {
            format!("{}{}", from, to)
        }
    }
}
