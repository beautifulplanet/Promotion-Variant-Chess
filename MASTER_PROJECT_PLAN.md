# MASTER PROJECT PLAN — Promotion Variant Chess
## FAANG-Worthy Fullstack Chess Platform
### Timeline: 4 years | Budget: ~$20/mo hosting | All 3 Tracks

---

## Current State Summary (Feb 2026 Audit)

### What Works Today
- **Chess.js** is the primary engine — all rules correct
- **Stockfish.js** handles all real AI gameplay (skill 0–20)
- **Rust WASM engine** exists with bitboards + magic bitboards, but is OPTIONAL and has 2 bugs
- **3D rendering** with 20 era-themed worlds, dynamic lighting
- **Unique mechanics**: piece inventory, custom board setup, ELO tracking
- **Good test coverage**: 7 test files, 65 describe blocks
- **CI/CD**: GitHub Pages deployment via Actions

### Known Bugs (Pre-existing)
| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | HIGH | movegen.rs:247 | Castling through check not validated |
| 2 | HIGH | movegen.rs | Castling while in check not blocked |
| 3 | MEDIUM | position.rs:236 | Halfmove clock always resets (50-move rule broken) |
| 4 | LOW | Build pipeline | .wasm binary not committed — must run build.ps1 |

### Architecture
```
Browser
├── main-3d.ts (entry point, DOM, 3D render)
├── gameController.ts (game logic, state, piece inventory)
├── stockfishEngine.ts (PRIMARY AI — Stockfish.js Web Worker)
├── aiService.ts (fallback AI orchestrator)
│   ├── Priority 1: Rust WASM (rustEngine.ts → public/wasm/)
│   ├── Priority 2: JS Web Worker (aiWorker.ts)
│   └── Priority 3: Synchronous JS (chessEngine.ts + chess.js)
├── learningAI.ts (experimental RL training)
├── saveSystem.ts (file-based save/load)
└── statsSystem.ts (localStorage career stats)
```

---

## Logical Execution Order (Dependency Flowchart)

```
PHASE 1: Fix & Fortify Rust Engine (Months 1-3)
    ↓
PHASE 2: Make Rust Engine Primary (Months 3-5)
    ↓
PHASE 3: Benchmarking & Optimization (Months 5-8)
    ↓
PHASE 4: Technical Blog Post (Month 8-9)
    ↓ (can start in parallel with Phase 3)
PHASE 5: Multiplayer Backend (Months 9-14)
    ↓
PHASE 6: Infrastructure & Scale (Months 14-18)
    ↓
PHASE 7: Load Testing & Hardening (Months 18-20)
    ↓
PHASE 8: Scale Blog Post (Month 20-21)
    ↓ (can start in parallel with Phase 7)
PHASE 9: Neural Network Training (Months 21-30)
    ↓
PHASE 10: AI Explainability (Months 30-34)
    ↓
PHASE 11: AI/ML Blog Post / Paper (Months 34-36)
    ↓
PHASE 12: Polish & Portfolio (Months 36-40)
```

**Why this order:**
1. Rust engine MUST be correct before it can be primary
2. Rust engine MUST be primary before benchmarks mean anything
3. Multiplayer MUST exist before we can scale-test it
4. Neural network training needs stable position evaluation to compare against
5. Blog posts follow each major milestone while it's fresh

---

## PHASE 1: Fix & Fortify Rust Engine
### Goal: Make the Rust engine bug-free and correct
### Duration: Months 1–3

---

#### Task 1.1: Fix castling-through-check bug
**Why:** Engine allows illegal moves — critical correctness issue

**Plan A (Inline check in movegen.rs):**
- Technical steps:
  1. In `generate_castling_moves()`, after confirming squares are unoccupied
  2. For kingside: check `is_square_attacked(E1/E8)`, `is_square_attacked(F1/F8)`, `is_square_attacked(G1/G8)`
  3. For queenside: check `is_square_attacked(E1/E8)`, `is_square_attacked(D1/D8)`, `is_square_attacked(C1/C8)`
  4. Only add castling move if NONE of those squares are attacked by opponent
  5. Add unit test: position where castling path is attacked, verify move is not generated
  6. Add unit test: position where king is in check, verify no castling generated

**Plan B (Filter in legal move generation):**
- Technical steps:
  1. Keep `generate_pseudo_legal_moves()` unchanged
  2. In `generate_legal_moves()`, add special castling filter
  3. For each castling move in pseudo-legal list, verify intermediate squares are safe
  4. Simpler to implement but slightly less efficient
  5. Same unit tests as Plan A

**Plan C:** TBD — ask for help if attack detection for intermediate squares is unreliable

---

#### Task 1.2: Fix halfmove clock bug
**Why:** 50-move draw rule never triggers — medium correctness issue

**Plan A (Check before move execution):**
- Technical steps:
  1. In `make_move()`, BEFORE moving pieces, check if `to` square has an enemy piece
  2. Store `is_capture = self.piece_on(to).is_some() && self.color_on(to) != Some(self.side_to_move)`
  3. Also check if moving piece is a pawn: `moving_piece_type == PieceType::Pawn`
  4. After move execution: `if is_capture || is_pawn_move { self.halfmove_clock = 0 } else { self.halfmove_clock += 1 }`
  5. Add unit test: make non-pawn non-capture move, verify clock increments
  6. Add unit test: make capture, verify clock resets
  7. Add unit test: make pawn move, verify clock resets

**Plan B (Separate capture detection function):**
- Technical steps:
  1. Add `fn is_capture(&self, mv: Move) -> bool` that checks occupancy bitboard
  2. Call before `make_move()` modifies the board
  3. Same clock logic as Plan A
  4. Same unit tests

