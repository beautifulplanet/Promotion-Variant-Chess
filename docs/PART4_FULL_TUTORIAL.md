# Part 4: Full Tutorial & Deep Dive

*The IKEA manual. Step-by-step setup, complete engine reference, system design Q&A. Everything you need to understand, modify, or rebuild any part of this project.*

> This is a standalone version of Part 4 from the [main README](../README.md).
> [← Back to main README](../README.md#part-4-full-tutorial--deep-dive)

---

## Table of Contents

### Section A: Setup Guide (IKEA-Style)

- [A1. System Requirements](#a1-system-requirements)
- [A2. Clone & Install (Frontend)](#a2-clone--install-frontend)
- [A3. Run the Game Locally](#a3-run-the-game-locally)
- [A4. Set Up the Multiplayer Server](#a4-set-up-the-multiplayer-server)
- [A5. Run All Tests](#a5-run-all-tests)
- [A6. Rebuild the Rust Engine from Source](#a6-rebuild-the-rust-engine-from-source)
- [A7. Deploy to Production](#a7-deploy-to-production)

### Section B: Interview-Ready Technical Walkthrough

- [B1. System Overview in 60 Seconds](#b1-system-overview-in-60-seconds)
- [B2. The AI Engine Fallback Chain](#b2-the-ai-engine-fallback-chain)
- [B3. Bitboard Representation](#b3-bitboard-representation)
- [B4. Magic Bitboards for Sliding Pieces](#b4-magic-bitboards-for-sliding-pieces)
- [B5. Move Generation](#b5-move-generation)
- [B6. Search Algorithm](#b6-search-algorithm)
- [B7. Position Evaluation](#b7-position-evaluation)
- [B8. Zobrist Hashing & Transposition Tables](#b8-zobrist-hashing--transposition-tables)
- [B9. WASM Bridge Architecture](#b9-wasm-bridge-architecture)
- [B10. Rendering Pipeline](#b10-rendering-pipeline)
- [B11. Multiplayer Architecture](#b11-multiplayer-architecture)

### Section C: Complete Engine Manual

- [C1. Board Representation from First Principles](#c1-board-representation-from-first-principles)
- [C2. Types and Move Encoding](#c2-types-and-move-encoding)
- [C3. The Position Struct](#c3-the-position-struct)
- [C4. Attack Tables — Knights, Kings, and Pawns](#c4-attack-tables--knights-kings-and-pawns)
- [C5. Magic Bitboards — The Complete Theory](#c5-magic-bitboards--the-complete-theory)
- [C6. Move Generation — Pseudolegal to Legal](#c6-move-generation--pseudolegal-to-legal)
- [C7. Position Evaluation — Material and Piece-Square Tables](#c7-position-evaluation--material-and-piece-square-tables)
- [C8. Zobrist Hashing — Incremental Position Fingerprinting](#c8-zobrist-hashing--incremental-position-fingerprinting)
- [C9. Transposition Table — Caching Search Results](#c9-transposition-table--caching-search-results)
- [C10. Search — Minimax, Alpha-Beta, and Beyond](#c10-search--minimax-alpha-beta-and-beyond)
- [C11. WASM Compilation and the TypeScript Bridge](#c11-wasm-compilation-and-the-typescript-bridge)
- [C12. GameState — Full Game Lifecycle in Rust](#c12-gamestate--full-game-lifecycle-in-rust)
- [C13. Testing and Correctness — Perft](#c13-testing-and-correctness--perft)

### Section D: System Design FAQ

- [D1. How would you scale to 10 billion users?](#d1-how-would-you-scale-to-10-billion-users)
- [D2. How do you detect and handle cheating?](#d2-how-do-you-detect-and-handle-cheating)
- [D3. Why Three.js instead of native mobile rendering?](#d3-why-threejs-instead-of-native-mobile-rendering)
- [D4. Why do you have multiple AI engines?](#d4-why-do-you-have-multiple-ai-engines)
- [D5. Why vanilla TypeScript instead of React/Vue/Svelte?](#d5-why-vanilla-typescript-instead-of-reactvuesvelte)
- [D6. How does the WASM binary get loaded in the browser?](#d6-how-does-the-wasm-binary-get-loaded-in-the-browser)
- [D7. What are the performance characteristics on mobile?](#d7-what-are-the-performance-characteristics-on-mobile)
- [D8. How does the ELO system work?](#d8-how-does-the-elo-system-work)
- [D9. What would you do differently if you started over?](#d9-what-would-you-do-differently-if-you-started-over)
- [D10. How do you test a 3D game?](#d10-how-do-you-test-a-3d-game)
- [D11. What is the AI Tournament System?](#d11-what-is-the-ai-tournament-system)
- [D12. What metrics do you capture and why?](#d12-what-metrics-do-you-capture-and-why)
- [D13. What is your production resilience strategy?](#d13-what-is-your-production-resilience-strategy)
- [D14. What are your load testing methodology and SLOs?](#d14-what-are-your-load-testing-methodology-and-slos)

### Section E: Project Structure

- [E1. File Map](#e1-file-map)

### Section F: Operations & Scaling Reference

- [F1. Bottleneck Analysis by User Scale](#f1-bottleneck-analysis-by-user-scale)
- [F2. Scaling Roadmap: 100 to 10 Billion Users](#f2-scaling-roadmap-100-to-10-billion-users)
- [F3. Statistics Captured and How They Drive Decisions](#f3-statistics-captured-and-how-they-drive-decisions)
- [F4. Documentation Index](#f4-documentation-index)

---

## A1. System Requirements

| Tool | Version | Required? | What it's for |
|---|---|---|---|
| Node.js | 18+ | **Yes** | Frontend dev server, server runtime |
| npm | 9+ | **Yes** | Package management (comes with Node) |
| Rust | 1.70+ | Only for engine rebuild | Compiles the WASM chess engine |
| wasm-pack | 0.12+ | Only for engine rebuild | Rust → WASM build tool |
| Docker | 20+ | Only for server deploy | Containerized server deployment |
| Git | 2.30+ | **Yes** | Clone the repo |

**Don't have Rust?** That's fine. The pre-built WASM binary is included in `public/wasm/`. You only need Rust if you want to modify the chess engine.

---

## A2. Clone & Install (Frontend)

**Step 1: Clone**

```bash
git clone https://github.com/beautifulplanet/Promotion-Variant-Chess.git
cd "Promotion-Variant-Chess/version 1"
```

**Step 2: Install dependencies**

```bash
npm install
```

This installs: Three.js (3D rendering), chess.js (move validation fallback), Vite (dev server & bundler), Vitest (testing), Playwright (E2E tests), TypeScript, and Socket.io client.

Done. Two commands.

---

## A3. Run the Game Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

You should see:
- A newspaper-styled header reading **"The Chess Chronicle"**
- A 3D chess board with the starting position
- A sidebar with game controls (difficulty, undo, settings)
- Era-themed environment (starts at Stone Age for new players)

**Play against AI:** Click a white piece to see legal moves highlighted in green. Click a destination to move. The AI responds in <1 second.

**Controls:**
| Input | Action |
|---|---|
| Click/Tap | Select piece, make move |
| Scroll/Pinch | Zoom in/out |
| Drag | Orbit camera around the board |

---

## A4. Set Up the Multiplayer Server

**Step 1: Navigate**

```bash
cd server
```

**Step 2: Install**

```bash
npm install
```

**Step 3: Configure**

```bash
cp .env.example .env
```

The defaults work out of the box (port 3001, SQLite, dev JWT secret).

**Step 4: Initialize database**

```bash
npx prisma migrate dev
```

Creates `prisma/dev.db` with Player and Game tables.

**Step 5: Start**

```bash
npm run dev
```

Server runs on `http://localhost:3001`.

| Endpoint | What |
|---|---|
| `GET /health` | Status + DB connectivity |
| `GET /metrics` | Prometheus metrics |
| `POST /api/auth/register` | Create account |
| `POST /api/auth/login` | Get JWT token |
| `WebSocket /` | Real-time gameplay |

**Step 6: Test multiplayer** — Open two browser tabs. Both connect and enter the matchmaking queue automatically.

---

## A5. Run All Tests

```bash
# Frontend (420 tests, ~5s)
npm test

# Server (154 tests, ~8s)
cd server && npm test

# Rust engine (213 tests, ~2s)
cd rust-engine && cargo test

# E2E browser tests (5 tests)
npx playwright install chromium    # First time only
npm run e2e
```

**Total: 792 unit/integration tests + 5 E2E tests**

| Suite | Count | Covers |
|---|---|---|
| Rust engine | 218 | Bitboards, attacks, magic bitboards, move gen, search, eval, TT, Zobrist, perft, game state, tournament |
| Frontend | 420 | Game controller, ELO, era system, save system, chess engine, performance, AI aggression |
| Server | 154 | Auth, API, database CRUD, matchmaker, game rooms, metrics, protocol |
| E2E | 5 | App load, canvas interaction, console errors, article rendering, game move |

---

## A6. Rebuild the Rust Engine from Source

Only needed if you modify files in `rust-engine/src/`.

```bash
# Install Rust (skip if you have it)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
cargo install wasm-pack

# Build
cd rust-engine
wasm-pack build --target web --release --out-dir ../public/wasm

# Verify
cargo test    # All 213 tests
```

Output goes to `public/wasm/` — a `.wasm` binary (~170 KB gzipped) + JavaScript glue code.

---

## A7. Deploy to Production

### Frontend → Vercel

Push to `main`. Vercel auto-deploys.

```bash
git push origin main
```

### Server → Fly.io

```bash
cd server

# Install CLI + auth (one-time)
# Windows: irm https://fly.io/install.ps1 | iex
# Mac/Linux: curl -L https://fly.io/install.sh | sh
fly auth login

# Create app (detects fly.toml)
fly launch --no-deploy

# Create persistent volume for SQLite
fly volumes create chess_data --region iad --size 1

# Set secrets
fly secrets set JWT_SECRET=$(openssl rand -hex 32)

# Deploy
fly deploy

# Verify
curl https://chess-server-falling-lake-2071.fly.dev/health
curl https://chess-server-falling-lake-2071.fly.dev/metrics
```

---

## B1. System Overview in 60 Seconds

Three independently deployable components:

1. **Frontend** (TypeScript + Three.js + Vite) — SPA with WebGL 3D chessboard, 20 era environments, mouse/touch input
2. **Rust Chess Engine** (WASM) — Bitboard engine in the browser. Move gen, eval, alpha-beta search. 10–100× faster than JavaScript.
3. **Multiplayer Server** (Node.js + Express + Socket.io + Prisma) — Matchmaking, game rooms, ELO, JWT auth, SQLite persistence

**Key insight:** Engine runs **in the browser**. Zero latency for single-player. Zero server cost for AI. Server only coordinates multiplayer.

---

## B2. The AI Engine Fallback Chain

```
┌─────────────────────────────────────────────────────┐
│                  AI Move Request                     │
│                                                      │
│  1. Rust WASM Engine (fastest, ~1M+ NPS)            │
│     └─ if WASM fails to load ─────────────────┐     │
│                                                │     │
│  2. Stockfish.js Web Worker (strongest,        │     │
│     skill 0-20)                                │     │
│     └─ if Worker fails ────────────────────┐   │     │
│                                            │   │     │
│  3. TypeScript Engine (always works,       │   │     │
│     chess.js + minimax)                    │   │     │
└────────────────────────────────────────────┘   │     │
```

```typescript
// aiService.ts — simplified
if (this.rustEngineReady) {
  move = rustEngine.getBestMove(fen, depth);
} else if (this.workerReady) {
  move = await this.requestFromWorker(board, turn, elo);
} else {
  move = this.fallbackEngine.getBestMove(board, turn, depth);
}
```

**Why 3 engines?** WASM can fail (old browsers, CSP). Workers can fail (Safari bugs). TypeScript always works. User never sees a broken AI.

---

## B3. Bitboard Representation

64 squares → 64-bit integer. One bit per square. Bit 0 = a1, bit 63 = h8.

```rust
pub struct Position {
    pieces: [[Bitboard; 6]; 2],       // 12 bitboards: (color, piece_type)
    occupied_by_color: [Bitboard; 2], // All white, all black
    occupied_all: Bitboard,            // Combined
}
```

| Operation | Bitboard | Array |
|---|---|---|
| "Piece on e4?" | 1 AND | 1 array access |
| "Count pieces" | 1 POPCNT | Loop 64 |
| "Knight moves from e4" | 1 lookup | 8 bounds checks |
| "Rook moves from e4" | 1 mul + shift + lookup | Ray-cast loop |

Directional shifts: north = `<< 8`, east = `(<< 1) & NOT_FILE_A`.

---

## B4. Magic Bitboards for Sliding Pieces

Sliding pieces (rook, bishop, queen) attack depends on blockers. Magic bitboards: O(1) lookup.

1. Precompute relevant occupancy mask per square (excluding edges)
2. Enumerate all 2^N blocker configs
3. Find magic number M: `(blockers × M) >> (64 - N)` = unique index
4. Store attack bitboard per index

**Runtime:** 5 operations total (AND + multiply + shift + 2 lookups). Memory: ~840 KB tables.

---

## B5. Move Generation

**Phase 1 — Pseudolegal:** All moves obeying piece rules (ignoring check). Pawns, knights/kings (table lookup), sliding pieces (magic lookup), castling.

**Phase 2 — Legal:** Make each move, check if king in check, unmake if illegal.

~5M legal positions/sec in WASM. Stack-allocated MoveList (512 bytes, L1-cache-friendly).

Perft verified: depth 5 = 4,865,609 nodes.

---

## B6. Search Algorithm

Negamax alpha-beta with iterative deepening, enhanced with:

| Technique | Effect |
|---|---|
| Transposition Table | Cache results by Zobrist hash (~2× speedup) |
| Null Move Pruning | Skip turn — if still winning, prune (~3×) |
| Late Move Reductions | Later moves at reduced depth (~2×) |
| Killer Moves | Prioritize quiet moves that caused cutoffs (~1.5×) |
| MVV-LVA Ordering | Best captures first (~2×) |
| Quiescence Search | Resolve captures at leaf nodes |

Move ordering: TT best → Captures (MVV-LVA) → Promotions → Killers → Quiet. Reduces branching factor from ~35 to ~6.

---

## B7. Position Evaluation

Centipawns (100 = 1 pawn). Components:

- **Material:** P=100, N=320, B=330, R=500, Q=900
- **Piece-Square Tables:** Positional bonuses (center, castled king, advanced pawns)
- **Bishop Pair:** +30cp
- **Phase Detection:** <2000cp non-king material → endgame king PST

Simple eval + deep search (via WASM speed) > complex eval + shallow search.

---

## B8. Zobrist Hashing & Transposition Tables

64-bit position fingerprint via XOR of random keys. 781 keys generated at **compile time** (const fn PRNG). O(1) incremental update per move.

TT: 262,144 entries (~5 MB). Stores hash, depth, score, flag (Exact/Lower/Upper), best move. Depth-preferred replacement. Mate score adjustment for correct distance.

---

## B9. WASM Bridge Architecture

`wasm-pack build --target web --release` → `.wasm` (~170 KB gzipped) + JS glue.

Bridge (`rustEngine.ts`): blob URL dynamic import (Vite-compatible), try/catch every call, `pos.free()` after every use, cross-platform time via `#[cfg(target_arch)]`.

---

## B10. Rendering Pipeline

Three.js WebGL: shadow mapping, orbit controls, 20 era environments (procedural skyboxes, themed materials, dynamic lighting, particles). Mobile adaptive: auto-detect → disable shadows/antialias, cap DPR at 2.0. Debounced resize (150ms).

---

## B11. Multiplayer Architecture

Socket.io (WebSocket + HTTP long-polling fallback):

1. **Auth:** JWT in socket handshake
2. **Matchmaking:** Ranked queue, expanding ELO range
3. **Game Rooms:** Server-side chess.js validation, state broadcast, reconnect handling
4. **ELO:** Standard formula (K=32), persisted via Prisma
5. **State:** In-memory Map — appropriate for portfolio scale

---

## C1. Board Representation from First Principles

### The Fundamental Problem

Answer "what are the legal moves?" millions of times per second. Board representation determines speed.

### 8×8 Array (Rejected)

Finding rook attacks = loop through 7 squares × 4 directions with bounds checks. O(28) per rook. Branchy.

### Bitboards (This Engine)

`u64` where each bit = one square:

```
White pawns starting position:
  8  . . . . . . . .       Hex: 0x000000000000FF00
  2  X X X X X X X X  ← bits 8-15 set
  1  . . . . . . . .
```

| Chess Op | CPU Instruction |
|---|---|
| "Piece on e4?" | AND |
| "Empty squares" | NOT |
| "Pawns north" | SHIFT |
| "Count pieces" | POPCNT |
| "Find first" | TZCNT |
| "Pop first" | AND + SUB |

### `bitboard.rs` Implementation

```rust
#[derive(Clone, Copy, PartialEq, Eq, Default)]
pub struct Bitboard(pub u64);

// Directional shifts with edge masking
pub const fn east(self) -> Bitboard {
    Bitboard((self.0 << 1) & NOT_FILE_A.0)
}
pub const fn north(self) -> Bitboard {
    Bitboard(self.0 << 8)
}

// Iteration: Kernighan's bit-pop
pub fn pop_lsb(&mut self) -> Option<Square> {
    if self.0 == 0 { return None; }
    let sq = Square(self.0.trailing_zeros() as u8);
    self.0 &= self.0 - 1;
    Some(sq)
}
```

---

## C2. Types and Move Encoding

```rust
#[repr(u8)]
pub enum PieceType { Pawn = 0, Knight = 1, Bishop = 2, Rook = 3, Queen = 4, King = 5 }

#[repr(u8)]
pub enum Color { White = 0, Black = 1 }

pub struct Square(pub u8);  // 0-63

pub struct Move(pub u16);   // 16-bit packed
// Bits 0-5: from, 6-11: to, 12-13: promotion, 14-15: flags
```

16-bit encoding: 2 bytes per move. MoveList (256 max) = 512 bytes. L1 cache.

---

## C3. The Position Struct

```rust
pub struct Position {
    pieces: [[Bitboard; 6]; 2],
    occupied_by_color: [Bitboard; 2],
    occupied_all: Bitboard,
    side_to_move: Color,
    castling: CastlingRights,          // 4-bit mask: KQkq
    en_passant: Option<Square>,
    halfmove_clock: u8,
    fullmove_number: u16,
    hash: u64,                         // Zobrist, incrementally updated
}
```

**Make/Unmake:** Save undo info → apply move → update castling/EP/hash → check king safety → return `None` if illegal. Millions of calls during search. `unmake` reverses using saved UndoInfo.

---

## C4. Attack Tables — Knights, Kings, and Pawns

Fixed patterns. Precomputed at **compile time** (Rust const eval). 512 bytes baked into binary.

```rust
pub static KNIGHT_ATTACKS: [Bitboard; 64] = { /* 8 L-shapes, bounds-checked */ };
pub static KING_ATTACKS: [Bitboard; 64] = { /* 8 adjacent */ };
pub static WHITE_PAWN_ATTACKS: [Bitboard; 64] = { /* NW, NE */ };
pub static BLACK_PAWN_ATTACKS: [Bitboard; 64] = { /* SW, SE */ };
```

Usage: `KNIGHT_ATTACKS[sq.index()]` — one memory read.

---

## C5. Magic Bitboards — The Complete Theory

### Problem

Bishop on d4, blocker on f6 → can't see g7/h8. Attack set depends on blockers. Mask has N relevant bits → 2^N configs. Need O(1) lookup.

### Solution: Perfect Hash via Multiplication

```
index = (blockers × magic_number) >> (64 - N)
```

Multiplication "gathers" relevant bits into top N bits. Magic found by brute-force search.

### Construction (one-time ~2ms)

```rust
for sq in 0..64 {
    let mask = rook_mask(sq);
    let mut blockers = Bitboard::EMPTY;
    loop {
        let attacks = rook_attacks_slow(sq, blockers); // Ray-cast
        let index = (blockers * MAGIC) >> (64 - bits);
        table[sq][index] = attacks;
        blockers = (blockers.wrapping_sub(mask)) & mask; // Carry-Rippler
        if blockers == 0 { break; }
    }
}
```

### Runtime: 5 Operations

```rust
fn rook_attacks(sq: Square, occupied: Bitboard) -> Bitboard {
    let blockers = occupied & ROOK_MASKS[sq];     // AND
    let index = (blockers * MAGIC) >> shift;      // MUL + SHIFT
    ROOK_TABLE[sq][index]                          // LOOKUP
}
```

Queen = rook | bishop. Two lookups + OR.

Memory: rook ~800 KB + bishop ~40 KB. `OnceLock` lazy init.

---

## C6. Move Generation — Pseudolegal to Legal

### MoveList: Stack-Allocated

```rust
pub struct MoveList {
    moves: [Move; 256],  // No heap
    count: usize,
}
```

### Pawn Generation

1. Single push: `pawns.north() & empty` (all pawns at once)
2. Double push: `(singles & RANK_3).north() & empty`
3. Captures: per-pawn `pawn_attacks(from) & enemies`
4. Promotions: rank 8 moves → 4 variants (Q/R/B/N)
5. En passant

### Castling

Rights exist + not in check + path empty + king doesn't cross attacked squares.

### Legal Filter

```rust
for m in pseudo_legal.iter() {
    if let Some(undo) = pos.make_move(*m) {
        legal.push(*m);
        pos.unmake_move(*m, &undo);
    }
}
```

---

## C7. Position Evaluation — Material and Piece-Square Tables

`evaluate(pos) → Score` (centipawns, side-to-move perspective).

**Material:** P=100, N=320, B=330, R=500, Q=900, K=20000

**PST highlights:**
| Piece | Good square | Bonus | Bad square | Penalty |
|---|---|---|---|---|
| Pawn | d4/e4 (center) | +25 | a3/h3 (flank) | -20 |
| Pawn | rank 7 | +50 | — | — |
| Knight | center | +20 | rim | -50 |
| King (midgame) | g1 (castled) | +30 | e1 (center) | -50 |
| King (endgame) | center | +40 | — | — |

Bishop pair: +30. Phase: <2000cp non-king → endgame. Black mirroring: `sq ^ 56`.

---

## C8. Zobrist Hashing — Incremental Position Fingerprinting

XOR random keys for each (piece, square) + side + castling + EP. 781 keys via **compile-time** const fn xorshift64.

**Incremental update (O(1)):** XOR is self-inverse. Move piece: `hash ^= key(from); hash ^= key(to)`.

Collision: ~1 in 2^64 ≈ 1.8×10^19. Negligible in any search.

---

## C9. Transposition Table — Caching Search Results

```rust
pub struct TTEntry {
    hash: u64, depth: u8, score: Score,
    flag: TTFlag,              // Exact | LowerBound | UpperBound
    best_move: Option<Move>,
}
```

262,144 entries (~5 MB). Depth-preferred replacement.

**Mate adjustment:** Store as node-relative (`score + ply`), read as root-relative (`score - ply`).

---

## C10. Search — Minimax, Alpha-Beta, and Beyond

### Iterative Deepening

Depth 1 → 2 → 3 → ... TT shared across iterations. Previous depth's best move searched first.

### Null Move Pruning

Skip turn; if opponent can't beat beta despite two moves, prune. Conditions: not in check, not root, has pieces. Reduction: 2 plies.

### Late Move Reductions

After first 4 moves, search later moves at depth-1. Re-search at full depth if promising. Skip reduction for captures, promotions, killers, checks.

### Quiescence

At depth 0, search all captures until "quiet." Stand-pat: static eval as baseline. Eliminates horizon effect.

### Move Ordering

TT best (+100K) → Captures MVV-LVA (+10K) → Promotions (+9K) → Killers (+5K) → Quiet (0)

MVV-LVA: `victim × 10 - attacker`. QxP(100) < PxQ(8900).

---

## C11. WASM Compilation and the TypeScript Bridge

### Build

```bash
wasm-pack build --target web --release --out-dir ../public/wasm
```

`wasm_bindgen` generates bindings: `#[wasm_bindgen] pub fn get_best_move(...)` → callable from JS.

### Bridge Loading

```typescript
const jsCode = await fetch('./wasm/chess_engine.js').then(r => r.text());
const blob = new Blob([jsCode], { type: 'application/javascript' });
const wasm = await import(URL.createObjectURL(blob));
await wasm.default('./wasm/chess_engine_bg.wasm');
```

### Memory + Error Handling

`pos.free()` after every use. Every call try/caught. Cross-platform time: `js_sys::Date::now()` in WASM, `SystemTime` in native.

---

## C12. GameState — Full Game Lifecycle in Rust

```rust
pub struct GameState {
    position: Position,
    hash_history: Vec<u64>,              // Threefold repetition
    move_history: Vec<(Move, UndoInfo)>, // Undo support
    uci_history: Vec<String>,            // Human-readable
}
```

**Status:** Checkmate → Stalemate → Insufficient material → 50-move → Threefold → Playing.

**Undo:** Pop from all three vectors, unmake move.

**Board JSON:** 8×8 array for TypeScript rendering.

---

## C13. Testing and Correctness — Perft

Count all leaf nodes at depth N. Standard correctness benchmark.

```rust
pub fn perft(pos: &mut Position, depth: u32) -> u64 {
    if depth == 0 { return 1; }
    let moves = generate_legal_moves(pos);
    if depth == 1 { return moves.len() as u64; }
    moves.iter().map(|m| {
        if let Some(undo) = pos.make_move(*m) {
            let n = perft(pos, depth - 1);
            pos.unmake_move(*m, &undo);
            n
        } else { 0 }
    }).sum()
}
```

| Position | Depth | Nodes | Status |
|---|---|---|---|
| Starting | 5 | 4,865,609 | ✅ |
| Kiwipete | 4 | 4,085,603 | ✅ |

**218 Rust tests:** bitboards, attacks, magic validation, move gen, make/unmake, search, TT, Zobrist, game state, perft, tournament runner.

---

## D1. How would you scale to 10 billion users?

This project is designed with a scaling roadmap from portfolio-scale to planetary-scale. Each tier identifies the bottleneck, the fix, and the infrastructure change.

**Current Production (Tier 0 — up to ~100 concurrent):**
Single Node.js process on Fly.io `shared-cpu-1x` (256MB). In-memory `Map` for game rooms. SQLite on a 1GB persistent volume. All AI runs client-side (WASM). Rate-limited: 100 req/min HTTP, 20 msg/sec WebSocket, 10 connections/IP, 500 room cap. Graceful shutdown with 15-second drain.

**Tier 1 (100–1K concurrent):**
*Bottleneck:* Memory exhaustion from 500+ game rooms in Map. SQLite write lock contention.
*Fix:* Scale to `shared-cpu-2x` 512MB. Add WAL mode to SQLite. Optimize Map cleanup. Deploy Litestream for continuous DB backup to S3.

**Tier 2 (1K–10K concurrent):**
*Bottleneck:* Single-threaded event loop saturates at ~200 WebSocket messages/sec sustained. Single machine = single point of failure.
*Fix:*
```
     Load Balancer (sticky sessions via cookie)
     ┌──────────┬──────────┬──────────┐
     ▼          ▼          ▼          ▼
  Server 1   Server 2   Server 3   Server 4
     └──────────┴──────────┴──────────┘
                    │
              Redis Pub/Sub (Socket.io adapter)
                    │
               PostgreSQL (write) + Read Replica
```
Migrate to PostgreSQL with connection pooling (PgBouncer). Redis Pub/Sub for cross-server Socket.io. Separate matchmaker service. CDN for all static assets. Horizontal auto-scale 2–10 machines.

**Tier 3 (10K–100K concurrent):**
*Bottleneck:* Matchmaker becomes hot path. PostgreSQL single-writer bottleneck. WebSocket connection distribution uneven across regions.
*Fix:* Dedicated matchmaker microservice with Redis Streams work queue. Multi-region deployment (US-East, EU-West, APAC). PostgreSQL with Citus for sharding. Game state in Redis (TTL-based expiry). API Gateway for WebSocket routing.

**Tier 4 (100K–10M concurrent):**
*Bottleneck:* Monolithic game server can’t specialize. Redis single-instance limits. ELO calculations become bottleneck at millions of concurrent rating updates.
*Fix:* Kubernetes with horizontal pod autoscaling. Redis Cluster (16+ shards). ELO updates batched via Apache Kafka event stream → async workers. Dedicated services: Auth, Matchmaker, GameRoom, ELO, Replay, Analytics. gRPC between services. Circuit breakers (Istio service mesh).

**Tier 5 (10M–1B concurrent):**
*Bottleneck:* Database writes at billions of game records/day. Global latency for real-time moves.
*Fix:* Event sourcing — games stored as move streams in Kafka, materialized views for queries. CRDT-based game state for conflict-free multi-region writes. Edge compute for move validation close to players. Tiered storage: hot (Redis) → warm (PostgreSQL) → cold (S3 Parquet).

**Tier 6 (1B–10B total registered users):**
The key architectural advantage: because our AI engine runs **client-side in WASM**, the compute cost for AI games is **always zero** regardless of user count. Only multiplayer sessions require server resources. At 10B users with 1–5% concurrent, that’s ~50M–500M concurrent connections — achievable with Tier 5 architecture.

> **Full scaling analysis** → [Section F1](#f1-bottleneck-analysis-by-user-scale) and [Section F2](#f2-scaling-roadmap-100-to-10-billion-users)

---

## D2. How do you detect and handle cheating?

**Now:** Server-side move validation, rate limiting.

**At scale:** Time-per-move analysis (engines are suspiciously consistent), move quality correlation (>90% top-3 match = flagged), ELO volatility (800→2200 in one session = flagged), browser fingerprinting, behavioral analysis (tab-switching, no mouse movement).

Progressive: warning → temp ban → permanent ban.

---

## D3. Why Three.js instead of native mobile rendering?

**Pro:** One codebase, zero install friction (link → play), 30-second deploys, 97%+ WebGL support, WASM for compute.

**Con:** 25–40% render penalty vs Metal/Vulkan, higher memory, no native APIs, Safari limitations.

**Mitigations:** Adaptive quality, PWA, full touch controls. If funded: native renderers sharing Rust engine via static lib/JNI.

---

## D4. Why do you have multiple AI engines?

| Engine | Role | Strength |
|---|---|---|
| Rust WASM | Primary (fastest) | ~1800 ELO depth 5 |
| Stockfish.js | Strongest backup | ~800–2800 ELO |
| TypeScript | Always works | ~1200 ELO depth 4 |
| Learning AI | Experimental | Varies |

Graceful degradation. User always gets a working AI.

---

## D5. Why vanilla TypeScript instead of React/Vue/Svelte?

1. **Three.js IS the framework.** 80% canvas. React adds virtual DOM overhead for canvas updates.
2. **Simple state.** One chess position. No nested component rerenders.
3. **Performance.** Direct scene graph updates. O(1) piece moves.
4. **Bundle.** ~400 KB total. React alone = +45 KB.

If UI grew: Solid.js for non-canvas panels. Canvas stays vanilla.

---

## D6. How does the WASM binary get loaded in the browser?

1. `initEngine()` at startup
2. Fetch JS glue code → blob URL → dynamic import
3. `wasm.default(path)` → `WebAssembly.instantiateStreaming` (compile while downloading)
4. ~50–100ms load. ~170 KB gzipped.
5. If fails → fallback to Stockfish → TypeScript

---

## D7. What are the performance characteristics on mobile?

| Metric | Desktop | Mobile (Pixel 7) | Budget |
|---|---|---|---|
| FPS (mobile mode) | 60 | 50–60 | 30–40 |
| Move gen (WASM) | ~5M pos/s | ~2M pos/s | — |
| Depth 5 search | ~300ms | ~700ms | ~5000ms (JS) |
| Memory | ~80 MB | ~50 MB | ~50 MB |

WASM = ~60% desktop speed on mobile. JS fallback = ~10× slower.

---

## D8. How does the ELO system work?

`R_new = R_old + K × (S - E)` where K=32, E = 1/(1 + 10^((R_opp - R)/400))

1200 beats 1500 → expected 15% → new rating: 1227 (+27). Starting ELO: 400. ELO ranges map to 20 eras.

---

## D9. What would you do differently if you started over?

**Keep:** Rust WASM, bitboards, Three.js, Vite, Socket.io.

**Change:** Lightweight UI framework (Solid.js), split renderer into SceneManager/CameraController/PieceRenderer, ECS pattern for 3D, type-safe WebSocket messages (tRPC/Zod), PostgreSQL from day one, tapered evaluation.

---

## D10. How do you test a 3D game?

| Layer | Tool | Count |
|---|---|---|
| Engine | cargo test | 213 |
| Frontend | Vitest | 420 |
| Server | Vitest | 154 |
| E2E | Playwright | 5 |
| Load (HTTP) | k6 | 6 scenarios |
| Load (WebSocket) | k6 | ramp to 200 VUs |
| Stress | k6 | 500 RPS / 250 WS |

**Mocked:** Three.js (no GPU), chess.js, Socket.io, localStorage.

**Load testing:** 3 k6 scripts validate SLOs under pressure — HTTP API (P95 < 500ms, <5% error rate), WebSocket gameplay simulation (200 concurrent, <2s connect), and stress/breaking point discovery (500 RPS, 250 concurrent WS). See [D14](#d14-what-are-your-load-testing-methodology-and-slos).

**Priority:** Correctness (engine) > Functionality (game) > Reliability (server) > Load (capacity) > Appearance (renderer).

---

## D11. What is the AI Tournament System?

A standalone **1-million-player AI tournament runner** (`rust-engine/src/bin/tournament.rs`, 866 lines) exercises the chess engine at scale for statistical analysis and A/B testing.

**Architecture:** `CLI (clap) → Generate AI Personas → Swiss Pairing → Parallel Games (rayon) → SQLite Results`

Each AI player has unique personality traits: `search_depth` (1–6), `aggression` (0.0–1.0), `opening_style` (King's Pawn / Queen's Pawn / English / Réti / Random), `blunder_rate` (0.0–0.15).

**A/B Testing:** Players split into Group A (control) and Group B (treatment — reward bonuses). Measures: mean ELO, win/loss/draw ratios, average game length, blunder frequency, opening effectiveness.

**Scale:** 1K players in ~2 min, 100K in ~30 min, 1M in ~5 hours using all cores via rayon.

```bash
cargo run --release --bin tournament -- --players 1000000 --rounds 20 --threads 0
```

> Full details in the [main README Section D11](../README.md#d11-what-is-the-ai-tournament-system)

---

## D12. What metrics do you capture and why?

16 custom Prometheus metrics + Node.js defaults. Each metric answers a specific operational question:

| Metric | Type | Question |
|---|---|---|
| `chess_connected_players` | Gauge | How many users online? |
| `chess_active_games` | Gauge | How many rooms consuming memory? |
| `chess_games_started_total` | Counter | Game creation rate? |
| `chess_games_completed_total` | Counter | Completion rate by result/reason? |
| `chess_queue_length` | Gauge | Are players waiting too long? |
| `chess_queue_wait_seconds` | Histogram | P50/P95/P99 matchmaking wait |
| `chess_moves_total` | Counter | Total move throughput |
| `chess_move_processing_seconds` | Histogram | Move validation latency |
| `chess_auth_total` | Counter | Auth rate by type/result |
| `chess_errors_total` | Counter | Error rate by code |
| `chess_db_query_seconds` | Histogram | SQLite bottleneck detection |
| `chess_rate_limit_hits_total` | Counter | False positive rate |
| `chess_ws_rate_limit_total` | Counter | WebSocket abuse rate |
| `chess_shutdown_in_progress` | Gauge | Deploy awareness |
| `chess_process_crashes_total` | Counter | Crash frequency |

> Full details in the [main README Section D12](../README.md#d12-what-metrics-do-you-capture-and-why)

---

## D13. What is your production resilience strategy?

Seven layers of defense:

1. **Fly.io Edge** → TLS termination, DDoS protection, auto-start
2. **Helmet.js** → Security headers (HSTS, X-Frame-Options, nosniff)
3. **Rate Limiting** → 100 req/min HTTP, 20 msg/sec WS, 10 conn/IP
4. **Input Validation** → Zod schemas, chess.js move validation, size limits
5. **Resource Protection** → 500 room cap, stale cleanup, 16KB body limit
6. **Observability** → 16 Prometheus metrics, health check with DB test
7. **Recovery** → Graceful shutdown (15s drain), crash handlers, memory alerts

> Full details in the [main README Section D13](../README.md#d13-what-is-your-production-resilience-strategy) and [docs/PRODUCTION_RESILIENCE.md](PRODUCTION_RESILIENCE.md)

---

## D14. What are your load testing methodology and SLOs?

**SLOs:** 99.5% availability, HTTP P95 < 500ms, P99 < 1000ms, <5% error rate, WS connect P95 < 2s, WS message P95 < 500ms, >90% connection success.

**Test scripts:** `http-load-test.js` (6 scenarios, ramp to 100 VUs), `websocket-load-test.js` (gameplay sim, 200 concurrent), `stress-test.js` (500 RPS, 250 WS).

```bash
k6 run load-tests/http-load-test.js
k6 run load-tests/websocket-load-test.js
k6 run load-tests/stress-test.js
```

> Full details in the [main README Section D14](../README.md#d14-what-are-your-load-testing-methodology-and-slos) and [docs/LOAD_TEST_PLAN.md](LOAD_TEST_PLAN.md)

---

## E1. File Map

```
├── src/                       # Frontend TypeScript
│   ├── main-3d.ts             # Entry point, DOM wiring
│   ├── gameController.ts      # Core game logic (1935 lines)
│   ├── renderer3d.ts          # Three.js 3D rendering (4300+ lines)
│   ├── chessEngine.ts         # chess.js wrapper engine
│   ├── rustEngine.ts          # WASM bridge to Rust
│   ├── stockfishEngine.ts     # Stockfish.js Worker wrapper
│   ├── aiService.ts           # AI fallback chain orchestrator
│   ├── eraSystem.ts           # ELO → era progression
│   ├── eras/                  # 9 era-specific world definitions
│   └── ...                    # Sound, save, stats, themes, overlays
│
├── rust-engine/               # Rust chess engine → WASM
│   └── src/
│       ├── lib.rs             # WASM entry points + GameState
│       ├── search.rs          # Alpha-beta with TT, NMP, LMR
│       ├── movegen.rs         # Legal move generation
│       ├── eval.rs            # Material + PST evaluation
│       ├── magic.rs           # Magic bitboard tables
│       ├── attacks.rs         # Precomputed attack tables
│       ├── bitboard.rs        # 64-bit board representation
│       ├── position.rs        # Board state + make/unmake
│       ├── types.rs           # Piece, Square, Move encoding
│       └── bin/
│           └── tournament.rs  # 1M AI tournament runner (866 lines)
│
├── server/                    # Multiplayer backend
│   ├── src/
│   │   ├── index.ts           # Express + Socket.io (1090 lines)
│   │   ├── resilience.ts      # Graceful shutdown, crash recovery, rate limiting
│   │   ├── metrics.ts         # 16 Prometheus metrics
│   │   ├── GameRoom.ts        # Game session management
│   │   ├── Matchmaker.ts      # Ranked queue + pairing
│   │   ├── auth.ts            # JWT authentication
│   │   ├── database.ts        # Prisma service layer
│   │   └── protocol.ts        # Zod message schemas
│   ├── prisma/schema.prisma   # Player + Game models
│   ├── Dockerfile             # Multi-stage production build
│   └── fly.toml               # Fly.io deployment config
│
├── load-tests/                # k6 load testing suite
│   ├── http-load-test.js      # HTTP API: 6 scenarios, ramp to 100 VUs
│   ├── websocket-load-test.js # WebSocket: gameplay sim, 200 concurrent
│   └── stress-test.js         # Breaking point: 500 RPS, 250 WS connections
│
├── tests/                     # Frontend test suite (420 tests)
├── e2e/                       # Playwright E2E tests (5 tests)
├── public/wasm/               # Pre-built WASM binary
├── docs/                      # Documentation
│   ├── PART1_SUMMARY.md       # Standalone Part 1
│   ├── PART2_TECH_STACK.md    # Standalone Part 2
│   ├── PART3_QUICK_START.md   # Standalone Part 3
│   ├── PART4_FULL_TUTORIAL.md # Standalone Part 4
│   ├── INCIDENT_RESPONSE.md   # P0-P3 incident runbook
│   ├── LOAD_TEST_PLAN.md      # k6 methodology, SLOs, capacity planning
│   ├── PRODUCTION_RESILIENCE.md # Defense-in-depth, failure modes, SLOs
│   ├── ARCHITECTURE_FAQ.md    # "Why X over Y?" for every decision
│   ├── adr/                   # Architecture Decision Records
│   └── blog/                  # Blog post drafts
└── index.html                 # Single-page app entry (1638 lines)
```

---

## F1. Bottleneck Analysis by User Scale

| Concurrent Users | First Bottleneck | Symptom | Detection Metric |
|---|---|---|---|
| **50–100** | Memory (256MB) | Slow responses, OOM | `process_resident_memory_bytes` |
| **100–500** | SQLite write lock | Auth/leaderboard timeout | `chess_db_query_seconds P95` |
| **500–2K** | Single-core CPU | Event loop lag > 100ms | `nodejs_eventloop_lag_seconds` |
| **2K–10K** | Single machine | Total outage on crash | `chess_process_crashes_total` |
| **10K–100K** | Matchmaker latency | Queue wait > 30s | `chess_queue_wait_seconds P95` |
| **100K–1M** | Redis memory | Stale game state | Redis `used_memory` |
| **1M–100M** | DB write throughput | Write conflicts | Kafka consumer lag |
| **100M–10B** | Organizational | Feature velocity drops | Deployment frequency |

---

## F2. Scaling Roadmap: 100 to 10 Billion Users

| Phase | Concurrent | Monthly Cost | Key Changes |
|---|---|---|---|
| **0 (current)** | 10–100 | $0–6 | Single Node.js + SQLite, Vercel CDN |
| **1** | 100–1K | $15–30 | Bigger instance, SQLite WAL, Litestream |
| **2** | 1K–10K | $100–300 | PostgreSQL, Redis, 2–4 servers, load balancer |
| **3** | 10K–100K | $1K–5K | Multi-region, Kubernetes, dedicated matchmaker |
| **4** | 100K–10M | $10K–100K | CockroachDB, Redis Cluster, Kafka, microservices |
| **5** | 10M–1B | $500K–5M | Event sourcing, CRDTs, edge compute, tiered storage |
| **6** | 1B–10B | $10M+ | Multi-cloud, custom CDN, data sovereignty |

**Key insight:** AI runs client-side in WASM. 10B single-player sessions = $0 server cost. Server only scales with multiplayer — typically 1–5% of registered users.

---

## F3. Statistics Captured and How They Drive Decisions

| Source | Statistic | Decision It Drives |
|---|---|---|
| Server | `chess_connected_players` trend | When to scale up |
| Server | `chess_queue_wait_seconds` P95 | Matchmaker optimization timing |
| Server | `chess_db_query_seconds` P95 | When to migrate SQLite → PostgreSQL |
| Server | `chess_rate_limit_hits_total` rate | Rate limit calibration |
| Server | `nodejs_eventloop_lag_seconds` | Horizontal scaling trigger |
| Tournament | ELO distribution by A/B group | Do reward bonuses improve play? |
| Tournament | Win rate by `search_depth` | Adaptive difficulty tuning |
| Tournament | Win rate by `opening_style` | Engine balance validation |
| Tournament | Average game length | Memory budget per game room |
| k6 | HTTP P95 at 50/100 VUs | SLO compliance |
| k6 | First failure VU count | Maximum safe concurrent users |
| k6 | WS connection success at 200 | Concurrent player capacity |

---

## F4. Documentation Index

| Document | Purpose | Audience |
|---|---|---|
| [README.md](../README.md) | Everything — summary through deep dive | Everyone |
| [PART1_SUMMARY.md](PART1_SUMMARY.md) | 30-second project summary | Hiring managers |
| [PART2_TECH_STACK.md](PART2_TECH_STACK.md) | Architecture and stack decisions | Senior engineers |
| [PART3_QUICK_START.md](PART3_QUICK_START.md) | Clone, install, run in 2 minutes | Developers |
| [PART4_FULL_TUTORIAL.md](PART4_FULL_TUTORIAL.md) | Complete engine manual + system design | Learners |
| [PRODUCTION_RESILIENCE.md](PRODUCTION_RESILIENCE.md) | SLOs, defense-in-depth, failure modes | SRE / DevOps |
| [LOAD_TEST_PLAN.md](LOAD_TEST_PLAN.md) | k6 methodology, capacity planning | Performance engineers |
| [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) | P0–P3 runbook, diagnostics, rollback | On-call engineers |
| [ARCHITECTURE_FAQ.md](ARCHITECTURE_FAQ.md) | "Why did you choose X?" — every trade-off explained | Staff+ interviewers |

---

## License

[MIT](../LICENSE)

---

*Built with Rust, TypeScript, and Three.js. 792 tests. 3 k6 load test suites. 1-million-AI tournament runner. Zero frameworks. One `<canvas>`.*

---

*[← Part 3: Quick Start](PART3_QUICK_START.md) · [Back to main README](../README.md)*
