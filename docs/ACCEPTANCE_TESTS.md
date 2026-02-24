# Acceptance Tests

Requirements → verification mapping.  
Each requirement in [REQUIREMENTS.md](REQUIREMENTS.md) has an AT-xx ID that points here.

---

## How to Read This

| Column | Meaning |
|---|---|
| **AT-ID** | Acceptance test identifier (referenced from REQUIREMENTS.md) |
| **Requirement** | What's being verified |
| **Method** | How it's verified (auto = CI-runnable, manual = human check) |
| **Command / Location** | Exact command or file path |
| **Pass Criteria** | What "pass" looks like |

---

## UX

| AT-ID | Requirement | Method | Command / Location | Pass Criteria |
|---|---|---|---|---|
| AT-01 | Page loads < 10s on broadband | E2E | `npx playwright test e2e/smoke.spec.ts -g "loads"` | No timeout at 10s |
| AT-02 | Welcome dashboard visible on load | E2E | `npx playwright test e2e/welcome-dashboard.spec.ts -g "visible"` | `#welcome-dashboard` visible |
| AT-03 | Touch controls on mobile | E2E | `npx playwright test e2e/smoke.spec.ts --project="Mobile Safari"` | Tap-select + tap-move works |
| AT-04 | Classic Mode layout | E2E | `npx playwright test e2e/classic-mode.spec.ts` | Dark layout renders, board visible |
| AT-05 | GFX presets playable | Manual | Toggle Low/Med/High in browser, check FPS | Each preset ≥ 30 FPS desktop |
| AT-06 | Theme change instant | Manual | Cycle themes via button | No reload, colors change immediately |
| AT-07 | Board visible without scroll (mobile) | E2E | `npx playwright test --project="Mobile Safari" -g "board"` | Board within viewport |
| AT-08 | 44px touch targets | Manual | Inspect action bar buttons | `min-height: 44px` in computed styles |
| AT-09 | Move list scrollable | Manual | Play 20+ moves, check overflow | Scrollbar appears, no viewport overflow |

---

## Game Logic

| AT-ID | Requirement | Method | Command / Location | Pass Criteria |
|---|---|---|---|---|
| AT-10 | Perft depth 5 correct | Unit (Rust) | `cd rust-engine && cargo test perft` | All positions match reference values |
| AT-11 | Special moves work | Unit (Rust) | `cd rust-engine && cargo test -- special` | En passant, castling, promotion pass |
| AT-12 | Game-end detection | Unit (TS) | `npx vitest run -t "checkmate\|stalemate\|draw\|repetition\|fifty"` | All end conditions detected |
| AT-13 | Undo works | E2E | `npx playwright test e2e/playtest.spec.ts -g "Undo"` | Move count returns to 0 |
| AT-14 | New game resets | E2E | `npx playwright test e2e/playtest.spec.ts -g "New game"` | Board matches starting position |
| AT-15 | Board flip | E2E | `npx playwright test e2e/playtest.spec.ts -g "Flip"` | `isViewFlipped()` toggles correctly |

---

## AI

| AT-ID | Requirement | Method | Command / Location | Pass Criteria |
|---|---|---|---|---|
| AT-16 | AI always responds | E2E | `npx playwright test e2e/smoke.spec.ts -g "AI responds"` | AI move appears within timeout |
| AT-17 | Fallback chain works | Unit | `npx vitest run -t "fallback"` | Stockfish failure → TS minimax response |
| AT-18 | AI speed | E2E | `npx playwright test e2e/playtest.spec.ts -g "Play 8"` | 8 turns complete within 80s |

---

## Save / Load

| AT-ID | Requirement | Method | Command / Location | Pass Criteria |
|---|---|---|---|---|
| AT-19 | Auto-save on every move | E2E | `npx playwright test e2e/smoke.spec.ts -g "save"` | localStorage key exists after move |
| AT-20 | File export/import | E2E | `npx playwright test e2e/smoke.spec.ts -g "export\|load"` | Exported JSON re-imports identically |
| AT-21 | Preferences persist | Manual | Set theme + piece style, reload page | Same settings after reload |

---

## Multiplayer

