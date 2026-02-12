// Chess Position - Full board state using bitboards

use crate::bitboard::Bitboard;
use crate::types::{CastlingRights, Color, Move, PieceType, Square};
use crate::zobrist;
use wasm_bindgen::prelude::*;

/// Complete chess position state
#[wasm_bindgen]
#[derive(Clone)]
pub struct Position {
    // Piece bitboards by color and type
    // pieces[color][piece_type]
    pieces: [[Bitboard; 6]; 2],

    // Combined occupancy bitboards (cached for speed)
    occupied_by_color: [Bitboard; 2],
    occupied_all: Bitboard,

    // Game state
    side_to_move: Color,
    castling: CastlingRights,
    en_passant: Option<Square>, // Target square for en passant capture
    halfmove_clock: u8,         // For 50-move rule
    fullmove_number: u16,

    // Zobrist hash for transposition tables and repetition detection
    hash: u64,
}

impl Position {
    // =========================================================================
    // CONSTRUCTORS
    // =========================================================================

    /// Create empty board
    pub fn empty() -> Self {
        Position {
            pieces: [[Bitboard::EMPTY; 6]; 2],
            occupied_by_color: [Bitboard::EMPTY; 2],
            occupied_all: Bitboard::EMPTY,
            side_to_move: Color::White,
            castling: CastlingRights::NONE,
            en_passant: None,
            halfmove_clock: 0,
            fullmove_number: 1,
            hash: 0,
        }
    }

    /// Create standard starting position
    pub fn starting_position() -> Self {
        Self::from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
            .expect("Starting position FEN is valid")
    }

    // =========================================================================
    // PIECE ACCESS
    // =========================================================================

    /// Get bitboard for specific piece type and color
    #[inline]
    pub fn pieces(&self, color: Color, piece: PieceType) -> Bitboard {
        self.pieces[color as usize][piece as usize]
    }

    /// Get all pieces of a color
    #[inline]
    pub fn occupied_by(&self, color: Color) -> Bitboard {
        self.occupied_by_color[color as usize]
    }

    /// Get all occupied squares
    #[inline]
    pub fn occupied(&self) -> Bitboard {
        self.occupied_all
    }

    /// Get all empty squares
    #[inline]
    pub fn empty_squares(&self) -> Bitboard {
        !self.occupied_all
    }

    /// Get side to move
    #[inline]
    pub fn side_to_move(&self) -> Color {
        self.side_to_move
    }

    /// Get castling rights
    #[inline]
    pub fn castling_rights(&self) -> CastlingRights {
        self.castling
    }

    /// Get en passant square
    #[inline]
    pub fn en_passant_square(&self) -> Option<Square> {
        self.en_passant
    }

    /// Get halfmove clock (for 50-move rule)
    #[inline]
    pub fn halfmove_clock(&self) -> u8 {
        self.halfmove_clock
    }

    /// Get Zobrist hash
    #[inline]
    pub fn hash(&self) -> u64 {
        self.hash
    }

    /// Iterate over all pieces on the board
    pub fn pieces_iter(&self) -> impl Iterator<Item = (Color, PieceType, Square)> + '_ {
        let colors = [Color::White, Color::Black];
        let piece_types = [
            PieceType::Pawn, PieceType::Knight, PieceType::Bishop,
            PieceType::Rook, PieceType::Queen, PieceType::King,
        ];
        colors.into_iter().flat_map(move |color| {
            piece_types.into_iter().flat_map(move |piece| {
                let mut bb = self.pieces(color, piece);
                std::iter::from_fn(move || {
                    bb.lsb().map(|sq| {
                        bb = Bitboard(bb.0 & !(1u64 << sq.index()));
                        (color, piece, sq)
                    })
                })
            })
        })
    }

    /// Compute Zobrist hash from scratch (for initialization / verification)
    pub fn compute_hash(&self) -> u64 {
        zobrist::compute_hash(
            self.pieces_iter(),
            self.side_to_move,
            self.castling,
            self.en_passant,
        )
    }

    /// Find what piece is on a square
    pub fn piece_on(&self, sq: Square) -> Option<(Color, PieceType)> {
        let bb = Bitboard::from_square(sq);

        for color in [Color::White, Color::Black] {
            if (self.occupied_by_color[color as usize] & bb).is_not_empty() {
                for piece_type in [
                    PieceType::Pawn,
                    PieceType::Knight,
                    PieceType::Bishop,
                    PieceType::Rook,
                    PieceType::Queen,
                    PieceType::King,
                ] {
                    if (self.pieces[color as usize][piece_type as usize] & bb).is_not_empty() {
                        return Some((color, piece_type));
                    }
                }
            }
        }
        None
    }

    // =========================================================================
    // PIECE MANIPULATION
    // =========================================================================

    /// Add a piece to the board
    pub fn add_piece(&mut self, color: Color, piece: PieceType, sq: Square) {
        let bb = Bitboard::from_square(sq);
        self.pieces[color as usize][piece as usize] |= bb;
        self.occupied_by_color[color as usize] |= bb;
        self.occupied_all |= bb;
    }

    /// Remove a piece from the board
    pub fn remove_piece(&mut self, color: Color, piece: PieceType, sq: Square) {
        let bb = Bitboard::from_square(sq);
        self.pieces[color as usize][piece as usize] =
            Bitboard(self.pieces[color as usize][piece as usize].0 & !bb.0);
        self.occupied_by_color[color as usize] =
            Bitboard(self.occupied_by_color[color as usize].0 & !bb.0);
        self.occupied_all = Bitboard(self.occupied_all.0 & !bb.0);
    }

    /// Move a piece (doesn't handle captures, just movement)
    pub fn move_piece(&mut self, color: Color, piece: PieceType, from: Square, to: Square) {
        self.remove_piece(color, piece, from);
        self.add_piece(color, piece, to);
    }

    // =========================================================================
    // UNDO INFO — Saved before each make_move, restored by unmake_move
    // =========================================================================
}

