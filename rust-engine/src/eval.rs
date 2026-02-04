// Evaluation Module
// Assigns a numeric score to any chess position
// Positive = White advantage, Negative = Black advantage

use crate::bitboard::Bitboard;
use crate::position::Position;
use crate::types::{Color, PieceType, Square};

/// Score type (centipawns - 100 = 1 pawn)
pub type Score = i32;

/// Special scores
pub const MATE_SCORE: Score = 30000;
pub const DRAW_SCORE: Score = 0;

// =============================================================================
// MATERIAL VALUES (in centipawns)
// =============================================================================

const PAWN_VALUE: Score = 100;
const KNIGHT_VALUE: Score = 320;
const BISHOP_VALUE: Score = 330;
const ROOK_VALUE: Score = 500;
const QUEEN_VALUE: Score = 900;
const KING_VALUE: Score = 20000; // Effectively infinite

/// Get material value for a piece type
#[inline]
pub fn piece_value(piece: PieceType) -> Score {
    match piece {
        PieceType::Pawn => PAWN_VALUE,
        PieceType::Knight => KNIGHT_VALUE,
        PieceType::Bishop => BISHOP_VALUE,
        PieceType::Rook => ROOK_VALUE,
        PieceType::Queen => QUEEN_VALUE,
        PieceType::King => KING_VALUE,
    }
}

// =============================================================================
// PIECE-SQUARE TABLES
// These give bonuses/penalties based on where pieces are located
// Values from White's perspective (flip for Black)
// =============================================================================

/// Pawn piece-square table
/// Encourages: central pawns, advanced pawns, discourages edge pawns
#[rustfmt::skip]
const PAWN_PST: [Score; 64] = [
     0,   0,   0,   0,   0,   0,   0,   0,  // Rank 1 (never occupied)
     5,  10,  10, -20, -20,  10,  10,   5,  // Rank 2
     5,  -5, -10,   0,   0, -10,  -5,   5,  // Rank 3
     0,   0,   0,  20,  20,   0,   0,   0,  // Rank 4
     5,   5,  10,  25,  25,  10,   5,   5,  // Rank 5
    10,  10,  20,  30,  30,  20,  10,  10,  // Rank 6
    50,  50,  50,  50,  50,  50,  50,  50,  // Rank 7 (about to promote!)
     0,   0,   0,   0,   0,   0,   0,   0,  // Rank 8 (never occupied)
];

/// Knight piece-square table
/// Encourages: central knights, discourages edge knights ("knight on rim is dim")
#[rustfmt::skip]
const KNIGHT_PST: [Score; 64] = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20,   0,   5,   5,   0, -20, -40,
    -30,   5,  10,  15,  15,  10,   5, -30,
    -30,   0,  15,  20,  20,  15,   0, -30,
    -30,   5,  15,  20,  20,  15,   5, -30,
    -30,   0,  10,  15,  15,  10,   0, -30,
    -40, -20,   0,   0,   0,   0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
];

/// Bishop piece-square table
/// Encourages: central control, long diagonals
#[rustfmt::skip]
const BISHOP_PST: [Score; 64] = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10,   5,   0,   0,   0,   0,   5, -10,
    -10,  10,  10,  10,  10,  10,  10, -10,
    -10,   0,  10,  10,  10,  10,   0, -10,
    -10,   5,   5,  10,  10,   5,   5, -10,
    -10,   0,   5,  10,  10,   5,   0, -10,
    -10,   0,   0,   0,   0,   0,   0, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
];

/// Rook piece-square table
/// Encourages: 7th rank, open files
#[rustfmt::skip]
const ROOK_PST: [Score; 64] = [
     0,   0,   0,   5,   5,   0,   0,   0,
    -5,   0,   0,   0,   0,   0,   0,  -5,
    -5,   0,   0,   0,   0,   0,   0,  -5,
    -5,   0,   0,   0,   0,   0,   0,  -5,
    -5,   0,   0,   0,   0,   0,   0,  -5,
    -5,   0,   0,   0,   0,   0,   0,  -5,
     5,  10,  10,  10,  10,  10,  10,   5,  // 7th rank bonus!
     0,   0,   0,   0,   0,   0,   0,   0,
];

/// Queen piece-square table
/// Encourages: not moving too early, central squares later
#[rustfmt::skip]
const QUEEN_PST: [Score; 64] = [
    -20, -10, -10,  -5,  -5, -10, -10, -20,
    -10,   0,   5,   0,   0,   0,   0, -10,
    -10,   5,   5,   5,   5,   5,   0, -10,
      0,   0,   5,   5,   5,   5,   0,  -5,
     -5,   0,   5,   5,   5,   5,   0,  -5,
    -10,   0,   5,   5,   5,   5,   0, -10,
    -10,   0,   0,   0,   0,   0,   0, -10,
    -20, -10, -10,  -5,  -5, -10, -10, -20,
];

/// King piece-square table (middlegame)
/// Encourages: castled position, staying safe
#[rustfmt::skip]
const KING_PST_MG: [Score; 64] = [
     20,  30,  10,   0,   0,  10,  30,  20,  // Castled positions good
     20,  20,   0,   0,   0,   0,  20,  20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
];

/// King piece-square table (endgame)
/// Encourages: active king, central king
#[rustfmt::skip]
const KING_PST_EG: [Score; 64] = [
    -50, -30, -30, -30, -30, -30, -30, -50,
    -30, -30,   0,   0,   0,   0, -30, -30,
    -30, -10,  20,  30,  30,  20, -10, -30,
    -30, -10,  30,  40,  40,  30, -10, -30,
    -30, -10,  30,  40,  40,  30, -10, -30,
    -30, -10,  20,  30,  30,  20, -10, -30,
    -30, -20, -10,   0,   0, -10, -20, -30,
    -50, -40, -30, -20, -20, -30, -40, -50,
];

