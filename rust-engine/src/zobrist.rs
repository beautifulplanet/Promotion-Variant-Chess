// Zobrist Hashing for Chess Positions
// 
// Provides a 64-bit hash for any chess position, used for:
// - Transposition tables (avoid re-searching same position)
// - Threefold repetition detection
// - Position comparison
//
// Uses XOR-based incremental updates: each make_move only XORs
// the changed elements instead of recomputing from scratch.

use crate::types::{Color, PieceType, Square, CastlingRights};

// =============================================================================
// COMPILE-TIME RANDOM NUMBER GENERATION
// =============================================================================

/// xorshift64 PRNG — simple, fast, good distribution for hash keys
const fn xorshift64(mut state: u64) -> u64 {
    state ^= state << 13;
    state ^= state >> 7;
    state ^= state << 17;
    state
}

/// Generate an array of N random u64 values at compile time
const fn generate_keys<const N: usize>(seed: u64) -> [u64; N] {
    let mut keys = [0u64; N];
    let mut state = seed;
    let mut i = 0;
    while i < N {
        state = xorshift64(state);
        keys[i] = state;
        i += 1;
    }
    keys
}

// =============================================================================
// ZOBRIST KEYS (generated at compile time)
// =============================================================================

// Seed chosen to produce well-distributed keys.
// Any non-zero value works; this one is from the Polyglot book format.
const SEED: u64 = 0x2d35_8dcc_aa6c_78a5;

// 12 piece types × 64 squares = 768 keys
// Layout: [color * 6 + piece_type][square]
// color: 0=White, 1=Black
// piece_type: 0=Pawn, 1=Knight, 2=Bishop, 3=Rook, 4=Queen, 5=King
const PIECE_KEYS: [u64; 768] = generate_keys(SEED);

// 1 key for side to move (XOR when it's black's turn)
const SIDE_KEY_ARRAY: [u64; 1] = generate_keys(xorshift64(SEED ^ 0xAAAA_BBBB_CCCC_DDDD));
const SIDE_KEY: u64 = SIDE_KEY_ARRAY[0];

// 4 keys for castling rights (one per right, XOR independently)
const CASTLING_KEYS: [u64; 4] = generate_keys(xorshift64(SEED ^ 0x1111_2222_3333_4444));

// 8 keys for en passant file (only the file matters, not the rank)
const EP_KEYS: [u64; 8] = generate_keys(xorshift64(SEED ^ 0x5555_6666_7777_8888));

// =============================================================================
// PUBLIC API
// =============================================================================

/// Get the Zobrist key for a piece on a square
#[inline]
pub fn piece_key(color: Color, piece: PieceType, sq: Square) -> u64 {
    let index = (color as usize) * 384 + (piece as usize) * 64 + sq.index();
    PIECE_KEYS[index]
}

/// Get the Zobrist key for side to move (XOR this when black is to move)
#[inline]
pub const fn side_to_move_key() -> u64 {
    SIDE_KEY
}

/// Get the Zobrist key for a specific castling right bit
/// Bit 0 = White Kingside, 1 = White Queenside, 2 = Black Kingside, 3 = Black Queenside
#[inline]
pub fn castling_key(rights: CastlingRights) -> u64 {
    let mut hash = 0u64;
    if rights.has(CastlingRights::WHITE_KINGSIDE) {
        hash ^= CASTLING_KEYS[0];
    }
    if rights.has(CastlingRights::WHITE_QUEENSIDE) {
        hash ^= CASTLING_KEYS[1];
    }
    if rights.has(CastlingRights::BLACK_KINGSIDE) {
        hash ^= CASTLING_KEYS[2];
    }
    if rights.has(CastlingRights::BLACK_QUEENSIDE) {
        hash ^= CASTLING_KEYS[3];
    }
    hash
}

/// Get the Zobrist key for an en passant file (0-7)
#[inline]
pub fn en_passant_key(file: u8) -> u64 {
    EP_KEYS[file as usize]
}

