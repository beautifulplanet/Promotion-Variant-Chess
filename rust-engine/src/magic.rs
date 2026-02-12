// Magic Bitboards for Sliding Piece Attacks
// Uses "magic" multiplication to hash occupancy patterns to attack sets
//
// The key insight: for a rook/bishop on a square, only the pieces BETWEEN
// the piece and the edge matter for blocking. We can hash all 2^n possible
// blocker configurations to precomputed attack bitboards.

use crate::bitboard::Bitboard;
use crate::types::Square;

// =============================================================================
// MAGIC NUMBERS - Found through trial/brute force, these give perfect hashing
// =============================================================================

/// Magic numbers for rook attacks (found empirically)
static ROOK_MAGICS: [u64; 64] = [
    0x8a80104000800020, 0x140002000100040, 0x2801880a0017001, 0x100081001000420,
    0x200020010080420, 0x3001c0002010008, 0x8480008002000100, 0x2080088004402900,
    0x800098204000, 0x2024401000200040, 0x100802000801000, 0x120800800801000,
    0x208808088000400, 0x2802200800400, 0x2200800100020080, 0x801000060821100,
    0x80044006422000, 0x100808020004000, 0x12108a0010204200, 0x140848010000802,
    0x481828014002800, 0x8094004002004100, 0x4010040010010802, 0x20008806104,
    0x100400080208000, 0x2040002120081000, 0x21200680100081, 0x20100080080080,
    0x2000a00200410, 0x20080800400, 0x80088400100102, 0x80004600042881,
    0x4040008040800020, 0x440003000200801, 0x4200011004500, 0x188020010100100,
    0x14800401802800, 0x2080040080800200, 0x124080204001001, 0x200046502000484,
    0x480400080088020, 0x1000422010034000, 0x30200100110040, 0x100021010009,
    0x2002080100110004, 0x202008004008002, 0x20020004010100, 0x2048440040820001,
    0x101002200408200, 0x40802000401080, 0x4008142004410100, 0x2060820c0120200,
    0x1001004080100, 0x20c020080040080, 0x2935610830022400, 0x44440041009200,
    0x280001040802101, 0x2100190040002085, 0x80c0084100102001, 0x4024081001000421,
    0x20030a0244872, 0x12001008414402, 0x2006104900a0804, 0x0002040301214486,
];

/// Magic numbers for bishop attacks
static BISHOP_MAGICS: [u64; 64] = [
    0x89a1121896040240, 0x2004844802002010, 0x2068080051921000, 0x62880a0220200808,
    0x4042004000000, 0x100822020200011, 0xc00444222012000a, 0x28808801216001,
    0x400492088408100, 0x201c401040c0084, 0x840800910a0010, 0x82080240060,
    0x2000840504006000, 0x30010c4108405004, 0x1008005410080802, 0x8144042209100900,
    0x208081020014400, 0x4800201208ca00, 0xf18140408012008, 0x1004002802102001,
    0x841000820080811, 0x40200200a42008, 0x800054042000, 0x88010400410c9000,
    0x520040470104290, 0x1004040051500081, 0x2002081833080021, 0x400c00c010142,
    0x941408200c002000, 0x658810000806011, 0x188071040440a00, 0x4800404002011c00,
    0x104442040404200, 0x511080202091021, 0x4022401120400, 0x80c0040400080120,
    0x8040010040820802, 0x480810700020090, 0x102008e00040242, 0x809005202050100,
    0x8002024220104080, 0x431008804142000, 0x19001802081400, 0x200014208040080,
    0x3308082008200100, 0x41010500040c020, 0x4012020c04210308, 0x208220a202004080,
    0x111040120082000, 0x6803040141280a00, 0x2101004202410000, 0x8200000041108022,
    0x21082088000, 0x2410204010040, 0x40100400809000, 0x822088220820214,
    0x40808090012004, 0x910224040218c9, 0x402814422015008, 0x90014004842410,
    0x1000042304105, 0x10008830412a00, 0x2520081090008908, 0x40102000a0a60140,
];

