/* @ts-self-types="./chess_engine.d.ts" */

export class CastlingRights {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CastlingRightsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_castlingrights_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get 0() {
        const ret = wasm.__wbg_get_castlingrights_0(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set 0(arg0) {
        wasm.__wbg_set_castlingrights_0(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) CastlingRights.prototype[Symbol.dispose] = CastlingRights.prototype.free;

/**
 * @enum {0 | 1}
 */
export const Color = Object.freeze({
    White: 0, "0": "White",
    Black: 1, "1": "Black",
});

export class Move {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MoveFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_move_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get 0() {
        const ret = wasm.__wbg_get_move_0(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set 0(arg0) {
        wasm.__wbg_set_move_0(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) Move.prototype[Symbol.dispose] = Move.prototype.free;

/**
 * @enum {0 | 1 | 2 | 3 | 4 | 5}
 */
export const PieceType = Object.freeze({
    Pawn: 0, "0": "Pawn",
    Knight: 1, "1": "Knight",
    Bishop: 2, "2": "Bishop",
    Rook: 3, "3": "Rook",
    Queen: 4, "4": "Queen",
    King: 5, "5": "King",
});

/**
 * Complete chess position state
 */
export class Position {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Position.prototype);
        obj.__wbg_ptr = ptr;
        PositionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PositionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_position_free(ptr, 0);
    }
    /**
     * Get piece character at square (for display)
     * Returns empty string if no piece
     * @param {number} file
     * @param {number} rank
     * @returns {string}
     */
    get_piece_at(file, rank) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.position_get_piece_at(this.__wbg_ptr, file, rank);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Check if it's white's turn
     * @returns {boolean}
     */
    is_white_turn() {
        const ret = wasm.position_is_white_turn(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Get total piece count
     * @returns {number}
     */
    piece_count() {
        const ret = wasm.position_piece_count(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) Position.prototype[Symbol.dispose] = Position.prototype.free;

/**
 * Search result with full info
 */
export class SearchResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(SearchResult.prototype);
        obj.__wbg_ptr = ptr;
        SearchResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SearchResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_searchresult_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get best_move() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.searchresult_best_move(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get depth() {
        const ret = wasm.searchresult_depth(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {bigint}
     */
    get nodes() {
        const ret = wasm.searchresult_nodes(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {number}
     */
    get score() {
        const ret = wasm.searchresult_score(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) SearchResult.prototype[Symbol.dispose] = SearchResult.prototype.free;

export class Square {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SquareFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_square_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get 0() {
        const ret = wasm.__wbg_get_castlingrights_0(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set 0(arg0) {
        wasm.__wbg_set_castlingrights_0(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) Square.prototype[Symbol.dispose] = Square.prototype.free;

/**
 * Get number of legal moves in position
 * @param {Position} pos
 * @returns {number}
 */
export function count_legal_moves(pos) {
    _assertClass(pos, Position);
    const ret = wasm.count_legal_moves(pos.__wbg_ptr);
    return ret >>> 0;
}

/**
 * Get engine info
 * @returns {string}
 */
export function engine_info() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.engine_info();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Evaluate the current position (centipawns, from side-to-move perspective)
 * @param {Position} pos
 * @returns {number}
 */
export function eval_position(pos) {
    _assertClass(pos, Position);
    const ret = wasm.eval_position(pos.__wbg_ptr);
    return ret;
}

/**
 * Create position from FEN string
 * @param {string} fen
 * @returns {Position}
 */
export function from_fen(fen) {
    const ptr0 = passStringToWasm0(fen, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.from_fen(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return Position.__wrap(ret[0]);
}

/**
 * Get best move for the current position
 * Returns move in UCI format (e.g., "e2e4")
 * @param {Position} pos
 * @param {number} depth
 * @returns {string | undefined}
 */
export function get_best_move(pos, depth) {
    _assertClass(pos, Position);
    const ret = wasm.get_best_move(pos.__wbg_ptr, depth);
    let v1;
    if (ret[0] !== 0) {
        v1 = getStringFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
}

/**
 * Get best move with iterative deepening (better for time management)
 * @param {Position} pos
 * @param {number} max_depth
 * @returns {string | undefined}
 */
export function get_best_move_iterative(pos, max_depth) {
    _assertClass(pos, Position);
    const ret = wasm.get_best_move_iterative(pos.__wbg_ptr, max_depth);
    let v1;
    if (ret[0] !== 0) {
        v1 = getStringFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
}

/**
 * Get all legal moves for a position as a JSON array of move strings (UCI format)
 * @param {Position} pos
 * @returns {any[]}
 */
export function get_legal_moves(pos) {
    _assertClass(pos, Position);
    const ret = wasm.get_legal_moves(pos.__wbg_ptr);
    var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * Get all pseudo-legal moves (may leave king in check)
 * @param {Position} pos
 * @returns {any[]}
 */
export function get_pseudo_legal_moves(pos) {
    _assertClass(pos, Position);
    const ret = wasm.get_pseudo_legal_moves(pos.__wbg_ptr);
    var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

export function init() {
    wasm.init();
}

/**
 * Check if the current side is in check
 * @param {Position} pos
 * @returns {boolean}
 */
export function is_in_check(pos) {
    _assertClass(pos, Position);
    const ret = wasm.is_in_check(pos.__wbg_ptr);
    return ret !== 0;
}

/**
 * Make a move on the position (modifies in place)
 * Returns true if move was legal
 * @param {Position} pos
 * @param {number} from_file
 * @param {number} from_rank
 * @param {number} to_file
 * @param {number} to_rank
 * @param {string | null} [promotion]
 * @returns {boolean}
 */
export function make_move(pos, from_file, from_rank, to_file, to_rank, promotion) {
    _assertClass(pos, Position);
    var ptr0 = isLikeNone(promotion) ? 0 : passStringToWasm0(promotion, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.make_move(pos.__wbg_ptr, from_file, from_rank, to_file, to_rank, ptr0, len0);
    return ret !== 0;
}

/**
 * Make a move using UCI notation (e.g., "e2e4", "e7e8q")
 * @param {Position} pos
 * @param {string} uci
 * @returns {boolean}
 */
export function make_move_uci(pos, uci) {
    _assertClass(pos, Position);
    const ptr0 = passStringToWasm0(uci, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.make_move_uci(pos.__wbg_ptr, ptr0, len0);
    return ret !== 0;
}

/**
 * Create a new chess position from starting position
 * @returns {Position}
 */
export function new_game() {
    const ret = wasm.new_game();
    return Position.__wrap(ret);
}

/**
 * Test function to verify WASM is working
 * @returns {string}
 */
export function ping() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.ping();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Run perft (performance test) — count all leaf nodes at given depth
 * Used to validate move generation and compare engine speed
 * @param {Position} pos
 * @param {number} depth
 * @returns {bigint}
 */
export function run_perft(pos, depth) {
    _assertClass(pos, Position);
    const ret = wasm.run_perft(pos.__wbg_ptr, depth);
    return BigInt.asUintN(64, ret);
}

/**
 * Search with full stats
 * @param {Position} pos
 * @param {number} depth
 * @returns {SearchResult}
 */
export function search_position(pos, depth) {
    _assertClass(pos, Position);
    const ret = wasm.search_position(pos.__wbg_ptr, depth);
    return SearchResult.__wrap(ret);
}

/**
 * Get FEN string from position
 * @param {Position} pos
 * @returns {string}
 */
export function to_fen(pos) {
    let deferred1_0;
    let deferred1_1;
    try {
        _assertClass(pos, Position);
        const ret = wasm.to_fen(pos.__wbg_ptr);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_be289d5034ed271b: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_error_7534b8e9a36f1ab4: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_new_8a6f238a6ece86ea: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_stack_0ed75d68575b0f3c: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./chess_engine_bg.js": import0,
    };
}

const CastlingRightsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_castlingrights_free(ptr >>> 0, 1));
const MoveFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_move_free(ptr >>> 0, 1));
const PositionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_position_free(ptr >>> 0, 1));
const SearchResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_searchresult_free(ptr >>> 0, 1));
const SquareFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_square_free(ptr >>> 0, 1));

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('chess_engine_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