/// Compute the full Zobrist hash for a position from scratch.
/// Used for initialization and verification.
pub fn compute_hash(
    pieces_iter: impl Iterator<Item = (Color, PieceType, Square)>,
    side_to_move: Color,
    castling: CastlingRights,
    en_passant: Option<Square>,
) -> u64 {
    let mut hash = 0u64;
    
    // Hash all pieces
    for (color, piece, sq) in pieces_iter {
        hash ^= piece_key(color, piece, sq);
    }
    
    // Hash side to move
    if matches!(side_to_move, Color::Black) {
        hash ^= SIDE_KEY;
    }
    
    // Hash castling rights
    hash ^= castling_key(castling);
    
    // Hash en passant file
    if let Some(ep_sq) = en_passant {
        hash ^= en_passant_key(ep_sq.file());
    }
    
    hash
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_piece_keys_unique() {
        // All 768 piece keys should be unique
        let mut keys: Vec<u64> = PIECE_KEYS.to_vec();
        keys.sort();
        keys.dedup();
        assert_eq!(keys.len(), 768, "All 768 piece keys must be unique");
    }

    #[test]
    fn test_all_keys_nonzero() {
        for k in &PIECE_KEYS {
            assert_ne!(*k, 0, "Piece key must not be zero");
        }
        assert_ne!(SIDE_KEY, 0, "Side key must not be zero");
        for k in &CASTLING_KEYS {
            assert_ne!(*k, 0, "Castling key must not be zero");
        }
        for k in &EP_KEYS {
            assert_ne!(*k, 0, "EP key must not be zero");
        }
    }

    #[test]
    fn test_side_key_distinct_from_piece_keys() {
        for k in &PIECE_KEYS {
            assert_ne!(*k, SIDE_KEY, "Side key must be distinct from all piece keys");
        }
    }

    #[test]
    fn test_xor_reversible() {
        // Core property: XOR is its own inverse
        let key = piece_key(Color::White, PieceType::Pawn, Square::E2);
        let mut hash = 0u64;
        hash ^= key; // Add
        hash ^= key; // Remove (should cancel out)
        assert_eq!(hash, 0);
    }

    #[test]
    fn test_castling_key_incremental() {
        // Removing one castling right should change the hash predictably
        let all = castling_key(CastlingRights::ALL);
        let without_wk = castling_key(CastlingRights(
            CastlingRights::WHITE_QUEENSIDE | CastlingRights::BLACK_KINGSIDE | CastlingRights::BLACK_QUEENSIDE,
        ));
        // XORing out ALL and XORing in the reduced set should equal just the WK key
        assert_eq!(all ^ without_wk, CASTLING_KEYS[0]);
    }

    #[test]
    fn test_compute_hash_deterministic() {
        // Same input → same hash
        let pieces = vec![
            (Color::White, PieceType::King, Square::E1),
            (Color::Black, PieceType::King, Square::E8),
        ];
        let h1 = compute_hash(pieces.clone().into_iter(), Color::White, CastlingRights::NONE, None);
        let h2 = compute_hash(pieces.into_iter(), Color::White, CastlingRights::NONE, None);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_different_positions_different_hash() {
        let pieces1 = vec![
            (Color::White, PieceType::King, Square::E1),
            (Color::Black, PieceType::King, Square::E8),
        ];
        let pieces2 = vec![
            (Color::White, PieceType::King, Square::D1), // King on different square
            (Color::Black, PieceType::King, Square::E8),
        ];
        let h1 = compute_hash(pieces1.into_iter(), Color::White, CastlingRights::NONE, None);
        let h2 = compute_hash(pieces2.into_iter(), Color::White, CastlingRights::NONE, None);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_side_to_move_changes_hash() {
        let pieces = vec![
            (Color::White, PieceType::King, Square::E1),
            (Color::Black, PieceType::King, Square::E8),
        ];
        let h_white = compute_hash(pieces.clone().into_iter(), Color::White, CastlingRights::NONE, None);
        let h_black = compute_hash(pieces.into_iter(), Color::Black, CastlingRights::NONE, None);
        assert_ne!(h_white, h_black);
        assert_eq!(h_white ^ SIDE_KEY, h_black);
    }

    #[test]
    fn test_en_passant_changes_hash() {
        let pieces = vec![
            (Color::White, PieceType::King, Square::E1),
            (Color::Black, PieceType::King, Square::E8),
        ];
        let h_no_ep = compute_hash(pieces.clone().into_iter(), Color::White, CastlingRights::NONE, None);
        let h_ep = compute_hash(pieces.into_iter(), Color::White, CastlingRights::NONE, Some(Square::from_file_rank(4, 2)));
        assert_ne!(h_no_ep, h_ep);
    }
}