// =============================================================================
// EVALUATION FUNCTIONS
// =============================================================================

/// Main evaluation function
/// Returns score from the perspective of the side to move
pub fn evaluate(pos: &Position) -> Score {
    let white_score = evaluate_side(pos, Color::White);
    let black_score = evaluate_side(pos, Color::Black);
    
    let score = white_score - black_score;
    
    // Return from perspective of side to move
    if pos.side_to_move() == Color::White {
        score
    } else {
        -score
    }
}

/// Evaluate one side's position
fn evaluate_side(pos: &Position, color: Color) -> Score {
    let mut score: Score = 0;
    
    // Material and piece-square tables
    score += evaluate_pawns(pos, color);
    score += evaluate_knights(pos, color);
    score += evaluate_bishops(pos, color);
    score += evaluate_rooks(pos, color);
    score += evaluate_queens(pos, color);
    score += evaluate_king(pos, color);
    
    score
}

fn evaluate_pawns(pos: &Position, color: Color) -> Score {
    let pawns = pos.pieces(color, PieceType::Pawn);
    let mut score: Score = 0;
    
    let mut bb = pawns;
    while let Some(sq) = bb.pop_lsb() {
        score += PAWN_VALUE;
        score += pst_value(&PAWN_PST, sq, color);
    }
    
    score
}

fn evaluate_knights(pos: &Position, color: Color) -> Score {
    let knights = pos.pieces(color, PieceType::Knight);
    let mut score: Score = 0;
    
    let mut bb = knights;
    while let Some(sq) = bb.pop_lsb() {
        score += KNIGHT_VALUE;
        score += pst_value(&KNIGHT_PST, sq, color);
    }
    
    score
}

fn evaluate_bishops(pos: &Position, color: Color) -> Score {
    let bishops = pos.pieces(color, PieceType::Bishop);
    let mut score: Score = 0;
    
    let mut bb = bishops;
    while let Some(sq) = bb.pop_lsb() {
        score += BISHOP_VALUE;
        score += pst_value(&BISHOP_PST, sq, color);
    }
    
    // Bishop pair bonus
    if bishops.count() >= 2 {
        score += 30;
    }
    
    score
}

fn evaluate_rooks(pos: &Position, color: Color) -> Score {
    let rooks = pos.pieces(color, PieceType::Rook);
    let mut score: Score = 0;
    
    let mut bb = rooks;
    while let Some(sq) = bb.pop_lsb() {
        score += ROOK_VALUE;
        score += pst_value(&ROOK_PST, sq, color);
    }
    
    score
}

fn evaluate_queens(pos: &Position, color: Color) -> Score {
    let queens = pos.pieces(color, PieceType::Queen);
    let mut score: Score = 0;
    
    let mut bb = queens;
    while let Some(sq) = bb.pop_lsb() {
        score += QUEEN_VALUE;
        score += pst_value(&QUEEN_PST, sq, color);
    }
    
    score
}

fn evaluate_king(pos: &Position, color: Color) -> Score {
    let king = pos.pieces(color, PieceType::King);
    let mut score: Score = 0;
    
    if let Some(sq) = king.lsb() {
        // Use endgame table if few pieces remain
        let total_material = count_material(pos);
        let pst = if total_material < 2000 {
            &KING_PST_EG
        } else {
            &KING_PST_MG
        };
        
        score += pst_value(pst, sq, color);
    }
    
    score
}

/// Get piece-square table value (flip for black)
#[inline]
fn pst_value(table: &[Score; 64], sq: Square, color: Color) -> Score {
    let index = if color == Color::White {
        sq.index()
    } else {
        // Mirror vertically for black
        sq.index() ^ 56
    };
    table[index]
}

/// Count total non-king material
fn count_material(pos: &Position) -> Score {
    let mut total: Score = 0;
    
    for color in [Color::White, Color::Black] {
        total += pos.pieces(color, PieceType::Pawn).count() as Score * PAWN_VALUE;
        total += pos.pieces(color, PieceType::Knight).count() as Score * KNIGHT_VALUE;
        total += pos.pieces(color, PieceType::Bishop).count() as Score * BISHOP_VALUE;
        total += pos.pieces(color, PieceType::Rook).count() as Score * ROOK_VALUE;
        total += pos.pieces(color, PieceType::Queen).count() as Score * QUEEN_VALUE;
    }
    
    total
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_starting_position_eval() {
        let pos = Position::starting_position();
        let score = evaluate(&pos);
        
        // Starting position should be roughly equal (close to 0)
        assert!(score.abs() < 50, "Starting position too unbalanced: {}", score);
    }
    
    #[test]
    fn test_material_advantage() {
        // White up a queen
        let pos = Position::from_fen("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").unwrap();
        let score = evaluate(&pos);
        
        // Should be significantly positive for white
        assert!(score > 800, "Queen advantage not reflected: {}", score);
    }
    
    #[test]
    fn test_piece_values() {
        assert_eq!(piece_value(PieceType::Pawn), 100);
        assert_eq!(piece_value(PieceType::Knight), 320);
        assert_eq!(piece_value(PieceType::Bishop), 330);
        assert_eq!(piece_value(PieceType::Rook), 500);
        assert_eq!(piece_value(PieceType::Queen), 900);
    }
}
