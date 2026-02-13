// Search Module
// Implements minimax with alpha-beta pruning to find the best move
// With: transposition table, killer move heuristic, MVV-LVA ordering

use crate::eval::{evaluate, Score, MATE_SCORE, DRAW_SCORE};
use crate::movegen::{generate_legal_moves, MoveList};
use crate::position::Position;
use crate::tt::{TranspositionTable, TTFlag, score_to_tt, score_from_tt};
use crate::types::Move;

// =============================================================================
// TIME MEASUREMENT (works on both native and WASM)
// =============================================================================

#[cfg(target_arch = "wasm32")]
fn now_ms() -> f64 {
    js_sys::Date::now()
}

#[cfg(not(target_arch = "wasm32"))]
fn now_ms() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs_f64() * 1000.0
}

// =============================================================================
// SEARCH CONFIGURATION
// =============================================================================

const MAX_DEPTH: u8 = 64;

/// Number of killer moves stored per ply.
const NUM_KILLERS: usize = 2;

/// Search statistics
#[derive(Default, Clone)]
pub struct SearchStats {
    pub nodes: u64,
    pub depth: u8,
    pub best_move: Option<Move>,
    pub score: Score,
    pub time_ms: f64,
    pub nps: u64,
    pub time_stopped: bool,
    pub tt_hits: u64,
    pub tt_cutoffs: u64,
}

/// Killer moves table: 2 killer moves per ply.
struct Killers {
    table: [[Option<Move>; NUM_KILLERS]; MAX_DEPTH as usize],
}

impl Killers {
    fn new() -> Self {
        Killers {
            table: [[None; NUM_KILLERS]; MAX_DEPTH as usize],
        }
    }

    /// Record a killer move at the given ply (quiet moves that caused beta cutoff).
    fn store(&mut self, ply: u8, mv: Move) {
        let ply = ply as usize;
        if ply >= MAX_DEPTH as usize { return; }
        // Don't store duplicates
        if self.table[ply][0] == Some(mv) { return; }
        // Shift: slot 1 = old slot 0, slot 0 = new killer
        self.table[ply][1] = self.table[ply][0];
        self.table[ply][0] = Some(mv);
    }

    /// Check if a move is a killer at the given ply.
    fn is_killer(&self, ply: u8, mv: Move) -> bool {
        let ply = ply as usize;
        if ply >= MAX_DEPTH as usize { return false; }
        self.table[ply][0] == Some(mv) || self.table[ply][1] == Some(mv)
    }
}

// =============================================================================
// MAIN SEARCH FUNCTIONS
// =============================================================================

/// Find the best move (no TT — backwards compatible).
pub fn search(pos: &mut Position, depth: u8) -> (Option<Move>, Score, SearchStats) {
    let mut tt = TranspositionTable::new(18);
    search_with_tt(pos, depth, &mut tt)
}

/// Find the best move using the given TT.
pub fn search_with_tt(pos: &mut Position, depth: u8, tt: &mut TranspositionTable) -> (Option<Move>, Score, SearchStats) {
    let mut stats = SearchStats::default();
    let mut killers = Killers::new();
    stats.depth = depth;

    let (score, best_move) = alpha_beta(
        pos, depth, 0, -MATE_SCORE - 1, MATE_SCORE + 1, &mut stats, tt, &mut killers,
    );

    stats.score = score;
    stats.best_move = best_move;
    stats.tt_hits = tt.hits;

    (best_move, score, stats)
}

/// Iterative deepening search (creates its own TT, shared across depths).
pub fn search_iterative(pos: &mut Position, max_depth: u8) -> (Option<Move>, Score, SearchStats) {
    let mut tt = TranspositionTable::new(18);
    let mut best_move = None;
    let mut best_score = -MATE_SCORE;
    let mut total_stats = SearchStats::default();

    for depth in 1..=max_depth {
        let (mv, score, stats) = search_with_tt(pos, depth, &mut tt);

        if let Some(m) = mv {
            best_move = Some(m);
            best_score = score;
        }

        total_stats.nodes += stats.nodes;
        total_stats.depth = depth;
        total_stats.tt_hits = tt.hits;
    }

    total_stats.best_move = best_move;
    total_stats.score = best_score;

    (best_move, best_score, total_stats)
}

