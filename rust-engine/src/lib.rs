// Chess Engine - Main Entry Point
// Compiled to WebAssembly for browser use

mod attacks;
mod bitboard;
mod eval;
mod magic;
mod movegen;
mod position;
mod search;
mod types;
mod zobrist;

use wasm_bindgen::prelude::*;
use position::Position;
use movegen::{generate_legal_moves, generate_pseudo_legal_moves, perft};
use search::{search, search_iterative};
use eval::evaluate;

// Initialize panic hook for better error messages in browser console
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// =============================================================================
// PUBLIC API - Called from JavaScript/TypeScript
// =============================================================================

/// Create a new chess position from starting position
#[wasm_bindgen]
pub fn new_game() -> Position {
    Position::starting_position()
}

/// Create position from FEN string
#[wasm_bindgen]
pub fn from_fen(fen: &str) -> Result<Position, String> {
    Position::from_fen(fen).map_err(|e| e.to_string())
}

/// Get FEN string from position
#[wasm_bindgen]
pub fn to_fen(pos: &Position) -> String {
    pos.to_fen()
}

/// Test function to verify WASM is working
#[wasm_bindgen]
pub fn ping() -> String {
    "🦀 Rust Chess Engine v0.1.0 - Ready!".to_string()
}

/// Get engine info
#[wasm_bindgen]
pub fn engine_info() -> String {
    format!(
        "Chess Engine v0.2.0\nBitboard + Magic Bitboards\nAlpha-Beta Search with Quiescence\nPiece-Square Tables\nCompiled to WebAssembly"
    )
}

// =============================================================================
// SEARCH & EVALUATION API (Part 4)
// =============================================================================

/// Get best move for the current position
/// Returns move in UCI format (e.g., "e2e4")
#[wasm_bindgen]
pub fn get_best_move(pos: &Position, depth: u8) -> Option<String> {
    let mut pos = pos.clone();
    let (best_move, _, _) = search(&mut pos, depth);
    best_move.map(|m| m.to_uci())
}

/// Get best move with iterative deepening (better for time management)
#[wasm_bindgen]
pub fn get_best_move_iterative(pos: &Position, max_depth: u8) -> Option<String> {
    let mut pos = pos.clone();
    let (best_move, _, _) = search_iterative(&mut pos, max_depth);
    best_move.map(|m| m.to_uci())
}

/// Evaluate the current position (centipawns, from side-to-move perspective)
#[wasm_bindgen]
pub fn eval_position(pos: &Position) -> i32 {
    evaluate(pos)
}

/// Search result with full info
#[wasm_bindgen]
pub struct SearchResult {
    best_move: String,
    score: i32,
    nodes: u64,
    depth: u8,
}

