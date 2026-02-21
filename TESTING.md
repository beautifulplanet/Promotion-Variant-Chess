# Testing Phase — Feb 21, 2026

## Overview

Automated playtest agent built with **Playwright** to catch bugs we don't have time to find manually. The agent plays real games against Stockfish AI, stress-tests UI, and validates visual correctness — not just "did it crash" but "did it render right."

## What We Found

### Bug 1: Rapid-Click Crash
**How found:** Playtest agent fires 40 random clicks on the canvas in rapid succession.  
**Root cause:** Each click triggered a full Three.js scene teardown + rebuild (`updatePieces()`). 40 of those in quick succession caused GC pressure, WebGL context loss, and the `alert()` in the context-lost handler blocked the thread — killing the page.  
**Fixes applied (5):**
1. **Click debounce** — 100ms throttle in `setupClickHandler()` (renderer3d.ts)
2. **Input lock** — `_processingClick` reentrance guard in `handleSquareClick()` (gameController.ts)
3. **RAF coalescing** — `updateState()` batches rapid calls into a single `requestAnimationFrame` tick
4. **DOM toast** — replaced `alert()` with a non-blocking toast on WebGL context loss
5. **Three.js disposal** — dispose geometry + materials when removing pieces (prevent memory leaks)

### Bug 2: Flip Board Glitch
**How found:** User spotted it visually; playtest agent didn't catch it (only checked crashes).  
**Root cause:** `toggleBoardFlip()` deferred rendering via RAF coalescing, but `syncRendererState()` from game logic would fire in between frames, recalculating `cachedPlayerColor` and causing a 1-frame flicker where the board snapped back momentarily.  
**Fix:** Made `toggleBoardFlip()` synchronous — simple color inversion + immediate `updatePieces()` call. The `viewFlipped` flag persists correctly across subsequent `updateState()` calls.

### Lesson: Visual Correctness vs Crash Detection
The original 8 tests only checked "did the page crash" and basic invariants (king count, piece total). They completely missed the flip glitch — which was a rendering/state consistency issue, not a crash. This led to adding 5 visual-correctness tests that verify actual state values.

## Test Suite: 13 Tests

### Gameplay Tests (slow — Stockfish AI ~4s/move)
| Test | What it validates |
|------|-------------------|
| Play 8 turns | Board invariants every move (king counts, piece total ≤32) |
| Undo after 3 turns | Full undo resets move count to 0, canvas stays visible |
| New game × 3 | 3 consecutive games with 2 turns each, board valid after each |
| PGN export | Output contains `[Event`, move notation `1.` |

### Visual Correctness Tests
| Test | What it validates |
|------|-------------------|
| Flip board toggles | `isViewFlipped()` + `getPlayerColor()` invert/restore correctly |
| Flip during gameplay | Flip mid-game, play more turns while flipped — state stays consistent |
| Turn indicator | Sidebar text matches `getCurrentTurn()` (white/black) |
| Move changes board | Board JSON + move count actually differ after a move |
| Undo restores exact board | Full undo returns board JSON to starting position exactly |

### Stress & Infrastructure Tests
| Test | What it validates |
|------|-------------------|
| Rapid clicking | 40 random canvas clicks — page stays alive, no JS errors |
| Mobile viewport | 375×812 touch events — canvas visible, no errors |
| UI buttons | Click undo/flip/new-game/export + keyboard shortcut (?) — no crashes |
| Console error audit | No unexpected `console.error` during 5s idle |

## How to Run

```bash
# Full suite (Chromium only — WebKit needs separate install)
npx playwright test e2e/playtest.spec.ts --project=chromium --workers=1

# Just the flip tests (fast)
npx playwright test e2e/playtest.spec.ts --project=chromium -g "Flip"

# Watch it play (headed mode)
npx playwright test e2e/playtest.spec.ts --project=chromium --headed --workers=1
```

**Note:** Requires Vite dev server running (`npx vite`) or configure `playwright.config.ts` `webServer`.

## Test Results (Feb 21, 2026)

```
11 passed, 2 failed (Chromium)
├── PASS: Play 8 turns
├── PASS: Undo after 3 turns
├── PASS: New game × 3
├── PASS: PGN export
├── PASS: UI buttons
├── FAIL: Rapid clicking (page still crashes under extreme 40-click stress)
├── PASS: Flip board toggles correctly
├── PASS: Flip during gameplay
├── PASS: Turn indicator matches game state
├── PASS: Move changes board state
├── PASS: Undo restores exact board state
├── FAIL: Console error audit (timeout — page load >15s)
└── N/A:  Mobile viewport (needs WebKit install)
```

## Architecture: How the Agent Works

The playtest agent uses two exposed globals for direct API access:

- `window.__GAME__` — the `gameController` module (move, undo, state, PGN)
- `window.__RENDERER__` — the `renderer3d` module (flip, player color, view state)

### Key helper functions:
- `makePlayerMove()` — picks a random legal move via `page.evaluate()`
- `waitForAI()` — uses `page.waitForFunction()` polling (non-blocking, handles Stockfish 3-5s latency)
- `playOneTurn()` — player move + AI response in sequence
- `validateBoard()` — checks king counts and piece totals

This avoids DOM clicking for moves (unreliable with 3D canvas) and directly exercises the game logic, while still running in a real browser with WebGL.

## Commits

- `a9a005f` — `fix: stability hardening — click debounce, input lock, RAF coalescing, WebGL toast, Three.js disposal, flip glitch`
- `7dfef93` — `test: automated playtest agent with 13 visual-correctness + stress tests`
