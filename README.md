# The Chess Chronicle ♟️

**A 3D chess game where you journey through the ages of human history — from the age of dinosaurs to transcendent cosmic realms.**

🎮 **[▶ PLAY NOW — Live Demo](https://promotion-variant-chess.vercel.app)** 🎮

> **Note:** This project is in active development — screenshots are coming soon. The live demo above reflects the latest build.

---

## Features

- **20 Unique Eras** — Progress from Jurassic jungles → Ice Age glaciers → Stone Age caves → Bronze Age pyramids → Classical temples → Medieval castles → Renaissance palaces → Industrial factories → Modern cities → Digital towers → Near Future holograms → Cyberpunk megacities → Space stations → Lunar colonies → Mars terraforming → Solar System mining → Type I Dyson swarms → Type II stellar megastructures → Type II.5 interstellar travel → Type III cosmic transcendence
- **Custom Rust Chess Engine** — Bitboard-based engine compiled to WebAssembly. Alpha-beta search with transposition tables, killer moves, null-move pruning, late move reductions, and quiescence search
- **3D & 2D Rendering** — Three.js-powered 3D board with procedural skyboxes, dynamic lighting, and era-themed environments. Fallback 2D canvas renderer
- **ELO Rating System** — Earn rating points by winning games. Your ELO determines which historical era you inhabit
- **Multiplayer** — Real-time WebSocket matchmaking with Socket.io. Ranked queue, game rooms, spectating
- **Sound & Atmosphere** — Era-appropriate ambient audio and move sounds
- **Save System** — Local game state persistence with undo/redo support
- **AI Difficulty Scaling** — Engine strength adapts to your rating
- **PWA Support** — Installable on mobile devices, offline-capable with service worker caching

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | TypeScript, Three.js, Vite |
| Chess Engine | Rust → WebAssembly (wasm-bindgen) |
| Multiplayer Server | Node.js, Express, Socket.io |
| Database | Prisma ORM, SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT + bcrypt |
| Metrics | Prometheus (prom-client) |
| Testing | Vitest (frontend + server), cargo test (Rust) |
| Deployment | Vercel (frontend), Docker / Fly.io (server) |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Three.js │  │   Game    │  │  Multiplayer │  │
│  │ Renderer │◄─┤Controller ├──┤    Client    │  │
│  └──────────┘  └─────┬─────┘  └──────┬───────┘  │
│                      │               │           │
│              ┌───────▼───────┐       │           │
│              │ Engine Bridge │       │           │
│              │  (TypeScript) │       │           │
│              └───────┬───────┘       │           │
│                      │               │           │
│              ┌───────▼───────┐       │           │
│              │  Rust Engine  │       │           │
│              │    (WASM)     │       │           │
│              └───────────────┘       │           │
└──────────────────────────────────────┼───────────┘
                                       │ WebSocket
                              ┌────────▼────────┐
                              │  Chess Server   │
                              │  Express + WS   │
                              ├─────────────────┤
                              │ Matchmaker │ ELO│
                              │ Game Rooms │Auth│
                              ├─────────────────┤
                              │  Prisma + DB    │
                              └─────────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Rust + wasm-pack (only if rebuilding the engine)

### Frontend

```bash
npm install
npm run dev        # Start dev server on http://localhost:5173
```

### Multiplayer Server

```bash
cd server
npm install
cp .env.example .env
npx prisma migrate dev    # Set up SQLite database
npm run dev               # Start server on http://localhost:3000
```

### Building for Production

```bash
npm run build      # TypeScript check + Vite build → dist/
```

---

## Building the Rust Engine

The WASM binary is pre-built in `public/wasm/`. To rebuild from source:

```bash
cd rust-engine
wasm-pack build --target web --release --out-dir ../public/wasm
```

See [rust-engine/README.md](rust-engine/README.md) for details on the engine architecture, magic bitboards, and search algorithms.

---

## Testing

```bash
# Frontend tests (10 test files, 382 tests)
npm test

# Server tests (9 test files, 154 tests)
cd server && npm test

# Rust engine tests (213 tests)
cd rust-engine && cargo test
```

---

## Project Structure

```
├── src/                  # Frontend TypeScript source
│   ├── eras/             # Era-specific 3D world definitions
│   ├── gameController.ts # Core game logic (1935 lines)
│   ├── chessEngine.ts    # TypeScript chess engine (chess.js wrapper)
│   ├── rustEngine.ts     # WASM bridge to Rust engine
│   ├── stockfishEngine.ts# Stockfish.js WebWorker wrapper
│   ├── aiService.ts      # AI fallback chain orchestrator
│   ├── renderer3d.ts     # Three.js 3D rendering (4300+ lines)
│   ├── main-3d.ts        # App entry point, DOM wiring
│   └── ...
├── rust-engine/          # Rust chess engine (compiles to WASM)
│   └── src/
│       ├── lib.rs        # WASM entry points + GameState
│       ├── search.rs     # Alpha-beta with TT, NMP, LMR
│       ├── movegen.rs    # Legal move generation
│       ├── eval.rs       # Position evaluation (PST)
│       ├── magic.rs      # Magic bitboard tables
│       ├── attacks.rs    # Precomputed attack tables
│       ├── bitboard.rs   # 64-bit board representation
│       ├── position.rs   # Board state + make/unmake
│       ├── zobrist.rs    # Zobrist hashing (compile-time)
│       ├── tt.rs         # Transposition table
│       └── types.rs      # Piece, Square, Move encoding
├── server/               # Multiplayer backend
│   ├── src/
│   │   ├── index.ts      # Express + Socket.io server
│   │   ├── GameRoom.ts   # Game session management
│   │   ├── Matchmaker.ts # Ranked queue + pairing
│   │   ├── auth.ts       # JWT authentication
│   │   ├── database.ts   # Prisma service layer
│   │   └── ...
│   └── prisma/
│       └── schema.prisma # Database schema
├── tests/                # Frontend test suite
├── public/wasm/          # Pre-built WASM binary
└── index.html            # Single-page app entry
```

---

## License

[MIT](LICENSE)

---

---

# Technical Deep Dive

*Everything below is a comprehensive technical reference for the entire system — how every component works, why each architectural decision was made, and the trade-offs involved. It is written at the level of detail you would need to explain any part of this project in a senior engineering interview, or to onboard a new contributor who has never seen the codebase.*

---

## Table of Contents — Deep Dive

1. [Part I: Interview-Ready Technical Walkthrough](#part-i-interview-ready-technical-walkthrough)
   - [System Overview in 60 Seconds](#system-overview-in-60-seconds)
   - [The AI Engine Fallback Chain](#the-ai-engine-fallback-chain)
   - [Bitboard Representation](#bitboard-representation)
   - [Magic Bitboards for Sliding Pieces](#magic-bitboards-for-sliding-pieces)
   - [Move Generation](#move-generation)
   - [Search Algorithm](#search-algorithm)
   - [Position Evaluation](#position-evaluation)
   - [Zobrist Hashing & Transposition Tables](#zobrist-hashing--transposition-tables)
   - [WASM Bridge Architecture](#wasm-bridge-architecture)
   - [Rendering Pipeline](#rendering-pipeline)
   - [Multiplayer Architecture](#multiplayer-architecture)

2. [Part II: Complete Engine Manual](#part-ii-complete-engine-manual)
   - [Chapter 1: Board Representation from First Principles](#chapter-1-board-representation-from-first-principles)
   - [Chapter 2: Types and Move Encoding](#chapter-2-types-and-move-encoding)
   - [Chapter 3: The Position Struct](#chapter-3-the-position-struct)
   - [Chapter 4: Attack Tables – Knights, Kings, and Pawns](#chapter-4-attack-tables--knights-kings-and-pawns)
   - [Chapter 5: Magic Bitboards – The Complete Theory](#chapter-5-magic-bitboards--the-complete-theory)
   - [Chapter 6: Move Generation – Pseudolegal to Legal](#chapter-6-move-generation--pseudolegal-to-legal)
   - [Chapter 7: Position Evaluation – Material and Piece-Square Tables](#chapter-7-position-evaluation--material-and-piece-square-tables)
   - [Chapter 8: Zobrist Hashing – Incremental Position Fingerprinting](#chapter-8-zobrist-hashing--incremental-position-fingerprinting)
   - [Chapter 9: Transposition Table – Caching Search Results](#chapter-9-transposition-table--caching-search-results)
   - [Chapter 10: Search – Minimax, Alpha-Beta, and Beyond](#chapter-10-search--minimax-alpha-beta-and-beyond)
   - [Chapter 11: WASM Compilation and the TypeScript Bridge](#chapter-11-wasm-compilation-and-the-typescript-bridge)
   - [Chapter 12: GameState – Full Game Lifecycle in Rust](#chapter-12-gamestate--full-game-lifecycle-in-rust)
   - [Chapter 13: Testing and Correctness – Perft](#chapter-13-testing-and-correctness--perft)

3. [Part III: System Design FAQ](#part-iii-system-design-faq)
   - [Q1: How would you scale to 10,000 concurrent players?](#q1-how-would-you-scale-to-10000-concurrent-players)
   - [Q2: How do you detect and handle cheating?](#q2-how-do-you-detect-and-handle-cheating)
   - [Q3: Why Three.js instead of native mobile rendering?](#q3-why-threejs-instead-of-native-mobile-rendering)
   - [Q4: Why do you have multiple AI engines?](#q4-why-do-you-have-multiple-ai-engines)
   - [Q5: Why vanilla TypeScript instead of React/Vue/Svelte?](#q5-why-vanilla-typescript-instead-of-reactvuesvelte)
   - [Q6: How does the WASM binary get loaded in the browser?](#q6-how-does-the-wasm-binary-get-loaded-in-the-browser)
   - [Q7: What are the performance characteristics on mobile?](#q7-what-are-the-performance-characteristics-on-mobile)
   - [Q8: How does the ELO system work?](#q8-how-does-the-elo-system-work)
   - [Q9: What would you do differently if you started over?](#q9-what-would-you-do-differently-if-you-started-over)
   - [Q10: How do you test a 3D game?](#q10-how-do-you-test-a-3d-game)

---

# Part I: Interview-Ready Technical Walkthrough

*Short, precise answers to the questions an interviewer would actually ask. Each section is structured as: what it is, how it works, why I chose it, what the trade-offs are.*

---

## System Overview in 60 Seconds

The Chess Chronicle is a full-stack chess application with three independently deployable components:

1. **Frontend** (TypeScript + Three.js + Vite) — A single-page application that renders a 3D chessboard using WebGL. It manages game state, handles user input (mouse and touch), renders 20 procedural era environments, and communicates with the chess engine and multiplayer server.

2. **Rust Chess Engine** (compiled to WASM) — A bitboard-based chess engine that runs entirely in the browser via WebAssembly. It provides legal move generation, position evaluation, and alpha-beta search with iterative deepening. It is 10–100× faster than the JavaScript fallback.

3. **Multiplayer Server** (Node.js + Express + Socket.io + Prisma) — Handles real-time matchmaking, game rooms, spectating, ELO tracking, JWT authentication, and persistent storage via Prisma (SQLite in dev, PostgreSQL in production). Communicates with clients over WebSocket.

The key architectural insight: the engine runs **in the browser**, not on the server. This means zero latency for single-player games, no server costs for AI computation, and the server only handles multiplayer coordination.

---

## The AI Engine Fallback Chain

A common interview question is: "Why do you have 4 AI engines?" The answer is that this is a **deliberate tiered fallback system**, not feature creep.

```
┌─────────────────────────────────────────────────────┐
│                  AI Move Request                     │
│                                                      │
│  1. Rust WASM Engine (fastest, ~1M+ NPS)            │
│     └─ if unavailable (WASM fails to load) ──────┐  │
│                                                   │  │
│  2. Stockfish.js Web Worker (strongest, ~20 ELO   │  │
│     skill levels)                                 │  │
│     └─ if unavailable (worker fails) ──────────┐  │  │
│                                                │  │  │
│  3. TypeScript Engine (always available,       │  │  │
│     chess.js + custom eval + minimax)          │  │  │
│                                                │  │  │
│  4. Learning AI (experimental RL, not in       │  │  │
│     production chain)                          │  │  │
└────────────────────────────────────────────────┘  │
```

**Why not just pick one?**

- **Rust WASM** is the fastest engine, but WASM can fail to load on older browsers, restricted CSP policies, or if the `.wasm` file fails to fetch. When it works, it's the best option — 10–100× faster than JavaScript.
- **Stockfish.js** is the strongest engine (2800+ ELO at skill 20) and provides granular difficulty via skill levels 0–20. It runs in a Web Worker so it doesn't block the UI. But Web Workers can fail (CSP restrictions, Safari bugs, SharedArrayBuffer requirements).
- **TypeScript engine** uses chess.js for move generation and a custom minimax with alpha-beta pruning. It's slower (~10K NPS) but it's pure JavaScript — it always works, everywhere, with zero dependencies on WASM or Workers.
- **Learning AI** is an experimental reinforcement learning agent that improves by playing itself. It's not in the production fallback chain — it's a research feature accessible via a training button.

**The code that implements this** is in `aiService.ts`. The `AIService` class tries Rust first, falls back to the Web Worker, and finally falls back to synchronous chess.js evaluation:

```typescript
// Simplified fallback logic from aiService.ts
if (this.rustEngineReady) {
  move = rustEngine.getBestMove(fen, depth);
} else if (this.workerReady) {
  move = await this.requestFromWorker(board, turn, elo);
} else {
  move = this.fallbackEngine.getBestMove(board, turn, depth);
}
```

**Trade-off:** More code to maintain, but the user never sees a broken AI. The game always works.

---

## Bitboard Representation

**What:** A bitboard represents the 64 squares of a chess board as a single 64-bit unsigned integer. One bit per square. Bit 0 = a1, bit 63 = h8.

**Why:** Bitwise operations on 64-bit integers map directly to CPU instructions (AND, OR, XOR, shift, popcount, trailing zeros). This means operations like "find all squares attacked by a knight on e4" reduce to a single table lookup returning a 64-bit mask, instead of looping through 8 possible destinations.

**How the position is stored:**

```rust
pub struct Position {
    // 12 bitboards: one per (color, piece_type) combination
    pieces: [[Bitboard; 6]; 2],  // pieces[White][Pawn], pieces[Black][Queen], etc.

    // 3 cached occupancy bitboards
    occupied_by_color: [Bitboard; 2],  // All white pieces, all black pieces
    occupied_all: Bitboard,             // All pieces on the board
    // ...
}
```

**Example:** To find all squares where White has a pawn:

```rust
let white_pawns: Bitboard = self.pieces[Color::White as usize][PieceType::Pawn as usize];
// Result: 0x000000000000FF00 (all bits set in rank 2 for starting position)
```

To find all empty squares: `!self.occupied_all`.

To find all squares where White can potentially move (not blocked by own pieces): `!self.occupied_by_color[Color::White as usize]`.

**Common operations and their costs:**

| Operation | Bitboard | Array-based |
|-----------|----------|-------------|
| "Is square X occupied?" | 1 AND, 1 compare | 1 array access |
| "Count pieces" | 1 `popcount` instruction | Loop over 64 squares |
| "All knight moves from e4" | 1 table lookup | 8 bounds checks |
| "All rook moves from e4" | 1 multiply + shift + lookup | Ray-casting loop |
| "Intersect two sets" | 1 AND | Loop + set intersection |

**Directional shifts:** Moving all pieces one rank north is just `bitboard << 8`. One file east is `(bitboard << 1) & NOT_FILE_A` (the mask prevents wrapping from the h-file to the a-file of the next rank).

---

## Magic Bitboards for Sliding Pieces

**The problem:** Rooks and bishops are "sliding" pieces — they move in a straight line until they hit another piece. Unlike knights (fixed pattern), their attack set depends on which other pieces are in the way (the "blockers"). A rook on e4 on an empty board attacks 14 squares. But if there's a piece on e6, the rook can't see e7 or e8.

**The naive solution:** Cast rays in each direction, checking for blockers at each square. This is O(7) per direction, and there are 4 directions per rook / 4 per bishop. Acceptable for a simple engine, but we can do O(1).

**The magic bitboard solution:** Precompute every possible attack pattern for every possible blocker configuration, and store them in a lookup table. At runtime, hash the current blocker configuration to an index and do a single table lookup.

**How it works, step by step:**

1. **Mask:** For each square, compute the "relevant occupancy mask" — the squares along the piece's rays, **excluding edges** (because a piece on the edge doesn't block further movement — there's nowhere further to go). For a rook on e4, the mask includes e5, e6, e7 (not e8), e3, e2 (not e1), f4, g4 (not h4), d4, c4, b4 (not a4).

2. **Enumerate blockers:** For a mask with N bits set, there are 2^N possible blocker configurations. For a rook in the center, N is typically 10–12 bits, giving 1024–4096 configurations. The **Carry-Rippler trick** enumerates all subsets of the mask:
   ```rust
   blockers = (blockers.wrapping_sub(mask)) & mask;
   ```

3. **Precompute attacks:** For each blocker configuration, compute the actual attack bitboard using slow ray-casting. Store it in a table.

4. **Magic number:** Find a 64-bit "magic number" M such that `(blockers * M) >> (64 - N)` produces a unique index for every distinct attack pattern. This is a **perfect hash function** — no two different attack patterns map to the same index. The magic numbers were found empirically through brute-force search.

5. **Runtime lookup:**
   ```rust
   fn rook_attacks(sq: Square, occupied: Bitboard) -> Bitboard {
       let mask = ROOK_MASKS[sq];           // Step 1: mask
       let blockers = occupied & mask;       // Step 2: relevant blockers only
       let index = (blockers * MAGIC) >> shift;  // Step 3: hash to index
       ROOK_TABLE[sq][index]                 // Step 4: O(1) lookup
   }
   ```

**Memory usage:** Each square has a table of 2^N entries. Total for all 64 squares:
- Rooks: ~800 KB
- Bishops: ~40 KB
- Total: ~840 KB of precomputed tables

**Initialization cost:** ~2ms on a modern CPU. Done once at startup via `OnceLock` (Rust's lazy static).

---

## Move Generation

Legal moves are generated in two phases:

**Phase 1: Pseudo-legal moves.** Generate all moves that obey piece movement rules, ignoring whether they leave the king in check. This is fast because it's purely mechanical:

- **Pawns:** Single push (shift by 8), double push from rank 2 (shift by 16, checking that rank 3 is empty), diagonal captures (shift + file mask), en passant, and promotions (4 moves per promotion square: Q, R, B, N).
- **Knights:** Table lookup `KNIGHT_ATTACKS[sq]`, masked with `!friendly_pieces`.
- **Bishops/Rooks/Queens:** Magic bitboard lookup, masked with `!friendly_pieces`.
- **King:** Table lookup `KING_ATTACKS[sq]`, plus castling (requires checking emptiness of intervening squares, king not in check, passing through check squares, and castling rights).

**Phase 2: Legality filter.** For each pseudo-legal move, make the move, check if the king is in check, and unmake it if illegal:

```rust
pub fn generate_legal_moves(pos: &mut Position) -> MoveList {
    let pseudo_legal = generate_pseudo_legal_moves(pos);
    let mut legal = MoveList::new();
    for m in pseudo_legal.iter() {
        if let Some(undo) = pos.make_move(*m) {
            legal.push(*m);
            pos.unmake_move(*m, &undo);
        }
    }
    legal
}
```

`make_move` returns `None` if the move leaves the king in check, effectively filtering illegal moves.

**Performance:** ~5 million legal positions per second in WASM on a modern laptop. The `MoveList` is stack-allocated (fixed-size array of 256 `Move` structs) to avoid heap allocation.

**Correctness validation:** Perft (performance test) counts all leaf nodes at a given depth. The engine matches the standard values exactly:

| Depth | Nodes | Expected |
|-------|-------|----------|
| 1 | 20 | 20 |
| 2 | 400 | 400 |
| 3 | 8,902 | 8,902 |
| 4 | 197,281 | 197,281 |
| 5 | 4,865,609 | 4,865,609 |

Perft also validates against the "Kiwipete" position (a complex position with many special moves: castling, en passant, promotions, pins, discovered checks).

---

## Search Algorithm

The search finds the best move by exploring the game tree. The core is **minimax with alpha-beta pruning**, enhanced with several standard optimizations:

### Minimax

Minimax assumes both players play optimally. White tries to maximize the score, Black tries to minimize it. The **negamax** formulation is used: `score = -search(opponent)`, which avoids separate min/max functions.

### Alpha-Beta Pruning

Alpha-beta maintains a window [α, β] of scores that matter. If a move scores ≥ β (opponent won't allow this line), we "cut off" — stop searching siblings. This reduces the effective branching factor from ~35 to ~6 in well-ordered trees.

### Iterative Deepening

Search depth 1, then depth 2, then depth 3, etc. This sounds wasteful but:
1. Each depth takes ~6× longer than the previous, so the total overhead is only ~20%.
2. The depth N-1 search provides move ordering information for depth N (the best move found at the previous depth is searched first).
3. Enables time management: if we're running low on time, return the best move from the last completed depth.

### Transposition Table (TT)

Positions can be reached via different move orders (transpositions). Search results are cached keyed by Zobrist hash. When we encounter a position already searched at sufficient depth, we reuse the result. The TT also provides the best move from the previous search for move ordering.

### Null Move Pruning (NMP)

If we skip our turn (make a "null move") and the opponent still can't beat beta, the position is so good we can prune the subtree. Reduction: 2 plies. Disabled when:
- In check (illegal to skip a move while in check)
- At the root
- No non-pawn material (zugzwang risk in king+pawn endgames)

### Late Move Reductions (LMR)

After searching the first few moves at full depth, search later moves at reduced depth (1 ply less). If a reduced-depth search finds a promising score, re-search at full depth. This is based on the observation that in a well-ordered move list, later moves are unlikely to be the best.

Conditions to **not** reduce: captures, promotions, killer moves, moves that give check, or when in check.

### Killer Move Heuristic

Store the last 2 "quiet" moves (non-captures) that caused a beta cutoff at each ply. These are likely to be good moves in sibling positions and are searched before other quiet moves.

### Move Ordering

The order moves are searched dramatically affects pruning efficiency:

1. **TT move** (best move from previous search) — score +100,000
2. **Captures** (ordered by MVV-LVA: Most Valuable Victim - Least Valuable Attacker) — score +10,000 + victim value
3. **Promotions** — score +9,000
4. **Killer moves** — score +5,000
5. **Quiet moves** — score 0

### Quiescence Search

At leaf nodes (depth 0), instead of returning the static evaluation, all capture sequences are searched to avoid the "horizon effect" (e.g., evaluating a position as equal when a queen is about to be captured). Stand-pat: if the static eval is already ≥ beta, cut immediately; if it's > alpha, raise alpha.

---

## Position Evaluation

The evaluation function returns a score in **centipawns** (100 = 1 pawn advantage). Positive = better for the side to move.

**Components:**

1. **Material Count:** Pawn = 100, Knight = 320, Bishop = 330, Rook = 500, Queen = 900. The bishop is slightly more valuable than the knight (historically debated, but most engines agree in open positions).

2. **Piece-Square Tables (PST):** A 64-element array per piece type that gives bonuses for good positions. Examples:
   - Pawns: +30 on rank 6 (about to promote), +25 in the center (d4/e4/d5/e5), -20 for premature flank advances
   - Knights: +20 in the center, -50 on the rim ("a knight on the rim is dim")
   - Rooks: +10 on the 7th rank (attacking opponent's pawns)
   - King (middlegame): +30 for castled positions (g1/c1), -50 in the center (danger)
   - King (endgame): +40 in the center (active king is crucial in endgames)

3. **Bishop Pair Bonus:** +30 centipawns for having two bishops (they complement each other in open positions).

4. **Game Phase Detection:** Total material count determines whether to use middlegame or endgame king PST. Below 2000 centipawns of non-king material = endgame.

**Why not more evaluation terms?** This evaluation is deliberately simple (material + PST + bishop pair). More complex engines add: passed pawn evaluation, king safety, pawn structure (doubled/isolated/backward pawns), rook on open files, outposts, mobility, etc. The engine instead relies on search depth to compensate — a deeper search with a simple evaluation often beats a shallow search with a complex evaluation. The Rust WASM speed gives us the depth advantage.

---

## Zobrist Hashing & Transposition Tables

### Zobrist Hashing

A **Zobrist hash** is a 64-bit fingerprint for a chess position. It uses XOR to combine random keys:

```
hash = 0
for each (piece, square) on the board:
    hash ^= PIECE_KEY[piece][square]
if black to move:
    hash ^= SIDE_KEY
hash ^= CASTLING_KEY[castling_rights]
if en_passant_file exists:
    hash ^= EP_KEY[file]
```

**The key property:** XOR is its own inverse. So when making a move, we don't recompute from scratch — we incrementally update:

```
hash ^= piece_key(us, piece, from)    // Remove piece from origin
hash ^= piece_key(us, piece, to)      // Place piece at destination
hash ^= piece_key(them, captured, to) // Remove captured piece (if any)
hash ^= side_to_move_key()            // Switch sides
// ... update castling and EP keys similarly
```

This makes hashing O(1) per move, not O(number of pieces).

**Key generation:** All 781 random keys (768 piece-square + 1 side + 4 castling + 8 en passant) are generated at **compile time** using a `const fn` xorshift64 PRNG. This means zero runtime initialization cost — the keys are baked into the binary.

### Transposition Table

The TT is a fixed-size hash table (2^18 = 262,144 entries, ~5 MB for WASM). Each entry stores:
- Full 64-bit hash (for collision detection)
- Search depth
- Score (adjusted for mate distance)
- Flag: Exact, LowerBound (beta cutoff), or UpperBound (failed low)
- Best move (for move ordering)

**Replacement policy:** Depth-preferred — an existing entry is only overwritten if the new entry was searched at equal or greater depth. This keeps high-quality deep search results in the table.

**Mate score adjustment:** Mate scores are relative to the root (e.g., "mate in 5 from root"). When storing in the TT, the score is adjusted to be relative to the node (`score + ply`). When retrieving, the adjustment is reversed (`score - ply`). This prevents incorrectly reporting a "mate in 3" from a different part of the tree as "mate in 3" from the current node.

---

## WASM Bridge Architecture

The Rust engine is compiled to WebAssembly using `wasm-pack` with the `--target web` flag, producing:
- `chess_engine_bg.wasm` — The binary (~170 KB gzipped)
- `chess_engine.js` — JavaScript glue code (handles memory management, type conversions)

The TypeScript bridge (`rustEngine.ts`) loads the WASM module at runtime:

```typescript
// 1. Fetch the JS glue code
const jsResponse = await fetch(`${base}wasm/chess_engine.js`);
const jsCode = await jsResponse.text();

// 2. Create a blob URL and import it dynamically
const blob = new Blob([jsCode], { type: 'application/javascript' });
const blobUrl = URL.createObjectURL(blob);
const wasm = await import(blobUrl);

// 3. Initialize the WASM module (loads and compiles the .wasm binary)
await wasm.default(`${base}wasm/chess_engine_bg.wasm`);
```

**Why blob URL?** Vite doesn't allow dynamic imports from `/public` at dev time. The blob URL workaround lets us load the WASM glue code regardless of the build system.

**Memory management:** WASM `Position` objects are allocated in linear memory. After each use, `pos.free()` is called to release them:

```typescript
export function getLegalMoves(fen: string): string[] {
    const pos = wasmModule.from_fen(fen);
    const moves = wasmModule.get_legal_moves(pos);
    pos.free();  // CRITICAL: prevents WASM memory leak
    return moves;
}
```

**Error handling:** Every function in the bridge wraps calls in try/catch and returns graceful defaults (empty array, null, 0). The engine is optional — the game works without it.

---

## Rendering Pipeline

The 3D renderer uses Three.js with the following pipeline:

1. **Scene Setup:** WebGLRenderer with shadow mapping, PerspectiveCamera with orbital controls, AmbientLight + DirectionalLight.

2. **Era System:** Each of the 20 eras defines: skybox (procedurally generated from gradient colors and cloud patterns), ground material (texture + color), ambient light color/intensity, directional light position, background elements (trees, buildings, structures), and particle effects.

3. **Board Rendering:** 64 square meshes (BoxGeometry) with alternating materials. Pieces are 3D geometries with era-appropriate materials. Selected squares get emissive highlighting. Legal move squares get semi-transparent green overlays.

4. **Camera Controls:** Orbit controls with mouse/touch input. Left-drag rotates, scroll/pinch zooms. The camera target is the center of the board.

5. **Responsive Resize:** `doResize()` recalculates canvas dimensions based on viewport, handles device pixel ratio (DPR) scaling, and updates the renderer/camera/overlay. Debounced to 150ms to prevent layout thrashing.

6. **Mobile Optimizations:** Auto-detected via `navigator.maxTouchPoints`. On mobile: antialiasing disabled, DPR capped at 2.0, shadows disabled, tone mapping exposure reduced, power preference set to `default` instead of `high-performance`.

---

## Multiplayer Architecture

The multiplayer system uses Socket.io (WebSocket with HTTP long-polling fallback):

1. **Authentication:** JWT tokens issued on login/register. Passed in socket handshake `auth` header. Verified on every connection.

2. **Matchmaking:** Players join a ranked queue. The `Matchmaker` pairs players with similar ELO (expanding the range over time if no match is found). Each match creates a `GameRoom`.

3. **Game Rooms:** A `GameRoom` manages one active game: validates moves server-side using chess.js, broadcasts state to both players, handles disconnect/reconnect, tracks thinking time, and determines game results.

4. **State Management:** Game rooms are stored in-memory (`Map<string, GameRoom>`). This is intentional for the current scale — see the [scaling FAQ](#q1-how-would-you-scale-to-10000-concurrent-players) for the distributed approach.

5. **ELO Updates:** On game completion, both players' ELO ratings are updated using the standard ELO formula and persisted to the database via Prisma.

---

---

# Part II: Complete Engine Manual

*A comprehensive guide to building a chess engine from scratch, using this project's Rust engine as the running example. Every data structure, algorithm, and design decision is explained in full.*

---

## Chapter 1: Board Representation from First Principles

### The Fundamental Problem

A chess engine needs to answer one question millions of times per second: "Given this position, what are all the legal moves, and which one is best?" The choice of board representation determines how fast we can answer this question.

### Option 1: 8×8 Array (Rejected)

The obvious approach — a 2D array of 64 cells, each containing a piece or null:

```
board[8][8] = {
  [R, N, B, Q, K, B, N, R],
  [P, P, P, P, P, P, P, P],
  [_, _, _, _, _, _, _, _],
  ...
}
```

**Problem:** To find all squares attacked by a rook, you loop through up to 7 squares in each of 4 directions, checking bounds and occupancy at each step. This is O(28) per rook, and you might have 2 rooks. For knights, you check 8 possible destinations with bounds checking. It works, but it's slow — lots of branching and memory accesses.

### Option 2: Bitboards (This Engine's Choice)

A `Bitboard` is a `u64` where each bit represents one square:

```
Bit mapping:
  a1=0  b1=1  c1=2  d1=3  e1=4  f1=5  g1=6  h1=7
  a2=8  b2=9  c2=10 d2=11 e2=12 f2=13 g2=14 h2=15
  ...
  a8=56 b8=57 c8=58 d8=59 e8=60 f8=61 g8=62 h8=63
```

**Example — White pawns in the starting position:**

```
Binary:     0000000000000000000000000000000000000000000000001111111100000000
Hex:        0x000000000000FF00
Board view:
  8  . . . . . . . .
  7  . . . . . . . .
  6  . . . . . . . .
  5  . . . . . . . .
  4  . . . . . . . .
  3  . . . . . . . .
  2  X X X X X X X X  ← bits 8-15 are set
  1  . . . . . . . .
```

**Why this is fast:** Bit operations on 64-bit integers map to single CPU instructions:

| Chess Operation | Bitboard Operation | CPU Instruction |
|---|---|---|
| "Is there a piece on e4?" | `board & (1 << 28)` | AND |
| "All squares attacked by White AND Black" | `white_attacks & black_attacks` | AND |
| "All empty squares" | `!occupied` | NOT |
| "Move all white pawns north" | `white_pawns << 8` | SHIFT |
| "How many pieces are there?" | `board.count_ones()` | POPCNT |
| "Where is the first (lowest) piece?" | `board.trailing_zeros()` | TZCNT |
| "Remove the first piece" | `board &= board - 1` | AND + SUB |

### Implementation: `bitboard.rs`

The `Bitboard` struct wraps a `u64` and provides chess-specific operations:

```rust
#[derive(Clone, Copy, PartialEq, Eq, Default)]
pub struct Bitboard(pub u64);
```

**Predefined constants:**

```rust
pub const RANK_1: Bitboard = Bitboard(0x0000_0000_0000_00FF);  // Row 1
pub const RANK_2: Bitboard = Bitboard(0x0000_0000_0000_FF00);  // Row 2 (White pawn start)
pub const FILE_A: Bitboard = Bitboard(0x0101_0101_0101_0101);  // Column A
pub const NOT_FILE_A: Bitboard = Bitboard(!FILE_A.0);           // Everything except column A
pub const NOT_FILE_H: Bitboard = Bitboard(!FILE_H.0);           // Everything except column H
```

**Directional shifts:** Moving pieces in a direction is a bitwise shift, but the file edges must be masked off to prevent wrap-around:

```rust
// Moving east (right): shift left by 1, but mask off file A
// (a piece on h1 shifted left would appear on a2 — wrong!)
pub const fn east(self) -> Bitboard {
    Bitboard((self.0 << 1) & NOT_FILE_A.0)
}

// Moving north: shift left by 8 (next rank)
pub const fn north(self) -> Bitboard {
    Bitboard(self.0 << 8)
}

// Diagonal: combine rank + file shift
pub const fn north_east(self) -> Bitboard {
    Bitboard((self.0 << 9) & NOT_FILE_A.0)
}
```

**Iteration — the `pop_lsb` trick:** To loop over all set bits (e.g., to process each pawn), each bit is popped using Kernighan's algorithm:

```rust
pub fn pop_lsb(&mut self) -> Option<Square> {
    if self.0 == 0 { return None; }
    let sq = Square(self.0.trailing_zeros() as u8);  // Find lowest set bit
    self.0 &= self.0 - 1;  // Clear that bit
    Some(sq)
}
```

This pops bits one at a time in ascending order. Each iteration is O(1) and branch-free.

`Iterator` is also implemented for `Bitboard`, so idiomatic Rust works:

```rust
let attacks = knight_attacks(e4);
for square in attacks {
    // process each attacked square
}
```

---

## Chapter 2: Types and Move Encoding

### Piece Types and Colors

Simple enums with `repr(u8)` for zero-cost indexing into arrays:

```rust
#[repr(u8)]
pub enum PieceType { Pawn = 0, Knight = 1, Bishop = 2, Rook = 3, Queen = 4, King = 5 }

#[repr(u8)]
pub enum Color { White = 0, Black = 1 }
```

`Color::flip()` switches sides: `White → Black, Black → White`.

### Square Representation

A `Square` is a `u8` (0–63):

```rust
pub struct Square(pub u8);

impl Square {
    pub const fn from_file_rank(file: u8, rank: u8) -> Self {
        Square(rank * 8 + file)
    }
    pub const fn file(self) -> u8 { self.0 % 8 }
    pub const fn rank(self) -> u8 { self.0 / 8 }
}
```

Named constants for common squares: `Square::E1 = Square(4)`, `Square::G1 = Square(6)`, etc. These are used in castling logic.

### Move Encoding

A `Move` is packed into a **16-bit integer** — small enough to store millions of them in a search tree without excessive memory:

```
Bits 0-5:   From square (0-63)       6 bits
Bits 6-11:  To square (0-63)         6 bits
Bits 12-13: Promotion piece          2 bits (0=N, 1=B, 2=R, 3=Q)
Bits 14-15: Move flags               2 bits (0=normal, 1=promotion, 2=EP, 3=castling)
```

```rust
pub struct Move(pub u16);

impl Move {
    pub fn new(from: Square, to: Square) -> Self {
        Move((from.0 as u16) | ((to.0 as u16) << 6))
    }
    pub fn new_promotion(from: Square, to: Square, promo: PieceType) -> Self {
        Move(from.0 as u16 | (to.0 as u16 << 6) | (promo_bits << 12) | (FLAG_PROMOTION << 14))
    }
    pub fn from(self) -> Square { Square((self.0 & 0x003F) as u8) }
    pub fn to(self) -> Square { Square(((self.0 & 0x0FC0) >> 6) as u8) }
    pub fn is_promotion(self) -> bool { self.flags() == 1 }
    pub fn is_en_passant(self) -> bool { self.flags() == 2 }
    pub fn is_castling(self) -> bool { self.flags() == 3 }
}
```

**Why 16 bits instead of a struct?** Memory. During search, thousands of moves are generated and stored. A `Move` struct with separate fields would be 8+ bytes. The 16-bit encoding is 2 bytes. The move list (256 moves max) is 512 bytes — fits in L1 cache.

**UCI conversion:** The engine communicates in UCI format (`e2e4`, `e7e8q`). The `to_uci()` method converts the packed format to the string format the TypeScript bridge expects.

---

## Chapter 3: The Position Struct

The `Position` struct is the complete chess board state — everything needed to generate moves and evaluate a position:

```rust
pub struct Position {
    pieces: [[Bitboard; 6]; 2],       // 12 piece bitboards
    occupied_by_color: [Bitboard; 2], // White occupancy, Black occupancy
    occupied_all: Bitboard,            // Combined occupancy (cached)

    side_to_move: Color,
    castling: CastlingRights,          // 4-bit flags: KQkq
    en_passant: Option<Square>,        // EP target square
    halfmove_clock: u8,                // 50-move rule counter
    fullmove_number: u16,

    hash: u64,                         // Zobrist hash (incrementally updated)
}
```

### Castling Rights

Stored as a 4-bit mask using `CastlingRights(u8)`:

```
Bit 0: White Kingside  (K)
Bit 1: White Queenside (Q)
Bit 2: Black Kingside  (k)
Bit 3: Black Queenside (q)
```

When a rook or king moves, the relevant bit(s) are cleared. When a rook is captured, the relevant bit is cleared. This is done via `rights.remove(bit)` in `make_move`.

### Make/Unmake Move Pattern

The `make_move` / `unmake_move` pair is the most critical code path — it's called millions of times during search.

**`make_move(m: Move) -> Option<UndoInfo>`:**

1. Save undo info: captured piece, old castling rights, old EP square, old halfmove clock, old hash.
2. Handle the move by type:
   - **Normal:** Remove piece from origin, add to destination. If capture, remove enemy piece first.
   - **En passant:** Remove enemy pawn from the square behind the EP target.
   - **Castling:** Move king + also move the rook from its corner to the crossing square.
   - **Promotion:** Remove pawn from origin, add promoted piece to destination.
3. Update castling rights (if king or rook moved or was captured).
4. Set en passant square (if pawn moved two squares).
5. Increment halfmove clock (reset on pawn move or capture).
6. Switch side to move.
7. Update Zobrist hash incrementally (XOR in/out changed elements).
8. **Legality check:** If the king is in check after the move, the move is illegal — return `None`.

**`unmake_move(m: Move, undo: &UndoInfo)`:**

Reverse everything. Restore the saved state. No hash computation needed — it was saved in `UndoInfo`.

**Why `make_move` returns `Option`:** This is how illegal moves are filtered. The move generator produces pseudo-legal moves (might leave king in check). `make_move` applies the move, checks legality, and returns `None` if illegal. This is simpler (and not slower) than computing pinned pieces and check evasions in the move generator.

---

## Chapter 4: Attack Tables – Knights, Kings, and Pawns

Knights, kings, and pawns have **fixed attack patterns** — they don't depend on which other pieces are on the board. Lookup tables are precomputed at compile time (`const` evaluation in Rust).

### Knight Attack Table

A knight on e4 always attacks the same 8 squares (d6, f6, c5, g5, c3, g3, d2, f2), regardless of what other pieces are on the board. All 64 attack bitboards are precomputed:

```rust
pub static KNIGHT_ATTACKS: [Bitboard; 64] = {
    let mut attacks = [Bitboard::EMPTY; 64];
    let mut sq = 0u8;
    while sq < 64 {
        let bb = 1u64 << sq;
        let mut attack = 0u64;
        let file = sq % 8;
        let rank = sq / 8;

        // 8 possible L-shaped moves, with bounds checking
        if rank < 6 && file > 0 { attack |= bb << 15; }  // North 2, West 1
        if rank < 6 && file < 7 { attack |= bb << 17; }  // North 2, East 1
        // ... (all 8 directions)

        attacks[sq as usize] = Bitboard(attack);
        sq += 1;
    }
    attacks
};
```

**Compile-time evaluation:** The `{...}` block is executed by the Rust compiler during compilation. The resulting 512-byte table is embedded directly in the binary — zero runtime cost.

### King Attack Table

Same principle — a king attacks 8 adjacent squares (or fewer in corners/edges):

```rust
pub static KING_ATTACKS: [Bitboard; 64] = { /* 8 directions with bounds */ };
```

### Pawn Attack Table

Pawns attack diagonally and direction depends on color, so there are two tables:

```rust
pub static WHITE_PAWN_ATTACKS: [Bitboard; 64] = { /* NW and NE captures */ };
pub static BLACK_PAWN_ATTACKS: [Bitboard; 64] = { /* SW and SE captures */ };
```

**Note:** Pawn *pushes* (forward movement) are not in the attack table — they're computed in move generation because they depend on occupancy (can't push through a piece).

### Runtime Usage

Getting knight attacks from e4 is a single array access — O(1):

```rust
pub fn knight_attacks(sq: Square) -> Bitboard {
    KNIGHT_ATTACKS[sq.index()]  // One memory read
}
```

---

## Chapter 5: Magic Bitboards – The Complete Theory

This is the most complex part of the engine. Understanding magic bitboards means understanding the key insight that makes modern chess engines fast.

### The Problem, Precisely Stated

A bishop on d4 on an empty board attacks 13 squares. But if there's a pawn on f6, the bishop can't see g7 or h8. The attack set depends on which "blocker" pieces occupy the diagonal.

For a bishop on d4, the **relevant occupancy mask** has a maximum of 9 bits set (the squares along the diagonals, excluding edges). That means there are 2^9 = 512 possible blocker configurations. Each configuration produces a different attack bitboard. The goal is O(1) lookup.

### The Solution: Perfect Hashing via Multiplication

The trick is finding a 64-bit "magic number" M such that when the blocker bitboard is multiplied by M and right-shifted by (64 - N), the result is a unique index for every distinct attack pattern.

```
index = (blockers × magic) >> (64 - relevant_bits)
```

**Why does multiplication work as a hash?** Binary multiplication is addition with carries. When you multiply a sparse bitboard by the right magic number, the relevant bits get "gathered" into the top N bits of the result, where they form a unique index. It's analogous to a hash function, but designed so that no two different attack patterns collide.

### How the Magic Numbers Were Found

Magic numbers are found by brute force: generate random 64-bit numbers, test if they produce a collision-free mapping for a given square, and keep the one that works. The magic numbers in this engine are taken from well-known sources (equivalent to those used in Stockfish).

```rust
static ROOK_MAGICS: [u64; 64] = [
    0x8a80104000800020, 0x140002000100040, ...
];
static BISHOP_MAGICS: [u64; 64] = [
    0x89a1121896040240, 0x2004844802002010, ...
];
```

### Table Construction (One-Time Initialization)

At startup, `MagicTables::new()` builds the lookup tables:

```rust
for sq in 0..64 {
    // 1. Compute the relevant occupancy mask (excluding edges)
    let mask = rook_mask(sq);

    // 2. Enumerate all 2^N blocker subsets using Carry-Rippler
    let mut blockers = Bitboard::EMPTY;
    loop {
        // 3. Compute attacks using slow ray-casting
        let attacks = rook_attacks_slow(sq, blockers);

        // 4. Hash blockers to index using magic number
        let index = (blockers * MAGIC) >> (64 - bits);

        // 5. Store in lookup table
        table[sq][index] = attacks;

        // 6. Next subset (Carry-Rippler trick)
        blockers = (blockers.wrapping_sub(mask)) & mask;
        if blockers == 0 { break; }
    }
}
```

**The Carry-Rippler trick** `(blockers - mask) & mask` generates all subsets of a bitmask in an order that wraps around back to 0. It's the standard way to enumerate subsets in bitboard engines.

### Runtime Lookup (O(1) per query)

```rust
pub fn rook_attacks(sq: Square, occupied: Bitboard) -> Bitboard {
    let mask = ROOK_MASKS[sq];                    // 1 memory read
    let blockers = occupied & mask;               // 1 AND
    let index = (blockers.0.wrapping_mul(magic))  // 1 multiply
                >> (64 - bits);                    // 1 shift
    ROOK_TABLE[sq][index]                          // 1 memory read
}
```

**5 operations total.** Compare to ray-casting which requires 4 loops of up to 7 iterations each with branch-on-occupancy — 28 conditional operations in the worst case.

### Memory Layout

The tables are stored as `Vec<Vec<Bitboard>>` — one inner vec per square. Sizes:

- Rook: 12 bits for corners (4096 entries), 10-11 bits elsewhere. Total: ~800 KB.
- Bishop: 6 bits for corners, up to 9 bits in center. Total: ~40 KB.

Stored in a `OnceLock<MagicTables>` — initialized lazily on first access, then immutable for the rest of the program's lifetime.

### Queen Attacks

A queen is just a rook + bishop combined:

```rust
pub fn queen_attacks(sq: Square, occupied: Bitboard) -> Bitboard {
    rook_attacks(sq, occupied) | bishop_attacks(sq, occupied)
}
```

Two lookups + one OR. Still O(1).

---

## Chapter 6: Move Generation – Pseudolegal to Legal

### Architecture

Move generation is split into two layers:

1. **`generate_pseudo_legal_moves(pos)`** — Generates all moves that follow piece movement rules, regardless of check.
2. **`generate_legal_moves(pos)`** — Filters out moves that leave the king in check.

### The MoveList

```rust
pub struct MoveList {
    moves: [Move; 256],  // Stack-allocated, no heap
    count: usize,
}
```

256 is the theoretical maximum legal moves in any chess position (the actual record is 218). Stack allocation means zero allocator overhead during search.

### Pawn Move Generation

Pawn generation is the most complex because pawns have so many special cases:

1. **Single push:** `white_pawns.north() & empty_squares`. This shifts all pawn bits up one rank and masks with empty squares — parallelized across all pawns simultaneously.

2. **Double push:** `(single_pushes & RANK_3).north() & empty_squares`. Only pawns that just pushed to rank 3 can push again (and rank 4 must be empty).

3. **Captures:** For each pawn individually (because both `from` and `to` squares are needed), compute `pawn_attacks(from) & enemy_pieces`.

4. **Promotions:** Any pawn move to rank 8 (or rank 1 for Black) generates 4 moves: Q, R, B, N promotions.

5. **En passant:** Check if any pawns can reach the en passant target square.

### Knight, King, Sliding Piece Generation

Pattern:
```rust
// Get all pieces of this type
let mut piece_bb = pos.pieces(us, PieceType::Knight);
// Iterate over each piece
while let Some(from) = piece_bb.pop_lsb() {
    // Get attack squares (minus friendly pieces)
    let attacks = knight_attacks(from) & !friendly;
    // Iterate over each attack square
    let mut att = attacks;
    while let Some(to) = att.pop_lsb() {
        moves.push(Move::new(from, to));
    }
}
```

### Castling Generation

Most complex preconditions in chess:

1. The king must have castling rights (neither king nor relevant rook has moved).
2. The king must NOT be in check.
3. The squares between king and rook must be empty.
4. The king must not pass through or land on a square attacked by the opponent.

```rust
// White kingside castling
if rights.has(WHITE_KINGSIDE) {
    let between = Bitboard::from_square(F1) | Bitboard::from_square(G1);
    if (occupied & between).is_empty()
        && !pos.is_square_attacked(F1, them)
        && !pos.is_square_attacked(G1, them)
    {
        moves.push(Move::new_castling(king_sq, G1));
    }
}
```

### Pseudo-Legal to Legal Filtering

```rust
for m in pseudo_legal.iter() {
    if let Some(undo) = pos.make_move(*m) {
        // make_move returns None if the move leaves king in check
        legal.push(*m);
        pos.unmake_move(*m, &undo);
    }
}
```

This is called the "make/unmake legality" approach. The alternative is to compute pins and check evasions in the move generator (used by engines like Stockfish for speed). This project's approach is simpler and fast enough for the target search depth.

---

## Chapter 7: Position Evaluation – Material and Piece-Square Tables

### The Evaluation Contract

`evaluate(pos) → Score` returns a score in centipawns (100 = 1 pawn) from the perspective of the side to move. Positive = side to move is ahead.

### Material Values

```
Pawn   = 100 cp
Knight = 320 cp
Bishop = 330 cp
Rook   = 500 cp
Queen  = 900 cp
King   = 20000 cp (effectively infinite — losing the king = losing the game)
```

The bishop is slightly more valuable than the knight (330 vs 320) because in open positions, bishops control more squares. This is a historically debated choice — some engines use equal values or phase-dependent values.

### Piece-Square Tables (PST)

A PST is a 64-element array that gives a bonus or penalty for a piece being on a specific square. These encode positional chess knowledge:

**Pawn PST — the reasoning behind each value:**

```
Rank 2: [ 5, 10, 10,-20,-20, 10, 10,  5]  ← Discourages d2/e2 pawns sitting still
Rank 4: [ 0,  0,  0, 20, 20,  0,  0,  0]  ← Central pawns (d4/e4) get +20
Rank 5: [ 5,  5, 10, 25, 25, 10,  5,  5]  ← Advanced central pawns even better
Rank 7: [50, 50, 50, 50, 50, 50, 50, 50]  ← About to promote = huge bonus
```

**Knight PST — "knight on the rim is dim":**

```
Edge squares:  -50 to -40  ← Knights on the edge control fewer squares
Center:        +15 to +20  ← Knights in the center control 8 squares
```

**King PST — two tables for game phase:**

- **Middlegame:** King wants to be castled (g1/g8 = +30) and away from the center (center = -50). The king is vulnerable to attack in the middlegame.
- **Endgame:** King wants to be central (+40 in center). With few pieces on the board, the king becomes an active attacking piece.

**Phase detection:** All non-king material is summed. Below 2000 centipawns, the endgame king table is used.

### Bishop Pair Bonus

Two bishops working together are worth more than their individual values suggest:

```rust
if bishops.count() >= 2 {
    score += 30;  // ≈0.3 pawns bonus
}
```

This reflects a well-known chess principle: two bishops complement each other because they cover both colors, making them especially strong in open positions.

### Flipping for Black

White's PSTs are written from White's perspective. For Black, vertical mirroring is applied:

```rust
fn pst_value(table: &[Score; 64], sq: Square, color: Color) -> Score {
    let index = if color == Color::White {
        sq.index()
    } else {
        sq.index() ^ 56  // XOR 56 = flip rank (rank 0 ↔ rank 7)
    };
    table[index]
}
```

---

## Chapter 8: Zobrist Hashing – Incremental Position Fingerprinting

### The Problem

The transposition table needs a way to identify positions. FEN strings work but are slow to compare. A fast hash function with low collision probability is needed.

### Zobrist's Method

Assign a random 64-bit number to every possible (piece, square) combination, plus keys for side to move, castling rights, and en passant file. The hash of a position is the XOR of all applicable keys.

**XOR has the perfect property:** `x ^ x = 0`. So to incrementally update the hash when moving a piece:

```
hash ^= piece_key(piece, from)  // Remove piece from origin (XOR cancels it)
hash ^= piece_key(piece, to)    // Add piece at destination
```

Two XOR operations instead of recomputing from scratch. This is O(1) per move.

### Compile-Time Key Generation

All 781 keys are generated at compile time using a `const fn` xorshift64 PRNG:

```rust
const fn xorshift64(mut state: u64) -> u64 {
    state ^= state << 13;
    state ^= state >> 7;
    state ^= state << 17;
    state
}

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

const PIECE_KEYS: [u64; 768] = generate_keys(SEED);  // 2 colors × 6 types × 64 squares
const SIDE_KEY: u64 = ...;                            // XOR when Black to move
const CASTLING_KEYS: [u64; 4] = ...;                  // One per castling right
const EP_KEYS: [u64; 8] = ...;                        // One per en passant file
```

**Why compile-time?** Zero runtime initialization cost. The keys are baked into the WASM binary. Deterministic — same keys every run, which makes debugging reproducible.

### Collision Probability

With a 64-bit hash and well-distributed keys, the probability of two different positions having the same hash is approximately 1 in 2^64 ≈ 1.8 × 10^19. In a typical search of 10 million nodes, the expected number of collisions is ~5.4 × 10^-13. Negligible.

### Testing

Tests verify:
- All 768 piece keys are unique
- All keys are non-zero
- XOR is reversible: `hash ^= key; hash ^= key; assert_eq!(hash, 0)`
- Moving pieces changes the hash
- Side to move changes the hash
- En passant changes the hash
- Castling rights change the hash

---

## Chapter 9: Transposition Table – Caching Search Results

### Structure

```rust
pub struct TranspositionTable {
    entries: Vec<TTEntry>,  // Fixed-size array
    capacity: usize,        // Power of 2 for fast modular indexing
}

pub struct TTEntry {
    hash: u64,             // Full Zobrist hash (collision detection)
    depth: u8,             // Depth at which this was searched
    score: Score,          // Evaluation result
    flag: TTFlag,          // Exact, LowerBound, or UpperBound
    best_move: Option<Move>,  // For move ordering in future searches
}
```

### TTFlag Semantics

| Flag | Meaning | When |
|------|---------|------|
| `Exact` | Score is the exact minimax value | Both alpha and beta were tightened (PV node) |
| `LowerBound` | Score is ≥ the true value | Beta cutoff occurred (score ≥ beta) |
| `UpperBound` | Score is ≤ the true value | All moves failed low (score ≤ alpha) |

### Using the TT During Search

**Probe (before searching a node):**

```rust
if let Some(entry) = tt.probe(hash) {
    if entry.depth >= depth {  // Only trust results from deeper searches
        match entry.flag {
            Exact => return entry.score,       // Definitive answer
            LowerBound => if score >= beta, return score,  // Cutoff
            UpperBound => if score <= alpha, return score,  // Cutoff
        }
    }
    // Even if depth insufficient, use the best move for ordering
    tt_move = entry.best_move;
}
```

**Store (after searching a node):**

```rust
let flag = if alpha >= beta { LowerBound }
           else if alpha > original_alpha { Exact }
           else { UpperBound };
tt.store(hash, depth, alpha, flag, best_move);
```

### Replacement Policy

**Depth-preferred:** An existing entry is only replaced if the new entry was searched at equal or greater depth. This preserves expensive deep searches.

```rust
if existing.hash != 0 && existing.hash != hash && existing.depth > depth {
    return;  // Keep the deeper entry
}
```

### Mate Score Adjustment

Mate scores encode distance from root: "mate in 5 moves" = MATE_SCORE - 5. But TT entries can be used from different positions in the tree. Without adjustment, a "mate in 5" stored from ply 2 would be read as "mate in 5" at ply 7 — wrong, it should be "mate in 10".

```rust
// When storing: convert from root-relative to node-relative
pub fn score_to_tt(score: Score, ply: u8) -> Score {
    if score > 29000 { score + ply }      // Mate for us: add ply distance
    else if score < -29000 { score - ply } // Mate for opponent
    else { score }
}

// When retrieving: convert back to root-relative
pub fn score_from_tt(score: Score, ply: u8) -> Score {
    if score > 29000 { score - ply }
    else if score < -29000 { score + ply }
    else { score }
}
```

---

## Chapter 10: Search – Minimax, Alpha-Beta, and Beyond

### The Core: Negamax Alpha-Beta

```rust
fn alpha_beta(pos, depth, ply, alpha, beta, stats, tt, killers, do_null) -> (Score, Option<Move>) {
    if depth == 0 { return (quiescence(pos, alpha, beta, stats), None); }

    // TT probe
    // Null move pruning
    // Generate legal moves
    // Order moves: TT → captures (MVV-LVA) → killers → quiet
    // Search each move with LMR
    // TT store
}
```

### Iterative Deepening

```rust
pub fn search_iterative(pos, max_depth) -> (Move, Score, Stats) {
    let mut tt = TranspositionTable::new(18);  // Shared across all depths
    for depth in 1..=max_depth {
        let (mv, score, stats) = search_with_tt(pos, depth, &mut tt);
        best_move = mv;  // Always use the latest completed depth
    }
}
```

The TT is shared across iterations — depth 3 results help order moves for depth 4, which dramatically improves pruning efficiency.

### Time-Limited Search

```rust
pub fn search_timed(pos, max_ms, max_depth) -> (Move, Score, Stats) {
    let deadline = now_ms() + max_ms;
    for depth in 1..=max_depth {
        let (mv, score, _) = search_with_tt(pos, depth, &mut tt);
        if now_ms() >= deadline { break; }
        // Also break if the next depth would likely exceed the budget
        if remaining < elapsed * 3.0 { break; }
    }
}
```

The heuristic `remaining < elapsed * 3.0` estimates whether there's time for another depth. Each depth takes roughly 6× as long as the previous, but the TT makes the ratio closer to 3× in practice.

### Null Move Pruning (NMP)

**Idea:** If skipping a turn (passing) still keeps the score above beta despite giving the opponent two consecutive moves, the position is so good the subtree can be pruned.

```rust
if do_null && !in_check && ply > 0 && depth > NMP_REDUCTION + 1
    && pos.has_non_pawn_material(us)
{
    pos.make_null_move();
    let (null_score, _) = alpha_beta(pos, depth - 1 - NMP_REDUCTION, ply+1, -beta, -beta+1, ...);
    pos.unmake_null_move();
    if -null_score >= beta { return (beta, None); }
}
```

**Conditions for NMP:**
- Not in check (passing while in check is illegal)
- Not at root (ply 0)
- Haven't already made a null move (prevents two in a row)
- Depth is sufficient (need at least 3 plies remaining)
- Side has non-pawn material (otherwise zugzwang risk — in K+P vs K, passing might be correct)

**Reduction:** The null-move position is searched at `depth - 3` (2 ply reduction + the null move itself). This makes the verification cheap.

### Late Move Reductions (LMR)

**Idea:** In a well-ordered move list, moves 5+ are unlikely to be the best. They are searched at reduced depth first; if the result looks promising, re-searched at full depth.

```rust
if moves_searched >= 4 && depth >= 3 && !is_capture && !is_promotion
    && !is_killer && !in_check && !gives_check
{
    // Reduced search (depth - 2 instead of depth - 1)
    let (reduced_score, _) = alpha_beta(pos, depth-2, ...);
    if -reduced_score > alpha {
        // Re-search at full depth
        let (full_score, _) = alpha_beta(pos, depth-1, ...);
        score = -full_score;
    }
}
```

**Conditions to NOT reduce:** Captures, promotions, killer moves, moves giving check, or when in check. These are all "interesting" moves that shouldn't be dismissed with a shallow search.

### Move Ordering

Good move ordering is the difference between examining 35^6 = 1.8 billion positions and 6^6 = 46,656 positions at depth 6. The ordering:

```rust
fn order_moves(moves, pos, tt_move, killers, ply) -> MoveList {
    for mv in moves {
        let score = 0;
        if Some(mv) == tt_move       { score += 100_000; }  // TT best move
        if is_capture(pos, mv)       { score += 10_000 + MVV_LVA(mv); }  // Captures
        if mv.is_promotion()         { score += 9_000; }     // Promotions
        if killers.is_killer(ply,mv) { score += 5_000; }     // Killer moves
        // Quiet moves stay at 0
    }
    sort_by_score_descending();
}
```

**MVV-LVA (Most Valuable Victim, Least Valuable Attacker):** Captures are ordered by `victim_value × 10 - attacker_value`. Capturing a queen with a pawn (900×10 - 100 = 8900) is searched before capturing a pawn with a queen (100×10 - 900 = 100). This puts the most promising captures first.

### Quiescence Search

At depth 0, instead of just returning the static evaluation, all capture sequences are searched until the position is "quiet":

```rust
fn quiescence(pos, alpha, beta, stats) -> Score {
    let stand_pat = evaluate(pos);
    if stand_pat >= beta { return beta; }       // Position already too good
    if stand_pat > alpha { alpha = stand_pat; } // Raise alpha

    for capture in legal_moves.filter(is_capture) {
        pos.make_move(capture);
        let score = -quiescence(pos, -beta, -alpha, stats);
        pos.unmake_move(capture);
        if score >= beta { return beta; }
        if score > alpha { alpha = score; }
    }
    alpha
}
```

**Stand-pat:** The side to move has the option of "not capturing anything" and just accepting the current evaluation. This prevents the search from being forced into bad exchanges.

---

## Chapter 11: WASM Compilation and the TypeScript Bridge

### Build Pipeline

```bash
cd rust-engine
wasm-pack build --target web --release --out-dir ../public/wasm
```

This runs the Rust compiler with:
1. Target: `wasm32-unknown-unknown` (WebAssembly)
2. Optimization: `--release` (LTO, dead code elimination, optimized codegen)
3. Output: JavaScript glue code + `.wasm` binary

The `wasm_bindgen` attribute on Rust functions generates JavaScript bindings automatically:

```rust
#[wasm_bindgen]
pub fn get_best_move(pos: &Position, depth: u8) -> Option<String> { ... }
```

becomes callable from JavaScript as:

```javascript
const move = wasm.get_best_move(position, 4);  // Returns "e2e4" or null
```

### The TypeScript Bridge Layer (`rustEngine.ts`)

The bridge provides:
1. **Initialization:** Asynchronous loading of the WASM module.
2. **Type Safety:** TypeScript interfaces for the WASM API.
3. **Memory Management:** Ensures `Position` objects are freed after use.
4. **Error Handling:** Every call is wrapped in try/catch with graceful fallbacks.
5. **UCI Helpers:** Coordinate-to-UCI and UCI-to-coordinate conversion.

### Why Dynamic Loading via Blob URL?

The standard `import()` syntax doesn't work well with WASM glue code served from the `public/` directory in Vite's dev server. The blob URL approach:

```typescript
const jsCode = await fetch('./wasm/chess_engine.js').then(r => r.text());
const blob = new Blob([jsCode], { type: 'application/javascript' });
const blobUrl = URL.createObjectURL(blob);
const wasm = await import(blobUrl);
await wasm.default('./wasm/chess_engine_bg.wasm');
```

works reliably in both Vite dev mode and production builds.

### Cross-Platform Time Measurement

The search module needs a clock for time-limited search. The standard library's `SystemTime` isn't available in WASM. Conditional compilation is used:

```rust
#[cfg(target_arch = "wasm32")]
fn now_ms() -> f64 { js_sys::Date::now() }

#[cfg(not(target_arch = "wasm32"))]
fn now_ms() -> f64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs_f64() * 1000.0
}
```

---

## Chapter 12: GameState – Full Game Lifecycle in Rust

The `GameState` struct wraps `Position` with game-level concerns:

```rust
pub struct GameState {
    position: Position,
    hash_history: Vec<u64>,                        // All position hashes (for repetition)
    move_history: Vec<(Move, UndoInfo)>,           // For undo
    uci_history: Vec<String>,                      // Human-readable history
}
```

### Threefold Repetition Detection

This cannot be done with Position alone — it requires knowing the game's entire move history:

```rust
pub fn is_threefold_repetition(&self) -> bool {
    let current = self.position.hash();
    self.hash_history.iter().filter(|&&h| h == current).count() >= 3
}
```

### Full Game Status

```rust
pub fn status(&self) -> String {
    if self.is_checkmate() { "checkmate" }
    else if self.is_stalemate() { "stalemate" }
    else if self.is_insufficient_material() { "insufficient_material" }
    else if self.is_fifty_move_draw() { "fifty_move" }
    else if self.is_threefold_repetition() { "threefold_repetition" }
    else { "playing" }
}
```

### Undo Support

`undo()` pops the last move from all three history vectors and unmakes it:

```rust
pub fn undo(&mut self) -> String {
    if let Some((m, undo)) = self.move_history.pop() {
        self.position.unmake_move(m, &undo);
        self.hash_history.pop();
        self.uci_history.pop().unwrap_or_default()
    } else { String::new() }
}
```

### Board Serialization

`get_board_json()` returns the board as a JSON 8×8 array, allowing the TypeScript frontend to render pieces without understanding bitboards:

```json
[
  [{"type":"R","color":"w"}, {"type":"N","color":"w"}, ...],
  [{"type":"P","color":"w"}, {"type":"P","color":"w"}, ...],
  [null, null, null, null, null, null, null, null],
  ...
]
```

---

## Chapter 13: Testing and Correctness – Perft

### What is Perft?

**Perft** (Performance Test) counts all leaf nodes at a given depth in the game tree. It's the standard correctness benchmark for chess engines. If perft numbers match the known-correct values, the move generation is (almost certainly) correct.

```rust
pub fn perft(pos: &mut Position, depth: u32) -> u64 {
    if depth == 0 { return 1; }
    let moves = generate_legal_moves(pos);
    if depth == 1 { return moves.len() as u64; }  // Leaf optimization
    let mut nodes = 0;
    for m in moves.iter() {
        if let Some(undo) = pos.make_move(*m) {
            nodes += perft(pos, depth - 1);
            pos.unmake_move(*m, &undo);
        }
    }
    nodes
}
```

### Standard Test Positions

**Starting position:**

| Depth | Nodes | What it tests |
|-------|-------|---------------|
| 1 | 20 | 16 pawn + 4 knight moves |
| 2 | 400 | 20 × 20 |
| 3 | 8,902 | Captures, check evasions |
| 4 | 197,281 | Deeper tactics, pins |
| 5 | 4,865,609 | All move types exercised |

**Kiwipete** (`r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -`):

This dense middlegame position tests: castling (both sides, both directions), en passant, promotions, pins, discovered checks, double checks. Perft 4 = 4,085,603.

### Perft Divide

When perft fails, `perft_divide` shows the node count per root move, making it easy to find which move is buggy:

```
a2a3: 8457
a2a4: 9329
b2b3: 9345
...
e1g1: 8349  ← If this number is wrong, castling is buggy
```

### Rust Test Suite

213 tests covering:
- Bitboard operations (shifts, population count, iteration)
- Attack tables (knight/king/pawn attacks at corners, edges, center)
- Magic bitboard validation (all 64×2 magic numbers collision-free)
- Move generation (starting position, captures, promotions, castling, en passant)
- Position make/unmake (hash consistency, piece restoration)
- Search (finds mate in 1, finds free pieces, iterative deepening)
- TT (store/probe/replacement/hit rate)
- Zobrist (uniqueness, reversibility, determinism)
- GameState (full lifecycle: make/undo/reset/load/history/repetition)
- Perft (starting position depth 1–4, Kiwipete depth 1–4)

---

---

# Part III: System Design FAQ

*Detailed answers to the questions an interviewer would ask about scaling, decisions, and trade-offs. Each answer explains what is done now, why, what the alternatives are, and what the approach would be at larger scale.*

---

## Q1: How would you scale to 10,000 concurrent players?

**Current state:** Single Node.js server with in-memory `Map<string, GameRoom>`. WebSocket connections via Socket.io. This handles ~500 concurrent connections comfortably.

**The scaling plan:**

### Tier 1: Vertical Scaling (500–2,000 players)

- Upgrade to a larger instance (4 vCPU, 8 GB RAM)
- Node.js is single-threaded for JavaScript but handles I/O concurrently via the event loop
- Socket.io can handle 10K+ connections per process
- SQLite → PostgreSQL for concurrent writes

### Tier 2: Horizontal Scaling (2,000–10,000 players)

**Problem:** WebSocket connections are stateful. A player connected to Server A can't have their game state on Server B.

**Solution architecture:**

```
                    ┌─────────────────┐
                    │   Load Balancer  │
                    │  (sticky sessions│
                    │   via cookie)    │
                    └────────┬────────┘
               ┌─────────┬──┴──┬─────────┐
               ▼         ▼     ▼         ▼
          ┌────────┐ ┌────────┐ ┌────────┐
          │Server 1│ │Server 2│ │Server 3│
          │(games) │ │(games) │ │(games) │
          └────┬───┘ └────┬───┘ └────┬───┘
               └──────────┼──────────┘
                     ┌────▼────┐
                     │  Redis  │
                     │  Pub/Sub│
                     │  + Cache│
                     └────┬────┘
                     ┌────▼────┐
                     │PostgreSQL│
                     │(replicas)│
                     └─────────┘
```

Key components:

1. **Sticky sessions at load balancer:** Both players in a game must connect to the same server. The load balancer uses a session cookie. Socket.io has built-in Redis adapter support for cross-server communication.

2. **Redis Pub/Sub for cross-server events:** If player A (on Server 1) challenges player B (on Server 2), the matchmaker publishes to Redis and Server 2 picks it up.

3. **Separate matchmaking service:** The matchmaker runs as its own process with Redis as its backing store. This decouples matchmaking from game serving.

4. **PostgreSQL read replicas:** Leaderboard queries and profile lookups go to read replicas, keeping the primary free for writes (ELO updates, game results).

5. **CDN for static assets:** Three.js textures, WASM binary, Stockfish.js — all served from a CDN with aggressive cache headers. These are ~5 MB of static assets that never change between deploys.

### Tier 3: Global Scale (10,000+)

- Regional deployment (US-East, EU-West, AP-Southeast)
- Game state serialization to Redis (not in-memory)
- Dedicated WebSocket gateway (e.g., AWS API Gateway WebSocket)
- Kubernetes for orchestration
- At this point, consider whether the business justifies this investment

**Trade-offs accepted at current scale:**
- In-memory state means server restart = all active games lost (acceptable for a chess game where games are <30 min)
- Single region means latency for international players (~100–200ms, acceptable for turn-based chess)

---

## Q2: How do you detect and handle cheating?

### What is done now

1. **Server-side move validation:** Every move sent by a client is validated against the chess rules using chess.js on the server. A client cannot send an illegal move.

2. **Rate limiting:** Socket.io events are throttled — a client can't spam 100 moves per second.

### What would be added at scale

3. **Time-per-move analysis:** Track the distribution of thinking time for each player. Humans have variable thinking times; engines are suspiciously consistent. Flag accounts where >80% of moves are made in a narrow time window (e.g., 1.2–1.5 seconds every move).

4. **Move quality analysis:** Compare player moves to engine recommendations (top 1–3 moves). A correlation >90% over 20+ games is statistically improbable for a human below 2500 ELO.

5. **ELO volatility detection:** A player who suddenly jumps from 800 to 2200 ELO in one session is either a smurf (secondary account) or using an engine. Flag for review.

6. **Browser fingerprinting:** Detect if the same person is running multiple accounts to manipulate ratings. Use canvas fingerprint, WebGL renderer string, and timezone.

7. **Behavioral heuristics:** Engine users often:
   - Tab away between moves (alt-tab to an engine)
   - Have no mouse movement during thinking (watching another screen)
   - Play endgames with computer-perfect accuracy (humans blunder in time pressure)

8. **Automated ban system with appeals:** Progressive penalties: warning → temporary ban → permanent ban. Automated appeals review if the player's subsequent games show human-like patterns.

**The key trade-off:** Aggressive anti-cheat catches more cheaters but also produces more false positives. For a casual chess game (not a tournament platform), the threshold should be set conservatively — better to let a few cheaters through than to ban legitimate players.

---

## Q3: Why Three.js instead of native mobile rendering?

### The decision

Three.js (WebGL) for 3D rendering, served as a web app, accessed via browser on all platforms.

### Why (Pros)

1. **Single codebase for all platforms.** One deployment serves desktop, mobile, tablet. No separate iOS/Android/Web apps to maintain.

2. **Zero install friction.** Users click a link and play. No App Store review process, no download, no update cycle. This is critical for a project demo — interviewers click the Vercel link and play immediately.

3. **Rapid iteration.** Change code, push to main, Vercel deploys in 30 seconds. Compare to: build Android APK (5 min), upload to Play Store (3 hour review), wait for users to update.

4. **WebGL is well-supported.** 97%+ of browsers support WebGL 2 (caniuse.com). Three.js abstracts GPU vendor differences.

5. **WASM for compute.** The chess engine runs at near-native speed in the browser. The bottleneck is GPU rendering, not CPU computation.

### Cost (Cons)

1. **25–40% rendering performance penalty** vs native Metal (iOS) / Vulkan (Android). WebGL has overhead: JavaScript→GPU driver IPC, shader compilation at runtime, no compute shaders.

2. **Higher memory usage.** The JavaScript VM (V8/SpiderMonkey) adds ~20 MB overhead. A native app starts leaner.

3. **No access to native APIs.** No push notifications (without PWA), no background audio (without workarounds), no haptic feedback engine (limited vibration API).

4. **Mobile browser limitations.** Safari on iOS doesn't support SharedArrayBuffer (required for multi-threaded WASM). Some WebGL extensions are missing on mobile GPUs.

### Mitigations implemented

- **Adaptive quality:** Mobile devices are auto-detected. Shadows disabled, antialias disabled, DPR capped at 2.0, tone mapping reduced.
- **PWA:** Manifest + service worker enable "Add to Home Screen" for an app-like experience.
- **Touch controls:** Full touch event handling with pinch-to-zoom, tap-to-move, long-press for context menus.

### Future: native renderer

If this were a funded product targeting competitive mobile gaming, a native renderer would be built:
- **iOS:** Metal + SceneKit, shared game logic via Rust compiled to iOS static library
- **Android:** Vulkan + custom renderer, shared Rust logic via JNI
- **Shared:** The Rust chess engine compiles to all three targets (WASM, iOS arm64, Android arm64) from the same source code

The cost is ~3× the engineering effort for ~30% better performance. For a portfolio project, the web-based approach maximizes impact per hour of development.

---

## Q4: Why do you have multiple AI engines?

See [The AI Engine Fallback Chain](#the-ai-engine-fallback-chain) in Part I. In short:

| Engine | Role | When Used | Strength |
|--------|------|-----------|----------|
| Rust WASM | Primary (fastest) | When WASM loads successfully | ~1800 ELO at depth 5 |
| Stockfish.js | Strongest | When WASM fails | ~800–2800 ELO (skill 0–20) |
| TypeScript | Fallback (always works) | When Worker fails | ~1200 ELO at depth 4 |
| Learning AI | Experimental | Manual training mode | Varies |

This is a **graceful degradation pattern**, not feature creep. The user always gets a working AI opponent. The production fallback chain is: Rust → Stockfish → TypeScript.

---

## Q5: Why vanilla TypeScript instead of React/Vue/Svelte?

### The decision

No framework. Pure TypeScript with direct DOM manipulation.

### Why

1. **Three.js is the framework.** The app is 80% WebGL canvas rendering. React's virtual DOM is designed for document-like UIs with frequent updates. The "UI" here is a 3D scene managed by Three.js. Using React to wrap a `<canvas>` element adds complexity without benefit.

2. **State simplicity.** The game has one core state: the chess position (represented as a FEN string and a board array). This changes on user click, AI response, or multiplayer message. Reactive state management (Redux, Zustand, MobX) solves a problem that doesn't exist here — there are no deeply nested components re-rendering based on slices of state.

3. **Performance.** No virtual DOM diffing. When a piece moves, the Three.js scene graph is updated directly — move mesh from square A to square B. This is O(1). A React-based approach would re-render a component tree to figure out what changed, then update the DOM/canvas.

4. **Bundle size.** The entire app (TypeScript + Three.js + chess.js) produces a ~400 KB gzipped bundle. React alone adds ~45 KB gzipped. For a game where load time matters (users are impatient), every KB counts.

### What would change at scale

If the UI grew significantly (settings pages, social features, tournament brackets, chat, friends list):
- **Solid.js** — Reactive without virtual DOM, ~7 KB, compiles away
- **Preact** — React API in 3 KB, good enough for non-game UI panels
- **Web Components** — For the game HUD elements (health bar, timer, etc.)

The game canvas would always be vanilla Three.js regardless of UI framework.

---

## Q6: How does the WASM binary get loaded in the browser?

Detailed in [Chapter 11](#chapter-11-wasm-compilation-and-the-typescript-bridge) of Part II. The short version:

1. TypeScript calls `initEngine()` at startup
2. Fetches `chess_engine.js` (glue code) from the server
3. Creates a blob URL to bypass Vite's import restrictions
4. Dynamically imports the blob module
5. Calls `wasm.default(path_to_wasm_binary)` which triggers `WebAssembly.instantiateStreaming`
6. The browser compiles the WASM binary to native machine code
7. All WASM functions become callable from JavaScript

**Total load time:** ~50–100ms on a fast connection. The WASM binary is ~170 KB gzipped. `WebAssembly.instantiateStreaming` compiles while downloading (pipelining).

**If loading fails** (CSP blocks, network error, browser too old): the `initEngine()` promise resolves with `false`, and the AI falls back to Stockfish.js or the TypeScript engine.

---

## Q7: What are the performance characteristics on mobile?

### Rendering

| Metric | Desktop (RTX 3060) | Mobile (Pixel 7) | Mobile (budget $200) |
|--------|--------------------|--------------------|----------------------|
| FPS (full quality) | 60 | 30–45 | 15–25 |
| FPS (mobile mode) | 60 | 50–60 | 30–40 |
| GPU memory | ~150 MB | ~80 MB | ~60 MB |

**Mobile mode** disables: antialiasing, shadows, reduces DPR to max 2.0, lowers tone mapping exposure.

### Chess Engine

| Operation | Desktop | Mobile (WASM) | Mobile (JS fallback) |
|-----------|---------|---------------|----------------------|
| Move generation | ~5M pos/s | ~2M pos/s | ~200K pos/s |
| Search depth 4 | ~50ms | ~120ms | ~800ms |
| Search depth 5 | ~300ms | ~700ms | ~5000ms |

WASM runs at ~60% of desktop speed on mobile. The JavaScript fallback is ~10× slower. This is why the Rust WASM engine matters — it makes deeper search feasible on mobile.

### Memory

Total app memory usage:
- Desktop: ~80 MB (Three.js scene + textures + chess engines)
- Mobile: ~50 MB (reduced texture resolution, fewer scene objects)
- Budget: Within Android's typical 128–256 MB per-tab limit

### Battery

Not yet profiled. Expected impact: moderate. WebGL rendering is GPU-intensive. The AI search is CPU-intensive but completes in <1 second per move. The main battery concern is continuous rendering of the 3D scene — a "pause rendering when idle" optimization should be considered.

---

## Q8: How does the ELO system work?

Standard ELO formula:

```
R_new = R_old + K × (S - E)
```

Where:
- **K** = 32 (development factor — how much ratings change per game)
- **S** = actual score (1 for win, 0 for loss, 0.5 for draw)
- **E** = expected score = 1 / (1 + 10^((R_opponent - R_player) / 400))

**Example:** A 1200 player beats a 1500 player:
- Expected score: 1 / (1 + 10^(300/400)) = 0.15 (15% expected win rate)
- New rating: 1200 + 32 × (1 - 0.15) = 1200 + 27 = **1227**
- The opponent drops by 27: 1500 - 27 = **1473**

**Starting ELO:** 400 (intentionally low — the game is designed so new players climb through eras as they improve).

**Era mapping:** ELO ranges map to the 20 eras. Higher ELO = later era = more visually impressive environment. This provides progression motivation beyond just the number.

---

## Q9: What would you do differently if you started over?

### Would keep

1. **Rust → WASM for the chess engine.** The performance advantage is real and measurable. The compilation pipeline is mature.
2. **Bitboard representation.** Industry standard for a reason.
3. **Three.js for 3D.** The right level of abstraction for a web-based 3D game.
4. **Vite for build system.** Fast, simple, good defaults.
5. **Socket.io for multiplayer.** The fallback behavior (WebSocket → long-polling) handles real-world network conditions well.

### Would change

1. **Use Solid.js or Svelte for the UI layer.** Not React (too heavy), but a lightweight reactive framework for the non-canvas UI elements (sidebar, modals, settings). The current approach of manual DOM manipulation works but doesn't scale for more UI features.

2. **Extract the renderer into separate modules.** The main renderer file does too many things: scene setup, camera controls, piece rendering, era transitions, overlays, resize handling, mobile detection. It should be split into: `SceneManager`, `CameraController`, `PieceRenderer`, `EraRenderer`, `OverlayManager`.

3. **Use an ECS (Entity Component System) pattern** for the 3D scene. Three.js scenes get complex when you have 64 squares + 32 pieces + dynamic lighting + particles + buildings. An ECS (like bitecs) would scale better.

4. **Type-safe WebSocket messages from day one.** Currently, Socket.io messages are loosely typed. Zod schemas exist on the server, but the client doesn't use them. Using a shared message schema (like tRPC or Zod-based RPC) would prevent message shape bugs.

5. **PostgreSQL from day one** instead of SQLite. The SQLite → PostgreSQL migration at deploy time is an unnecessary risk. PostgreSQL via Docker for local dev is trivial.

6. **Implement the evaluation function in two passes** (middlegame + endgame scores with tapering) instead of a single pass with a phase-threshold approach. Tapered evaluation produces smoother transitions and is what modern engines use.

---

## Q10: How do you test a 3D game?

### What is tested

| Layer | Tool | What | Count |
|-------|------|------|-------|
| Rust engine | `cargo test` | Move gen, search, eval, TT, perft | 213 tests |
| Frontend logic | Vitest | Game controller, ELO, era system, save system | 382 tests |
| Server | Vitest | Auth, matchmaking, game rooms, database, API | 154 tests |
| Rust perft | Integration | Move generation correctness vs known values | 8 perft positions |

### What is mocked

- **Three.js:** All tests mock `three` to avoid requiring a GPU. Tests verify that the correct Three.js methods are called with correct arguments, not that pixels render correctly.
- **chess.js:** Mocked for unit tests that don't need real chess validation.
- **WebSocket:** Mock Socket.io client/server for multiplayer tests.
- **localStorage:** Mocked for save system tests.

### What is not tested (and should be)

1. **E2E tests with Playwright:** Actual browser interaction — click a piece, see legal moves highlighted, make a move, verify board state. This would catch DOM/CSS bugs that unit tests miss.

2. **Visual regression tests:** Screenshot comparison after each deploy. Catch unintended changes to piece rendering, board colors, or era environments. Tools: Percy, Chromatic, or custom Playwright screenshots.

3. **Load testing:** k6 or Artillery to simulate 100 concurrent WebSocket connections. Verify the server doesn't degrade (memory leaks, event loop blocking, GC pauses).

4. **Lighthouse CI:** Automated performance, accessibility, and SEO checks in GitHub Actions. Currently manual.

5. **GPU rendering tests:** Headless Chrome with SwiftShader (software GPU renderer) to validate that the Three.js scene renders without errors on different GPU capabilities.

### The testing philosophy

The Rust engine has the highest test coverage because it's the most critical and most testable component. Pure functions with deterministic inputs and outputs. The 3D renderer is the hardest to test and has the lowest coverage — but it's also the most tolerant of bugs (a visual glitch is less severe than an incorrect chess move).

Priority order: **Correctness** (engine) > **Functionality** (game controller) > **Reliability** (server) > **Appearance** (renderer).

---

*End of technical deep dive. Total: 11 Rust source files (~6,000 lines of engine code), 5 TypeScript bridge files, 749 tests across 3 layers (213 Rust + 382 frontend + 154 server).*