**Plan C:** TBD

---

#### Task 1.3: Add missing en passant handling edge cases
**Why:** Ensure Rust engine matches chess.js correctness for all special moves

**Plan A (Perft validation):**
- Technical steps:
  1. Implement `perft(depth)` function that counts all legal move paths
  2. Run against known perft results for standard starting position:
     - Depth 1: 20 nodes
     - Depth 2: 400 nodes
     - Depth 3: 8,902 nodes
     - Depth 4: 197,281 nodes
     - Depth 5: 4,865,609 nodes
  3. Run against tricky perft positions (Kiwipete, position 3-6 from Chess Programming Wiki)
  4. Any mismatch = bug to fix
  5. Add perft as a WASM-exposed function for benchmarking later

**Plan B (Differential testing vs chess.js):**
- Technical steps:
  1. Write a test that generates random positions
  2. Compare Rust legal moves vs chess.js legal moves for same FEN
  3. Run 10,000 random positions
  4. Log any mismatches with FEN for debugging

**Plan C:** TBD

---

#### Task 1.4: Build and commit WASM binary
**Why:** The .wasm file is missing from the repo — can't use Rust engine without it

**Plan A (Build locally + commit):**
- Technical steps:
  1. Install wasm-pack if not present: `cargo install wasm-pack`
  2. Install Rust wasm target: `rustup target add wasm32-unknown-unknown`
  3. Run `build.ps1` from rust-engine/ directory
  4. Verify output in public/wasm/: `chess_engine_bg.wasm`, `chess_engine.js`, `chess_engine.d.ts`
  5. Remove .wasm from .gitignore if it's listed
  6. Commit the built artifacts
  7. Verify in browser: `rustEngine.init()` succeeds

**Plan B (CI builds WASM):**
- Technical steps:
  1. Add a GitHub Actions step to install Rust + wasm-pack
  2. Build WASM as part of the deploy workflow
  3. Don't commit .wasm — it's built fresh each deploy
  4. Update deploy.yml with Rust toolchain setup

**Plan C:** TBD — if wasm-pack has issues on Windows, try wasm-bindgen CLI directly

---

#### Task 1.5: Add Zobrist hashing for position comparison
**Why:** Required for transposition tables, repetition detection, and 3-fold repetition rule

**Plan A (Standard Zobrist implementation):**
- Technical steps:
  1. Create `src/zobrist.rs` module
  2. Generate 781 random u64 keys at compile time:
     - 12 × 64 = 768 piece-square keys
     - 1 side-to-move key
     - 4 castling rights keys
     - 8 en passant file keys
  3. Use `const fn` with a simple PRNG (xorshift64) seeded with a fixed value
  4. Add `hash: u64` field to `Position`
  5. Incrementally update hash in `make_move()` (XOR out old, XOR in new)
  6. Verify: make/unmake same move should restore original hash
  7. Add unit tests: same position via different move orders → same hash

**Plan B (Use a crate):**
- Technical steps:
  1. Add `rand` crate with `no_std` support
  2. Generate random keys at init time (not compile time)
  3. Same incremental update logic
  4. Slightly slower init but simpler code

**Plan C:** TBD

---

#### Task 1.6: Implement unmake_move()
**Why:** Currently clones entire position for each move in search — huge performance cost

**Plan A (Incremental unmake with move stack):**
- Technical steps:
  1. Add `UndoInfo` struct: captured piece, old castling rights, old en passant, old halfmove clock, old hash
  2. `make_move()` returns `UndoInfo`
  3. `unmake_move(mv, undo_info)` reverses all changes
  4. Handle special cases: en passant uncapture, castling undo (move rook back), promotion undo (demote to pawn)
  5. Unit test: make + unmake = identical position (check all bitboards + metadata)
  6. Update `generate_legal_moves()` to use make/unmake instead of clone
  7. Benchmark: compare search speed with clone vs make/unmake

**Plan B (Copy-make with smaller copy):**
- Technical steps:
  1. Instead of cloning the full Position, store only the changed fields
  2. Use a lightweight snapshot struct
  3. Less code but less speedup than full unmake
  4. Still better than cloning all 12 bitboards + occupancy + metadata

**Plan C:** TBD

---

#### Task 1.7: Expand unit test coverage for Rust engine
**Why:** Confidence foundation before making Rust the primary engine

