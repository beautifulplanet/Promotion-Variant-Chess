// Transposition Table Module
// Array-based hash table for caching search results.
// Uses Zobrist hash as key, always-replace policy.

use crate::eval::Score;
use crate::types::Move;

// =============================================================================
// TT ENTRY
// =============================================================================

/// Flags indicating the type of score stored.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TTFlag {
    /// Score is exact (PV node — both bounds were improved).
    Exact,
    /// Score is a lower bound (beta cutoff — score >= beta).
    LowerBound,
    /// Score is an upper bound (failed low — score <= alpha).
    UpperBound,
}

/// A single entry in the transposition table.
#[derive(Clone, Copy)]
pub struct TTEntry {
    /// Full Zobrist hash for collision detection.
    pub hash: u64,
    /// Search depth when this entry was stored.
    pub depth: u8,
    /// Stored score.
    pub score: Score,
    /// Type of score.
    pub flag: TTFlag,
    /// Best move found (for move ordering / PV recovery).
    pub best_move: Option<Move>,
}

impl Default for TTEntry {
    fn default() -> Self {
        TTEntry {
            hash: 0,
            depth: 0,
            score: 0,
            flag: TTFlag::Exact,
            best_move: None,
        }
    }
}

// =============================================================================
// TRANSPOSITION TABLE
// =============================================================================

/// Fixed-size transposition table.
/// Uses `hash % capacity` as index (always-replace).
/// For WASM, default to 2^18 entries (~5 MB) to stay within limits.
pub struct TranspositionTable {
    entries: Vec<TTEntry>,
    capacity: usize,
    /// Stats
    pub hits: u64,
    pub misses: u64,
    pub stores: u64,
    pub collisions: u64,
}

impl TranspositionTable {
    /// Create a new TT with the given number of entries.
    /// `size_power` is the power of 2 (e.g., 18 = 2^18 = 262144 entries).
    pub fn new(size_power: u8) -> Self {
        let capacity = 1usize << size_power;
        TranspositionTable {
            entries: vec![TTEntry::default(); capacity],
            capacity,
            hits: 0,
            misses: 0,
            stores: 0,
            collisions: 0,
        }
    }

    /// Default table size for WASM (2^18 = 262144 entries, ~5 MB).
    pub fn default_wasm() -> Self {
        Self::new(18)
    }

    /// Probe the TT for a matching entry.
    /// Returns Some(entry) if the hash matches exactly.
    pub fn probe(&mut self, hash: u64) -> Option<&TTEntry> {
        let idx = (hash as usize) & (self.capacity - 1);
        let entry = &self.entries[idx];
        if entry.hash == hash && entry.hash != 0 {
            self.hits += 1;
            Some(entry)
        } else {
            self.misses += 1;
            None
        }
    }

    /// Store an entry in the TT.
    /// Always-replace: overwrites whatever was in the slot.
    /// Depth-preferred variant: only overwrite if new depth >= existing depth.
    pub fn store(&mut self, hash: u64, depth: u8, score: Score, flag: TTFlag, best_move: Option<Move>) {
        let idx = (hash as usize) & (self.capacity - 1);
        let existing = &self.entries[idx];

        // Track collisions (different position in same slot)
        if existing.hash != 0 && existing.hash != hash {
            self.collisions += 1;
        }

        // Depth-preferred: only replace if new search is at least as deep
        if existing.hash != 0 && existing.hash != hash && existing.depth > depth {
            return; // Keep higher-depth entry
        }

        self.entries[idx] = TTEntry {
            hash,
            depth,
            score,
            flag,
            best_move,
        };
        self.stores += 1;
    }

    /// Clear the entire table (e.g., for a new game).
    pub fn clear(&mut self) {
        for entry in self.entries.iter_mut() {
            *entry = TTEntry::default();
        }
        self.hits = 0;
        self.misses = 0;
        self.stores = 0;
        self.collisions = 0;
    }

    /// Table utilization (fraction of slots filled).
    pub fn utilization(&self) -> f64 {
        let filled = self.entries.iter().filter(|e| e.hash != 0).count();
        filled as f64 / self.capacity as f64
    }

    /// Get hit rate as a percentage.
    pub fn hit_rate(&self) -> f64 {
        let total = self.hits + self.misses;
        if total == 0 { 0.0 } else { (self.hits as f64 / total as f64) * 100.0 }
    }
}

// =============================================================================
// SCORE ADJUSTMENT FOR MATE SCORES
// =============================================================================

/// Adjust mate score when storing in TT.
/// Mate scores are relative to the root; TT stores them relative to the node.
pub fn score_to_tt(score: Score, ply: u8) -> Score {
    if score > 29000 {
        score + ply as Score  // Mate score: add ply to make it root-relative
    } else if score < -29000 {
        score - ply as Score
    } else {
        score
    }
}