#[wasm_bindgen]
impl SearchResult {
    #[wasm_bindgen(getter)]
    pub fn best_move(&self) -> String {
        self.best_move.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn score(&self) -> i32 {
        self.score
    }
    
    #[wasm_bindgen(getter)]
    pub fn nodes(&self) -> u64 {
        self.nodes
    }
    
    #[wasm_bindgen(getter)]
    pub fn depth(&self) -> u8 {
        self.depth
    }
}

/// Search with full stats
#[wasm_bindgen]
pub fn search_position(pos: &Position, depth: u8) -> SearchResult {
    let mut pos = pos.clone();
    let (best_move, score, stats) = search(&mut pos, depth);
    
    SearchResult {
        best_move: best_move.map(|m| m.to_uci()).unwrap_or_default(),
        score,
        nodes: stats.nodes,
        depth: stats.depth,
    }
}

// =============================================================================
// MOVE GENERATION API
// =============================================================================

/// Get all legal moves for a position as a JSON array of move strings (UCI format)
#[wasm_bindgen]
pub fn get_legal_moves(pos: &Position) -> Vec<JsValue> {
    let mut pos = pos.clone();
    let moves = generate_legal_moves(&mut pos);
    moves.iter()
        .map(|m| JsValue::from_str(&m.to_uci()))
        .collect()
}

/// Get number of legal moves in position
#[wasm_bindgen]
pub fn count_legal_moves(pos: &Position) -> usize {
    let mut pos = pos.clone();
    generate_legal_moves(&mut pos).len()
}

/// Get all pseudo-legal moves (may leave king in check)
#[wasm_bindgen]
pub fn get_pseudo_legal_moves(pos: &Position) -> Vec<JsValue> {
    let moves = generate_pseudo_legal_moves(pos);
    moves.iter()
        .map(|m| JsValue::from_str(&m.to_uci()))
        .collect()
}

/// Make a move on the position (modifies in place)
/// Returns true if move was legal
#[wasm_bindgen]
pub fn make_move(pos: &mut Position, from_file: u8, from_rank: u8, to_file: u8, to_rank: u8, promotion: Option<String>) -> bool {
    use types::{Move, Square, PieceType};
    
    let from = Square::from_file_rank(from_file, from_rank);
    let to = Square::from_file_rank(to_file, to_rank);
    
    let m = if let Some(promo) = promotion {
        let promo_piece = match promo.as_str() {
            "q" | "Q" => PieceType::Queen,
            "r" | "R" => PieceType::Rook,
            "b" | "B" => PieceType::Bishop,
            "n" | "N" => PieceType::Knight,
            _ => PieceType::Queen,
        };
        Move::new_promotion(from, to, promo_piece)
    } else {
        Move::new(from, to)
    };
    
    pos.make_move(m).is_some()
}

/// Make a move using UCI notation (e.g., "e2e4", "e7e8q")
#[wasm_bindgen]
pub fn make_move_uci(pos: &mut Position, uci: &str) -> bool {
    use types::{Move, Square, PieceType};
    
    if uci.len() < 4 {
        return false;
    }
    
    let from = match Square::from_algebraic(&uci[0..2]) {
        Some(sq) => sq,
        None => return false,
    };
    let to = match Square::from_algebraic(&uci[2..4]) {
        Some(sq) => sq,
        None => return false,
    };
    
    // Check for en passant
    if let Some((_, piece_type)) = pos.piece_on(from) {
        if piece_type == PieceType::Pawn {
            if let Some(ep_sq) = pos.en_passant_square() {
                if to == ep_sq {
                    return pos.make_move(Move::new_en_passant(from, to)).is_some();
                }
            }
        }
        
        // Check for castling
        if piece_type == PieceType::King {
            let diff = (to.file() as i8 - from.file() as i8).abs();
            if diff == 2 {
                return pos.make_move(Move::new_castling(from, to)).is_some();
            }
        }
    }
    
    let m = if uci.len() >= 5 {
        let promo_char = uci.chars().nth(4).unwrap();
        let promo_piece = match promo_char {
            'q' | 'Q' => PieceType::Queen,
            'r' | 'R' => PieceType::Rook,
            'b' | 'B' => PieceType::Bishop,
            'n' | 'N' => PieceType::Knight,
            _ => PieceType::Queen,
        };
        Move::new_promotion(from, to, promo_piece)
    } else {
        Move::new(from, to)
    };
    
    pos.make_move(m).is_some()
}

/// Check if the current side is in check
#[wasm_bindgen]
pub fn is_in_check(pos: &Position) -> bool {
    pos.is_in_check(pos.side_to_move())
}

// =============================================================================
// PERFT API - Standard chess engine correctness benchmark
// =============================================================================

/// Run perft (performance test) — count all leaf nodes at given depth
/// Used to validate move generation and compare engine speed
#[wasm_bindgen]
pub fn run_perft(pos: &Position, depth: u32) -> u64 {
    let mut pos = pos.clone();
    perft(&mut pos, depth)
}

/// Get Zobrist hash of the position (for transposition tables / repetition detection)
#[wasm_bindgen]
pub fn get_hash(pos: &Position) -> u64 {
    pos.hash()
}

// =============================================================================
// GAME-STATE DETECTION API (Task 2.1)
// =============================================================================

/// Check if the current side is in checkmate
#[wasm_bindgen]
pub fn is_checkmate(pos: &Position) -> bool {
    pos.is_checkmate()
}

/// Check if the current side is in stalemate
#[wasm_bindgen]
pub fn is_stalemate(pos: &Position) -> bool {
    pos.is_stalemate()
}

/// Check if the position has insufficient material for checkmate
#[wasm_bindgen]
pub fn is_insufficient_material(pos: &Position) -> bool {
    pos.is_insufficient_material()
}

/// Check if the 50-move rule draw has been reached
#[wasm_bindgen]
pub fn is_fifty_move_draw(pos: &Position) -> bool {
    pos.is_fifty_move_draw()
}

/// Check if the game is drawn (stalemate, insufficient material, or 50-move)
/// Note: For threefold repetition, use GameState which tracks hash history.
#[wasm_bindgen]
pub fn is_draw(pos: &Position) -> bool {
    pos.is_draw()
}

/// Get game status: "playing", "checkmate", "stalemate", or "draw"
/// Note: Does not include threefold repetition. Use GameState for full detection.
#[wasm_bindgen]
pub fn game_status(pos: &Position) -> String {
    pos.game_status()
}

// =============================================================================
// GAME STATE WITH HISTORY (Task 2.1 — Threefold Repetition)
// Wraps Position + hash history for full game-state detection
// =============================================================================

/// A full game state that tracks position + hash history for repetition detection.
#[wasm_bindgen]
pub struct GameState {
    position: Position,
    hash_history: Vec<u64>,
}

#[wasm_bindgen]
impl GameState {
    /// Create a new game from starting position
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let pos = Position::starting_position();
        let hash = pos.hash();
        Self {
            position: pos,
            hash_history: vec![hash],
        }
    }