/// Bit counts for rook attack masks (excluding edges)
static ROOK_BITS: [u8; 64] = [
    12, 11, 11, 11, 11, 11, 11, 12,
    11, 10, 10, 10, 10, 10, 10, 11,
    11, 10, 10, 10, 10, 10, 10, 11,
    11, 10, 10, 10, 10, 10, 10, 11,
    11, 10, 10, 10, 10, 10, 10, 11,
    11, 10, 10, 10, 10, 10, 10, 11,
    11, 10, 10, 10, 10, 10, 10, 11,
    12, 11, 11, 11, 11, 11, 11, 12,
];

/// Bit counts for bishop attack masks
static BISHOP_BITS: [u8; 64] = [
    6, 5, 5, 5, 5, 5, 5, 6,
    5, 5, 5, 5, 5, 5, 5, 5,
    5, 5, 7, 7, 7, 7, 5, 5,
    5, 5, 7, 9, 9, 7, 5, 5,
    5, 5, 7, 9, 9, 7, 5, 5,
    5, 5, 7, 7, 7, 7, 5, 5,
    5, 5, 5, 5, 5, 5, 5, 5,
    6, 5, 5, 5, 5, 5, 5, 6,
];

// =============================================================================
// ATTACK MASKS - Relevant squares for each piece (excluding edges)
// =============================================================================

/// Rook attack mask (relevant occupancy squares, excluding edges)
fn rook_mask(sq: Square) -> Bitboard {
    let mut mask = 0u64;
    let rank = sq.rank() as i8;
    let file = sq.file() as i8;
    
    // North (excluding edge)
    for r in (rank + 1)..7 {
        mask |= 1u64 << (r * 8 + file);
    }
    // South (excluding edge)
    for r in 1..rank {
        mask |= 1u64 << (r * 8 + file);
    }
    // East (excluding edge)
    for f in (file + 1)..7 {
        mask |= 1u64 << (rank * 8 + f);
    }
    // West (excluding edge)
    for f in 1..file {
        mask |= 1u64 << (rank * 8 + f);
    }
    
    Bitboard(mask)
}

/// Bishop attack mask (relevant occupancy squares, excluding edges)
fn bishop_mask(sq: Square) -> Bitboard {
    let mut mask = 0u64;
    let rank = sq.rank() as i8;
    let file = sq.file() as i8;
    
    // Northeast
    let (mut r, mut f) = (rank + 1, file + 1);
    while r < 7 && f < 7 {
        mask |= 1u64 << (r * 8 + f);
        r += 1;
        f += 1;
    }
    // Northwest
    let (mut r, mut f) = (rank + 1, file - 1);
    while r < 7 && f > 0 {
        mask |= 1u64 << (r * 8 + f);
        r += 1;
        f -= 1;
    }
    // Southeast
    let (mut r, mut f) = (rank - 1, file + 1);
    while r > 0 && f < 7 {
        mask |= 1u64 << (r * 8 + f);
        r -= 1;
        f += 1;
    }
    // Southwest
    let (mut r, mut f) = (rank - 1, file - 1);
    while r > 0 && f > 0 {
        mask |= 1u64 << (r * 8 + f);
        r -= 1;
        f -= 1;
    }
    
    Bitboard(mask)
}

// =============================================================================
// ATTACK GENERATION (with blockers)
// =============================================================================

/// Generate rook attacks given blockers (used to build lookup table)
fn rook_attacks_slow(sq: Square, blockers: Bitboard) -> Bitboard {
    let mut attacks = 0u64;
    let rank = sq.rank() as i8;
    let file = sq.file() as i8;
    
    // North
    for r in (rank + 1)..8 {
        let bit = 1u64 << (r * 8 + file);
        attacks |= bit;
        if blockers.0 & bit != 0 { break; }
    }
    // South
    for r in (0..rank).rev() {
        let bit = 1u64 << (r * 8 + file);
        attacks |= bit;
        if blockers.0 & bit != 0 { break; }
    }
    // East
    for f in (file + 1)..8 {
        let bit = 1u64 << (rank * 8 + f);
        attacks |= bit;
        if blockers.0 & bit != 0 { break; }
    }
    // West
    for f in (0..file).rev() {
        let bit = 1u64 << (rank * 8 + f);
        attacks |= bit;
        if blockers.0 & bit != 0 { break; }
    }
    
    Bitboard(attacks)
}