**Plan A (Comprehensive test suite):**
- Technical steps:
  1. Add perft tests (from Task 1.3) as permanent fixtures
  2. Add tests for all FEN edge cases (empty board, only kings, all pawns promoted)
  3. Add tests for stalemate positions
  4. Add tests for insufficient material (K vs K, K+B vs K, K+N vs K)
  5. Add tests for 50-move draw detection
  6. Add tests for en passant pin (pawn pinned to king can't take en passant)
  7. Add integration test: play a full game from start to checkmate
  8. Target: >90% code coverage on movegen, position, eval, search

**Plan B (Property-based testing):**
- Technical steps:
  1. Add `proptest` crate
  2. Generate random positions and moves
  3. Assert invariants: legal moves never leave king in check, eval is symmetric, etc.
  4. Catches edge cases that hand-written tests miss

**Plan C:** TBD

---

## PHASE 2: Make Rust Engine Primary
### Goal: Replace chess.js with Rust WASM as the main engine
### Duration: Months 3–5

---

#### Task 2.1: Expose full game-state API from Rust
**Why:** Currently chess.js handles game-over detection, draw conditions — Rust needs these too

**Plan A (Add game state functions to lib.rs):**
- Technical steps:
  1. Add `is_checkmate(pos) -> bool`: in check AND no legal moves
  2. Add `is_stalemate(pos) -> bool`: NOT in check AND no legal moves
  3. Add `is_draw(pos) -> bool`: stalemate OR 50-move OR insufficient material
  4. Add `is_insufficient_material(pos) -> bool`: K vs K, K+B vs K, K+N vs K, K+B vs K+B (same color)
  5. Add `is_threefold_repetition(pos) -> bool`: requires Zobrist hash history (from Task 1.5)
  6. Add `game_status(pos) -> String`: "playing" | "checkmate" | "stalemate" | "draw"
  7. Export all via `#[wasm_bindgen]`
  8. Unit test each function with known positions

**Plan B (Thin wrapper — delegate complex checks to JS):**
- Technical steps:
  1. Only add checkmate/stalemate to Rust (these are simple)
  2. Keep repetition detection in JS using hash history array
  3. Less Rust code, but split logic between Rust and JS

**Plan C:** TBD

---

#### Task 2.2: Create RustGameState wrapper in TypeScript
**Why:** Need a drop-in replacement for chess.js `Chess` object

**Plan A (Adapter pattern):**
- Technical steps:
  1. Create `src/rustGameState.ts`
  2. Implement same interface as chess.js `Chess`:
     - `move(san)`, `moves()`, `fen()`, `turn()`, `isCheck()`, `isCheckmate()`, `isStalemate()`, `isDraw()`, `isGameOver()`
     - `board()` — 8×8 array of pieces
     - `undo()`, `history()`, `pgn()`
  3. Internally use Rust WASM for all logic
  4. Convert between SAN notation (chess.js format) and UCI (Rust format)
  5. Maintain move history in JS (Rust is stateless per call)
  6. Unit test: run existing chessEngine.test.ts with RustGameState instead of chess.js Chess
  7. If all tests pass → confidence that it's a valid replacement

**Plan B (Gradual replacement):**
- Technical steps:
  1. Don't replace chess.js entirely
  2. Use Rust for SEARCH only (already partially done)
  3. Keep chess.js for state management and validation
  4. Less risk but doesn't achieve "Remove Chess.js dependency entirely" goal

**Plan C:** TBD — some chess.js features (PGN parsing, SAN conversion) are complex to reimplement

---

#### Task 2.3: Wire RustGameState into gameController
**Why:** Replace chess.js usage in the game logic layer

**Plan A (Feature flag):**
- Technical steps:
  1. Add `USE_RUST_ENGINE` constant in constants.ts
  2. In gameController constructor, conditionally create RustGameState or Chess
  3. Run both paths in development (dual-engine mode — compare outputs)
  4. Log any divergence for debugging
  5. Once stable, remove chess.js path
  6. Update all call sites that reference chess.js-specific API

**Plan B (Hard switch):**
- Technical steps:
  1. Replace chess.js import directly with RustGameState
  2. Fix type errors
  3. Test manually
  4. Faster but riskier

**Plan C:** TBD

---

#### Task 2.4: Remove chess.js dependency
**Why:** Clean separation — one engine, not two doing the same thing

**Plan A (Gradual removal):**
- Technical steps:
  1. Remove `chess.js` from package.json
  2. Remove all imports of `Chess` from chess.js
  3. Remove `chessEngine.ts` evaluation code (moved to Rust)
  4. Remove `aiWorker.ts` (Rust is fast enough on main thread or use Rust in worker)
  5. Update tests to use RustGameState
  6. Run full test suite
  7. Verify no runtime errors in browser

**Plan B (Keep chess.js as dev-only reference):**
- Technical steps:
  1. Move chess.js to devDependencies
  2. Use only in tests for cross-validation
  3. Production code uses Rust only

**Plan C:** TBD

---

## PHASE 3: Benchmarking & Optimization
### Goal: Demonstrate measurable performance with real numbers
### Duration: Months 5–8

---

#### Task 3.1: Implement perft benchmark suite
**Why:** Standard chess engine performance test — universally understood metric

**Plan A (WASM + JS perft comparison):**
- Technical steps:
  1. Add `perft(pos, depth) -> u64` to Rust lib.rs (expose via WASM)
  2. Implement perft in JS using chess.js for comparison
  3. Create `benchmarks/perft.html` standalone page
  4. Test depths 1–6 for starting position
  5. Test Kiwipete position (rich in special moves)
  6. Measure: nodes/second for each engine
  7. Display results in a table with timing
  8. Expected result: Rust 50-100x faster than JS

**Plan B (Node.js benchmark script):**
- Technical steps:
  1. Write Node.js script that loads WASM and chess.js
  2. Run perft, output JSON results
  3. Use `performance.now()` for timing
  4. Less visual but scriptable for CI

**Plan C:** TBD

---

#### Task 3.2: Implement search depth benchmark
**Why:** Show that Rust searches deeper in same wall-clock time

**Plan A (Time-limited search comparison):**
- Technical steps:
  1. Add time-limited search to Rust: `search_timed(pos, max_ms) -> SearchResult`
  2. Compare: given 1 second, what depth does Rust reach vs JS?
  3. Test 10 standard middlegame positions
  4. Record: depth reached, nodes searched, nodes/sec, best move
  5. Create benchmark results page with charts

**Plan B (Fixed-depth timing comparison):**
- Technical steps:
  1. Compare time to search depth 5, 6, 7 in both engines
  2. Simpler to implement
  3. Less "real-world" but still compelling

**Plan C:** TBD

---

#### Task 3.3: Add transposition table to Rust engine
**Why:** Major search optimization — avoids re-searching identical positions

**Plan A (Hash map transposition table):**
- Technical steps:
  1. Create `src/tt.rs` module
  2. Define `TTEntry`: hash, depth, score, flag (exact/alpha/beta), best_move
  3. Use Zobrist hash (from Task 1.5) as key
  4. Fixed-size hash map (e.g., 2^20 entries = ~32MB)
  5. Replacement strategy: always-replace or depth-preferred
  6. In alpha_beta: probe TT before search, store results after
  7. Benchmark: compare NPS and depth with/without TT
  8. Expected improvement: 2-5x effective search depth increase

**Plan B (Simple array-based TT):**
- Technical steps:
  1. Use `Vec<TTEntry>` with hash % size as index
  2. No collision handling — just overwrite
  3. Simpler but more collisions
  4. Still significant speedup

**Plan C:** TBD — WASM memory limits may constrain table size

---

#### Task 3.4: Add killer move heuristic to Rust engine
**Why:** The JS engine already has this — Rust should too

**Plan A (Standard killer moves):**
- Technical steps:
  1. Store 2 killer moves per ply (depth level)
  2. In `order_moves()`: killers get scored between captures and quiet moves
  3. In `alpha_beta()`: when a beta cutoff occurs on a quiet move, store as killer
  4. Array of `[Move; 2]` for each ply (max 64 plies)
  5. Reset between searches
  6. Benchmark improvement in nodes searched

**Plan B (Single killer per ply):**
- Technical steps:
  1. Only store 1 killer per ply
  2. Simpler but slightly less effective
  3. Good starting point

**Plan C:** TBD

---

#### Task 3.5: Add null move pruning
**Why:** Major search pruning technique — skips branches that are obviously too good

**Plan A (Standard null move pruning):**
- Technical steps:
  1. Before searching a position, try a "null move" (passing the turn)
  2. Search with reduced depth (depth - 1 - R, where R=2 or 3)
  3. If null move still causes a beta cutoff → prune this branch
  4. Don't apply in: check positions, endgame (zugzwang risk), recursive null move
  5. Benchmark: measure tree size reduction
  6. Expected improvement: 25-50% fewer nodes for same depth

**Plan B (Simplified null move — fixed reduction):**
- Technical steps:
  1. Always reduce by R=2
  2. Only disable in check positions
  3. Risk: some zugzwang positions miscalculated
  4. Simpler to implement

**Plan C:** TBD

---

#### Task 3.6: Add Late Move Reduction (LMR)
**Why:** Search late-ordered moves to reduced depth — they're statistically less likely to be good

**Plan A (Standard LMR):**
- Technical steps:
  1. After searching first few moves at full depth:
  2. For remaining quiet moves (not captures, not killers, not promotions):
  3. Search at depth - 1 first
  4. If result is interesting (above alpha), re-search at full depth
  5. Typical: reduce after first 3-4 moves
  6. Benchmark node count reduction

**Plan B (Simplified — reduce all late moves by 1):**
- Technical steps:
  1. After first 4 moves, reduce all non-capture moves by 1
  2. No re-search on interesting results (aggressive but fast)
  3. Simpler to implement

**Plan C:** TBD

---

#### Task 3.7: Add iterative deepening with time management
**Why:** Real engines don't search to fixed depth — they search until time runs out

**Plan A (Clock-based search):**
- Technical steps:
  1. Add `Instant`-based timer to search (use `js_sys::Date::now()` in WASM)
  2. `search_timed(pos, max_ms)` → iteratively deepen until time expires
  3. Return best move from deepest completed iteration
  4. Check time every 1024 nodes (not every node — too expensive)
  5. Aspiration windows: narrow alpha-beta window around previous iteration's score
  6. If window fails, widen and re-search
  7. Expose via WASM: `get_best_move_timed(pos, ms) -> SearchResult`

**Plan B (Node count limit):**
- Technical steps:
  1. Instead of time, limit by node count
  2. `search_nodes(pos, max_nodes)` → stop after N nodes
  3. Simpler (no clock dependency) but less "real" for benchmarks

**Plan C:** TBD

---

#### Task 3.8: Profile with Chrome DevTools and document improvements
**Why:** Show real profiling data — concrete evidence of optimization

**Plan A (Chrome DevTools profiling):**
- Technical steps:
  1. Create `benchmarks/profile.html` with profiling harness
  2. Record CPU profile of JS engine search (depth 5)
  3. Record CPU profile of Rust WASM engine search (depth 5)
  4. Screenshot flame graphs
  5. Identify hotspots in both
  6. Document findings in benchmark report
  7. Show before/after for each optimization (TT, killers, NMP, LMR)

**Plan B (Console timing):**
- Technical steps:
  1. Use `performance.now()` for timing
  2. Output structured JSON results
  3. Create charts from JSON data
  4. Less visual but more automatable

**Plan C:** TBD

---

#### Task 3.9: Create benchmark results page with graphs
**Why:** Visual proof of performance — the centerpiece of the blog post

**Plan A (Interactive HTML page):**
- Technical steps:
  1. Create `benchmarks/results.html`
  2. Use Chart.js (or simple SVG) for graphs
  3. Graphs: NPS comparison, depth vs time, optimization progression
  4. Table: position-by-position results
  5. Auto-run benchmarks on page load
  6. Add to GitHub Pages deployment

**Plan B (Static images in README):**
- Technical steps:
  1. Run benchmarks locally, take screenshots
  2. Include in README.md
  3. Less interactive but requires no extra code

**Plan C:** TBD

---

## PHASE 4: Technical Blog Post
### Goal: "Building a Chess Engine 80x Faster Than JavaScript"
### Duration: Month 8–9

---

#### Task 4.1: Outline the blog post
**Plan A (Technical narrative arc):**
- Technical steps:
  1. Hook: "What if your chess engine was 80x faster?"
  2. Section 1: The problem (JS chess engine limitations)
  3. Section 2: Why Rust + WASM (language choice rationale)
  4. Section 3: Bitboard representation (explain with diagrams)
  5. Section 4: Magic bitboards (the clever part)
  6. Section 5: Alpha-beta search optimization journey
  7. Section 6: Benchmarks (the payoff)
  8. Section 7: WASM integration (making it work in the browser)
  9. Conclusion: What I learned
  10. Draft in `docs/blog-post-performance.md`

**Plan B (Shorter format):**
- Condensed version focusing on benchmarks + key insights
- Better for Dev.to / Hacker News attention spans

**Plan C:** TBD

---

#### Task 4.2: Write code samples and diagrams
**Plan A:** Create clear, annotated code snippets for each section. Use ASCII art for bitboard diagrams. 

**Plan B:** Use screenshots from the codebase with annotations.

**Plan C:** TBD

---

#### Task 4.3: Publish and distribute
**Plan A:** Post to Dev.to, cross-post to personal site, submit to Hacker News

**Plan B:** Post to personal blog only, share on Reddit r/chess and r/programming

**Plan C:** TBD — I don't know which platforms you prefer. Let's decide when we get here.

---

## PHASE 5: Multiplayer Backend
### Goal: WebSocket-based real-time chess server
### Duration: Months 9–14

---

#### Task 5.1: Choose backend technology
**Plan A (Node.js + Socket.io):**
- Technical steps:
  1. Create `server/` directory
  2. Initialize Node.js project with TypeScript
  3. Install: express, socket.io, cors
  4. Advantages: same language as frontend, fast iteration
  5. Good for ~$20/mo budget (single process handles 5-10K connections)

**Plan B (Rust + Tokio + Tungstenite):**
- Technical steps:
  1. Create `server-rs/` directory
  2. Use axum or actix-web for HTTP, tokio-tungstenite for WebSocket
  3. Advantages: lower resource usage, can reuse chess engine code
  4. More complex but impressive for portfolio

**Plan C:** TBD — depends on comfort level with Rust async

---

#### Task 5.2: Design message protocol
**Plan A (JSON over WebSocket):**
- Technical steps:
  1. Define message types:
     - Client→Server: `join_queue`, `make_move`, `resign`, `offer_draw`, `accept_draw`, `chat`
     - Server→Client: `game_found`, `opponent_move`, `game_over`, `error`, `queue_status`
  2. Use Zod schemas for validation (already a dependency)
  3. Document protocol in `docs/protocol.md`
  4. Version the protocol (field: `v: 1`)

**Plan B (Protocol Buffers / MessagePack):**
- Technical steps:
  1. Use binary encoding for smaller messages
  2. Better performance but harder to debug
  3. Overkill for chess (messages are small)

**Plan C:** TBD

---

#### Task 5.3: Implement game room management
**Plan A (In-memory rooms):**
- Technical steps:
  1. `GameRoom` class: player1, player2, game state (FEN), move history, timers
  2. Room lifecycle: create → join → play → end → cleanup
  3. Map<roomId, GameRoom> for active games
  4. Handle disconnections: grace period (30s), then forfeit
  5. Handle reconnection: restore room by player token
  6. Unit test: room lifecycle, disconnection handling

**Plan B (Redis-backed rooms):**
- Technical steps:
  1. Store room state in Redis
  2. Supports horizontal scaling (multiple server instances)
  3. More complex but production-ready
  4. Adds ~$5/mo (Redis on Railway/Fly.io)

**Plan C:** TBD

---

#### Task 5.4: Implement matchmaking system
**Plan A (ELO-based queue):**
- Technical steps:
  1. Players enter queue with their ELO
  2. Match within ±100 ELO first, widen to ±200 after 15s, ±500 after 30s
  3. FIFO within ELO brackets
  4. Queue timeout: max 60s, then offer AI game
  5. Unit test: matchmaking logic, ELO ranges, timeout

**Plan B (Simple FIFO queue):**
- Technical steps:
  1. First two players in queue get matched
  2. No ELO consideration
  3. Simple but less fair

**Plan C:** TBD

---

#### Task 5.5: Implement server-side move validation
**Why:** Never trust the client — server must validate all moves

**Plan A (Rust WASM on server):**
- Technical steps:
  1. Load Rust WASM engine in Node.js (WASM works in Node)
  2. Server validates every move before broadcasting
  3. Reuses the same engine code — no duplication
  4. Reject invalid moves with error message

**Plan B (chess.js on server):**
- Technical steps:
  1. Use chess.js for server-side validation
  2. Simpler setup (no WASM in Node)
  3. Known-correct rule implementation
  4. But doesn't showcase Rust engine

**Plan C:** TBD

---

#### Task 5.6: Implement ELO calculation for multiplayer
**Plan A (Standard ELO):**
- Technical steps:
  1. K-factor: 32 for new players (<30 games), 16 for established
  2. Calculate expected score: `E = 1 / (1 + 10^((R_opponent - R_player) / 400))`
  3. New rating: `R' = R + K * (S - E)` where S = 1 (win), 0.5 (draw), 0 (loss)
  4. Store in database (Task 6.2)
  5. Update after each game
  6. Unit test: ELO calculations match expected values

**Plan B (Glicko-2):**
- Technical steps:
  1. More accurate than ELO (accounts for rating volatility)
  2. Used by Lichess
  3. More complex math
  4. Better for portfolio ("we use Glicko-2 like Lichess")

**Plan C:** TBD

---

#### Task 5.7: Implement leaderboard
**Plan A (Simple sorted query):**
- Technical steps:
  1. GET `/api/leaderboard?page=1&limit=20`
  2. Query PostgreSQL: `SELECT * FROM players ORDER BY elo DESC LIMIT 20 OFFSET ?`
  3. Include: rank, username, ELO, games played, win rate
  4. Cache with 60s TTL
  5. Display in frontend sidebar or modal

**Plan B (Redis sorted set):**
- Technical steps:
  1. Use Redis ZADD for O(log N) Insert, ZREVRANGE for O(log N + M) retrieval
  2. Real-time updates
  3. Requires Redis

**Plan C:** TBD

---

#### Task 5.8: Build multiplayer frontend UI
**Plan A (Integrated into existing game):**
- Technical steps:
  1. Add "Play Online" button to main menu
  2. Queue screen with "Searching for opponent..." + cancel
  3. Opponent info display (name, ELO)
  4. Move transmission: on player move → send to server → receive opponent move
  5. Game end screen with ELO change
  6. Chat (optional, text-only, sanitized)
  7. Rematch button

**Plan B (Separate page):**
- Technical steps:
  1. `multiplayer.html` — standalone multiplayer client
  2. Simpler but doesn't reuse existing UI
  3. Could share chess rendering code via modules

**Plan C:** TBD

---

## PHASE 6: Infrastructure & Scale
### Goal: Production-grade deployment with monitoring
### Duration: Months 14–18

---

#### Task 6.1: Deploy backend
**Plan A (Railway):**
- Technical steps:
  1. Create Railway project
  2. Link GitHub repo, set build command
  3. Set environment variables (PORT, DATABASE_URL, REDIS_URL)
  4. Enable auto-deploy on push
  5. Cost: ~$5-10/mo for small instance

**Plan B (Fly.io):**
- Technical steps:
  1. Create Fly.io app with `fly launch`
  2. Configure `fly.toml` for WebSocket support
  3. Edge regions for low latency
  4. Cost: similar to Railway

**Plan C:** TBD — evaluate both when we reach this phase

---

#### Task 6.2: Set up PostgreSQL
**Plan A (Managed PostgreSQL):**
- Technical steps:
  1. Use Railway/Fly.io managed PostgreSQL
  2. Schema:
     ```sql
     CREATE TABLE players (id UUID PRIMARY KEY, username TEXT UNIQUE, elo INT DEFAULT 1200, games_played INT DEFAULT 0, wins INT DEFAULT 0, created_at TIMESTAMP);
     CREATE TABLE games (id UUID PRIMARY KEY, white_id UUID REFERENCES players, black_id UUID REFERENCES players, result TEXT, pgn TEXT, created_at TIMESTAMP);
     ```
  3. Use Prisma or Drizzle ORM
  4. Migrations via ORM tooling
  5. Cost: ~$5-7/mo

**Plan B (SQLite for dev, PostgreSQL for prod):**
- Technical steps:
  1. Use SQLite locally for development
  2. PostgreSQL in production only
  3. Cheaper to develop but slight compatibility risk

**Plan C:** TBD

---

#### Task 6.3: Add Redis for session/state management
**Plan A (Managed Redis):**
- Technical steps:
  1. Use Upstash Redis (free tier: 10K commands/day)
  2. Store: active game rooms, queue state, leaderboard cache
  3. Session tokens for player identity
  4. TTL-based cleanup of stale games
  5. Cost: free tier likely sufficient initially

**Plan B (In-memory only — skip Redis):**
- Technical steps:
  1. Keep all state in Node.js process memory
  2. Simpler but can't scale horizontally
  3. State lost on restart
  4. Acceptable for early stages

**Plan C:** TBD

---

#### Task 6.4: Add monitoring (Prometheus + Grafana)
**Plan A (Grafana Cloud — free tier):**
- Technical steps:
  1. Sign up for Grafana Cloud (free: 10K metrics, 50GB logs, 50GB traces)
  2. Add prom-client to Node.js server
  3. Metrics: active games, queue length, move latency, WebSocket connections, errors
  4. Create dashboards: System health, Game activity, Performance
  5. Set up alerts: error rate > 1%, p99 latency > 200ms

**Plan B (Simple logging + health endpoint):**
- Technical steps:
  1. `GET /health` → status, uptime, active games count
  2. Structured JSON logging to stdout
  3. Use Railway/Fly.io built-in log viewer
  4. Cheaper and simpler, less comprehensive

**Plan C:** TBD

---

#### Task 6.5: Add authentication
**Plan A (Anonymous + optional account):**
- Technical steps:
  1. Guest play: generate UUID client-side, store in localStorage
  2. Optional sign-up: username + password (bcrypt hashed)
  3. JWT tokens for session management
  4. Guest ELO preserved until account creation
  5. No email required (keeps it simple)

**Plan B (OAuth — Google/GitHub):**
- Technical steps:
  1. Use Passport.js with Google/GitHub OAuth
  2. More trustworthy identities
  3. Harder to set up, requires OAuth app registration

**Plan C:** TBD

---

## PHASE 7: Load Testing & Hardening
### Goal: "System handles 10K concurrent games at 50ms p99 latency"
### Duration: Months 18–20

---

#### Task 7.1: Set up load testing framework
**Plan A (k6):**
- Technical steps:
  1. Install k6 locally
  2. Write WebSocket load test script
  3. Simulate: connect → join queue → make moves → end game
  4. Ramp: 10 → 100 → 1K → 5K → 10K virtual users
  5. Measure: connection success rate, move latency p50/p95/p99, error rate

**Plan B (Artillery):**
- Technical steps:
  1. Install Artillery with WebSocket plugin
  2. YAML-based scenarios
  3. Built-in reports
  4. Simpler config but less flexible

**Plan C:** TBD

---

#### Task 7.2: Optimize for 10K concurrent connections
**Plan A (Horizontal scaling):**
- Technical steps:
  1. Sticky sessions via Redis pub/sub
  2. Multiple server instances behind load balancer
  3. Room state in Redis (from Task 6.3)
  4. Round-robin or least-connections routing
  5. Test failover: kill one instance, verify games continue

**Plan B (Vertical scaling):**
- Technical steps:
  1. Single beefy instance
  2. Optimize Node.js: increase `--max-old-space-size`, use worker_threads
  3. Connection pooling for DB
  4. Simpler but has a ceiling

**Plan C:** TBD

---

#### Task 7.3: Document architecture decisions
**Plan A (Architecture Decision Records):**
- Technical steps:
  1. Create `docs/adr/` directory
  2. ADR-001: Why Node.js (or Rust) for backend
  3. ADR-002: Why WebSocket over polling
  4. ADR-003: Why ELO (or Glicko-2) over other systems
  5. ADR-004: Why Redis for state
  6. ADR-005: Load testing results and scaling strategy
  7. Include trade-off analysis for each decision

**Plan B (Single architecture doc):**
- Technical steps:
  1. `docs/ARCHITECTURE.md` with all decisions
  2. Less formal but still comprehensive

**Plan C:** TBD

---

## PHASE 8: Scale Blog Post
### Goal: "Scaling a Real-Time Chess Platform to 10K Players"
### Duration: Month 20–21

---

#### Task 8.1: Write the scaling blog post
**Plan A:** Full technical article with architecture diagrams, load test results, and lessons learned.

**Plan B:** Condensed version focusing on the most interesting problems (WebSocket scaling, real-time state sync).

**Plan C:** TBD — format depends on audience and platform

---

## PHASE 9: Neural Network Training
### Goal: Train a chess position evaluator using PyTorch
### Duration: Months 21–30

---

#### Task 9.1: Set up Python ML environment
**Plan A (Local Python + PyTorch):**
- Technical steps:
  1. Create `ml/` directory in project
  2. Python 3.10+, pip, venv
  3. Install: PyTorch, numpy, python-chess, pandas, matplotlib, tensorboard
  4. Verify GPU support (CUDA) or plan for CPU training
  5. Create `ml/requirements.txt`

**Plan B (Google Colab):**
- Technical steps:
  1. Use Colab for training (free GPU)
  2. Keep scripts in `ml/` for reference
  3. Download trained model locally

**Plan C:** TBD — depends on available hardware

---

#### Task 9.2: Download and parse Lichess database
**Plan A (Lichess monthly dumps):**
- Technical steps:
  1. Download from database.lichess.org (monthly PGN files, ~10-50GB compressed)
  2. Filter: standard games only, ELO > 1800, time control > 3min
  3. Parse PGN → extract (FEN, evaluation) pairs
  4. Use Stockfish to evaluate positions (if no eval in PGN)
  5. Target: 3-5M labeled positions
  6. Save as numpy arrays or HDF5

**Plan B (Pre-processed datasets):**
- Technical steps:
  1. Find an existing labeled chess position dataset
  2. E.g., from Chess Programming Wiki or Kaggle
  3. Less data processing, faster to start training

**Plan C:** I don't know the best source of pre-labeled positions. Let's research when we get here.

---

#### Task 9.3: Design neural network architecture
**Plan A (Simple feedforward network):**
- Technical steps:
  1. Input: 768 features (12 piece types × 64 squares, binary)
  2. Hidden layers: 256 → 128 → 64 → 1
  3. Output: position evaluation in centipawns
  4. Activation: ReLU, output linear
  5. Loss: MSE against Stockfish evaluations
  6. This is similar to NNUE (Efficiently Updatable Neural Network)

**Plan B (Convolutional network):**
- Technical steps:
  1. Input: 8×8×12 tensor (board as image)
  2. 3-4 convolutional layers
  3. Global average pooling → dense → output
  4. Better at learning spatial patterns
  5. More parameters, slower inference

**Plan C:** TBD — I don't know which architecture will perform best. We'll experiment.

---

#### Task 9.4: Train the model
**Plan A (Local training):**
- Technical steps:
  1. Train/val/test split: 80/10/10
  2. Batch size: 4096 (positions are small)
  3. Optimizer: Adam, lr=1e-3, decay schedule
  4. Train for 100 epochs
  5. Track: MSE loss, evaluation accuracy (within ±50cp), correlation with Stockfish
  6. Use TensorBoard for training curves
  7. Save best checkpoint
  8. Expected training time: 2-4 hours on GPU, 1-2 days on CPU

**Plan B (Colab training):**
- Technical steps:
  1. Upload dataset to Google Drive
  2. Train on Colab GPU (T4/A100)
  3. Download model weights
  4. Free but session time-limited

**Plan C:** TBD

---

#### Task 9.5: Export model to ONNX and run in browser
**Plan A (ONNX Runtime Web):**
- Technical steps:
  1. Export PyTorch model to ONNX format
  2. Use onnxruntime-web in browser
  3. Load model, run inference on positions
  4. Integrate into Rust engine's eval function OR use as standalone evaluator
  5. Benchmark: inference time per position (target: <1ms)

**Plan B (Convert to TensorFlow.js):**
- Technical steps:
  1. Export PyTorch → ONNX → TensorFlow.js
  2. Use tf.js for browser inference
  3. Well-supported in browsers
  4. Slightly more conversion steps

**Plan C:** TBD — WASM-based inference could also work (compile model to WASM)

---

#### Task 9.6: Compare neural network vs minimax
**Why:** "Neural network matches 1500 ELO with 10x less computation"

**Plan A (Self-play tournament):**
- Technical steps:
  1. Set up engine vs engine matches
  2. Neural net eval + depth-1 search VS minimax + handcrafted eval at depth 5
  3. Play 100+ games with alternating colors
  4. Measure: win rate, ELO difference, nodes searched, time per move
  5. Record games as PGN for analysis
  6. Generate ELO estimate from win rate

**Plan B (Position evaluation correlation):**
- Technical steps:
  1. Take 1000 positions, evaluate with both engines
  2. Compare evaluations to Stockfish (ground truth)
  3. Measure correlation, MAE, accuracy within thresholds
  4. Less compelling than gameplay but faster

**Plan C:** TBD

---

## PHASE 10: AI Explainability
### Goal: "Why the AI made this move" with visualizations
### Duration: Months 30–34

---

#### Task 10.1: Implement move explanation system
**Plan A (Feature attribution):**
- Technical steps:
  1. For each candidate move, run neural net evaluation
  2. Compute feature importance (gradient-based or SHAP-like)
  3. Map importance back to board squares
  4. "This move wins because: +2.1 material, +0.5 center control, -0.3 king safety"
  5. Display as text below the board

**Plan B (Simple heuristic explanations):**
- Technical steps:
  1. Use the existing eval function components
  2. "This move: captures knight (+3.2), improves pawn structure (+0.3)"
  3. No gradient computation needed
  4. Less sophisticated but practical

**Plan C:** TBD — gradient extraction from ONNX in browser may be complex

---

#### Task 10.2: Build attention/heatmap visualization
**Plan A (Board heatmap overlay):**
- Technical steps:
  1. Color each square by evaluation contribution (red=bad, green=good)
  2. Separate heatmaps: piece importance, square control, attack patterns
  3. Toggle overlay on/off
  4. Animate between moves to show strategy evolution
  5. Integrate into 3D renderer (transparent colored planes on squares)

**Plan B (Side panel visualization):**
- Technical steps:
  1. Display heatmap as a separate 2D grid next to the board
  2. Simpler integration (no 3D overlay needed)
  3. Include legend and explanation

**Plan C:** TBD

---

## PHASE 11: AI/ML Blog Post / Paper
### Goal: "Efficient Chess Position Evaluation with Compact Neural Networks"
### Duration: Months 34–36

---

#### Task 11.1: Write AI/ML blog post or paper
**Plan A (arXiv-style paper):**
- Technical steps:
  1. LaTeX document following ML conference format
  2. Sections: Abstract, Introduction, Related Work, Method, Experiments, Conclusion
  3. Include training curves, benchmark tables, architecture diagram
  4. Submit to arXiv (cs.AI or cs.LG)

**Plan B (Blog post + ML meetup talk):**
- Technical steps:
  1. More accessible blog format
  2. Prepare 15-20 minute talk for local ML meetup
  3. Include live demo
  4. Wider reach than a paper

**Plan C:** TBD — depends on how novel the results are

---

## PHASE 12: Polish & Portfolio
### Goal: Portfolio-ready presentation
### Duration: Months 36–40

---

#### Task 12.1: Create portfolio page / landing page
**Plan A:** Design a polished landing page showcasing the project with screenshots, architecture diagrams, links to blog posts, and live demo.

**Plan B:** Enhance the existing README with portfolio-quality presentation.

**Plan C:** TBD

---

#### Task 12.2: Record demo video
**Plan A:** 3-5 minute video walkthrough: gameplay, multiplayer, AI features, architecture overview.

**Plan B:** GIF/screenshots in README.

**Plan C:** TBD

---

#### Task 12.3: Code cleanup and documentation
**Plan A:** JSDoc/RustDoc across all modules, contribution guide, updated architecture docs.

**Plan B:** Focus documentation on the most impressive parts only.

**Plan C:** TBD

---

## Active Task Tracker

| Phase | Task | Status | Blocked By |
|-------|------|--------|------------|
| 1 | 1.1 Fix castling-through-check | ✅ DONE | — |
| 1 | 1.2 Fix halfmove clock | ✅ DONE | — |
| 1 | 1.3 Perft validation | ✅ DONE | — |
| 1 | 1.4 Build WASM binary | ✅ DONE | — |
| 1 | 1.5 Zobrist hashing | ✅ DONE | — |
| 1 | 1.6 Implement unmake_move | ✅ DONE | 1.5 |
| 1 | 1.7 Expand test coverage | ✅ DONE (128 tests) | 1.1, 1.2 |
| 2 | 2.1 Game-state API | ✅ DONE (174→190 Rust tests) | 1.6 |
| 2 | 2.2 RustGameState TS wrapper | ✅ DONE (330 total tests) | 2.1 |
| 2 | 2.3 Wire RustGameState into gameController | NOT STARTED | 2.2 |
| 2 | 2.4 Remove chess.js dependency | NOT STARTED | 2.3 |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-12 | All 3 tracks, 4-year timeline | User preference — no rush, build it right |
| 2026-02-12 | Performance → Scale → AI/ML order | Dependency chain: Rust engine feeds everything |
| 2026-02-12 | ~$20/mo hosting budget | Budget constraint for Scale phase |
| 2026-02-12 | Plan A/B for each task | Reduce decision paralysis, always have a fallback |
| 2026-02-13 | Keep chess.js as fallback | User: keep all engines for device/accessibility compat |
| 2026-02-13 | Proxy facade pattern | engineProvider.ts — transparent backend switching |
| 2026-02-13 | Deferred WASM swap | Red-team fix: only swap at game boundaries, not mid-game |

---

*Last updated: 2026-02-14*
*Phase 3 complete (Tasks 3.1-3.9 done)*
*Optimizations: TT (256K entries), killer moves (2/ply), NMP (R=2), LMR, iterative deepening + time mgmt*
*Benchmarks: perft.html, search.html, results.html — all auto-run JS vs WASM comparison*
*Test counts: 213 Rust tests, 382 TypeScript tests*
*Next: Phase 4 — Technical Blog Post*
