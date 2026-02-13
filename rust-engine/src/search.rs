// Search Module
// Implements minimax with alpha-beta pruning to find the best move

use crate::eval::{evaluate, Score, MATE_SCORE, DRAW_SCORE};
use crate::movegen::{generate_legal_moves, MoveList};
use crate::position::Position;
use crate::types::Move;

// =============================================================================
// TIME MEASUREMENT (works on both native and WASM)
// =============================================================================

/// Get current time in milliseconds.
/// Uses js_sys::Date::now() on WASM, std::time for native.
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

/// Maximum search depth
const MAX_DEPTH: u8 = 64;

/// Search statistics
#[derive(Default, Clone)]
pub struct SearchStats {
    pub nodes: u64,
    pub depth: u8,
    pub best_move: Option<Move>,
    pub score: Score,
    pub time_ms: f64,
    pub nps: u64,
    /// Set when search was stopped by time limit (result still valid — last completed depth)
    pub time_stopped: bool,
}

// =============================================================================
// MAIN SEARCH FUNCTION
// =============================================================================

/// Find the best move for the current position
/// Returns (best_move, score, stats)
pub fn search(pos: &mut Position, depth: u8) -> (Option<Move>, Score, SearchStats) {
    let mut stats = SearchStats::default();
    stats.depth = depth;
    
    let (score, best_move) = alpha_beta(
        pos,
        depth,
        -MATE_SCORE - 1,  // alpha
        MATE_SCORE + 1,   // beta
        &mut stats,
    );
    
    stats.score = score;
    stats.best_move = best_move;
    
    (best_move, score, stats)
}

/// Iterative deepening search - searches progressively deeper
/// Better for time management and move ordering
pub fn search_iterative(pos: &mut Position, max_depth: u8) -> (Option<Move>, Score, SearchStats) {
    let mut best_move = None;
    let mut best_score = -MATE_SCORE;
    let mut total_stats = SearchStats::default();
    
    for depth in 1..=max_depth {
        let (mv, score, stats) = search(pos, depth);
        
        if let Some(m) = mv {
            best_move = Some(m);
            best_score = score;
        }
        
        total_stats.nodes += stats.nodes;
        total_stats.depth = depth;
    }
    
    total_stats.best_move = best_move;
    total_stats.score = best_score;
    
    (best_move, best_score, total_stats)
}

/// Time-limited iterative deepening search.
/// Searches deeper and deeper until `max_ms` wall-clock time is exceeded.
/// Returns the result from the last *completed* depth.
/// If `max_depth` is 0, defaults to MAX_DEPTH (64).
pub fn search_timed(pos: &mut Position, max_ms: f64, max_depth: u8) -> (Option<Move>, Score, SearchStats) {
    let start = now_ms();
    let deadline = start + max_ms;
    let depth_limit = if max_depth == 0 { MAX_DEPTH } else { max_depth };

    let mut best_move = None;
    let mut best_score = -MATE_SCORE;
    let mut total_stats = SearchStats::default();

    for depth in 1..=depth_limit {
        let (mv, score, stats) = search(pos, depth);

        total_stats.nodes += stats.nodes;
        total_stats.depth = depth;

        if let Some(m) = mv {
            best_move = Some(m);
            best_score = score;
        }

        // Check if we exceeded the time budget
        let elapsed = now_ms() - start;
        if elapsed >= max_ms {
            total_stats.time_stopped = true;
            break;
        }

        // If the *next* depth is likely to take too long, stop early.
        // Heuristic: next depth takes ~3-4x longer than current.
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
    } else {
        0
    };
    total_stats.best_move = best_move;
    total_stats.score = best_score;

    (best_move, best_score, total_stats)
}

// =============================================================================
// ALPHA-BETA SEARCH
// =============================================================================

