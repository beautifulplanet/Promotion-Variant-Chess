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
     * Get piece character at square (for display)
     * Returns empty string if no piece
     */
    get_piece_at(file: number, rank: number): string;
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
 * Get best move for the current position
 * Returns move in UCI format (e.g., "e2e4")
 */
export function get_best_move(pos: Position, depth: number): string | undefined;

/**
 * Get best move with iterative deepening (better for time management)
 */
export function get_best_move_iterative(pos: Position, max_depth: number): string | undefined;

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
 * Check if the current side is in check
 */
export function is_in_check(pos: Position): boolean;

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
    readonly __wbg_position_free: (a: number, b: number) => void;
    readonly position_get_piece_at: (a: number, b: number, c: number) => [number, number];
    readonly position_is_white_turn: (a: number) => number;
    readonly position_piece_count: (a: number) => number;
    readonly __wbg_searchresult_free: (a: number, b: number) => void;
    readonly count_legal_moves: (a: number) => number;
    readonly engine_info: () => [number, number];
    readonly eval_position: (a: number) => number;
    readonly from_fen: (a: number, b: number) => [number, number, number];
    readonly get_best_move: (a: number, b: number) => [number, number];
    readonly get_best_move_iterative: (a: number, b: number) => [number, number];
    readonly get_legal_moves: (a: number) => [number, number];
    readonly get_pseudo_legal_moves: (a: number) => [number, number];
    readonly is_in_check: (a: number) => number;
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
    readonly init: () => void;
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
