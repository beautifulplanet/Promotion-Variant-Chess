# Requirements

Last updated: 2026-02-22

Priority levels per [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119):
- **MUST** — Hard requirement. Failure = broken product.
- **SHOULD** — Expected. Omission needs justification.
- **MAY** — Nice-to-have. No penalty for absence.

Verification column links to [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md).

---

## 1. UX Requirements

| ID | Priority | Requirement | Status | Verification |
|---|---|---|---|---|
| UX-01 | MUST | Game loads and is interactive within 10 seconds on desktop broadband | ✅ | AT-01 |
| UX-02 | MUST | Welcome dashboard is the first screen on load — all pre-game options accessible | ✅ | AT-02 |
| UX-03 | MUST | Touch controls work on mobile (tap to select, tap to move) | ✅ | AT-03 |
| UX-04 | MUST | Classic Mode provides a clean, dark, chess.com-style layout suitable for mobile | ✅ | AT-04 |
| UX-05 | MUST | 3 GFX quality presets (Low / Med / High) each produce playable frame rates | ✅ | AT-05 |
| UX-06 | MUST | Theme changes apply instantly with no page reload | ✅ | AT-06 |
| UX-07 | SHOULD | Board is fully visible without scrolling on common mobile viewports (375×667+) | ✅ | AT-07 |
| UX-08 | SHOULD | Action bar buttons are ≥ 44px touch targets (Apple HIG minimum) | ✅ | AT-08 |
| UX-09 | SHOULD | Move list is scrollable and does not overflow the viewport | ✅ | AT-09 |
| UX-10 | MAY | Keyboard shortcuts for common actions (undo, new game, flip board) | 🔲 | — |
| UX-11 | MAY | Screen reader announces check, checkmate, and turn changes | 🔲 | — |
| UX-12 | MAY | Reduced-motion preference disables piece animations | 🔲 | — |

---

## 2. Functional Requirements

### 2.1 Game Logic

| ID | Priority | Requirement | Status | Verification |
|---|---|---|---|---|
| FN-01 | MUST | All legal moves are generated correctly (perft depth 5 matches standard values) | ✅ | AT-10 |
| FN-02 | MUST | En passant, castling (both sides), and pawn promotion work correctly | ✅ | AT-11 |
| FN-03 | MUST | Checkmate is detected and the game ends with a result | ✅ | AT-12 |
| FN-04 | MUST | Stalemate is detected and the game ends as a draw | ✅ | AT-12 |
| FN-05 | MUST | Threefold repetition is detected | ✅ | AT-12 |
| FN-06 | MUST | Fifty-move rule is detected | ✅ | AT-12 |
| FN-07 | MUST | Insufficient material is detected (K vs K, K vs KB, K vs KN) | ✅ | AT-12 |
| FN-08 | MUST | Undo reverts the last full move (player + AI) | ✅ | AT-13 |
| FN-09 | MUST | New game resets the board to starting position | ✅ | AT-14 |
| FN-10 | MUST | Board flip changes perspective without breaking game state | ✅ | AT-15 |

### 2.2 AI

| ID | Priority | Requirement | Status | Verification |
|---|---|---|---|---|
| AI-01 | MUST | At least one AI engine always responds to a move request | ✅ | AT-16 |
| AI-02 | MUST | Rust WASM engine is the primary engine when available | ✅ | AT-16 |
| AI-03 | MUST | If WASM fails, Stockfish.js takes over silently | ✅ | AT-17 |
| AI-04 | MUST | If Stockfish fails, TypeScript minimax takes over silently | ✅ | AT-17 |
| AI-05 | SHOULD | AI responds within 5 seconds on desktop, 10 seconds on mobile | ✅ | AT-18 |
| AI-06 | MAY | Aggression slider changes AI behavior (bonus pieces, board rearrangement) | ✅ | — |

### 2.3 Save / Load

| ID | Priority | Requirement | Status | Verification |
|---|---|---|---|---|
| SV-01 | MUST | Game state auto-saves to localStorage on every move | ✅ | AT-19 |
| SV-02 | MUST | Save file export produces a valid JSON file that can be re-imported | ✅ | AT-20 |
| SV-03 | MUST | Loading a save restores board position, move history, ELO, and settings | ✅ | AT-20 |
| SV-04 | SHOULD | Piece style and board style preferences persist across sessions | ✅ | AT-21 |

### 2.4 Multiplayer

| ID | Priority | Requirement | Status | Verification |
|---|---|---|---|---|
| MP-01 | MUST | Guest players can create and join tables without registration | ✅ | AT-22 |
| MP-02 | MUST | Server validates every move via chess.js — illegal moves are rejected | ✅ | AT-23 |
| MP-03 | MUST | Server checks it's the correct player's turn before accepting a move | ✅ | AT-23 |
| MP-04 | MUST | Draw offer, accept, decline protocol works | ✅ | AT-24 |
| MP-05 | MUST | Resignation ends the game with correct result | ✅ | AT-24 |
| MP-06 | MUST | ELO updates correctly after game completion (K=32 standard formula) | ✅ | AT-25 |
| MP-07 | SHOULD | Disconnected player has 30-second grace period to reconnect | ✅ | AT-26 |
| MP-08 | SHOULD | Clock times are tracked server-side (not client-trusted) | ✅ | AT-27 |
| MP-09 | MAY | Spectator mode for ongoing games | 🔲 | — |
| MP-10 | MAY | Rematch offer after game ends | 🔲 | — |

