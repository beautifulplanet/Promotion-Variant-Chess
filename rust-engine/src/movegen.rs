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
pub fn generate_legal_moves(pos: &mut Position) -> MoveList {
    let pseudo_legal = generate_pseudo_legal_moves(pos);
    let mut legal = MoveList::new();
    
    for m in pseudo_legal.iter() {
        if let Some(undo) = pos.make_move(*m) {
            legal.push(*m);
            pos.unmake_move(*m, &undo);
        }
    }
    
    legal
}

// =============================================================================
// PERFT - Standard chess engine correctness test
// =============================================================================

/// Count all leaf nodes at a given depth (Performance Test)
/// Used to validate move generation correctness against known values.
pub fn perft(pos: &mut Position, depth: u32) -> u64 {
    if depth == 0 {
        return 1;
    }

    let moves = generate_legal_moves(pos);

    if depth == 1 {
        return moves.len() as u64;
    }

    let mut nodes: u64 = 0;
    for m in moves.iter() {
        if let Some(undo) = pos.make_move(*m) {
            nodes += perft(pos, depth - 1);
            pos.unmake_move(*m, &undo);
        }
    }
    nodes
}

/// Perft with divide: shows node count per root move (useful for debugging)
pub fn perft_divide(pos: &mut Position, depth: u32) -> Vec<(String, u64)> {
    let moves = generate_legal_moves(pos);
    let mut results = Vec::new();

    for m in moves.iter() {
        if let Some(undo) = pos.make_move(*m) {
            let nodes = if depth <= 1 { 1 } else { perft(pos, depth - 1) };
            pos.unmake_move(*m, &undo);
            results.push((m.to_uci(), nodes));
        }
    }

    results.sort_by(|a, b| a.0.cmp(&b.0));
    results
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
    let them = us.flip();

    // Can't castle while in check
    if pos.is_in_check(us) {
        return;
    }
    
    match us {
        Color::White => {
            // White kingside: e1-g1, f1 and g1 must be empty
            if rights.has(CastlingRights::WHITE_KINGSIDE) {
                let between = Bitboard::from_square(Square::F1) | Bitboard::from_square(Square::G1);
                if (occupied & between).is_empty()
                    && !pos.is_square_attacked(Square::F1, them)
                    && !pos.is_square_attacked(Square::G1, them)
                {
                    moves.push(Move::new_castling(king_sq, Square::G1));
                }
            }
            // White queenside: e1-c1, b1, c1, d1 must be empty
            if rights.has(CastlingRights::WHITE_QUEENSIDE) {
                let between = Bitboard::from_square(Square::B1) 
                    | Bitboard::from_square(Square::C1) 
                    | Bitboard::from_square(Square::D1);
                if (occupied & between).is_empty()
                    && !pos.is_square_attacked(Square::D1, them)
                    && !pos.is_square_attacked(Square::C1, them)
                {
                    moves.push(Move::new_castling(king_sq, Square::C1));
                }
            }
        }
        Color::Black => {
            // Black kingside
            if rights.has(CastlingRights::BLACK_KINGSIDE) {
                let between = Bitboard::from_square(Square::F8) | Bitboard::from_square(Square::G8);
                if (occupied & between).is_empty()
                    && !pos.is_square_attacked(Square::F8, them)
                    && !pos.is_square_attacked(Square::G8, them)
                {
                    moves.push(Move::new_castling(king_sq, Square::G8));
                }
            }
            // Black queenside
            if rights.has(CastlingRights::BLACK_QUEENSIDE) {
                let between = Bitboard::from_square(Square::B8) 
                    | Bitboard::from_square(Square::C8) 
                    | Bitboard::from_square(Square::D8);
                if (occupied & between).is_empty()
                    && !pos.is_square_attacked(Square::D8, them)
                    && !pos.is_square_attacked(Square::C8, them)
                {
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
        let mut pos = Position::from_fen("4r3/8/8/8/8/8/8/4K3 w - - 0 1").unwrap();
        let legal = generate_legal_moves(&mut pos);
        
        // King can only move to d1, d2, f1, f2 (e-file blocked by rook)
        assert_eq!(legal.len(), 4);
    }
    
    #[test]
    fn test_starting_position_legal_moves() {
        let mut pos = Position::starting_position();
        let moves = generate_legal_moves(&mut pos);
        
        // Starting position has 20 legal moves
        assert_eq!(moves.len(), 20);
    }

    #[test]
    fn test_no_castling_through_check() {
        // White king on e1, rooks on a1/h1, black bishop on b4 attacks d2 and e1...
        // Actually: black rook on f4 doesn't help. Use black bishop on h4 attacking e1.
        // Better: black rook on f2 attacks f1 — blocks kingside castling through f1
        let pos = Position::from_fen("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1").unwrap();
        let moves = generate_pseudo_legal_moves(&pos);
        let castle_moves: Vec<_> = moves.iter().filter(|m| m.is_castling()).collect();
        // Rook on f2 attacks f1, so kingside castling blocked (king passes through f1)
        // Queenside castling should still be available
        assert_eq!(castle_moves.len(), 1);
        assert_eq!(castle_moves[0].to(), Square::C1);
    }

    #[test]
    fn test_no_castling_while_in_check() {
        // White king on e1 in check from black rook on e8
        // No castling should be allowed
        let mut pos = Position::from_fen("4k3/8/8/8/8/8/8/R3K2r w KQ - 0 1").unwrap();
        let legal = generate_legal_moves(&mut pos);
        let castle_moves: Vec<_> = legal.iter().filter(|m| m.is_castling()).collect();
        assert_eq!(castle_moves.len(), 0);
    }

    #[test]
    fn test_no_castling_into_check() {
        // White king on e1, black bishop on b4 attacks d2 — but NOT g1 or f1 or c1
        // Actually let's use: black rook on g8 attacks g1 — kingside castling into check
        let pos = Position::from_fen("4k1r1/8/8/8/8/8/8/R3K2R w KQkq - 0 1").unwrap();
        let moves = generate_pseudo_legal_moves(&pos);
        let castle_moves: Vec<_> = moves.iter().filter(|m| m.is_castling()).collect();
        // Kingside blocked (g1 attacked), only queenside
        assert_eq!(castle_moves.len(), 1);
        assert_eq!(castle_moves[0].to(), Square::C1);
    }

    #[test]
    fn test_castling_allowed_when_safe() {
        // All clear — both sides should castle
        let pos = Position::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1").unwrap();
        let moves = generate_pseudo_legal_moves(&pos);
        let castle_moves: Vec<_> = moves.iter().filter(|m| m.is_castling()).collect();
        assert_eq!(castle_moves.len(), 2);
    }

    // =========================================================================
    // PERFT TESTS — standard correctness validation
    // Known values from https://www.chessprogramming.org/Perft_Results
    // =========================================================================

    #[test]
    fn test_perft_starting_position_depth1() {
        let mut pos = Position::starting_position();
        assert_eq!(perft(&mut pos, 1), 20);
    }

    #[test]
    fn test_perft_starting_position_depth2() {
        let mut pos = Position::starting_position();
        assert_eq!(perft(&mut pos, 2), 400);
    }

    #[test]
    fn test_perft_starting_position_depth3() {
        let mut pos = Position::starting_position();
        assert_eq!(perft(&mut pos, 3), 8_902);
    }

    #[test]
    fn test_perft_starting_position_depth4() {
        let mut pos = Position::starting_position();
        assert_eq!(perft(&mut pos, 4), 197_281);
    }

    #[test]
    fn test_perft_position4_depth1() {
        let mut pos = Position::from_fen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1").unwrap();
        assert_eq!(perft(&mut pos, 1), 6);
    }

    #[test]
    fn test_perft_position4_depth2() {
        let mut pos = Position::from_fen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1").unwrap();
        assert_eq!(perft(&mut pos, 2), 264);
    }

    #[test]
    fn test_perft_position4_depth3() {
        let mut pos = Position::from_fen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1").unwrap();
        assert_eq!(perft(&mut pos, 3), 9_467);
    }

    #[test]
    fn test_perft_position5_depth3() {
        let mut pos = Position::from_fen("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8").unwrap();
        assert_eq!(perft(&mut pos, 3), 62_379);
    }

    #[test]
    fn test_perft_position6_depth4() {
        let mut pos = Position::from_fen("r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10").unwrap();
        assert_eq!(perft(&mut pos, 4), 3_894_594);
    }

    // Kiwipete — the most popular perft debugging position
    // Rich in en passant, castling, promotions, and discovered checks
    // FEN: r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -
    #[test]
    fn test_perft_kiwipete_depth1() {
        let mut pos = Position::from_fen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1").unwrap();
        assert_eq!(perft(&mut pos, 1), 48);
    }

    #[test]
    fn test_perft_kiwipete_depth2() {
        let mut pos = Position::from_fen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1").unwrap();
        assert_eq!(perft(&mut pos, 2), 2_039);
    }

    #[test]
    fn test_perft_kiwipete_depth3() {
        let mut pos = Position::from_fen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1").unwrap();
        assert_eq!(perft(&mut pos, 3), 97_862);
    }

    // Position 3 — en passant and promotion heavy
    // FEN: 8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -
    #[test]
    fn test_perft_position3_depth1() {
        let mut pos = Position::from_fen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1").unwrap();
        assert_eq!(perft(&mut pos, 1), 14);
    }

    #[test]
    fn test_perft_position3_depth2() {
        let mut pos = Position::from_fen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1").unwrap();
        assert_eq!(perft(&mut pos, 2), 191);
    }

    #[test]
    fn test_perft_position3_depth3() {
        let mut pos = Position::from_fen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1").unwrap();
        assert_eq!(perft(&mut pos, 3), 2_812);
    }
}