/// State snapshot needed to undo a move.
/// Stored alongside the Move so unmake_move can reverse make_move perfectly.
#[derive(Clone, Copy, Debug)]
pub struct UndoInfo {
    /// Piece captured during this move (None if not a capture)
    pub captured: Option<PieceType>,
    /// Castling rights BEFORE the move
    pub castling: CastlingRights,
    /// En passant square BEFORE the move
    pub en_passant: Option<Square>,
    /// Halfmove clock BEFORE the move
    pub halfmove_clock: u8,
    /// Zobrist hash BEFORE the move
    pub hash: u64,
}

impl Position {

    // =========================================================================
    // MAKE MOVE
    // =========================================================================

    /// Make a move on the board. Returns Some(UndoInfo) if the move was legal,
    /// None if it was illegal (king left in check, or invalid).
    /// The UndoInfo is needed by unmake_move() to reverse this operation.
    pub fn make_move(&mut self, m: Move) -> Option<UndoInfo> {
        let us = self.side_to_move;
        let them = us.flip();
        let from = m.from();
        let to = m.to();
        
        // Find what piece is moving
        let moving_piece = match self.piece_on(from) {
            Some((color, piece)) if color == us => piece,
            _ => return None, // Invalid move
        };
        
        // Save undo info BEFORE modifying anything
        let mut undo = UndoInfo {
            captured: None,
            castling: self.castling,
            en_passant: self.en_passant,
            halfmove_clock: self.halfmove_clock,
            hash: self.hash,
        };

        // === Hash: XOR out old castling rights (will XOR in new ones after update) ===
        self.hash ^= zobrist::castling_key(self.castling);

        // === Hash: XOR out old en passant ===
        if let Some(ep_sq) = self.en_passant {
            self.hash ^= zobrist::en_passant_key(ep_sq.file());
        }

        // Handle captures (remove enemy piece at destination)
        if let Some((cap_color, cap_piece)) = self.piece_on(to) {
            if cap_color == them {
                undo.captured = Some(cap_piece);
                self.remove_piece(them, cap_piece, to);
                // Hash: XOR out captured piece
                self.hash ^= zobrist::piece_key(them, cap_piece, to);
            } else {
                return None; // Can't capture own piece
            }
        }
        
        // Handle special moves
        if m.is_en_passant() {
            // Remove the captured pawn (it's not on 'to' square)
            let captured_sq = if us == Color::White {
                Square::new(to.0 - 8)
            } else {
                Square::new(to.0 + 8)
            };
            undo.captured = Some(PieceType::Pawn);
            self.remove_piece(them, PieceType::Pawn, captured_sq);
            // Hash: XOR out en-passant captured pawn
            self.hash ^= zobrist::piece_key(them, PieceType::Pawn, captured_sq);
        }
        
        if m.is_castling() {
            // Move the rook as well
            let (rook_from, rook_to) = match to {
                Square::G1 => (Square::H1, Square::F1), // White kingside
                Square::C1 => (Square::A1, Square::D1), // White queenside
                Square::G8 => (Square::H8, Square::F8), // Black kingside
                Square::C8 => (Square::A8, Square::D8), // Black queenside
                _ => return None,
            };
            self.move_piece(us, PieceType::Rook, rook_from, rook_to);
            // Hash: XOR out rook from old square, XOR in rook at new square
            self.hash ^= zobrist::piece_key(us, PieceType::Rook, rook_from);
            self.hash ^= zobrist::piece_key(us, PieceType::Rook, rook_to);
        }
        
        // Move the piece — hash: XOR out piece from old square
        self.remove_piece(us, moving_piece, from);
        self.hash ^= zobrist::piece_key(us, moving_piece, from);
        
        // Handle promotion
        let placed_piece = if let Some(promo) = m.promotion_piece() {
            promo
        } else {
            moving_piece
        };
        self.add_piece(us, placed_piece, to);
        // Hash: XOR in piece at new square (could be promoted piece type)
        self.hash ^= zobrist::piece_key(us, placed_piece, to);
        
        // Update castling rights
        self.update_castling_rights(from, to);
        // === Hash: XOR in new castling rights ===
        self.hash ^= zobrist::castling_key(self.castling);
        
        // Update en passant square
        self.en_passant = if moving_piece == PieceType::Pawn {
            let diff = (to.0 as i8 - from.0 as i8).abs();
            if diff == 16 {
                // Double pawn push - set en passant square
                Some(Square::new(((from.0 as i8 + to.0 as i8) / 2) as u8))
            } else {
                None
            }
        } else {
            None
        };
        // === Hash: XOR in new en passant ===
        if let Some(ep_sq) = self.en_passant {
            self.hash ^= zobrist::en_passant_key(ep_sq.file());
        }
        
        // Update halfmove clock (reset on pawn move or capture)
        if moving_piece == PieceType::Pawn || undo.captured.is_some() {
            self.halfmove_clock = 0;
        } else {
            self.halfmove_clock += 1;
        }
        
        // Update fullmove number
        if us == Color::Black {
            self.fullmove_number += 1;
        }
        
        // Switch sides
        self.side_to_move = them;
        // === Hash: flip side to move ===
        self.hash ^= zobrist::side_to_move_key();
        
        // Check if move was legal (our king not in check)
        if self.is_in_check(us) {
            // Illegal move — unmake it
            self.unmake_move(m, &undo);
            return None;
        }
        
        Some(undo)
    }