/// Time-limited iterative deepening with TT.
pub fn search_timed(pos: &mut Position, max_ms: f64, max_depth: u8) -> (Option<Move>, Score, SearchStats) {
    let start = now_ms();
    let deadline = start + max_ms;
    let depth_limit = if max_depth == 0 { MAX_DEPTH } else { max_depth };

    let mut tt = TranspositionTable::new(18);
    let mut best_move = None;
    let mut best_score = -MATE_SCORE;
    let mut total_stats = SearchStats::default();

    for depth in 1..=depth_limit {
        let (mv, score, stats) = search_with_tt(pos, depth, &mut tt);

        total_stats.nodes += stats.nodes;
        total_stats.depth = depth;
        total_stats.tt_hits = tt.hits;

        if let Some(m) = mv {
            best_move = Some(m);
            best_score = score;
        }

        let elapsed = now_ms() - start;
        if elapsed >= max_ms {
            total_stats.time_stopped = true;
            break;
        }
        let remaining = deadline - now_ms();
        if remaining < elapsed * 3.0 {
            total_stats.time_stopped = true;
            break;
        }
    }

    let total_time = now_ms() - start;
    total_stats.time_ms = total_time;
    total_stats.nps = if total_time > 0.0 {
        (total_stats.nodes as f64 / (total_time / 1000.0)) as u64
    } else { 0 };
    total_stats.best_move = best_move;
    total_stats.score = best_score;

    (best_move, best_score, total_stats)
}

// =============================================================================
// ALPHA-BETA SEARCH WITH TT + KILLERS
// =============================================================================

fn alpha_beta(
    pos: &mut Position,
    depth: u8,
    ply: u8,
    mut alpha: Score,
    beta: Score,
    stats: &mut SearchStats,
    tt: &mut TranspositionTable,
    killers: &mut Killers,
) -> (Score, Option<Move>) {
    stats.nodes += 1;

    // Base case: leaf node
    if depth == 0 {
        return (quiescence(pos, alpha, beta, stats), None);
    }

    // ── TT Probe ──
    let hash = pos.hash();
    let mut tt_move: Option<Move> = None;

    if let Some(entry) = tt.probe(hash) {
        tt_move = entry.best_move;

        if entry.depth >= depth {
            let tt_score = score_from_tt(entry.score, ply);
            match entry.flag {
                TTFlag::Exact => {
                    stats.tt_cutoffs += 1;
                    return (tt_score, entry.best_move);
                }
                TTFlag::LowerBound => {
                    if tt_score >= beta {
                        stats.tt_cutoffs += 1;
                        return (tt_score, entry.best_move);
                    }
                    if tt_score > alpha {
                        alpha = tt_score;
                    }
                }
                TTFlag::UpperBound => {
                    if tt_score <= alpha {
                        stats.tt_cutoffs += 1;
                        return (tt_score, entry.best_move);
                    }
                }
            }
        }
    }

    // Generate legal moves
    let moves = generate_legal_moves(pos);

    // Checkmate or stalemate
    if moves.is_empty() {
        let score = if pos.is_in_check(pos.side_to_move()) {
            -MATE_SCORE + ply as Score
        } else {
            DRAW_SCORE
        };
        return (score, None);
    }

    // Order moves: TT move first, then captures (MVV-LVA), then killers, then quiet
    let ordered_moves = order_moves_full(&moves, pos, tt_move, killers, ply);

    let mut best_move = None;
    let original_alpha = alpha;

    for mv in ordered_moves.iter() {
        let undo = match pos.make_move(*mv) {
            Some(u) => u,
            None => continue,
        };

        let (score, _) = alpha_beta(pos, depth - 1, ply + 1, -beta, -alpha, stats, tt, killers);
        let score = -score;

        pos.unmake_move(*mv, &undo);

        if score > alpha {
            alpha = score;
            best_move = Some(*mv);

            if alpha >= beta {
                // Beta cutoff — store killer if quiet move
                if !is_capture(pos, *mv) {
                    killers.store(ply, *mv);
                }
                break;
            }
        }
    }

    // ── TT Store ──
    let flag = if alpha >= beta {
        TTFlag::LowerBound
    } else if alpha > original_alpha {
        TTFlag::Exact
    } else {
        TTFlag::UpperBound
    };
    tt.store(hash, depth, score_to_tt(alpha, ply), flag, best_move);

    (alpha, best_move)
}

// =============================================================================
// QUIESCENCE SEARCH
// =============================================================================

fn quiescence(
    pos: &mut Position,
    mut alpha: Score,
    beta: Score,
    stats: &mut SearchStats,
) -> Score {
    stats.nodes += 1;

    let stand_pat = evaluate(pos);

    if stand_pat >= beta {
        return beta;
    }
    if stand_pat > alpha {
        alpha = stand_pat;
    }

    let moves = generate_legal_moves(pos);

    if moves.is_empty() {
        if pos.is_in_check(pos.side_to_move()) {
            return -MATE_SCORE;
        } else {
            return DRAW_SCORE;
        }
    }

    for mv in moves.iter() {
        if !is_capture(pos, *mv) {
            continue;
        }

        let undo = match pos.make_move(*mv) {
            Some(u) => u,
            None => continue,
        };

        let score = -quiescence(pos, -beta, -alpha, stats);
        pos.unmake_move(*mv, &undo);

        if score >= beta {
            return beta;
        }
        if score > alpha {
            alpha = score;
        }
    }

    alpha
}