/// Generate bishop attacks given blockers
fn bishop_attacks_slow(sq: Square, blockers: Bitboard) -> Bitboard {
    let mut attacks = 0u64;
    let rank = sq.rank() as i8;
    let file = sq.file() as i8;
    
    // Northeast
    let (mut r, mut f) = (rank + 1, file + 1);
    while r < 8 && f < 8 {
        let bit = 1u64 << (r * 8 + f);
        attacks |= bit;
        if blockers.0 & bit != 0 { break; }
        r += 1;
        f += 1;
    }
    // Northwest
    let (mut r, mut f) = (rank + 1, file - 1);
    while r < 8 && f >= 0 {
        let bit = 1u64 << (r * 8 + f);
        attacks |= bit;
        if blockers.0 & bit != 0 { break; }
        r += 1;
        f -= 1;
    }
    // Southeast
    let (mut r, mut f) = (rank - 1, file + 1);
    while r >= 0 && f < 8 {
        let bit = 1u64 << (r * 8 + f);
        attacks |= bit;
        if blockers.0 & bit != 0 { break; }
        r -= 1;
        f += 1;
    }
    // Southwest
    let (mut r, mut f) = (rank - 1, file - 1);
    while r >= 0 && f >= 0 {
        let bit = 1u64 << (r * 8 + f);
        attacks |= bit;
        if blockers.0 & bit != 0 { break; }
        r -= 1;
        f -= 1;
    }
    
    Bitboard(attacks)
}

// =============================================================================
// MAGIC LOOKUP TABLES
// =============================================================================

/// Storage for magic lookup tables
pub struct MagicTables {
    rook_masks: [Bitboard; 64],
    bishop_masks: [Bitboard; 64],
    rook_attacks: Vec<Vec<Bitboard>>,
    bishop_attacks: Vec<Vec<Bitboard>>,
}

impl MagicTables {
    /// Initialize magic bitboard tables
    pub fn new() -> Self {
        let mut tables = MagicTables {
            rook_masks: [Bitboard::EMPTY; 64],
            bishop_masks: [Bitboard::EMPTY; 64],
            rook_attacks: vec![Vec::new(); 64],
            bishop_attacks: vec![Vec::new(); 64],
        };
        
        // Build tables for each square
        for sq_idx in 0..64 {
            let sq = Square::new(sq_idx);
            
            // Rook
            tables.rook_masks[sq_idx as usize] = rook_mask(sq);
            let rook_bits = ROOK_BITS[sq_idx as usize];
            let rook_size = 1 << rook_bits;
            tables.rook_attacks[sq_idx as usize] = vec![Bitboard::EMPTY; rook_size];
            
            // Enumerate all possible blocker configurations
            let mask = tables.rook_masks[sq_idx as usize];
            let mut blockers = Bitboard::EMPTY;
            loop {
                let attacks = rook_attacks_slow(sq, blockers);
                let index = magic_index(blockers, ROOK_MAGICS[sq_idx as usize], rook_bits);
                tables.rook_attacks[sq_idx as usize][index] = attacks;
                
                // Carry-Rippler trick to enumerate all subsets
                blockers = Bitboard((blockers.0.wrapping_sub(mask.0)) & mask.0);
                if blockers.is_empty() { break; }
            }
            
            // Bishop
            tables.bishop_masks[sq_idx as usize] = bishop_mask(sq);
            let bishop_bits = BISHOP_BITS[sq_idx as usize];
            let bishop_size = 1 << bishop_bits;
            tables.bishop_attacks[sq_idx as usize] = vec![Bitboard::EMPTY; bishop_size];
            
            let mask = tables.bishop_masks[sq_idx as usize];
            let mut blockers = Bitboard::EMPTY;
            loop {
                let attacks = bishop_attacks_slow(sq, blockers);
                let index = magic_index(blockers, BISHOP_MAGICS[sq_idx as usize], bishop_bits);
                tables.bishop_attacks[sq_idx as usize][index] = attacks;
                
                blockers = Bitboard((blockers.0.wrapping_sub(mask.0)) & mask.0);
                if blockers.is_empty() { break; }
            }
        }
        
        tables
    }
    