    // =========================================================================
    // UNMAKE MOVE
    // =========================================================================

    /// Undo a move, restoring the position to its state before make_move.
    /// The caller must provide the same Move and the UndoInfo returned by make_move.
    pub fn unmake_move(&mut self, m: Move, undo: &UndoInfo) {
        // Switch sides back (was flipped at end of make_move)
        let them = self.side_to_move;       // "them" is the side that just moved
        let us = them.flip();               // "us" is the side that made the move
        self.side_to_move = us;

        // Undo fullmove number
        if us == Color::Black {
            self.fullmove_number -= 1;
        }

        // Restore saved state
        self.castling = undo.castling;
        self.en_passant = undo.en_passant;
        self.halfmove_clock = undo.halfmove_clock;
        self.hash = undo.hash;

        let from = m.from();
        let to = m.to();

        // Figure out what piece is on the destination (could be promoted)
        let placed_piece = if let Some(promo) = m.promotion_piece() {
            promo
        } else {
            // Look up what's actually on 'to' square
            match self.piece_on(to) {
                Some((_, pt)) => pt,
                None => return, // Shouldn't happen
            }
        };

        // Remove piece from destination
        self.remove_piece(us, placed_piece, to);

        // Put original piece back on source square
        let original_piece = if m.is_promotion() {
            PieceType::Pawn // Promotions always start as pawns
        } else {
            placed_piece
        };
        self.add_piece(us, original_piece, from);

        // Restore captured piece
        if let Some(cap_piece) = undo.captured {
            if m.is_en_passant() {
                // En passant capture: pawn was not on 'to', it was behind it
                let cap_sq = if us == Color::White {
                    Square::new(to.0 - 8)
                } else {
                    Square::new(to.0 + 8)
                };
                self.add_piece(them, PieceType::Pawn, cap_sq);
            } else {
                self.add_piece(them, cap_piece, to);
            }
        }

        // Undo castling rook move
        if m.is_castling() {
            let (rook_from, rook_to) = match to {
                Square::G1 => (Square::H1, Square::F1),
                Square::C1 => (Square::A1, Square::D1),
                Square::G8 => (Square::H8, Square::F8),
                Square::C8 => (Square::A8, Square::D8),
                _ => return,
            };
            // Rook was moved from rook_from to rook_to in make_move, so reverse it
            self.move_piece(us, PieceType::Rook, rook_to, rook_from);
        }
    }
    
    fn update_castling_rights(&mut self, from: Square, to: Square) {
        // King moves remove both castling rights
        if from == Square::E1 {
            self.castling.remove(CastlingRights::WHITE_KINGSIDE | CastlingRights::WHITE_QUEENSIDE);
        }
        if from == Square::E8 {
            self.castling.remove(CastlingRights::BLACK_KINGSIDE | CastlingRights::BLACK_QUEENSIDE);
        }
        
        // Rook moves or captures remove specific rights
        if from == Square::A1 || to == Square::A1 {
            self.castling.remove(CastlingRights::WHITE_QUEENSIDE);
        }
        if from == Square::H1 || to == Square::H1 {
            self.castling.remove(CastlingRights::WHITE_KINGSIDE);
        }
        if from == Square::A8 || to == Square::A8 {
            self.castling.remove(CastlingRights::BLACK_QUEENSIDE);
        }
        if from == Square::H8 || to == Square::H8 {
            self.castling.remove(CastlingRights::BLACK_KINGSIDE);
        }
    }
    