/// Alpha-beta minimax search
/// - alpha: best score for maximizing player (current side)
/// - beta: best score for minimizing player (opponent)
/// Returns (score, best_move)
fn alpha_beta(
    pos: &mut Position,
    depth: u8,
    mut alpha: Score,
    beta: Score,
    stats: &mut SearchStats,
) -> (Score, Option<Move>) {
    stats.nodes += 1;
    
    // Base case: leaf node
    if depth == 0 {
        return (quiescence(pos, alpha, beta, stats), None);
    }
    
    // Generate legal moves
    let moves = generate_legal_moves(pos);
    
    // Check for checkmate or stalemate
    if moves.is_empty() {
        if pos.is_in_check(pos.side_to_move()) {
            return (-MATE_SCORE + (MAX_DEPTH - depth) as Score, None);
        } else {
            return (DRAW_SCORE, None);
        }
    }
    
    // Order moves for better pruning (captures first)
    let ordered_moves = order_moves(&moves, pos);
    
    let mut best_move = None;
    
    for mv in ordered_moves.iter() {
        // Make the move
        let undo = match pos.make_move(*mv) {
            Some(u) => u,
            None => continue,
        };
        
        // Recurse
        let (score, _) = alpha_beta(pos, depth - 1, -beta, -alpha, stats);
        let score = -score; // Negamax: negate score for opponent
        
        // Unmake
        pos.unmake_move(*mv, &undo);
        
        // Update best
        if score > alpha {
            alpha = score;
            best_move = Some(*mv);
            
            // Beta cutoff
            if alpha >= beta {
                break;
            }
        }
    }
    
    (alpha, best_move)
}

// =============================================================================
// QUIESCENCE SEARCH
// Search captures only to avoid horizon effect
// =============================================================================

/// Quiescence search - only looks at captures to get a stable evaluation
fn quiescence(
    pos: &mut Position,
    mut alpha: Score,
    beta: Score,
    stats: &mut SearchStats,
) -> Score {
    stats.nodes += 1;
    
    // Stand pat: evaluate current position
    let stand_pat = evaluate(pos);
    
    // Beta cutoff
    if stand_pat >= beta {
        return beta;
    }
    
    // Update alpha
    if stand_pat > alpha {
        alpha = stand_pat;
    }
    
    // Generate all legal moves (we'll filter to captures)
    let moves = generate_legal_moves(pos);
    
    // Check for checkmate/stalemate if no moves
    if moves.is_empty() {
        if pos.is_in_check(pos.side_to_move()) {
            return -MATE_SCORE;
        } else {
            return DRAW_SCORE;
        }
    }
    
    // Only search captures
    for mv in moves.iter() {
        // Check if this is a capture
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
// Better move ordering = more beta cutoffs = faster search
// =============================================================================

/// Order moves: captures first, then others
fn order_moves(moves: &MoveList, pos: &Position) -> MoveList {
    use crate::eval::piece_value;
    
    // Create scored moves
    let mut scored: Vec<(Move, Score)> = moves.iter()
        .map(|&mv| {
            let mut score: Score = 0;
            
            // MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
            if is_capture(pos, mv) {
                if let Some((_, captured)) = pos.piece_on(mv.to()) {
                    score += piece_value(captured) * 10; // Victim value
                }
                if let Some((_, attacker)) = pos.piece_on(mv.from()) {
                    score -= piece_value(attacker); // Attacker value (lower is better)
                }
            }
            
            // Promotions
            if mv.is_promotion() {
                score += 800;
            }
            
            (mv, score)
        })
        .collect();
    
    // Sort by score descending
    scored.sort_by(|a, b| b.1.cmp(&a.1));
    
    // Convert back to MoveList
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
        
        // Should find a valid move
        assert!(best_move.is_some());
        // Starting position is roughly equal
        assert!(score.abs() < 100);
        // Should search some nodes
        assert!(stats.nodes > 0);
    }
    
    #[test]
    fn test_finds_mate_in_one() {
        // Back rank mate: Qe8# is checkmate
        let mut pos = Position::from_fen("4k3/8/8/8/8/8/8/4K2Q w - - 0 1").unwrap();
        let (best_move, score, _) = search(&mut pos, 4);
        
        // Should find a move
        assert!(best_move.is_some());
        // Score should be very high (winning)
        assert!(score > 500, "Score not high enough: {}", score);
    }
    
    #[test]
    fn test_finds_free_piece() {
        // White rook on e2 can capture undefended black queen on e4
        let mut pos = Position::from_fen("7k/8/8/8/4q3/8/4R3/4K3 w - - 0 1").unwrap();
        let (best_move, score, _) = search(&mut pos, 3);
        
        // Should find Rxe4
        assert!(best_move.is_some());
        let mv = best_move.unwrap();
        // Check the move captures the queen
        assert!(mv.to_uci().ends_with("e4"), "Should capture queen on e4, got: {}", mv.to_uci());
        // Should be winning (queen is 900cp, score is relative to opponent's reply)
        assert!(score > 400, "Score not high enough: {}", score);
    }
    
    #[test]
    fn test_iterative_deepening() {
        let mut pos = Position::starting_position();
        let (best_move, _, stats) = search_iterative(&mut pos, 4);
        
        assert!(best_move.is_some());
        assert_eq!(stats.depth, 4);
    }
}