---

## 3. Security Requirements

| ID | Priority | Requirement | Status | Verification |
|---|---|---|---|---|
| SC-01 | MUST | All HTTP responses include security headers (Helmet.js: HSTS, X-Frame-Options, nosniff; CSP via frontend `<meta>` tag + Vercel headers) | ✅ | AT-28 |
| SC-02 | MUST | HTTP rate limiting is enforced (100 req/min per IP) | ✅ | AT-29 |
| SC-03 | MUST | WebSocket message rate limiting is enforced (20 msg/sec per socket) | ✅ | AT-30 |
| SC-04 | MUST | Per-IP WebSocket connection cap is enforced (max 10) | ✅ | AT-30 |
| SC-05 | MUST | All inbound WebSocket messages are Zod-validated — malformed messages rejected | ✅ | AT-31 |
| SC-06 | MUST | Protocol version mismatch (`v ≠ 1`) is rejected | ✅ | AT-31 |
| SC-07 | MUST | Passwords are hashed with bcrypt (not stored plaintext) | ✅ | AT-32 |
| SC-08 | MUST | JWT tokens are used for auth (HS256) | ✅ | AT-32 |
| SC-09 | MUST | CORS origin allowlist restricts to known domains | ✅ | AT-33 |
| SC-10 | MUST | Max 500 active game rooms (prevents memory exhaustion) | ✅ | AT-34 |
| SC-11 | SHOULD | Graceful shutdown on SIGTERM — no orphaned connections | ✅ | AT-35 |
| SC-12 | SHOULD | Crash recovery handlers for uncaughtException and unhandledRejection | ✅ | AT-35 |
| SC-13 | MAY | Statistical anti-cheat (move-quality, time-per-move analysis) | 🔲 | — |
| SC-14 | MAY | Browser fingerprinting for ban enforcement | 🔲 | — |

---

## 4. Performance Requirements

| ID | Priority | Requirement | Target | Status | Verification |
|---|---|---|---|---|---|
| PF-01 | MUST | Desktop FPS in Low GFX mode | ≥ 30 FPS | ✅ | AT-36 |
| PF-02 | MUST | Desktop FPS in High GFX mode | ≥ 30 FPS | ✅ | AT-36 |
| PF-03 | SHOULD | Mobile FPS in Low GFX mode | ≥ 30 FPS | ✅ | AT-36 |
| PF-04 | MUST | WASM engine depth 5 search on desktop | < 1 second | ✅ | AT-37 |
| PF-05 | SHOULD | WASM engine depth 5 search on mobile | < 2 seconds | ✅ | AT-37 |
| PF-06 | MUST | HTTP API P95 latency under 50 VU load | < 500ms | ✅ | AT-38 |
| PF-07 | MUST | HTTP API P99 latency under 100 VU load | < 1,000ms | ✅ | AT-38 |
| PF-08 | MUST | HTTP error rate under 100 VU load | < 5% | ✅ | AT-38 |
| PF-09 | MUST | WebSocket connection P95 under 200 VU | < 2,000ms | ✅ | AT-39 |
| PF-10 | MUST | WebSocket message P95 | < 500ms | ✅ | AT-39 |
| PF-11 | SHOULD | WASM binary size (gzipped) | < 200 KB | ✅ | AT-40 |
| PF-12 | SHOULD | Page load to interactive (desktop broadband) | < 10 seconds | ✅ | AT-01 |
| PF-13 | MAY | Server handles 500 RPS HTTP + 250 concurrent WS | Measured, not SLO | ✅ | AT-41 |

---

## 5. Surge Preparedness

Not "infinite scale" — documented mechanisms:

| ID | Priority | Mechanism | Status | Verification |
|---|---|---|---|---|
| SP-01 | MUST | k6 load test scripts exist and are runnable | ✅ | AT-38, AT-39, AT-41 |
| SP-02 | MUST | HTTP rate limiting active in production | ✅ | AT-29 |
| SP-03 | MUST | WebSocket rate limiting active in production | ✅ | AT-30 |
| SP-04 | MUST | Prometheus metrics endpoint live | ✅ | AT-42 |
| SP-05 | MUST | Health check endpoint live | ✅ | AT-42 |
| SP-06 | MUST | Graceful shutdown on deploy (connection draining) | ✅ | AT-35 |
| SP-07 | SHOULD | Room count cap prevents memory exhaustion | ✅ | AT-34 |
| SP-08 | MAY | Auto-scaling triggers (Fly.io machine scaling) | 🔲 | — |
| SP-09 | MAY | Alerting rules on key metrics (connected_players, error_rate) | 🔲 | — |
| SP-10 | MAY | Real-time monitoring dashboard (Grafana) | 🔲 | — |
