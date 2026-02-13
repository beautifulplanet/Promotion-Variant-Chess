/* tslint:disable */
/* eslint-disable */

export class CastlingRights {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    0: number;
}

export enum Color {
    White = 0,
    Black = 1,
}

/**
 * A full game state that tracks position + hash history for repetition detection.
 */
export class GameState {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Get best move via search
     */
    best_move(depth: number): string | undefined;
    /**
     * Evaluate current position
     */
    eval(): number;
    /**
     * Get the FEN of the current position
     */
    fen(): string;
    /**
     * Create from FEN string
     */
    static from_fen(fen: string): GameState;
    /**
     * Get the board as a JSON string representing 8x8 array
     * Each cell is null or {\"type\":\"P\",\"color\":\"w\"} etc.
     */
    get_board_json(): string;
    /**
     * Get the Zobrist hash
     */
    hash(): bigint;
    /**
     * Get move history as UCI strings (JSON array)
     */
    history(): string;
    /**
     * Check if current side is in checkmate
     */
    is_checkmate(): boolean;
    /**
     * Check if the game is drawn (any draw condition including repetition)
     */
    is_draw(): boolean;
    /**
     * Check 50-move rule
     */
    is_fifty_move_draw(): boolean;
    /**
     * Check if the game is over (checkmate or any draw)
     */
    is_game_over(): boolean;
    /**
     * Check if current side is in check
     */
    is_in_check(): boolean;
    /**
     * Check for insufficient material
     */
    is_insufficient_material(): boolean;
    /**
     * Check if current side is in stalemate
     */
    is_stalemate(): boolean;
    /**
     * Check threefold repetition using hash history
     */
    is_threefold_repetition(): boolean;
    /**
     * Get legal moves as UCI strings
     */
    legal_moves(): any[];
    /**
     * Load a position from FEN, clearing history
     */
    load_fen(fen: string): boolean;
    /**
     * Make a move in UCI notation. Returns true if legal.
     */
    make_move_uci(uci: string): boolean;
    /**
     * Get the number of moves played (hash history length - 1)
     */
    move_count(): number;
    /**
     * Create a new game from starting position
     */
    constructor();
    /**
     * Run perft from the current position at the given depth.
     * Returns the total leaf node count — the standard correctness benchmark.
     */
    perft(depth: number): bigint;
    /**
     * Run perft divide — returns JSON: [["e2e4", 8102], ["d2d4", 8338], ...]
     * Shows node count per root move (useful for debugging move generation).
     */
    perft_divide(depth: number): string;
    /**
     * Get piece at a specific square (file 0-7, rank 0-7 where rank 0 = row 7 in display)
     * Returns empty string if no piece, or "wP", "bN", etc.
     */
    piece_at(file: number, rank: number): string;
    /**
     * Reset to starting position
     */
    reset(): void;
    /**
     * Fixed-depth search returning full stats as JSON.
     */
    search_depth(depth: number): string;
    /**
     * Time-limited search. Searches deeper until time budget is exhausted.
     * Returns JSON: {"bestMove":"e2e4","score":15,"depth":6,"nodes":123456,"timeMs":987.5,"nps":125000}
     */
    search_timed(max_ms: number): string;
    /**
     * Get full game status including repetition detection
     * Returns: "checkmate", "stalemate", "insufficient_material", "fifty_move",
     *          "threefold_repetition", or "playing"
     */
    status(): string;
    /**
     * Get current turn: "w" or "b"
     */
    turn(): string;
    /**
     * Undo the last move. Returns the UCI string of the undone move, or empty string if nothing to undo.
     */
    undo(): string;
}

export class Move {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    0: number;
}

export enum PieceType {
    Pawn = 0,
    Knight = 1,
    Bishop = 2,
    Rook = 3,
    Queen = 4,
    King = 5,
}

/**
 * Complete chess position state
 */