| AT-ID | Requirement | Method | Command / Location | Pass Criteria |
|---|---|---|---|---|
| AT-22 | Guest join | Unit (server) | `cd server && npx vitest run -t "guest"` | Guest gets JWT, can create/join |
| AT-23 | Server validates moves | Unit (server) | `cd server && npx vitest run -t "illegal\|turn"` | Illegal moves rejected, wrong-turn rejected |
| AT-24 | Draw/resign protocol | Unit (server) | `cd server && npx vitest run -t "draw\|resign"` | Protocol completes, game ends correctly |
| AT-25 | ELO updates | Unit (server) | `cd server && npx vitest run -t "elo\|rating"` | K=32, correct delta after win/loss/draw |
| AT-26 | Reconnect grace | Unit (server) | `cd server && npx vitest run -t "reconnect\|disconnect"` | 30s grace, game preserved |
| AT-27 | Server-side clock | Unit (server) | `cd server && npx vitest run -t "clock\|time"` | Time tracked server-side |

---

## Security

| AT-ID | Requirement | Method | Command / Location | Pass Criteria |
|---|---|---|---|---|
| AT-28 | Security headers | Manual / curl | `curl -I https://[server-url]` | Helmet headers present (HSTS, X-Frame-Options, nosniff). CSP via frontend `<meta>` tag + `vercel.json` headers |
| AT-29 | HTTP rate limit | k6 | `k6 run load-tests/http-load-test.js` | 429 responses after 100 req/min |
| AT-30 | WS rate limit + IP cap | k6 | `k6 run load-tests/websocket-load-test.js` | Connections dropped after 20 msg/sec or 10 per IP |
| AT-31 | Zod validation | Unit (server) | `cd server && npx vitest run -t "zod\|validation\|malformed"` | Bad messages rejected |
| AT-32 | Auth (bcrypt + JWT) | Unit (server) | `cd server && npx vitest run -t "auth\|password\|jwt"` | Passwords hashed, tokens validated |
| AT-33 | CORS allowlist | Manual / curl | `curl -H "Origin: evil.com" https://[server-url]` | Request blocked |
| AT-34 | Room cap | Unit (server) | `cd server && npx vitest run -t "room cap\|max rooms"` | 501st room creation rejected |
| AT-35 | Graceful shutdown | Unit (server) | `cd server && npx vitest run -t "shutdown\|SIGTERM"` | Connections drained, no orphans |

---

## Performance

| AT-ID | Requirement | Method | Command / Location | Pass Criteria |
|---|---|---|---|---|
| AT-36 | FPS floors | Manual | Chrome DevTools FPS meter | Low ≥ 30, all presets playable |
| AT-37 | WASM engine speed | Unit (Rust) | `cd rust-engine && cargo bench` | Depth 5 < 1s desktop |
| AT-38 | HTTP P95/P99 | k6 | `k6 run load-tests/http-load-test.js --vus=50 --duration=60s` | P95 < 500ms, P99 < 1s, errors < 5% |
| AT-39 | WS latency | k6 | `k6 run load-tests/websocket-load-test.js --vus=200` | P95 connection < 2s, msg P95 < 500ms |
| AT-40 | WASM binary size | Build | `ls -la rust-engine/pkg/*.wasm` + gzip check | < 200 KB gzipped |
| AT-41 | Stress test | k6 | `k6 run load-tests/stress-test.js` | Server stays up, no crash |
| AT-42 | Metrics + health | Manual / curl | `curl https://[server-url]/health` + `/metrics` | 200 OK, valid Prometheus format |

---

## Quick Verification Commands

```bash
# Full unit test suite
npx vitest run                                    # 420 frontend tests
cd server && npx vitest run                       # 168 server tests
cd rust-engine && cargo test                      # 218 engine tests

# Full E2E suite
npx playwright test --project=chromium --workers=1

# Perft quick check (depth 3, fast)
cd rust-engine && cargo test perft

# Load tests (requires running server)
k6 run server/k6/http-load.js --vus=50 --duration=30s
k6 run server/k6/ws-load.js --vus=100 --duration=30s

# Build check
npx tsc --noEmit && npx vite build
```