    /// Create from FEN string
    pub fn from_fen(fen: &str) -> Result<GameState, String> {
        let pos = Position::from_fen(fen).map_err(|e| e.to_string())?;
        let hash = pos.hash();
        Ok(Self {
            position: pos,
            hash_history: vec![hash],
        })
    }

    /// Make a move in UCI notation. Returns true if legal.
    pub fn make_move_uci(&mut self, uci: &str) -> bool {
        use types::{Move, Square, PieceType};

        if uci.len() < 4 {
            return false;
        }

        let from = match Square::from_algebraic(&uci[0..2]) {
            Some(sq) => sq,
            None => return false,
        };
        let to = match Square::from_algebraic(&uci[2..4]) {
            Some(sq) => sq,
            None => return false,
        };

        // Check for en passant
        if let Some((_, piece_type)) = self.position.piece_on(from) {
            if piece_type == PieceType::Pawn {
                if let Some(ep_sq) = self.position.en_passant_square() {
                    if to == ep_sq {
                        let result = self.position.make_move(Move::new_en_passant(from, to)).is_some();
                        if result {
                            self.hash_history.push(self.position.hash());
                        }
                        return result;
                    }
                }
            }

            // Check for castling
            if piece_type == PieceType::King {
                let diff = (to.file() as i8 - from.file() as i8).abs();
                if diff == 2 {
                    let result = self.position.make_move(Move::new_castling(from, to)).is_some();
                    if result {
                        self.hash_history.push(self.position.hash());
                    }
                    return result;
                }
            }
        }

        let m = if uci.len() >= 5 {
            let promo_char = uci.chars().nth(4).unwrap();
            let promo_piece = match promo_char {
                'q' | 'Q' => PieceType::Queen,
                'r' | 'R' => PieceType::Rook,
                'b' | 'B' => PieceType::Bishop,
                'n' | 'N' => PieceType::Knight,
                _ => PieceType::Queen,
            };
            Move::new_promotion(from, to, promo_piece)
        } else {
            Move::new(from, to)
        };

        let result = self.position.make_move(m).is_some();
        if result {
            self.hash_history.push(self.position.hash());
        }
        result
    }

    /// Get the FEN of the current position
    pub fn fen(&self) -> String {
        self.position.to_fen()
    }

    /// Get the Zobrist hash
    pub fn hash(&self) -> u64 {
        self.position.hash()
    }

    /// Check if current side is in check
    pub fn is_in_check(&self) -> bool {
        self.position.is_in_check(self.position.side_to_move())
    }