export class Position {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Get game status string
     * Returns "checkmate", "stalemate", "draw", or "playing"
     * Note: Does not detect threefold repetition (needs history).
     */
    game_status(): string;
    /**
     * Get piece character at square (for display)
     * Returns empty string if no piece
     */
    get_piece_at(file: number, rank: number): string;
    /**
     * Check if current side is in checkmate (in check AND no legal moves)
     */
    is_checkmate(): boolean;
    /**
     * Check if position is a draw (stalemate, insufficient material, or 50-move rule)
     * Note: Threefold repetition is NOT checked here — it requires move history,
     * which is tracked by GameState in lib.rs.
     */
    is_draw(): boolean;
    /**
     * Check if the 50-move rule has been reached (halfmove clock >= 100)
     */
    is_fifty_move_draw(): boolean;
    /**
     * Check if the position has insufficient material for either side to checkmate
     * Returns true for: K vs K, K+N vs K, K+B vs K, K+B vs K+B (same color bishops)
     */
    is_insufficient_material(): boolean;
    /**
     * Check if current side is in stalemate (NOT in check AND no legal moves)
     */
    is_stalemate(): boolean;
    /**
     * Check if it's white's turn
     */
    is_white_turn(): boolean;
    /**
     * Get total piece count
     */
    piece_count(): number;
}

/**
 * Search result with full info
 */
export class SearchResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly best_move: string;
    readonly depth: number;
    readonly nodes: bigint;
    readonly score: number;
}

export class Square {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    0: number;
}

/**
 * Get number of legal moves in position
 */
export function count_legal_moves(pos: Position): number;

/**
 * Get engine info
 */
export function engine_info(): string;

/**
 * Evaluate the current position (centipawns, from side-to-move perspective)
 */
export function eval_position(pos: Position): number;

/**
 * Create position from FEN string
 */
export function from_fen(fen: string): Position;

/**
 * Get game status: "playing", "checkmate", "stalemate", or "draw"
 * Note: Does not include threefold repetition. Use GameState for full detection.
 */
export function game_status(pos: Position): string;

/**
 * Get best move for the current position
 * Returns move in UCI format (e.g., "e2e4")
 */
export function get_best_move(pos: Position, depth: number): string | undefined;

/**
 * Get best move with iterative deepening (better for time management)
 */
export function get_best_move_iterative(pos: Position, max_depth: number): string | undefined;

/**
 * Get Zobrist hash of the position (for transposition tables / repetition detection)
 */
export function get_hash(pos: Position): bigint;

/**
 * Get all legal moves for a position as a JSON array of move strings (UCI format)
 */
export function get_legal_moves(pos: Position): any[];

/**
 * Get all pseudo-legal moves (may leave king in check)
 */
export function get_pseudo_legal_moves(pos: Position): any[];

export function init(): void;

/**
 * Check if the current side is in checkmate
 */
export function is_checkmate(pos: Position): boolean;

/**
 * Check if the game is drawn (stalemate, insufficient material, or 50-move)
 * Note: For threefold repetition, use GameState which tracks hash history.
 */
export function is_draw(pos: Position): boolean;

/**
 * Check if the 50-move rule draw has been reached
 */
export function is_fifty_move_draw(pos: Position): boolean;

/**
 * Check if the current side is in check
 */
export function is_in_check(pos: Position): boolean;

/**
 * Check if the position has insufficient material for checkmate
 */
export function is_insufficient_material(pos: Position): boolean;

/**
 * Check if the current side is in stalemate
 */
export function is_stalemate(pos: Position): boolean;

/**
 * Make a move on the position (modifies in place)
 * Returns true if move was legal
 */
export function make_move(pos: Position, from_file: number, from_rank: number, to_file: number, to_rank: number, promotion?: string | null): boolean;

/**
 * Make a move using UCI notation (e.g., "e2e4", "e7e8q")
 */
export function make_move_uci(pos: Position, uci: string): boolean;

/**
 * Create a new chess position from starting position
 */
export function new_game(): Position;

/**
 * Test function to verify WASM is working
 */
export function ping(): string;

/**
 * Run perft (performance test) — count all leaf nodes at given depth
 * Used to validate move generation and compare engine speed
 */
export function run_perft(pos: Position, depth: number): bigint;

/**
 * Search with full stats
 */
export function search_position(pos: Position, depth: number): SearchResult;

/**
 * Get FEN string from position
 */
