# Scope

Last updated: 2026-02-22  
Intentionally short. If it takes a week to read, it's not a guardrail.

---

## MVP (must ship)

- [x] Single-player vs AI on desktop + mobile (Chrome, Safari, Firefox)
- [x] Legal moves perft-validated through depth 5
- [x] Triple-fallback AI (Rust WASM → Stockfish → TS minimax)
- [x] Save/load (localStorage + JSON file export)
- [x] 8 themes, 3 GFX presets, Classic Mode toggle
- [x] Welcome dashboard with all pre-game options
- [x] Unit tests pass (420 + 218 + 168)
- [x] E2E Playwright tests pass
- [x] README documents everything a reviewer needs
- [ ] No critical console errors on load

---

## Non-Goals (not now)

| What | Why not |
|---|---|
| Feature parity with chess.com/lichess | Portfolio piece, not a product |
| Horizontal scaling / clustering | Single Fly.io VM is appropriate for portfolio traffic |
| Anti-cheat beyond move legality | Needs server-side engine — too expensive for portfolio |
| Social features (friends, chat, spectating) | Significant infra for low demo value |
| Screen reader / keyboard-only play | Important, not yet scoped (tracked as SHOULD) |
| Opening book / endgame tablebase | Engine nice-to-have, not MVP |
| Native mobile app | Web-first; native doubles the codebase |

---

## Invariants (must never break)

| Invariant | What breaks if violated |
|---|---|
| **Move legality** — engine generates only legal moves, perft matches | Entire game is wrong |
| **Save integrity** — load(save(state)) === state | Player loses progress |
| **Multiplayer consistency** — server is authority, clients can't forge moves | Cheating becomes trivial |
| **AI always responds** — fallback chain never leaves player hanging | Game freezes, unrecoverable |
| **Auth correctness** — passwords hashed (bcrypt), JWT tokens validated | Security hole |
| **Rate limits active** — HTTP 100/min, WS 20/sec, IP cap 10 | One client can DoS server |
| **Graceful shutdown** — SIGTERM drains connections, no orphaned games | Deploys corrupt state |

---

## Performance Floors

Not SLOs — rough floors. "It doesn't embarrassingly break."

| What | Floor | Measured how |
|---|---|---|
| Desktop FPS (Low GFX) | ≥ 30 | Manual check, Chrome DevTools |
| Mobile FPS (Low GFX, mid-range phone) | ≥ 20 | Manual check |
| WASM depth-5 search (desktop) | < 1s | cargo bench / browser console timer |
| Page load → interactive (broadband) | < 10s | Playwright timing |
| Server P95 under 50 VU (k6) | < 500ms | k6 HTTP script |
| Server stays up under reconnect storms | No crash | k6 WebSocket script |
| WASM binary gzipped | < 200 KB | Build output |