/// Adjust mate score when retrieving from TT.
pub fn score_from_tt(score: Score, ply: u8) -> Score {
    if score > 29000 {
        score - ply as Score
    } else if score < -29000 {
        score + ply as Score
    } else {
        score
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Move, Square};

    #[test]
    fn test_tt_store_and_probe() {
        let mut tt = TranspositionTable::new(10); // 1024 entries
        tt.store(12345, 5, 100, TTFlag::Exact, None);

        let entry = tt.probe(12345).unwrap();
        assert_eq!(entry.hash, 12345);
        assert_eq!(entry.depth, 5);
        assert_eq!(entry.score, 100);
        assert_eq!(entry.flag, TTFlag::Exact);
        assert!(entry.best_move.is_none());
    }

    #[test]
    fn test_tt_miss_on_empty() {
        let mut tt = TranspositionTable::new(10);
        assert!(tt.probe(12345).is_none());
        assert_eq!(tt.misses, 1);
    }

    #[test]
    fn test_tt_miss_on_wrong_hash() {
        let mut tt = TranspositionTable::new(10);
        tt.store(12345, 5, 100, TTFlag::Exact, None);
        assert!(tt.probe(99999).is_none());
    }

    #[test]
    fn test_tt_overwrite_lower_depth() {
        let mut tt = TranspositionTable::new(10);
        // Store at depth 3
        let hash = 12345u64;
        tt.store(hash, 3, 50, TTFlag::Exact, None);

        // Overwrite with depth 5 (deeper = better)
        tt.store(hash, 5, 100, TTFlag::LowerBound, None);

        let entry = tt.probe(hash).unwrap();
        assert_eq!(entry.depth, 5);
        assert_eq!(entry.score, 100);
    }

    #[test]
    fn test_tt_depth_preferred_keeps_deeper() {
        let mut tt = TranspositionTable::new(10);
        // Two different hashes that map to the same slot
        let capacity = 1024usize;
        let hash1 = 42u64;
        let hash2 = hash1 + capacity as u64; // Same slot, different hash

        tt.store(hash1, 8, 200, TTFlag::Exact, None);
        tt.store(hash2, 3, 50, TTFlag::Exact, None); // Lower depth — should NOT replace

        let entry = tt.probe(hash1).unwrap();
        assert_eq!(entry.depth, 8); // Original kept
    }

    #[test]
    fn test_tt_clear() {
        let mut tt = TranspositionTable::new(10);
        tt.store(12345, 5, 100, TTFlag::Exact, None);
        tt.clear();
        assert!(tt.probe(12345).is_none());
        assert_eq!(tt.hits, 0);
        assert_eq!(tt.stores, 0);
    }

    #[test]
    fn test_tt_flags() {
        let mut tt = TranspositionTable::new(10);

        tt.store(1, 5, 100, TTFlag::LowerBound, None);
        assert_eq!(tt.probe(1).unwrap().flag, TTFlag::LowerBound);

        tt.store(2, 5, -50, TTFlag::UpperBound, None);
        assert_eq!(tt.probe(2).unwrap().flag, TTFlag::UpperBound);

        tt.store(3, 5, 0, TTFlag::Exact, None);
        assert_eq!(tt.probe(3).unwrap().flag, TTFlag::Exact);
    }

    #[test]
    fn test_tt_with_best_move() {
        let mut tt = TranspositionTable::new(10);
        let from = Square::from_file_rank(4, 1); // e2
        let to = Square::from_file_rank(4, 3);   // e4
        let mv = Move::new(from, to);
        tt.store(12345, 5, 100, TTFlag::Exact, Some(mv));

        let entry = tt.probe(12345).unwrap();
        assert!(entry.best_move.is_some());
        let stored_mv = entry.best_move.unwrap();
        assert_eq!(stored_mv.from(), from);
        assert_eq!(stored_mv.to(), to);
    }

    #[test]
    fn test_tt_hit_rate() {
        let mut tt = TranspositionTable::new(10);
        tt.store(1, 5, 100, TTFlag::Exact, None);

        tt.probe(1); // hit
        tt.probe(2); // miss
        tt.probe(1); // hit
        tt.probe(3); // miss

        assert_eq!(tt.hits, 2);
        assert_eq!(tt.misses, 2);
        assert!((tt.hit_rate() - 50.0).abs() < 0.01);
    }

    #[test]
    fn test_score_to_from_tt() {
        // Normal scores pass through unchanged
        assert_eq!(score_to_tt(100, 5), 100);
        assert_eq!(score_from_tt(100, 5), 100);

        // Mate scores adjusted by ply
        assert_eq!(score_to_tt(30000, 5), 30005);
        assert_eq!(score_from_tt(30005, 5), 30000);

        assert_eq!(score_to_tt(-30000, 5), -30005);
        assert_eq!(score_from_tt(-30005, 5), -30000);
    }
}