export function to_fen(pos: Position): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_gamestate_free: (a: number, b: number) => void;
    readonly __wbg_searchresult_free: (a: number, b: number) => void;
    readonly count_legal_moves: (a: number) => number;
    readonly engine_info: () => [number, number];
    readonly eval_position: (a: number) => number;
    readonly from_fen: (a: number, b: number) => [number, number, number];
    readonly game_status: (a: number) => [number, number];
    readonly gamestate_best_move: (a: number, b: number) => [number, number];
    readonly gamestate_eval: (a: number) => number;
    readonly gamestate_fen: (a: number) => [number, number];
    readonly gamestate_from_fen: (a: number, b: number) => [number, number, number];
    readonly gamestate_get_board_json: (a: number) => [number, number];
    readonly gamestate_hash: (a: number) => bigint;
    readonly gamestate_history: (a: number) => [number, number];
    readonly gamestate_is_checkmate: (a: number) => number;
    readonly gamestate_is_draw: (a: number) => number;
    readonly gamestate_is_fifty_move_draw: (a: number) => number;
    readonly gamestate_is_game_over: (a: number) => number;
    readonly gamestate_is_in_check: (a: number) => number;
    readonly gamestate_is_insufficient_material: (a: number) => number;
    readonly gamestate_is_stalemate: (a: number) => number;
    readonly gamestate_is_threefold_repetition: (a: number) => number;
    readonly gamestate_legal_moves: (a: number) => [number, number];
    readonly gamestate_load_fen: (a: number, b: number, c: number) => number;
    readonly gamestate_make_move_uci: (a: number, b: number, c: number) => number;
    readonly gamestate_move_count: (a: number) => number;
    readonly gamestate_new: () => number;
    readonly gamestate_perft: (a: number, b: number) => bigint;
    readonly gamestate_perft_divide: (a: number, b: number) => [number, number];
    readonly gamestate_piece_at: (a: number, b: number, c: number) => [number, number];
    readonly gamestate_reset: (a: number) => void;
    readonly gamestate_search_depth: (a: number, b: number) => [number, number];
    readonly gamestate_search_timed: (a: number, b: number) => [number, number];
    readonly gamestate_status: (a: number) => [number, number];
    readonly gamestate_turn: (a: number) => [number, number];
    readonly gamestate_undo: (a: number) => [number, number];
    readonly get_best_move: (a: number, b: number) => [number, number];
    readonly get_best_move_iterative: (a: number, b: number) => [number, number];
    readonly get_legal_moves: (a: number) => [number, number];
    readonly get_pseudo_legal_moves: (a: number) => [number, number];
    readonly is_checkmate: (a: number) => number;
    readonly is_draw: (a: number) => number;
    readonly is_in_check: (a: number) => number;
    readonly is_stalemate: (a: number) => number;
    readonly make_move: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly make_move_uci: (a: number, b: number, c: number) => number;
    readonly new_game: () => number;
    readonly ping: () => [number, number];
    readonly run_perft: (a: number, b: number) => bigint;
    readonly search_position: (a: number, b: number) => number;
    readonly searchresult_best_move: (a: number) => [number, number];
    readonly searchresult_depth: (a: number) => number;
    readonly searchresult_nodes: (a: number) => bigint;
    readonly searchresult_score: (a: number) => number;
    readonly to_fen: (a: number) => [number, number];
    readonly is_insufficient_material: (a: number) => number;
    readonly init: () => void;
    readonly is_fifty_move_draw: (a: number) => number;
    readonly get_hash: (a: number) => bigint;
    readonly __wbg_position_free: (a: number, b: number) => void;
    readonly position_game_status: (a: number) => [number, number];
    readonly position_get_piece_at: (a: number, b: number, c: number) => [number, number];
    readonly position_is_checkmate: (a: number) => number;
    readonly position_is_draw: (a: number) => number;
    readonly position_is_fifty_move_draw: (a: number) => number;
    readonly position_is_insufficient_material: (a: number) => number;
    readonly position_is_stalemate: (a: number) => number;
    readonly position_is_white_turn: (a: number) => number;
    readonly position_piece_count: (a: number) => number;
    readonly __wbg_castlingrights_free: (a: number, b: number) => void;
    readonly __wbg_get_castlingrights_0: (a: number) => number;
    readonly __wbg_get_move_0: (a: number) => number;
    readonly __wbg_move_free: (a: number, b: number) => void;
    readonly __wbg_set_castlingrights_0: (a: number, b: number) => void;
    readonly __wbg_set_move_0: (a: number, b: number) => void;
    readonly __wbg_square_free: (a: number, b: number) => void;
    readonly __wbg_get_square_0: (a: number) => number;
    readonly __wbg_set_square_0: (a: number, b: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
