// Move Generation Module
// Generates all legal moves for a position

use crate::attacks::{knight_attacks, king_attacks, pawn_attacks};
use crate::magic::{rook_attacks, bishop_attacks, queen_attacks};
use crate::bitboard::Bitboard;
use crate::position::Position;
use crate::types::{CastlingRights, Color, Move, PieceType, Square};

// =============================================================================
// MOVE LIST - Stack-allocated for speed
// =============================================================================

/// Fixed-size move list (max 256 moves in any position)
pub struct MoveList {
    moves: [Move; 256],
    count: usize,
}

impl MoveList {
    pub fn new() -> Self {
        MoveList {
            moves: [Move::NULL; 256],
            count: 0,
        }
    }

    #[inline]
    pub fn push(&mut self, m: Move) {
        debug_assert!(self.count < 256);
        self.moves[self.count] = m;
        self.count += 1;
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.count
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.count == 0
    }

    #[inline]
    pub fn get(&self, index: usize) -> Move {
        debug_assert!(index < self.count);
        self.moves[index]
    }

    pub fn iter(&self) -> impl Iterator<Item = &Move> {
        self.moves[..self.count].iter()
    }
}

impl Default for MoveList {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// MOVE GENERATION
// =============================================================================

/// Generate all pseudo-legal moves (doesn't check if king is left in check)
pub fn generate_pseudo_legal_moves(pos: &Position) -> MoveList {
    let mut moves = MoveList::new();
    let us = pos.side_to_move();
    
    generate_pawn_moves(pos, us, &mut moves);
    generate_knight_moves(pos, us, &mut moves);
    generate_bishop_moves(pos, us, &mut moves);
    generate_rook_moves(pos, us, &mut moves);
    generate_queen_moves(pos, us, &mut moves);
    generate_king_moves(pos, us, &mut moves);
    
    moves
}

/// Generate all legal moves (filters out moves that leave king in check)
pub fn generate_legal_moves(pos: &Position) -> MoveList {
    let pseudo_legal = generate_pseudo_legal_moves(pos);
    let mut legal = MoveList::new();
    
    for m in pseudo_legal.iter() {
        // Make the move on a copy
        let mut new_pos = pos.clone();
        if new_pos.make_move(*m) {
            // Move was legal (king not in check)
            legal.push(*m);
        }
    }
    
    legal
}

// =============================================================================
// PAWN MOVE GENERATION
// =============================================================================

fn generate_pawn_moves(pos: &Position, us: Color, moves: &mut MoveList) {
    let pawns = pos.pieces(us, PieceType::Pawn);
    let occupied = pos.occupied();
    let empty = !occupied;
    let enemies = pos.occupied_by(us.flip());
    
    let is_white = us == Color::White;
    
    // Direction pawns move
    let push_dir: i8 = if is_white { 8 } else { -8 };
    let start_rank = if is_white { Bitboard::RANK_2 } else { Bitboard::RANK_7 };
    let promo_rank = if is_white { Bitboard::RANK_8 } else { Bitboard::RANK_1 };
    
    // Single pawn pushes
    let single_pushes = if is_white {
        pawns.north() & empty
    } else {
        pawns.south() & empty
    };
    
    // Double pawn pushes (only from starting rank)
    let double_pushes = if is_white {
        (single_pushes & Bitboard::RANK_3).north() & empty
    } else {
        (single_pushes & Bitboard::RANK_6).south() & empty
    };
    
    // Process single pushes
    let mut pushes = single_pushes;
    while let Some(to) = pushes.pop_lsb() {
        let from = Square::new((to.0 as i8 - push_dir) as u8);
        
        if (Bitboard::from_square(to) & promo_rank).is_not_empty() {
            // Promotion!
            moves.push(Move::new_promotion(from, to, PieceType::Queen));
            moves.push(Move::new_promotion(from, to, PieceType::Rook));
            moves.push(Move::new_promotion(from, to, PieceType::Bishop));
            moves.push(Move::new_promotion(from, to, PieceType::Knight));
        } else {
            moves.push(Move::new(from, to));
        }
    }
    
    // Process double pushes
    let mut doubles = double_pushes;
    while let Some(to) = doubles.pop_lsb() {
        let from = Square::new((to.0 as i8 - push_dir * 2) as u8);
        moves.push(Move::new(from, to));
    }
    
    // Pawn captures
    let mut pawn_bb = pawns;
    while let Some(from) = pawn_bb.pop_lsb() {
        let attacks = pawn_attacks(from, is_white) & enemies;
        
        let mut att = attacks;
        while let Some(to) = att.pop_lsb() {
            if (Bitboard::from_square(to) & promo_rank).is_not_empty() {
                // Capture with promotion
                moves.push(Move::new_promotion(from, to, PieceType::Queen));
                moves.push(Move::new_promotion(from, to, PieceType::Rook));
                moves.push(Move::new_promotion(from, to, PieceType::Bishop));
                moves.push(Move::new_promotion(from, to, PieceType::Knight));
            } else {
                moves.push(Move::new(from, to));
            }
        }
    }
    
    // En passant
    if let Some(ep_sq) = pos.en_passant_square() {
        let ep_bb = Bitboard::from_square(ep_sq);
        
        // Find pawns that can capture en passant
        let ep_attackers = if is_white {
            // White pawns that can reach ep_sq
            let left = (ep_bb & Bitboard::NOT_FILE_A).south_west();
            let right = (ep_bb & Bitboard::NOT_FILE_H).south_east();
            (left | right) & pawns
        } else {
            // Black pawns that can reach ep_sq  
            let left = (ep_bb & Bitboard::NOT_FILE_A).north_west();
            let right = (ep_bb & Bitboard::NOT_FILE_H).north_east();
            (left | right) & pawns
        };
        
        let mut attackers = ep_attackers;
        while let Some(from) = attackers.pop_lsb() {
            moves.push(Move::new_en_passant(from, ep_sq));
        }
    }
}

// =============================================================================
// KNIGHT MOVE GENERATION
// =============================================================================

fn generate_knight_moves(pos: &Position, us: Color, moves: &mut MoveList) {
    let knights = pos.pieces(us, PieceType::Knight);
    let friendly = pos.occupied_by(us);
    
    let mut knight_bb = knights;
    while let Some(from) = knight_bb.pop_lsb() {
        // Get all squares this knight attacks, excluding friendly pieces
        let attacks = knight_attacks(from) & !friendly;
        
        let mut att = attacks;
        while let Some(to) = att.pop_lsb() {
            moves.push(Move::new(from, to));
        }
    }
}

// =============================================================================
// KING MOVE GENERATION
// =============================================================================

fn generate_king_moves(pos: &Position, us: Color, moves: &mut MoveList) {
    let king = pos.pieces(us, PieceType::King);
    let friendly = pos.occupied_by(us);
    
    if let Some(from) = king.lsb() {
        // Normal king moves
        let attacks = king_attacks(from) & !friendly;
        
        let mut att = attacks;
        while let Some(to) = att.pop_lsb() {
            moves.push(Move::new(from, to));
        }
        
        // Castling
        generate_castling_moves(pos, us, from, moves);
    }
}

fn generate_castling_moves(pos: &Position, us: Color, king_sq: Square, moves: &mut MoveList) {
    let rights = pos.castling_rights();
    let occupied = pos.occupied();
    
    match us {
        Color::White => {
            // White kingside: e1-g1, f1 and g1 must be empty
            if rights.has(CastlingRights::WHITE_KINGSIDE) {
                let between = Bitboard::from_square(Square::F1) | Bitboard::from_square(Square::G1);
                if (occupied & between).is_empty() {
                    // TODO Part 3: Check that king doesn't pass through check
                    moves.push(Move::new_castling(king_sq, Square::G1));
                }
            }
            // White queenside: e1-c1, b1, c1, d1 must be empty
            if rights.has(CastlingRights::WHITE_QUEENSIDE) {
                let between = Bitboard::from_square(Square::B1) 
                    | Bitboard::from_square(Square::C1) 
                    | Bitboard::from_square(Square::D1);
                if (occupied & between).is_empty() {
                    moves.push(Move::new_castling(king_sq, Square::C1));
                }
            }
        }
        Color::Black => {
            // Black kingside
            if rights.has(CastlingRights::BLACK_KINGSIDE) {
                let between = Bitboard::from_square(Square::F8) | Bitboard::from_square(Square::G8);
                if (occupied & between).is_empty() {
                    moves.push(Move::new_castling(king_sq, Square::G8));
                }
            }
            // Black queenside
            if rights.has(CastlingRights::BLACK_QUEENSIDE) {
                let between = Bitboard::from_square(Square::B8) 
                    | Bitboard::from_square(Square::C8) 
                    | Bitboard::from_square(Square::D8);
                if (occupied & between).is_empty() {
                    moves.push(Move::new_castling(king_sq, Square::C8));
                }
            }
        }
    }
}

// =============================================================================
// SLIDING PIECE MOVE GENERATION (Part 3)
// =============================================================================

fn generate_bishop_moves(pos: &Position, us: Color, moves: &mut MoveList) {
    let bishops = pos.pieces(us, PieceType::Bishop);
    let friendly = pos.occupied_by(us);
    let occupied = pos.occupied();
    
    let mut bishop_bb = bishops;
    while let Some(from) = bishop_bb.pop_lsb() {
        let attacks = bishop_attacks(from, occupied) & !friendly;
        
        let mut att = attacks;
        while let Some(to) = att.pop_lsb() {
            moves.push(Move::new(from, to));
        }
    }
}

fn generate_rook_moves(pos: &Position, us: Color, moves: &mut MoveList) {
    let rooks = pos.pieces(us, PieceType::Rook);
    let friendly = pos.occupied_by(us);
    let occupied = pos.occupied();
    
    let mut rook_bb = rooks;
    while let Some(from) = rook_bb.pop_lsb() {
        let attacks = rook_attacks(from, occupied) & !friendly;
        
        let mut att = attacks;
        while let Some(to) = att.pop_lsb() {
            moves.push(Move::new(from, to));
        }
    }
}

fn generate_queen_moves(pos: &Position, us: Color, moves: &mut MoveList) {
    let queens = pos.pieces(us, PieceType::Queen);
    let friendly = pos.occupied_by(us);
    let occupied = pos.occupied();
    
    let mut queen_bb = queens;
    while let Some(from) = queen_bb.pop_lsb() {
        let attacks = queen_attacks(from, occupied) & !friendly;
        
        let mut att = attacks;
        while let Some(to) = att.pop_lsb() {
            moves.push(Move::new(from, to));
        }
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_starting_position_moves() {
        let pos = Position::starting_position();
        let moves = generate_pseudo_legal_moves(&pos);
        
        // In starting position, white has 20 moves:
        // 16 pawn moves (8 single + 8 double) + 4 knight moves
        assert_eq!(moves.len(), 20);
    }

    #[test]
    fn test_pawn_promotion() {
        // White pawn on e7, empty e8
        let pos = Position::from_fen("8/4P3/8/8/8/8/8/4K2k w - - 0 1").unwrap();
        let moves = generate_pseudo_legal_moves(&pos);
        
        // Should have 4 promotion moves (Q, R, B, N) + king moves
        let promo_moves: Vec<_> = moves.iter().filter(|m| m.is_promotion()).collect();
        assert_eq!(promo_moves.len(), 4);
    }

    #[test]
    fn test_knight_moves_center() {
        // Knight on e4
        let pos = Position::from_fen("8/8/8/8/4N3/8/8/4K2k w - - 0 1").unwrap();
        let moves = generate_pseudo_legal_moves(&pos);
        
        // Knight has 8 moves, king has some moves
        let knight_moves: Vec<_> = moves.iter()
            .filter(|m| m.from() == Square::from_file_rank(4, 3))
            .collect();
        assert_eq!(knight_moves.len(), 8);
    }

    #[test]
    fn test_en_passant() {
        // White pawn on e5, black just played d7-d5
        let pos = Position::from_fen("8/8/8/3pP3/8/8/8/4K2k w - d6 0 1").unwrap();
        let moves = generate_pseudo_legal_moves(&pos);
        
        // Should include en passant capture
        let ep_moves: Vec<_> = moves.iter().filter(|m| m.is_en_passant()).collect();
        assert_eq!(ep_moves.len(), 1);
    }

    #[test]
    fn test_castling_available() {
        // Starting-ish position with clear castling paths
        let pos = Position::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1").unwrap();
        let moves = generate_pseudo_legal_moves(&pos);
        
        // Should have castling moves
        let castle_moves: Vec<_> = moves.iter().filter(|m| m.is_castling()).collect();
        assert_eq!(castle_moves.len(), 2); // Kingside and queenside
    }
    
    #[test]
    fn test_rook_moves_empty_board() {
        // Rook on e4, king out of the way on a1
        let pos = Position::from_fen("7k/8/8/8/4R3/8/8/K7 w - - 0 1").unwrap();
        let moves = generate_pseudo_legal_moves(&pos);
        
        // Rook has 14 moves (7 vertical + 7 horizontal)
        let rook_moves: Vec<_> = moves.iter()
            .filter(|m| m.from() == Square::from_file_rank(4, 3))
            .collect();
        assert_eq!(rook_moves.len(), 14);
    }
    
    #[test]
    fn test_bishop_moves_empty_board() {
        // Bishop on e4, kings out of the way
        let pos = Position::from_fen("7k/8/8/8/4B3/8/8/K7 w - - 0 1").unwrap();
        let moves = generate_pseudo_legal_moves(&pos);
        
        // Bishop on e4 has 13 moves
        let bishop_moves: Vec<_> = moves.iter()
            .filter(|m| m.from() == Square::from_file_rank(4, 3))
            .collect();
        assert_eq!(bishop_moves.len(), 13);
    }
    
    #[test]
    fn test_queen_moves_empty_board() {
        // Queen on e4, kings out of the way
        let pos = Position::from_fen("7k/8/8/8/4Q3/8/8/K7 w - - 0 1").unwrap();
        let moves = generate_pseudo_legal_moves(&pos);
        
        // Queen = rook (14) + bishop (13) = 27 moves
        let queen_moves: Vec<_> = moves.iter()
            .filter(|m| m.from() == Square::from_file_rank(4, 3))
            .collect();
        assert_eq!(queen_moves.len(), 27);
    }
    
    #[test]
    fn test_legal_moves_filters_check() {
        // King on e1 with enemy rook on e8 - many moves are illegal
        let pos = Position::from_fen("4r3/8/8/8/8/8/8/4K3 w - - 0 1").unwrap();
        let legal = generate_legal_moves(&pos);
        
        // King can only move to d1, d2, f1, f2 (e-file blocked by rook)
        assert_eq!(legal.len(), 4);
    }
    
    #[test]
    fn test_starting_position_legal_moves() {
        let pos = Position::starting_position();
        let moves = generate_legal_moves(&pos);
        
        // Starting position has 20 legal moves
        assert_eq!(moves.len(), 20);
    }
}