    /// Check if the given side's king is in check
    pub fn is_in_check(&self, color: Color) -> bool {
        let king_bb = self.pieces(color, PieceType::King);
        if let Some(king_sq) = king_bb.lsb() {
            self.is_square_attacked(king_sq, color.flip())
        } else {
            // No king found - shouldn't happen in valid position
            true
        }
    }
    
    /// Check if a square is attacked by the given side
    pub fn is_square_attacked(&self, sq: Square, attacker: Color) -> bool {
        use crate::attacks::{knight_attacks, king_attacks, pawn_attacks};
        
        // Knight attacks
        let knights = self.pieces(attacker, PieceType::Knight);
        if (knight_attacks(sq) & knights).is_not_empty() {
            return true;
        }
        
        // King attacks
        let king = self.pieces(attacker, PieceType::King);
        if (king_attacks(sq) & king).is_not_empty() {
            return true;
        }
        
        // Pawn attacks (note: we check from defender's perspective)
        let pawns = self.pieces(attacker, PieceType::Pawn);
        let pawn_att = pawn_attacks(sq, attacker == Color::Black); // Flip because we're checking who attacks this square
        if (pawn_att & pawns).is_not_empty() {
            return true;
        }
        
        // Sliding piece attacks using magic bitboards
        use crate::magic::{bishop_attacks, rook_attacks};
        let occupied = self.occupied();
        
        // Bishop + Queen diagonal attacks
        let bishops = self.pieces(attacker, PieceType::Bishop);
        let queens = self.pieces(attacker, PieceType::Queen);
        let bishop_att = bishop_attacks(sq, occupied);
        if (bishop_att & (bishops | queens)).is_not_empty() {
            return true;
        }
        
        // Rook + Queen straight attacks
        let rooks = self.pieces(attacker, PieceType::Rook);
        let rook_att = rook_attacks(sq, occupied);
        if (rook_att & (rooks | queens)).is_not_empty() {
            return true;
        }
        
        false
    }

    // =========================================================================
    // FEN PARSING
    // =========================================================================

    /// Parse position from FEN string
    pub fn from_fen(fen: &str) -> Result<Self, &'static str> {
        let parts: Vec<&str> = fen.split_whitespace().collect();
        if parts.len() < 4 {
            return Err("FEN must have at least 4 parts");
        }

        let mut pos = Position::empty();

        // Parse piece placement
        let mut rank = 7u8;
        let mut file = 0u8;

        for ch in parts[0].chars() {
            match ch {
                '/' => {
                    if rank == 0 {
                        return Err("Too many ranks in FEN");
                    }
                    rank -= 1;
                    file = 0;
                }
                '1'..='8' => {
                    file += ch.to_digit(10).unwrap() as u8;
                }
                _ => {
                    if file >= 8 {
                        return Err("Too many files in FEN rank");
                    }

                    let color = if ch.is_uppercase() {
                        Color::White
                    } else {
                        Color::Black
                    };
                    let piece = match ch.to_ascii_lowercase() {
                        'p' => PieceType::Pawn,
                        'n' => PieceType::Knight,
                        'b' => PieceType::Bishop,
                        'r' => PieceType::Rook,
                        'q' => PieceType::Queen,
                        'k' => PieceType::King,
                        _ => return Err("Invalid piece character in FEN"),
                    };

                    let sq = Square::from_file_rank(file, rank);
                    pos.add_piece(color, piece, sq);
                    file += 1;
                }
            }
        }

        // Parse side to move
        pos.side_to_move = match parts[1] {
            "w" => Color::White,
            "b" => Color::Black,
            _ => return Err("Invalid side to move"),
        };

        // Parse castling rights
        pos.castling = CastlingRights::NONE;
        if parts[2] != "-" {
            for ch in parts[2].chars() {
                match ch {
                    'K' => pos.castling.add(CastlingRights::WHITE_KINGSIDE),
                    'Q' => pos.castling.add(CastlingRights::WHITE_QUEENSIDE),
                    'k' => pos.castling.add(CastlingRights::BLACK_KINGSIDE),
                    'q' => pos.castling.add(CastlingRights::BLACK_QUEENSIDE),
                    _ => return Err("Invalid castling rights"),
                }
            }
        }

        // Parse en passant square
        pos.en_passant = if parts[3] == "-" {
            None
        } else {
            Square::from_algebraic(parts[3])
        };

        // Parse halfmove clock (optional)
        pos.halfmove_clock = parts.get(4).and_then(|s| s.parse().ok()).unwrap_or(0);

        // Parse fullmove number (optional)
        pos.fullmove_number = parts.get(5).and_then(|s| s.parse().ok()).unwrap_or(1);

        // Compute Zobrist hash from the fully parsed position
        pos.hash = pos.compute_hash();