    /// Check if current side is in checkmate
    pub fn is_checkmate(&self) -> bool {
        self.position.is_checkmate()
    }

    /// Check if current side is in stalemate
    pub fn is_stalemate(&self) -> bool {
        self.position.is_stalemate()
    }

    /// Check for insufficient material
    pub fn is_insufficient_material(&self) -> bool {
        self.position.is_insufficient_material()
    }

    /// Check 50-move rule
    pub fn is_fifty_move_draw(&self) -> bool {
        self.position.is_fifty_move_draw()
    }

    /// Check threefold repetition using hash history
    pub fn is_threefold_repetition(&self) -> bool {
        let current_hash = self.position.hash();
        let count = self.hash_history.iter().filter(|&&h| h == current_hash).count();
        count >= 3
    }

    /// Check if the game is drawn (any draw condition including repetition)
    pub fn is_draw(&self) -> bool {
        self.position.is_stalemate()
            || self.position.is_insufficient_material()
            || self.position.is_fifty_move_draw()
            || self.is_threefold_repetition()
    }

    /// Check if the game is over (checkmate or any draw)
    pub fn is_game_over(&self) -> bool {
        self.is_checkmate() || self.is_draw()
    }

    /// Get full game status including repetition detection
    /// Returns: "checkmate", "stalemate", "insufficient_material", "fifty_move",
    ///          "threefold_repetition", or "playing"
    pub fn status(&self) -> String {
        if self.position.is_checkmate() {
            return "checkmate".to_string();
        }
        if self.position.is_stalemate() {
            return "stalemate".to_string();
        }
        if self.position.is_insufficient_material() {
            return "insufficient_material".to_string();
        }
        if self.position.is_fifty_move_draw() {
            return "fifty_move".to_string();
        }
        if self.is_threefold_repetition() {
            return "threefold_repetition".to_string();
        }
        "playing".to_string()
    }

    /// Get legal moves as UCI strings
    pub fn legal_moves(&self) -> Vec<JsValue> {
        let mut pos = self.position.clone();
        let moves = generate_legal_moves(&mut pos);
        moves.iter()
            .map(|m| JsValue::from_str(&m.to_uci()))
            .collect()
    }

    /// Get best move via search
    pub fn best_move(&self, depth: u8) -> Option<String> {
        let mut pos = self.position.clone();
        let (best_move, _, _) = search(&mut pos, depth);
        best_move.map(|m| m.to_uci())
    }

    /// Get the number of moves played (hash history length - 1)
    pub fn move_count(&self) -> usize {
        self.hash_history.len() - 1
    }

    /// Evaluate current position
    pub fn eval(&self) -> i32 {
        evaluate(&self.position)
    }
}