// =============================================================================
// MOVE ORDERING
// =============================================================================

/// Full move ordering: TT move → captures (MVV-LVA) → killers → quiet moves
fn order_moves_full(moves: &MoveList, pos: &Position, tt_move: Option<Move>, killers: &Killers, ply: u8) -> MoveList {
    use crate::eval::piece_value;

    let mut scored: Vec<(Move, i32)> = moves.iter()
        .map(|&mv| {
            let mut score: i32 = 0;

            // TT move gets highest priority
            if Some(mv) == tt_move {
                score += 100_000;
            }

            // MVV-LVA for captures
            if is_capture(pos, mv) {
                score += 10_000; // Base capture bonus
                if let Some((_, captured)) = pos.piece_on(mv.to()) {
                    score += (piece_value(captured) * 10) as i32;
                }
                if let Some((_, attacker)) = pos.piece_on(mv.from()) {
                    score -= piece_value(attacker) as i32;
                }
            }

            // Promotions
            if mv.is_promotion() {
                score += 9_000;
            }

            // Killer moves (quiet moves that caused beta cutoff at this ply)
            if !is_capture(pos, mv) && killers.is_killer(ply, mv) {
                score += 5_000;
            }

            (mv, score)
        })
        .collect();

    scored.sort_by(|a, b| b.1.cmp(&a.1));

    let mut ordered = MoveList::new();
    for (mv, _) in scored {
        ordered.push(mv);
    }
    ordered
}

/// Check if a move is a capture
#[inline]
fn is_capture(pos: &Position, mv: Move) -> bool {
    mv.is_en_passant() || pos.piece_on(mv.to()).is_some()
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_starting_position() {
        let mut pos = Position::starting_position();
        let (best_move, score, stats) = search(&mut pos, 3);

        assert!(best_move.is_some());
        assert!(score.abs() < 100);
        assert!(stats.nodes > 0);
    }

    #[test]
    fn test_finds_mate_in_one() {
        let mut pos = Position::from_fen("4k3/8/8/8/8/8/8/4K2Q w - - 0 1").unwrap();
        let (best_move, score, _) = search(&mut pos, 4);

        assert!(best_move.is_some());
        assert!(score > 500, "Score not high enough: {}", score);
    }

    #[test]
    fn test_finds_free_piece() {
        let mut pos = Position::from_fen("7k/8/8/8/4q3/8/4R3/4K3 w - - 0 1").unwrap();
        let (best_move, score, _) = search(&mut pos, 3);

        assert!(best_move.is_some());
        let mv = best_move.unwrap();
        assert!(mv.to_uci().ends_with("e4"), "Should capture queen on e4, got: {}", mv.to_uci());
        assert!(score > 400, "Score not high enough: {}", score);
    }

    #[test]
    fn test_iterative_deepening() {
        let mut pos = Position::starting_position();
        let (best_move, _, stats) = search_iterative(&mut pos, 4);

        assert!(best_move.is_some());
        assert_eq!(stats.depth, 4);
    }

    #[test]
    fn test_tt_is_used() {
        // Iterative deepening should have TT hits on later iterations
        let mut pos = Position::starting_position();
        let (_, _, stats) = search_iterative(&mut pos, 5);

        assert!(stats.tt_hits > 0, "TT should have some hits during iterative deepening");
    }

    #[test]
    fn test_tt_improves_node_count() {
        // Search the same position twice with shared TT — second search should be faster
        let mut pos = Position::starting_position();
        let mut tt = TranspositionTable::new(18);

        let (_, _, stats1) = search_with_tt(&mut pos, 4, &mut tt);
        let (_, _, stats2) = search_with_tt(&mut pos, 4, &mut tt);

        // Second search should use fewer nodes thanks to TT
        assert!(stats2.nodes <= stats1.nodes,
            "Second search ({}) should use <= nodes than first ({})", stats2.nodes, stats1.nodes);
    }

    #[test]
    fn test_killer_moves_dont_crash() {
        // Ensure killer move heuristic doesn't cause issues
        let mut pos = Position::from_fen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1").unwrap();
        let (best_move, _, stats) = search(&mut pos, 4);
        assert!(best_move.is_some());
        assert!(stats.nodes > 0);
    }
}