        Ok(pos)
    }

    /// Convert position to FEN string
    pub fn to_fen(&self) -> String {
        let mut fen = String::with_capacity(90);

        // Piece placement
        for rank in (0..8).rev() {
            let mut empty_count = 0;

            for file in 0..8 {
                let sq = Square::from_file_rank(file, rank);

                if let Some((color, piece)) = self.piece_on(sq) {
                    if empty_count > 0 {
                        fen.push(char::from_digit(empty_count, 10).unwrap());
                        empty_count = 0;
                    }

                    let ch = match piece {
                        PieceType::Pawn => 'p',
                        PieceType::Knight => 'n',
                        PieceType::Bishop => 'b',
                        PieceType::Rook => 'r',
                        PieceType::Queen => 'q',
                        PieceType::King => 'k',
                    };

                    fen.push(if color == Color::White {
                        ch.to_ascii_uppercase()
                    } else {
                        ch
                    });
                } else {
                    empty_count += 1;
                }
            }

            if empty_count > 0 {
                fen.push(char::from_digit(empty_count, 10).unwrap());
            }

            if rank > 0 {
                fen.push('/');
            }
        }

        // Side to move
        fen.push(' ');
        fen.push(match self.side_to_move {
            Color::White => 'w',
            Color::Black => 'b',
        });

        // Castling rights
        fen.push(' ');
        if self.castling.0 == 0 {
            fen.push('-');
        } else {
            if self.castling.has(CastlingRights::WHITE_KINGSIDE) {
                fen.push('K');
            }
            if self.castling.has(CastlingRights::WHITE_QUEENSIDE) {
                fen.push('Q');
            }
            if self.castling.has(CastlingRights::BLACK_KINGSIDE) {
                fen.push('k');
            }
            if self.castling.has(CastlingRights::BLACK_QUEENSIDE) {
                fen.push('q');
            }
        }

        // En passant
        fen.push(' ');
        match self.en_passant {
            Some(sq) => fen.push_str(&sq.to_algebraic()),
            None => fen.push('-'),
        }

        // Halfmove clock and fullmove number
        fen.push_str(&format!(" {} {}", self.halfmove_clock, self.fullmove_number));

        fen
    }
}

// =============================================================================
// WASM BINDINGS
// =============================================================================

#[wasm_bindgen]
impl Position {
    /// Get piece character at square (for display)
    /// Returns empty string if no piece
    #[wasm_bindgen]
    pub fn get_piece_at(&self, file: u8, rank: u8) -> String {
        if file >= 8 || rank >= 8 {
            return String::new();
        }

        let sq = Square::from_file_rank(file, rank);
        match self.piece_on(sq) {
            Some((color, piece)) => {
                let ch = match piece {
                    PieceType::Pawn => 'P',
                    PieceType::Knight => 'N',
                    PieceType::Bishop => 'B',
                    PieceType::Rook => 'R',
                    PieceType::Queen => 'Q',
                    PieceType::King => 'K',
                };
                if color == Color::White {
                    ch.to_string()
                } else {
                    ch.to_ascii_lowercase().to_string()
                }
            }
            None => String::new(),
        }
    }

    /// Check if it's white's turn
    #[wasm_bindgen]
    pub fn is_white_turn(&self) -> bool {
        matches!(self.side_to_move, Color::White)
    }

