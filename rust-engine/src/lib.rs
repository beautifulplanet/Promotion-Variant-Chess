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

use wasm_bindgen::prelude::*;
use position::Position;
use movegen::{generate_legal_moves, generate_pseudo_legal_moves};
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
    let (best_move, _, _) = search(pos, depth);
    best_move.map(|m| m.to_uci())
}

/// Get best move with iterative deepening (better for time management)
#[wasm_bindgen]
pub fn get_best_move_iterative(pos: &Position, max_depth: u8) -> Option<String> {
    let (best_move, _, _) = search_iterative(pos, max_depth);
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
    let (best_move, score, stats) = search(pos, depth);
    
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
    let moves = generate_legal_moves(pos);
    moves.iter()
        .map(|m| JsValue::from_str(&m.to_uci()))
        .collect()
}

/// Get number of legal moves in position
#[wasm_bindgen]
pub fn count_legal_moves(pos: &Position) -> usize {
    generate_legal_moves(pos).len()
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
    
    pos.make_move(m)
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
                    return pos.make_move(Move::new_en_passant(from, to));
                }
            }
        }
        
        // Check for castling
        if piece_type == PieceType::King {
            let diff = (to.file() as i8 - from.file() as i8).abs();
            if diff == 2 {
                return pos.make_move(Move::new_castling(from, to));
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
    
    pos.make_move(m)
}

/// Check if the current side is in check
#[wasm_bindgen]
pub fn is_in_check(pos: &Position) -> bool {
    pos.is_in_check(pos.side_to_move())
}