// =============================================================================
// GAME STATE TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gamestate_new() {
        let gs = GameState::new();
        assert_eq!(gs.fen(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        assert_eq!(gs.move_count(), 0);
        assert!(!gs.is_checkmate());
        assert!(!gs.is_stalemate());
        assert!(!gs.is_draw());
        assert!(!gs.is_game_over());
        assert_eq!(gs.status(), "playing");
    }

    #[test]
    fn test_gamestate_make_move() {
        let mut gs = GameState::new();
        assert!(gs.make_move_uci("e2e4"));
        assert_eq!(gs.move_count(), 1);
        assert!(gs.make_move_uci("e7e5"));
        assert_eq!(gs.move_count(), 2);
    }

    #[test]
    fn test_gamestate_invalid_move() {
        let mut gs = GameState::new();
        // Moving to invalid squares should fail
        assert!(!gs.make_move_uci("e2"));
        assert_eq!(gs.move_count(), 0);
    }

    #[test]
    fn test_gamestate_checkmate() {
        let mut gs = GameState::new();
        // Fool's Mate: 1. f3 e5 2. g4 Qh4#
        assert!(gs.make_move_uci("f2f3"));
        assert!(gs.make_move_uci("e7e5"));
        assert!(gs.make_move_uci("g2g4"));
        assert!(gs.make_move_uci("d8h4"));
        assert!(gs.is_checkmate());
        assert!(gs.is_game_over());
        assert_eq!(gs.status(), "checkmate");
    }

    #[test]
    fn test_gamestate_stalemate() {
        let mut gs = GameState::from_fen("k7/8/1Q1K4/8/8/8/8/8 b - - 0 1").unwrap();
        assert!(gs.is_stalemate());
        assert!(gs.is_game_over());
        assert_eq!(gs.status(), "stalemate");
    }

    #[test]
    fn test_gamestate_insufficient_material() {
        let mut gs = GameState::from_fen("4k3/8/8/8/8/8/8/4K3 w - - 0 1").unwrap();
        assert!(gs.is_insufficient_material());
        assert!(gs.is_draw());
        assert!(gs.is_game_over());
        assert_eq!(gs.status(), "insufficient_material");
    }

    #[test]
    fn test_gamestate_fifty_move_draw() {
        let mut gs = GameState::from_fen("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 100 50").unwrap();
        assert!(gs.is_fifty_move_draw());
        assert!(gs.is_draw());
        assert!(gs.is_game_over());
        assert_eq!(gs.status(), "fifty_move");
    }

    #[test]
    fn test_gamestate_threefold_repetition() {
        let mut gs = GameState::new();
        // Play Nf3 Nf6 Ng1 Ng8 (back to start) x2 = 3 occurrences of start pos
        // Occurrence 1: initial position
        assert!(gs.make_move_uci("g1f3"));
        assert!(gs.make_move_uci("g8f6"));
        assert!(gs.make_move_uci("f3g1"));
        assert!(gs.make_move_uci("f6g8"));
        // Occurrence 2: same position as start
        assert!(!gs.is_threefold_repetition(), "Only 2 occurrences so far");

        assert!(gs.make_move_uci("g1f3"));
        assert!(gs.make_move_uci("g8f6"));
        assert!(gs.make_move_uci("f3g1"));
        assert!(gs.make_move_uci("f6g8"));
        // Occurrence 3: same position again → threefold
        assert!(gs.is_threefold_repetition(), "Should be threefold repetition now");
        assert!(gs.is_draw());
        assert!(gs.is_game_over());
        assert_eq!(gs.status(), "threefold_repetition");
    }

    #[test]
    fn test_gamestate_no_threefold_after_pawn_move() {
        let mut gs = GameState::new();
        // After 1. e4, the position can never repeat the starting position
        assert!(gs.make_move_uci("e2e4"));
        assert!(!gs.is_threefold_repetition());
    }

    #[test]
    fn test_gamestate_legal_moves() {
        // We can't test legal_moves() directly because it returns Vec<JsValue>
        // which panics outside WASM. Instead verify via the position.
        let gs = GameState::new();
        let mut pos = gs.position.clone();
        let moves = generate_legal_moves(&mut pos);
        assert_eq!(moves.len(), 20); // 16 pawn + 4 knight moves
    }

    #[test]
    fn test_gamestate_eval() {
        let gs = GameState::new();
        let score = gs.eval();
        // Starting position should be roughly equal
        assert!(score.abs() < 50, "Starting eval should be near 0: {}", score);
    }

    #[test]
    fn test_gamestate_hash_changes() {
        let mut gs = GameState::new();
        let h1 = gs.hash();
        gs.make_move_uci("e2e4");
        let h2 = gs.hash();
        assert_ne!(h1, h2, "Hash should change after move");
    }

    #[test]
    fn test_gamestate_castling() {
        let mut gs = GameState::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1").unwrap();
        assert!(gs.make_move_uci("e1g1")); // Kingside castling
        assert!(gs.is_in_check() == false);
    }

    #[test]
    fn test_gamestate_en_passant() {
        let mut gs = GameState::from_fen("4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1").unwrap();
        assert!(gs.make_move_uci("d5e6")); // EP capture
        assert!(gs.move_count() == 1);
    }

    #[test]
    fn test_gamestate_promotion() {
        let mut gs = GameState::from_fen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1").unwrap();
        assert!(gs.make_move_uci("a7a8q")); // Promote to queen
        assert!(gs.move_count() == 1);
    }
}