    /// Get total piece count
    #[wasm_bindgen]
    pub fn piece_count(&self) -> u32 {
        self.occupied_all.count()
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_starting_position() {
        let pos = Position::starting_position();

        // Check white pieces
        assert_eq!(pos.pieces(Color::White, PieceType::Pawn).count(), 8);
        assert_eq!(pos.pieces(Color::White, PieceType::Rook).count(), 2);
        assert_eq!(pos.pieces(Color::White, PieceType::Knight).count(), 2);
        assert_eq!(pos.pieces(Color::White, PieceType::Bishop).count(), 2);
        assert_eq!(pos.pieces(Color::White, PieceType::Queen).count(), 1);
        assert_eq!(pos.pieces(Color::White, PieceType::King).count(), 1);

        // Check black pieces
        assert_eq!(pos.pieces(Color::Black, PieceType::Pawn).count(), 8);

        // Total 32 pieces
        assert_eq!(pos.piece_count(), 32);

        // White to move
        assert!(pos.is_white_turn());
    }

    #[test]
    fn test_fen_roundtrip() {
        let start_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        let pos = Position::from_fen(start_fen).unwrap();
        assert_eq!(pos.to_fen(), start_fen);

        let mid_fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
        let pos2 = Position::from_fen(mid_fen).unwrap();
        assert_eq!(pos2.to_fen(), mid_fen);
    }

    #[test]
    fn test_piece_on() {
        let pos = Position::starting_position();

        // e1 should have white king
        let e1 = Square::from_file_rank(4, 0);
        assert_eq!(pos.piece_on(e1), Some((Color::White, PieceType::King)));

        // e8 should have black king
        let e8 = Square::from_file_rank(4, 7);
        assert_eq!(pos.piece_on(e8), Some((Color::Black, PieceType::King)));

        // e4 should be empty
        let e4 = Square::from_file_rank(4, 3);
        assert_eq!(pos.piece_on(e4), None);
    }

    #[test]
    fn test_halfmove_clock_increments_on_quiet_move() {
        // Knight can move — non-pawn, non-capture
        let mut pos = Position::from_fen("4k3/8/8/8/8/8/8/4K1N1 w - - 0 1").unwrap();
        let nf3 = Square::from_file_rank(5, 2); // f3
        let m = Move::new(Square::G1, nf3); // Nf3
        pos.make_move(m).unwrap();
        assert_eq!(pos.halfmove_clock(), 1);
    }

    #[test]
    fn test_halfmove_clock_resets_on_capture() {
        // White knight captures black pawn on f3
        let mut pos = Position::from_fen("4k3/8/8/8/8/5p2/8/4K1N1 w - - 5 1").unwrap();
        let nf3 = Square::from_file_rank(5, 2); // f3
        let m = Move::new(Square::G1, nf3); // Nxf3
        pos.make_move(m).unwrap();
        assert_eq!(pos.halfmove_clock(), 0);
    }

    #[test]
    fn test_halfmove_clock_resets_on_pawn_move() {
        let mut pos = Position::from_fen("4k3/8/8/8/8/8/4P3/4K3 w - - 5 1").unwrap();
        let e4 = Square::from_file_rank(4, 3); // e4
        let m = Move::new(Square::E2, e4); // e4
        pos.make_move(m).unwrap();
        assert_eq!(pos.halfmove_clock(), 0);
    }

    // =========================================================================
    // ZOBRIST HASH TESTS
    // =========================================================================

    #[test]
    fn test_hash_nonzero_for_starting_position() {
        let pos = Position::starting_position();
        assert_ne!(pos.hash(), 0, "Starting position hash should not be zero");
    }

    #[test]
    fn test_hash_matches_compute_hash() {
        // After construction, incremental hash should match full computation
        let pos = Position::starting_position();
        assert_eq!(pos.hash(), pos.compute_hash());

        let pos2 = Position::from_fen("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4").unwrap();
        assert_eq!(pos2.hash(), pos2.compute_hash());
    }

    #[test]
    fn test_hash_changes_after_move() {
        let pos = Position::starting_position();
        let hash_before = pos.hash();
        let mut pos2 = pos.clone();
        pos2.make_move(Move::new(Square::E2, Square::from_file_rank(4, 3))).unwrap(); // e2e4
        assert_ne!(pos2.hash(), hash_before, "Hash must change after a move");
    }

    #[test]
    fn test_hash_incremental_matches_full_after_moves() {
        // Play a few moves and verify incremental hash stays consistent
        let mut pos = Position::starting_position();
        
        // 1. e4
        pos.make_move(Move::new(Square::E2, Square::from_file_rank(4, 3))).unwrap();
        assert_eq!(pos.hash(), pos.compute_hash(), "Hash mismatch after 1. e4");
        
        // 1... e5
        pos.make_move(Move::new(Square::from_file_rank(4, 6), Square::from_file_rank(4, 4))).unwrap();
        assert_eq!(pos.hash(), pos.compute_hash(), "Hash mismatch after 1... e5");
        
        // 2. Nf3
        pos.make_move(Move::new(Square::G1, Square::from_file_rank(5, 2))).unwrap();
        assert_eq!(pos.hash(), pos.compute_hash(), "Hash mismatch after 2. Nf3");
        
        // 2... Nc6
        pos.make_move(Move::new(Square::from_file_rank(1, 7), Square::from_file_rank(2, 5))).unwrap();
        assert_eq!(pos.hash(), pos.compute_hash(), "Hash mismatch after 2... Nc6");
        
        // 3. Bc4
        pos.make_move(Move::new(Square::from_file_rank(5, 0), Square::from_file_rank(2, 3))).unwrap();
        assert_eq!(pos.hash(), pos.compute_hash(), "Hash mismatch after 3. Bc4");
    }

    #[test]
    fn test_hash_same_position_different_move_order() {
        // Reach the same position via different move orders → same hash
        // Both paths end with the same last move (Nc6), so en passant state matches
        // Path A: 1. Nf3 e5 2. e3 Nc6
        let mut pos_a = Position::starting_position();
        pos_a.make_move(Move::new(Square::G1, Square::from_file_rank(5, 2))).unwrap(); // Nf3
        pos_a.make_move(Move::new(Square::from_file_rank(4, 6), Square::from_file_rank(4, 4))).unwrap(); // e5
        pos_a.make_move(Move::new(Square::E2, Square::from_file_rank(4, 2))).unwrap(); // e3
        pos_a.make_move(Move::new(Square::from_file_rank(1, 7), Square::from_file_rank(2, 5))).unwrap(); // Nc6

        // Path B: 1. e3 Nc6 2. Nf3 e5 3. — wait, that has EP on e6
        // Better: use only non-pawn moves so EP is irrelevant
        // Path A: 1. Nf3 Nc6 2. Nh4 Nb8 3. Nf3 Nc6  (return to same position)
        // Path B: just starting + Nf3 Nc6
        // Actually simplest: two non-pawn knight moves in different orders
        
        // Path A: 1. Nf3 Nf6
        let mut pa = Position::starting_position();
        pa.make_move(Move::new(Square::G1, Square::from_file_rank(5, 2))).unwrap(); // Nf3
        pa.make_move(Move::new(Square::from_file_rank(6, 7), Square::from_file_rank(5, 5))).unwrap(); // Nf6

        // Path B: Use FEN that represents same position
        let pb = Position::from_fen(&pa.to_fen()).unwrap();
        
        assert_eq!(pa.hash(), pb.hash(), "Same position must have same hash");
        assert_eq!(pa.to_fen(), pb.to_fen(), "FENs should also match");
        
        // More interesting: truly transposed knight moves
        // Path C: 1. Nc3 Nc6 2. Nf3 Nf6 
        let mut pc = Position::starting_position();
        pc.make_move(Move::new(Square::from_file_rank(1, 0), Square::from_file_rank(2, 2))).unwrap(); // Nc3
        pc.make_move(Move::new(Square::from_file_rank(1, 7), Square::from_file_rank(2, 5))).unwrap(); // Nc6
        pc.make_move(Move::new(Square::G1, Square::from_file_rank(5, 2))).unwrap(); // Nf3
        pc.make_move(Move::new(Square::from_file_rank(6, 7), Square::from_file_rank(5, 5))).unwrap(); // Nf6

        // Path D: 1. Nf3 Nf6 2. Nc3 Nc6 (different order, same result)
        let mut pd = Position::starting_position();
        pd.make_move(Move::new(Square::G1, Square::from_file_rank(5, 2))).unwrap(); // Nf3
        pd.make_move(Move::new(Square::from_file_rank(6, 7), Square::from_file_rank(5, 5))).unwrap(); // Nf6
        pd.make_move(Move::new(Square::from_file_rank(1, 0), Square::from_file_rank(2, 2))).unwrap(); // Nc3
        pd.make_move(Move::new(Square::from_file_rank(1, 7), Square::from_file_rank(2, 5))).unwrap(); // Nc6

        assert_eq!(pc.to_fen(), pd.to_fen(), "FENs should match for transposed positions");
        assert_eq!(pc.hash(), pd.hash(), "Same position via different move orders must have same hash");
    }

    #[test]
    fn test_hash_same_fen_same_hash() {
        // Parsing the same FEN twice should give the same hash
        let fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
        let pos1 = Position::from_fen(fen).unwrap();
        let pos2 = Position::from_fen(fen).unwrap();
        assert_eq!(pos1.hash(), pos2.hash());
    }

    #[test]
    fn test_hash_different_fen_different_hash() {
        let pos1 = Position::from_fen("4k3/8/8/8/8/8/8/4K3 w - - 0 1").unwrap();
        let pos2 = Position::from_fen("4k3/8/8/8/8/8/8/3K4 w - - 0 1").unwrap();
        assert_ne!(pos1.hash(), pos2.hash());
    }

    #[test]
    fn test_hash_capture_changes_hash() {
        // After a capture, the hash should change and still match full compute
        let mut pos = Position::from_fen("4k3/8/8/8/8/5p2/8/4K1N1 w - - 5 1").unwrap();
        pos.make_move(Move::new(Square::G1, Square::from_file_rank(5, 2))).unwrap(); // Nxf3
        assert_eq!(pos.hash(), pos.compute_hash(), "Hash mismatch after capture");
    }

    #[test]
    fn test_hash_castling() {
        // White kingside castling
        let mut pos = Position::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1").unwrap();
        pos.make_move(Move::new_castling(Square::E1, Square::G1)).unwrap();
        assert_eq!(pos.hash(), pos.compute_hash(), "Hash mismatch after castling");
    }

    #[test]
    fn test_hash_en_passant_capture() {
        // En passant capture
        let mut pos = Position::from_fen("4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1").unwrap();
        pos.make_move(Move::new_en_passant(Square::from_file_rank(3, 4), Square::from_file_rank(4, 5))).unwrap(); // d5xe6 ep
        assert_eq!(pos.hash(), pos.compute_hash(), "Hash mismatch after en passant");
    }

    #[test]
    fn test_hash_promotion() {
        // Pawn promotion
        let mut pos = Position::from_fen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1").unwrap();
        pos.make_move(Move::new_promotion(Square::A7, Square::A8, PieceType::Queen)).unwrap();
        assert_eq!(pos.hash(), pos.compute_hash(), "Hash mismatch after promotion");
    }

    // =========================================================================
    // UNMAKE_MOVE TESTS
    // =========================================================================

    /// Helper: assert that make + unmake restores the position exactly
    fn assert_make_unmake_roundtrip(fen: &str, m: Move) {
        let mut pos = Position::from_fen(fen).unwrap();
        let original_fen = pos.to_fen();
        let original_hash = pos.hash();

        let undo = pos.make_move(m).expect(&format!(
            "Move {} should be legal in position {}", m.to_uci(), fen
        ));
        // Position should have changed
        assert_ne!(pos.to_fen(), original_fen, "Position should change after make_move");

        pos.unmake_move(m, &undo);
        // Position should be fully restored
        assert_eq!(pos.to_fen(), original_fen,
            "FEN mismatch after unmake_move for {} in {}", m.to_uci(), fen);
        assert_eq!(pos.hash(), original_hash,
            "Hash mismatch after unmake_move for {} in {}", m.to_uci(), fen);
    }

    #[test]
    fn test_unmake_quiet_move() {
        // Knight move
        assert_make_unmake_roundtrip(
            "4k3/8/8/8/8/8/8/4K1N1 w - - 0 1",
            Move::new(Square::G1, Square::from_file_rank(5, 2)), // Ng1-f3
        );
    }

    #[test]
    fn test_unmake_capture() {
        // Knight captures pawn
        assert_make_unmake_roundtrip(
            "4k3/8/8/8/8/5p2/8/4K1N1 w - - 5 1",
            Move::new(Square::G1, Square::from_file_rank(5, 2)), // Nxf3
        );
    }

    #[test]
    fn test_unmake_double_pawn_push() {
        // e2-e4
        assert_make_unmake_roundtrip(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            Move::new(Square::E2, Square::from_file_rank(4, 3)),
        );
    }

    #[test]
    fn test_unmake_en_passant() {
        assert_make_unmake_roundtrip(
            "4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1",
            Move::new_en_passant(Square::from_file_rank(3, 4), Square::from_file_rank(4, 5)),
        );
    }

    #[test]
    fn test_unmake_castling_kingside() {
        assert_make_unmake_roundtrip(
            "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
            Move::new_castling(Square::E1, Square::G1),
        );
    }

    #[test]
    fn test_unmake_castling_queenside() {
        assert_make_unmake_roundtrip(
            "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
            Move::new_castling(Square::E1, Square::C1),
        );
    }

    #[test]
    fn test_unmake_promotion() {
        assert_make_unmake_roundtrip(
            "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
            Move::new_promotion(Square::A7, Square::A8, PieceType::Queen),
        );
    }

    #[test]
    fn test_unmake_promotion_with_capture() {
        assert_make_unmake_roundtrip(
            "1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1",
            Move::new_promotion(Square::A7, Square::from_file_rank(1, 7), PieceType::Queen),
        );
    }

    #[test]
    fn test_unmake_black_castling() {
        assert_make_unmake_roundtrip(
            "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1",
            Move::new_castling(Square::from_file_rank(4, 7), Square::from_file_rank(6, 7)),
        );
    }

    #[test]
    fn test_unmake_sequence_of_moves() {
        // Play several moves and unmake them all — should return to start
        let mut pos = Position::starting_position();
        let original_fen = pos.to_fen();
        let original_hash = pos.hash();

        let moves_and_undos: Vec<(Move, UndoInfo)> = vec![
            Move::new(Square::E2, Square::from_file_rank(4, 3)),  // e4
            Move::new(Square::from_file_rank(4, 6), Square::from_file_rank(4, 4)), // e5
            Move::new(Square::G1, Square::from_file_rank(5, 2)),  // Nf3
            Move::new(Square::from_file_rank(1, 7), Square::from_file_rank(2, 5)), // Nc6
        ].into_iter().map(|m| {
            let undo = pos.make_move(m).unwrap();
            (m, undo)
        }).collect();

        // Now unmake in reverse order
        for (m, undo) in moves_and_undos.into_iter().rev() {
            pos.unmake_move(m, &undo);
        }

        assert_eq!(pos.to_fen(), original_fen, "FEN should match after unmaking all moves");
        assert_eq!(pos.hash(), original_hash, "Hash should match after unmaking all moves");
    }

    #[test]
    fn test_unmake_preserves_all_perft_positions() {
        // For each perft position: make every legal move and unmake, verify FEN + hash restored
        let fens = [
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
            "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
            "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
        ];

        for fen in &fens {
            let mut pos = Position::from_fen(fen).unwrap();
            let original_fen = pos.to_fen();
            let original_hash = pos.hash();

            let pseudo = crate::movegen::generate_pseudo_legal_moves(&pos);
            for m in pseudo.iter() {
                if let Some(undo) = pos.make_move(*m) {
                    pos.unmake_move(*m, &undo);
                    assert_eq!(pos.to_fen(), original_fen,
                        "FEN mismatch after make/unmake {} in {}", m.to_uci(), fen);
                    assert_eq!(pos.hash(), original_hash,
                        "Hash mismatch after make/unmake {} in {}", m.to_uci(), fen);
                }
                // If make_move returned None, position was already restored internally
            }
        }
    }
}