    /// Get rook attacks from a square given occupancy
    #[inline]
    pub fn rook_attacks(&self, sq: Square, occupied: Bitboard) -> Bitboard {
        let sq_idx = sq.index();
        let mask = self.rook_masks[sq_idx];
        let blockers = occupied & mask;
        let index = magic_index(blockers, ROOK_MAGICS[sq_idx], ROOK_BITS[sq_idx]);
        self.rook_attacks[sq_idx][index]
    }
    
    /// Get bishop attacks from a square given occupancy
    #[inline]
    pub fn bishop_attacks(&self, sq: Square, occupied: Bitboard) -> Bitboard {
        let sq_idx = sq.index();
        let mask = self.bishop_masks[sq_idx];
        let blockers = occupied & mask;
        let index = magic_index(blockers, BISHOP_MAGICS[sq_idx], BISHOP_BITS[sq_idx]);
        self.bishop_attacks[sq_idx][index]
    }
    
    /// Get queen attacks (rook + bishop combined)
    #[inline]
    pub fn queen_attacks(&self, sq: Square, occupied: Bitboard) -> Bitboard {
        self.rook_attacks(sq, occupied) | self.bishop_attacks(sq, occupied)
    }
}

/// Compute magic index from blockers
#[inline]
fn magic_index(blockers: Bitboard, magic: u64, bits: u8) -> usize {
    ((blockers.0.wrapping_mul(magic)) >> (64 - bits)) as usize
}

// =============================================================================
// GLOBAL INSTANCE (initialized once)
// =============================================================================

use std::sync::OnceLock;

static MAGIC_TABLES: OnceLock<MagicTables> = OnceLock::new();

/// Get the global magic tables (initializes on first call)
pub fn magic_tables() -> &'static MagicTables {
    MAGIC_TABLES.get_or_init(MagicTables::new)
}

/// Get rook attacks
#[inline]
pub fn rook_attacks(sq: Square, occupied: Bitboard) -> Bitboard {
    magic_tables().rook_attacks(sq, occupied)
}

/// Get bishop attacks
#[inline]
pub fn bishop_attacks(sq: Square, occupied: Bitboard) -> Bitboard {
    magic_tables().bishop_attacks(sq, occupied)
}

