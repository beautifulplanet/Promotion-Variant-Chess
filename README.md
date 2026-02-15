# The Chess Chronicle ♟️

**A full-stack 3D chess game where you journey through twenty ages of human history — from the age of dinosaurs to transcendent cosmic realms — powered by a custom Rust chess engine compiled to WebAssembly.**

🎮 **[▶ PLAY NOW](https://promotion-variant-chess.vercel.app)** 🎮
🔌 **[Multiplayer Server](https://chess-server-falling-lake-2071.fly.dev)** 🔌
📈 **[Health Check](https://chess-server-falling-lake-2071.fly.dev/health)** · 📊 **[Metrics](https://chess-server-falling-lake-2071.fly.dev/metrics)**

> *792 tests. 3 languages. 1 WebAssembly binary. Zero frameworks. Production-hardened with k6 load testing, rate limiting, and a 1-million-AI tournament runner.*

<!-- Screenshot placeholder: Replace with actual screenshot -->
<!-- ![The Chess Chronicle](docs/images/screenshot.png) -->

---

## How to Read This README

This document serves **four audiences**. Jump to what you need:

| You are... | Start here | Time |
|---|---|---|
| **Hiring manager** wanting the highlights | [Part 1: Summary](#part-1-summary) | 30 seconds |
| **Senior engineer** evaluating the architecture | [Part 2: Tech Stack & Architecture](#part-2-tech-stack--architecture) | 1 minute |
| **Developer** wanting to run it locally | [Part 3: Quick Start](#part-3-quick-start) | 2 minutes |
| **Learner** wanting to understand everything | [Part 4: Full Tutorial](#part-4-full-tutorial--deep-dive) | 30+ minutes |

Each part is also available as a **standalone document** if you only want one section:

| Part | In this README | Standalone doc |
|---|---|---|
| Summary | [Jump ↓](#part-1-summary) | [docs/PART1_SUMMARY.md](docs/PART1_SUMMARY.md) |
| Tech Stack | [Jump ↓](#part-2-tech-stack--architecture) | [docs/PART2_TECH_STACK.md](docs/PART2_TECH_STACK.md) |
| Quick Start | [Jump ↓](#part-3-quick-start) | [docs/PART3_QUICK_START.md](docs/PART3_QUICK_START.md) |
| Full Tutorial | [Jump ↓](#part-4-full-tutorial--deep-dive) | [docs/PART4_FULL_TUTORIAL.md](docs/PART4_FULL_TUTORIAL.md) |

---

# Part 1: Summary

*30 seconds. What this is, what it does, why it matters.*

### What

A chess game that combines:
- **Custom Rust chess engine** compiled to WebAssembly (bitboards, magic bitboards, alpha-beta search, transposition tables)
- **3D rendering** with Three.js — 20 procedurally generated era environments
- **AI Aggression system** — 20-level slider controlling bonus pieces, board rearrangement, and pawn upgrades
- **Real-time multiplayer** via Socket.io with ELO matchmaking, JWT auth, game persistence
- **Progressive Web App** — installable on mobile, offline-capable

### Why It's Interesting (for Interviewers)

| Talking Point | Detail |
|---|---|
| Systems programming | Rust engine: bitboard move gen, magic bitboard lookups, Zobrist hashing — all compiled to WASM |
| Full-stack ownership | Frontend (TS + Three.js), backend (Node + Express + Prisma), engine (Rust), infra (Docker + Fly.io) |
| Testing discipline | 792 tests: 218 Rust (cargo test) + 420 frontend (Vitest) + 154 server (Vitest) |
| Performance engineering | Engine does ~5M positions/sec in WASM. Magic bitboards reduce sliding piece lookup from O(28) to O(1) |
| Graceful degradation | Triple AI fallback: Rust WASM → Stockfish.js Worker → TypeScript minimax. Game always works. |
| Production resilience | Rate limiting (HTTP + WS), graceful shutdown, crash recovery, Helmet.js security headers, k6 load testing |
| Large-scale AI experimentation | 1-million-player tournament runner with Swiss pairing, A/B testing, rayon parallelism, SQLite analytics |

### Key Numbers

| Metric | Value |
|---|---|
| Rust engine source | 12 files, ~7,000 lines (includes 866-line tournament runner) |
| Frontend source | 20+ files, TypeScript |
| Server source | 10+ files, 1,090-line main server + resilience module |
| Load test scripts | 3 k6 scripts (HTTP, WebSocket, stress) |
| Perft correctness | Matches all standard values through depth 5 (4,865,609 nodes) |
| WASM binary | ~170 KB gzipped |
| Test count | 792 total across 3 languages |
| Prometheus metrics | 16 custom metrics + Node.js defaults |

---

# Part 2: Tech Stack & Architecture

*1 minute. What's used, how it fits together, and the key design decisions.*

### Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | TypeScript, Three.js, Vite | WebGL 3D rendering, zero-framework for canvas-heavy app |
| Chess Engine | Rust → WebAssembly (wasm-bindgen) | 10–100× faster than JS, runs client-side for zero server cost |
| Multiplayer | Node.js, Express, Socket.io | Real-time WebSocket with HTTP long-polling fallback |
| Database | Prisma ORM, SQLite (dev/prod) | Type-safe queries, zero-config dev, persistent volume in prod |
| Auth | JWT + bcryptjs | Stateless auth, guest accounts with optional registration |
| Security | Helmet.js, express-rate-limit, CORS | Security headers, brute-force protection, origin whitelisting |
| Metrics | Prometheus (prom-client) | 16 custom metrics + Node.js defaults, `/metrics` endpoint |
| Load Testing | k6 (Grafana) | HTTP, WebSocket, and stress test scripts with SLO thresholds |
| AI Tournament | Rust (rayon, clap, rusqlite) | 1M-player Swiss tournament with A/B testing and parallel execution |
| Testing | Vitest + cargo test + Playwright | Unit, integration, E2E across all 3 languages |
| Deploy | Vercel (frontend), Docker + Fly.io (server) | Edge CDN for static, persistent VM for WebSocket server |

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Browser                          │
│                                                      │
│  ┌──────────┐   ┌────────────┐   ┌──────────────┐   │
│  │ Three.js │   │   Game     │   │  Socket.io   │   │
│  │ Renderer │◄──┤ Controller ├──►│   Client     │   │
│  └──────────┘   └─────┬──────┘   └──────┬───────┘   │
│                       │                  │           │
│               ┌───────▼────────┐         │           │
│               │  Engine Bridge │         │           │
│               │  (TypeScript)  │         │           │
│               └───────┬────────┘         │           │
│                       │                  │           │
│               ┌───────▼────────┐         │           │
│               │  Rust Engine   │         │           │
│               │    (WASM)      │         │           │
│               └────────────────┘         │           │
└──────────────────────────────────────────┼───────────┘
                                           │ WebSocket
                                  ┌────────▼─────────┐
                                  │   Chess Server    │
                                  │  Express + WS     │
                                  ├──────────────────-┤
                                  │ Matchmaker  │ ELO │
                                  │ Game Rooms  │ Auth│
                                  ├──────────────────-┤
                                  │   Prisma + SQLite  │
                                  └────────────────────┘
```

### AI Fallback Chain

The engine runs **in the browser**, not on the server. Three engines cascade for 100% availability:

```
Request → Rust WASM (~1M+ NPS)
             ↓ if WASM fails to load
          Stockfish.js Worker (~200K NPS, skill 0-20)
             ↓ if Worker fails
          TypeScript minimax (~10K NPS, always works)
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Engine in browser, not server | Zero latency for single-player, zero server cost for AI, scales to infinite players |
| Vanilla TS, no React | App is 80% canvas. React's virtual DOM adds overhead for `<canvas>` updates |
| SQLite in production | Portfolio-scale traffic. Persistent Fly.io volume. Avoids Postgres complexity |
| Bitboard representation | O(1) attack lookups via magic bitboards. Industry standard for chess engines |
| 16-bit move encoding | 2 bytes per move. 256-move list fits in 512 bytes (L1 cache) |

---

# Part 3: Quick Start

*2 minutes. Clone, install, play.*

### Prerequisites

- **Node.js 18+**
- **Rust + wasm-pack** *(only if rebuilding the WASM engine — pre-built binary included)*

### Frontend (play the game)

```bash
git clone https://github.com/beautifulplanet/Promotion-Variant-Chess.git
cd "Promotion-Variant-Chess/version 1"
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). That's it.

### Multiplayer Server (optional)

```bash
cd server
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Server starts on `http://localhost:3001`.

### Run Tests

```bash
npm test                          # 420 frontend tests
cd server && npm test             # 154 server tests
cd rust-engine && cargo test      # 218 Rust engine tests
```

### Build for Production

```bash
npm run build                     # TypeScript check + Vite → dist/
```

### Rebuild the WASM Engine (optional)

```bash
cd rust-engine
wasm-pack build --target web --release --out-dir ../public/wasm
```

> **Need more detail?** See [Part 4: Full Tutorial](#part-4-full-tutorial--deep-dive) for step-by-step setup with explanations, or the [standalone tutorial doc](docs/PART4_FULL_TUTORIAL.md).

---

# Part 4: Full Tutorial & Deep Dive

*The IKEA manual. Step-by-step setup, complete engine reference, system design Q&A. Everything you need to understand, modify, or rebuild any part of this project.*

> **This section is large.** Use the table of contents below to jump to what you need.
> It's also available as a [standalone document → docs/PART4_FULL_TUTORIAL.md](docs/PART4_FULL_TUTORIAL.md) with its own table of contents.

---

## Part 4 — Table of Contents

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

# Rust engine (218 tests, ~2s)
cd rust-engine && cargo test

# E2E browser tests (4 tests)
npx playwright install chromium    # First time only
npm run e2e
```

**Total: 792 unit/integration tests + 4 E2E tests**

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
cargo test    # All 218 tests
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

Perft verified: depth 5 = 4,865,609 nodes ✅

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
*Fix:* Dedicated matchmaker microservice with Redis Streams work queue. Multi-region deployment (US-East, EU-West, APAC). PostgreSQL with Citus for sharding. Game state in Redis (TTL-based expiry). API Gateway for WebSocket routing. Health-check-driven auto-scaling with custom Prometheus alerting.

**Tier 4 (100K–10M concurrent):**
*Bottleneck:* Monolithic game server can't specialize. Redis single-instance limits. ELO calculations become bottleneck with millions of concurrent rating updates.
*Fix:*
```
                   Global Load Balancer (GeoDNS)
                   ┌──────────────────────────┐
                   │         │                │
              US-East     EU-West          APAC
              ┌────┐     ┌────┐          ┌────┐
              │ K8s│     │ K8s│          │ K8s│
              └──┬─┘     └──┬─┘          └──┬─┘
                 │          │               │
              ┌──▼──────────▼───────────────▼──┐
              │      Redis Cluster (sharded)    │
              └──────────────┬─────────────────┘
                             │
              ┌──────────────▼─────────────────┐
              │  CockroachDB / Spanner (global) │
              └────────────────────────────────┘
```
Kubernetes with horizontal pod autoscaling. Redis Cluster (16+ shards). ELO updates batched via Apache Kafka event stream → async workers. Game replay storage in object store (S3). Dedicated services: Auth, Matchmaker, GameRoom, ELO, Replay, Analytics. gRPC between services. Circuit breakers (Istio service mesh).

**Tier 5 (10M–1B concurrent):**
*Bottleneck:* Database writes at billions of game records/day. Global latency for real-time moves. Cost of always-on infrastructure.
*Fix:* Event sourcing — games stored as move streams in Kafka, materialized views for queries. CRDT-based game state for conflict-free multi-region writes. Edge compute (Cloudflare Workers / Fly.io Machines) for move validation close to players. Tiered storage: hot (Redis) → warm (PostgreSQL) → cold (S3 Parquet). Cost optimization: spot instances for AI tournament workloads, reserved instances for stateful services.

**Tier 6 (1B–10B total registered users):**
*Bottleneck:* You're now operating at planetary scale. The challenge is no longer technical — it's organizational, economic, and regulatory.
*Fix:* This is the Meta/Google tier. User table sharded by region. Data sovereignty compliance (GDPR, CCPA, etc.). Multi-cloud (AWS + GCP + Azure) for resilience. Custom CDN. Dedicated SRE team. The interesting architectural note: because our AI engine runs **client-side in WASM**, the compute cost for AI games is **always zero** regardless of user count. Only multiplayer games cost server resources — and even at 10B users, the concurrent player count is a fraction (typically 1–5%). This means the real scaling target for the server is ~50M–500M concurrent connections, which is achievable with Tier 5 architecture.

> **Full scaling analysis** → [docs/PRODUCTION_RESILIENCE.md](docs/PRODUCTION_RESILIENCE.md)
> **Load test methodology** → [docs/LOAD_TEST_PLAN.md](docs/LOAD_TEST_PLAN.md)
> **Bottleneck analysis** → [Section F1](#f1-bottleneck-analysis-by-user-scale)

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
| Engine | cargo test | 218 |
| Frontend | Vitest | 420 |
| Server | Vitest | 154 |
| E2E | Playwright | 5 |
| Load (HTTP) | k6 | 6 scenarios |
| Load (WebSocket) | k6 | ramp to 200 VUs |
| Stress | k6 | 500 RPS / 250 WS |

**Mocked:** Three.js (no GPU), chess.js, Socket.io, localStorage.

**Load testing:** 3 k6 scripts validate SLOs under pressure — HTTP API (P95 < 500ms, <5% error rate), WebSocket gameplay simulation (200 concurrent, <2s connect), and stress/breaking point discovery (500 RPS, 250 concurrent WS). See [D14](#d14-what-are-your-load-testing-methodology-and-slos) for full methodology.

**Priority:** Correctness (engine) > Functionality (game) > Reliability (server) > Load (capacity) > Appearance (renderer).

---

## D11. What is the AI Tournament System?

The project includes a standalone **1-million-player AI tournament runner** (`rust-engine/src/bin/tournament.rs`, 866 lines) that exercises the chess engine at scale for statistical analysis and A/B testing.

### Architecture

```
CLI (clap) → Generate AI Personas → Swiss Pairing → Parallel Games (rayon) → SQLite Results
                                         ↑ repeat for N rounds ↓
```

### AI Personas

Each AI player has unique personality traits generated from a seeded RNG:

| Trait | Range | Effect |
|---|---|---|
| `search_depth` | 1–6 | How many plies deep the engine searches |
| `aggression` | 0.0–1.0 | Preference for captures and forward moves |
| `opening_style` | 5 types | First move preference: King's Pawn (e4), Queen's Pawn (d4), English (c4), Réti (Nf3), or Random |
| `blunder_rate` | 0.0–0.15 | Probability of playing a random move instead of the best move |

### Swiss Pairing

Standard Swiss-system tournament: players with similar scores are paired each round. This produces statistically meaningful ELO distributions without requiring a full round-robin (which would be O(N²) games for N players).

| Players | Rounds | Total Games | Time (est.) |
|---|---|---|---|
| 1,000 | 10 | 5,000 | ~2 minutes |
| 100,000 | 15 | 750,000 | ~30 minutes |
| 1,000,000 | 20 | 10,000,000 | ~5 hours |

### A/B Testing Framework

Players are split into two groups:
- **Group A (Control):** Standard search with no modifications
- **Group B (Treatment):** Receives "reward bonuses" — evaluation score adjustments that incentivize certain play patterns

**Hypothesis:** Do reward bonuses produce stronger or weaker players over many games?

**Metrics captured per group:**
- Mean ELO after N rounds
- Win/loss/draw ratios
- Average game length (moves)
- Blunder frequency
- Opening style effectiveness (win rate by first move)
- Score variance and standard deviation

**Statistical analysis:** The tournament outputs to SQLite, enabling post-hoc SQL queries:

```sql
-- Compare mean ELO by group
SELECT group_name, AVG(elo), STDDEV(elo), COUNT(*) FROM players GROUP BY group_name;

-- Win rate by opening style
SELECT opening_style, 
       SUM(wins) * 1.0 / (SUM(wins) + SUM(losses) + SUM(draws)) as win_rate
FROM players GROUP BY opening_style;

-- Search depth vs ELO correlation
SELECT search_depth, AVG(elo) FROM players GROUP BY search_depth ORDER BY search_depth;
```

### Running the Tournament

```bash
cd rust-engine

# Quick test (1K players, ~2 min)
cargo run --release --bin tournament -- --players 1000 --rounds 10

# Full run (1M players, ~5 hours, all cores)
cargo run --release --bin tournament -- --players 1000000 --rounds 20 --threads 0

# With custom seed for reproducibility
cargo run --release --bin tournament -- --players 10000 --rounds 12 --seed 12345 --output results.db
```

### How This Experiment Helps Scale to 10 Billion Users

The tournament runner answers questions that direct database and infrastructure design:

1. **ELO distribution shape** → Determines shard key ranges for user partitioning at scale
2. **Game length distribution** → Informs timeout policies and memory budgets per game room
3. **Blunder rate vs depth** → Guides adaptive AI difficulty (how to set difficulty for 10B users with varying skill)
4. **Opening diversity** → Validates that the engine produces interesting games (player retention)
5. **A/B test methodology** → Proves the framework works before testing on real users

---

## D12. What metrics do you capture and why?

Every metric is chosen to answer a specific operational question.

### Server Metrics (Prometheus)

| Metric | Type | Question It Answers |
|---|---|---|
| `chess_connected_players` | Gauge | How many users are online right now? |
| `chess_active_games` | Gauge | How many game rooms are consuming memory? |
| `chess_games_started_total` | Counter | What's our game creation rate? |
| `chess_games_completed_total` | Counter | What's the completion rate? (labeled by result + reason) |
| `chess_queue_length` | Gauge | Are players waiting too long for matches? |
| `chess_queue_wait_seconds` | Histogram | P50/P95/P99 matchmaking wait time |
| `chess_moves_total` | Counter | Total move throughput across all games |
| `chess_move_processing_seconds` | Histogram | Is move validation creating latency? |
| `chess_auth_total` | Counter | Auth attempt rate by type (guest/register/login) and result |
| `chess_errors_total` | Counter | Error rate by code (used for alerting thresholds) |
| `chess_db_query_seconds` | Histogram | Is SQLite becoming a bottleneck? |
| `chess_rate_limit_hits_total` | Counter | Are legitimate users being rate-limited? |
| `chess_ws_rate_limit_total` | Counter | WebSocket abuse detection rate |
| `chess_shutdown_in_progress` | Gauge | Is the server currently draining? (deploy awareness) |
| `chess_process_crashes_total` | Counter | Crash frequency — any value > 0 needs investigation |
| `chess_*` (default) | Various | Node.js process: CPU, memory, event loop lag, GC pause |

### How Metrics Drive Scaling Decisions

```
chess_connected_players > 150  →  Warning: approaching Tier 1 capacity
chess_active_games > 300       →  Warning: approaching room limit (500)
chess_db_query_seconds P95 > 1s →  SQLite contention: migrate to PostgreSQL
chess_queue_wait_seconds P95 > 30s → Matchmaker bottleneck: needs dedicated service
chess_move_processing_seconds P95 > 500ms → CPU saturation: scale horizontally
event_loop_lag_seconds > 0.1   →  Event loop blocking: profile and optimize
```

### Tournament Metrics (SQLite)

| Table | Columns | Purpose |
|---|---|---|
| `players` | id, name, elo, depth, aggression, opening, blunder_rate, group, wins, losses, draws, total_moves, blunders | Per-AI final state and personality |
| `rounds` | round_num, total_games, avg_elo_change, duration_ms | Per-round tournament health |
| `games` | white_id, black_id, result, moves, duration_ms | Individual game replay data |
| `ab_results` | group, mean_elo, stddev, win_rate, avg_game_length | A/B test aggregate statistics |

---

## D13. What is your production resilience strategy?

Seven layers of defense, each protecting against a specific failure class.

```
Layer 1: Fly.io Edge          → TLS termination, DDoS protection, auto-start
Layer 2: Helmet.js            → Security headers (HSTS, X-Frame-Options, nosniff)
Layer 3: Rate Limiting        → 100 req/min HTTP, 20 msg/sec WS, 10 conn/IP
Layer 4: Input Validation     → Zod schemas, chess.js move validation, size limits
Layer 5: Resource Protection  → 500 room cap, stale cleanup, 16KB body limit
Layer 6: Observability        → 16 Prometheus metrics, health check with DB test
Layer 7: Recovery             → Graceful shutdown (15s drain), crash handlers, memory alerts
```

### Graceful Shutdown Sequence

When Fly.io sends SIGTERM (during deploy or scale-down):

1. Set `shutdownInProgress = true` — reject new connections with 503
2. Send `server_shutdown` event to all connected WebSocket clients
3. Wait up to 15 seconds for active connections to drain naturally
4. Force-disconnect any remaining sockets
5. Run cleanup: clear intervals, disconnect Prisma, clear rate-limit maps
6. Exit with code 0

This ensures players get a "server restarting" message instead of a silent disconnect.

### Crash Recovery

- **`uncaughtException`:** Log full stack trace, increment `chess_process_crashes_total`, exit(1) → Fly.io auto-restarts the container
- **`unhandledRejection`:** Log warning, increment counter, continue running (non-fatal)
- **Memory warning:** At 85% heap utilization, log warning for proactive investigation

### Rate Limiting Configuration

| Scope | Limit | Window | Action on Exceed |
|---|---|---|---|
| Global HTTP API | 100 requests | 1 minute | 429 + `RATE_LIMITED` error |
| Auth endpoints | 10 requests | 1 minute | 429 + `AUTH_RATE_LIMITED` error |
| WebSocket messages | 20 messages | 1 second | Disconnect with `RATE_LIMITED` |
| Connections per IP | 10 sockets | — | Reject with `CONNECTION_LIMIT` |
| Game rooms | 500 total | — | Reject with `SERVER_FULL` |

> **Full resilience documentation** → [docs/PRODUCTION_RESILIENCE.md](docs/PRODUCTION_RESILIENCE.md)
> **Incident response runbook** → [docs/INCIDENT_RESPONSE.md](docs/INCIDENT_RESPONSE.md)

---

## D14. What are your load testing methodology and SLOs?

### Service Level Objectives

| Category | Metric | Target |
|---|---|---|
| **Availability** | Uptime | 99.5% (monthly) |
| **HTTP Latency** | P95 | < 500ms |
| **HTTP Latency** | P99 | < 1,000ms |
| **HTTP Errors** | Error rate | < 5% |
| **WebSocket Connect** | P95 | < 2,000ms |
| **WebSocket Message** | P95 | < 500ms |
| **WS Connection Success** | Rate | > 90% |

### Test Scripts

| Script | Pattern | Peak Load | Duration |
|---|---|---|---|
| `http-load-test.js` | Ramp 10→50→100 VUs | 100 concurrent | 5 min |
| `websocket-load-test.js` | Ramp 10→50→200 VUs | 200 concurrent WS | 4 min |
| `stress-test.js` | Arrival rate 10→500 RPS + 250 WS | 500 RPS | 5 min |

### What Each Test Validates

**HTTP Load Test:** 6 scenarios — health check, root endpoint, guest auth, leaderboard, Prometheus metrics, rate limiter verification. Confirms the API stays within SLO under normal traffic.

**WebSocket Load Test:** Simulates real gameplay — connect, join queue, handle matchmaking, make moves, handle opponent moves. Validates the full game lifecycle under concurrent load.

**Stress Test:** Pushes past the breaking point. Discovers where the first failure occurs (VU count), measures maximum sustainable RPS, and verifies rate limiters engage correctly under extreme load.

### Running Load Tests

```bash
# Install k6 (one-time)
winget install k6  # Windows
brew install k6    # macOS

# Run against production
k6 run load-tests/http-load-test.js
k6 run load-tests/websocket-load-test.js
k6 run load-tests/stress-test.js

# Run against local dev server
BASE_URL=http://localhost:3001 k6 run load-tests/http-load-test.js
WS_URL=ws://localhost:3001 k6 run load-tests/websocket-load-test.js
```

> **Full methodology** → [docs/LOAD_TEST_PLAN.md](docs/LOAD_TEST_PLAN.md)

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

Every system has a bottleneck at every scale. The goal is to **know what breaks next** before it breaks.

| Concurrent Users | First Bottleneck | Second Bottleneck | Symptom | Detection Metric |
|---|---|---|---|---|
| **50–100** | Memory (256MB) | JS event loop | Slow responses, OOM | `process_resident_memory_bytes` |
| **100–500** | SQLite write lock | Game room Map growth | Auth/leaderboard timeout | `chess_db_query_seconds P95` |
| **500–2K** | Single-core CPU | WebSocket throughput | Event loop lag > 100ms | `nodejs_eventloop_lag_seconds` |
| **2K–10K** | Single machine | No failover | Total outage on crash | `chess_process_crashes_total` |
| **10K–100K** | Matchmaker latency | PostgreSQL connections | Queue wait > 30s | `chess_queue_wait_seconds P95` |
| **100K–1M** | Redis memory | Cross-region latency | Stale game state | Redis `used_memory`, RTT |
| **1M–100M** | DB write throughput | Global consistency | Write conflicts | Kafka consumer lag |
| **100M–10B** | Organizational complexity | Regulatory compliance | Feature velocity drops | Deployment frequency |

### Why This Matters for a Portfolio Project

Interviewers ask "how would you scale this?" The correct answer isn't just "add more servers." It's:

1. **Identify the bottleneck** at the current scale
2. **Explain what metric** tells you it's happening
3. **Describe the fix** and what it costs (complexity, money, latency)
4. **Predict the next bottleneck** after the fix

This table is that answer, pre-computed.

---

## F2. Scaling Roadmap: 100 to 10 Billion Users

A detailed infrastructure plan at each order of magnitude, with cost estimates and architectural notes.

### Phase 0: Portfolio Scale (current — 10–100 concurrent)

```
Cost: ~$0–6/month (Fly.io auto-stop, Vercel free tier)
Stack: Single Node.js + SQLite + Vercel CDN
Key insight: AI runs client-side (WASM), so AI games cost $0 in server resources.
```

| Component | Spec | Cost |
|---|---|---|
| Frontend | Vercel free tier | $0 |
| Backend | Fly.io shared-cpu-1x, 256MB, auto-stop | $0–6/mo |
| Database | SQLite on 1GB volume | Included |
| AI Engine | Client-side WASM | $0 |

### Phase 1: Early Traction (100–1K concurrent)

```
Cost: ~$15–30/month
Change: Bigger instance, SQLite WAL, Litestream backups
New bottleneck to watch: SQLite write lock contention
```

### Phase 2: Growth (1K–10K concurrent)

```
Cost: ~$100–300/month
Change: PostgreSQL (Neon/Supabase), Redis, 2–4 server instances, load balancer
New bottleneck: Matchmaker becomes a hot service
```

### Phase 3: Scale (10K–100K concurrent)

```
Cost: ~$1,000–5,000/month
Change: Multi-region, Kubernetes, dedicated matchmaker, PostgreSQL read replicas
New bottleneck: Cross-region game state consistency
```

### Phase 4: Mass Market (100K–10M concurrent)

```
Cost: ~$10,000–100,000/month
Change: CockroachDB/Spanner, Redis Cluster, Kafka event bus, microservices
New bottleneck: Organizational — single team can't own all services
```

### Phase 5: Planetary Scale (10M–1B concurrent)

```
Cost: ~$500,000–5,000,000/month
Change: Event sourcing, CRDT game state, edge compute, tiered storage
New bottleneck: Regulatory (GDPR, data sovereignty per region)
```

### Phase 6: Theoretical Maximum (1B–10B registered users)

```
Cost: $10M+/month
Context: ~50M-500M peak concurrent (1-5% of registered users)
Key architectural advantage: AI is client-side, so 10B single-player sessions = $0 server cost.
Only multiplayer sessions require server resources.
```

### The AI Advantage in Scaling

This architecture has a unique property: **the most expensive computation (chess AI at ~5M positions/sec) runs entirely in the user's browser via WASM.** This means:

- 1 trillion single-player games/year = $0 server cost
- Server only scales with **multiplayer** games
- At 10B users, if 1% play multiplayer simultaneously, that's 100M concurrent — which is Tier 5 architecture
- The remaining 99% of users are playing against WASM AI with zero server involvement

This is why the architecture was designed with browser-side AI from the start.

---

## F3. Statistics Captured and How They Drive Decisions

### Data Flow

```
Browser                    Server                   Analytics
┌──────────┐         ┌──────────────┐         ┌─────────────┐
│ Game play │────────→│ Socket.io    │────────→│ Prometheus  │
│  events   │  WS    │ handlers     │ metrics │ /metrics    │
└──────────┘         │              │         └──────┬──────┘
                     │ ┌──────────┐ │                │
                     │ │ Prisma   │─┼───────→ SQLite (games, users, ELO)
                     │ └──────────┘ │                │
                     └──────────────┘                ▼
                                              Grafana dashboards
                                              k6 load test reports
Tournament Runner                             Tournament SQLite DB
┌──────────────┐
│ 1M AI games  │─────────────────────────────→ analytics.db
│ A/B testing  │                               (personas, rounds, games, ab_results)
└──────────────┘
```

### Server Statistics → Operational Decisions

| Statistic | Decision It Drives |
|---|---|
| `chess_connected_players` trend | When to scale up (>150 warning, >250 critical) |
| `chess_queue_wait_seconds` P95 | Whether matchmaker needs optimization or dedicated service |
| `chess_db_query_seconds` P95 | When to migrate from SQLite to PostgreSQL |
| `chess_games_completed_total` by reason | Whether games end naturally (checkmate) or abnormally (disconnect) |
| `chess_rate_limit_hits_total` rate | Whether rate limits are too aggressive (false positives) or too lenient (abuse) |
| `chess_errors_total` by code | Which error paths need hardening |
| `nodejs_eventloop_lag_seconds` | Whether the server is CPU-bound and needs horizontal scaling |
| `process_heap_used_bytes` | Memory leak detection; when to increase instance RAM |

### Tournament Statistics → Design Decisions

| Statistic | Design Question It Answers |
|---|---|
| ELO distribution by group (A vs B) | Do reward bonuses improve play quality? |
| Win rate by `search_depth` | What depth range provides the most interesting games? |
| Win rate by `opening_style` | Are certain openings overpowered in our engine? (engine bug indicator) |
| Average game length | How much memory/time should we budget per game room? |
| Blunder rate vs ELO correlation | Does blunder rate map linearly to ELO? (difficulty tuning) |
| Games per round timing | How long does the engine take per game? (performance regression detection) |
| Score variance per round | Is the Swiss pairing producing fair matchups? |

### Load Test Statistics → Capacity Planning

| k6 Metric | Capacity Decision |
|---|---|
| HTTP P95 latency at 50 VUs | Baseline — our SLO target (< 500ms) |
| HTTP P95 latency at 100 VUs | Are we within SLO under 2× normal load? |
| First HTTP failure VU count | Maximum safe concurrent users |
| WS connection success rate at 200 | Can we handle our target concurrent player count? |
| Stress test breaking-point VU | Absolute server capacity ceiling |
| Rate limit trigger count | Are our rate limits calibrated correctly? |
| Time to first byte at peak load | CDN/edge performance under pressure |

---

## F4. Documentation Index

| Document | Purpose | Audience |
|---|---|---|
| [README.md](README.md) | Everything — summary through deep dive | Everyone |
| [docs/PART1_SUMMARY.md](docs/PART1_SUMMARY.md) | 30-second project summary | Hiring managers |
| [docs/PART2_TECH_STACK.md](docs/PART2_TECH_STACK.md) | Architecture and stack decisions | Senior engineers |
| [docs/PART3_QUICK_START.md](docs/PART3_QUICK_START.md) | Clone, install, run in 2 minutes | Developers |
| [docs/PART4_FULL_TUTORIAL.md](docs/PART4_FULL_TUTORIAL.md) | Complete engine manual + system design | Learners |
| [docs/PRODUCTION_RESILIENCE.md](docs/PRODUCTION_RESILIENCE.md) | SLOs, defense-in-depth, failure modes | SRE / DevOps |
| [docs/LOAD_TEST_PLAN.md](docs/LOAD_TEST_PLAN.md) | k6 methodology, capacity planning, CI integration | Performance engineers |
| [docs/INCIDENT_RESPONSE.md](docs/INCIDENT_RESPONSE.md) | P0–P3 runbook, diagnostic commands, rollback | On-call engineers |
| [docs/ARCHITECTURE_FAQ.md](docs/ARCHITECTURE_FAQ.md) | "Why did you choose X?" — every architectural trade-off explained | Staff+ interviewers |

---

## License

[MIT](LICENSE)

---

*Built with Rust, TypeScript, and Three.js. 792 tests. 3 k6 load test suites. 1-million-AI tournament runner. Zero frameworks. One `<canvas>`.*