/// Get queen attacks
#[inline]
pub fn queen_attacks(sq: Square, occupied: Bitboard) -> Bitboard {
    magic_tables().queen_attacks(sq, occupied)
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_rook_attacks_empty_board() {
        let sq = Square::from_file_rank(4, 3); // e4
        let attacks = rook_attacks(sq, Bitboard::EMPTY);
        
        // Rook on e4 attacks 14 squares (4 up, 3 down, 4 right, 3 left)
        assert_eq!(attacks.count(), 14);
    }
    
    #[test]
    fn test_rook_attacks_with_blocker() {
        let sq = Square::from_file_rank(4, 3); // e4
        let blocker = Bitboard::from_square(Square::from_file_rank(4, 5)); // e6
        let attacks = rook_attacks(sq, blocker);
        
        // e6 blocks north, so only e5, e6 visible (not e7, e8)
        assert!(attacks.has(Square::from_file_rank(4, 4))); // e5
        assert!(attacks.has(Square::from_file_rank(4, 5))); // e6 (blocker)
        assert!(!attacks.has(Square::from_file_rank(4, 6))); // e7 blocked
    }
    
    #[test]
    fn test_bishop_attacks_empty_board() {
        let sq = Square::from_file_rank(4, 3); // e4
        let attacks = bishop_attacks(sq, Bitboard::EMPTY);
        
        // Bishop on e4 attacks 13 squares
        assert_eq!(attacks.count(), 13);
    }
    
    #[test]
    fn test_queen_attacks_empty_board() {
        let sq = Square::from_file_rank(4, 3); // e4
        let attacks = queen_attacks(sq, Bitboard::EMPTY);
        
        // Queen = rook (14) + bishop (13) = 27 squares
        assert_eq!(attacks.count(), 27);
    }
    
    #[test]
    fn test_corner_rook() {
        let sq = Square::from_file_rank(0, 0); // a1
        let attacks = rook_attacks(sq, Bitboard::EMPTY);
        
        // Rook on a1 attacks 14 squares (7 up + 7 right)
        assert_eq!(attacks.count(), 14);
    }
    
    #[test]
    fn test_rook_h8_blocked_by_h3() {
        let h8 = Square::from_file_rank(7, 7);
        let h3 = Square::from_file_rank(7, 2);
        let h2 = Square::from_file_rank(7, 1);
        let h1 = Square::from_file_rank(7, 0);
        
        let occupied = Bitboard::from_square(h3);
        let attacks = rook_attacks(h8, occupied);
        
        // Rook on h8, blocker on h3: ray should stop at h3
        assert!(attacks.has(Square::from_file_rank(7, 6)), "h7 should be attacked");
        assert!(attacks.has(Square::from_file_rank(7, 5)), "h6 should be attacked");
        assert!(attacks.has(Square::from_file_rank(7, 4)), "h5 should be attacked");
        assert!(attacks.has(Square::from_file_rank(7, 3)), "h4 should be attacked");
        assert!(attacks.has(h3), "h3 should be in attack set (blocker square)");
        assert!(!attacks.has(h2), "h2 should NOT be in attack set (blocked by h3)");
        assert!(!attacks.has(h1), "h1 should NOT be in attack set (blocked by h3)");
    }
    
    #[test]
    fn test_validate_all_rook_magics() {
        // Validate every rook magic number: no two different attack patterns
        // should hash to the same index for the same square
        let mut bad_squares = Vec::new();
        
        for sq_idx in 0u8..64 {
            let sq = Square::new(sq_idx);
            let mask = rook_mask(sq);
            let bits = ROOK_BITS[sq_idx as usize];
            let magic = ROOK_MAGICS[sq_idx as usize];
            let table_size = 1usize << bits;
            
            // Build table and check for destructive collisions
            let mut table: Vec<Option<Bitboard>> = vec![None; table_size];
            let mut collision = false;
            
            let mut blockers = Bitboard::EMPTY;
            loop {
                let attacks = rook_attacks_slow(sq, blockers);
                let index = magic_index(blockers, magic, bits);
                
                match table[index] {
                    None => { table[index] = Some(attacks); }
                    Some(existing) => {
                        if existing.0 != attacks.0 {
                            collision = true;
                            break;
                        }
                    }
                }
                
                blockers = Bitboard((blockers.0.wrapping_sub(mask.0)) & mask.0);
                if blockers.is_empty() { break; }
            }
            
            if collision {
                bad_squares.push(sq_idx);
            }
        }
        
        if !bad_squares.is_empty() {
            panic!("Rook magic collisions found for squares: {:?}", bad_squares);
        }
    }
    
    #[test]
    fn test_validate_all_bishop_magics() {
        let mut bad_squares = Vec::new();
        
        for sq_idx in 0u8..64 {
            let sq = Square::new(sq_idx);
            let mask = bishop_mask(sq);
            let bits = BISHOP_BITS[sq_idx as usize];
            let magic = BISHOP_MAGICS[sq_idx as usize];
            let table_size = 1usize << bits;
            
            let mut table: Vec<Option<Bitboard>> = vec![None; table_size];
            let mut collision = false;
            
            let mut blockers = Bitboard::EMPTY;
            loop {
                let attacks = bishop_attacks_slow(sq, blockers);
                let index = magic_index(blockers, magic, bits);
                
                match table[index] {
                    None => { table[index] = Some(attacks); }
                    Some(existing) => {
                        if existing.0 != attacks.0 {
                            collision = true;
                            break;
                        }
                    }
                }
                
                blockers = Bitboard((blockers.0.wrapping_sub(mask.0)) & mask.0);
                if blockers.is_empty() { break; }
            }
            
            if collision {
                bad_squares.push(sq_idx);
            }
        }
        
        if !bad_squares.is_empty() {
            panic!("Bishop magic collisions found for squares: {:?}", bad_squares);
        }
    }
}
