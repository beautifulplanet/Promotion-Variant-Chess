# UNDO MOVE — Complete Remediation Plan

**Project:** Sideways Chess — Undo Feature  
**Status:** COMPLETE  
**Created:** February 11, 2026  
**Scope:** Fix all 9 audit issues with the undo button. Nothing else.

---

## Audit Summary

A full end-to-end audit of the undo flow found **9 issues**:

| Task | Severity | Issue | Status |
|------|----------|-------|--------|
| T1 | Medium | `engine.undo()` return value silently discarded — false success | ✅ |
| T2 | **CRITICAL** | After undo, if it becomes AI's turn, AI never moves — game hangs | ✅ |
| T3 | Medium | `currentGamePromotions` not rolled back on undo — phantom credits | ✅ |
| T4 | Low | Move list `refreshMoveList()` throttle can silently drop undo update | ✅ |
| T5 | Low | Stockfish `stop` response can confuse `currentMoveResolver` | ✅ |
| T6 | Low | No debounce on undo button — rapid clicks undo too many moves | ✅ |
| T7 | Trivial | `onAIThinking(false)` called twice on cancel + async cleanup | ✅ |
| T8 | Low | `handleSquareClick` lacks explicit turn guard at top | ✅ |
| T9 | — | Write integration test for undo to prevent regressions | ✅ |

---

## Task 1 — Check `engine.undo()` Return Value

**Problem:** `engine.undo()` wraps `chess.js` which returns the undone move or `null` on failure. The return value is discarded. `undoMove()` logs "Undid AI move" and returns `true` even if nothing was actually undone.

**File:** `src/chessEngine.ts` (line ~259), `src/gameController.ts` (lines ~331-338)

### Plan A — Return boolean from `engine.undo()`
1. Change `ChessEngine.undo()` to return `boolean` (true if chess.js returned a move, false if null).
2. In `gameController.undoMove()`, check the return value of each `engine.undo()` call.
3. If the first undo fails, log the real failure and return `false`.
4. If the second undo fails, log but still return `true` (the first undo succeeded).

**Technical steps:**
```
chessEngine.ts:
  - Change: undo(): void → undo(): boolean
  - Change body: return this.chess.undo() !== null; (keep boardDirty = true)
  
gameController.ts undoMove():
  - Wrap each engine.undo() in an if-check
  - Log actual success/failure per undo call
```

### Plan B — Keep `void` but validate via move count
1. Before calling `undo()`, capture `engine.getMoveHistory().length`.
2. After calling `undo()`, compare lengths.
3. If length didn't change, the undo failed.

**Why Plan A is better:** Cleaner, uses chess.js's own return value, no extra call overhead.

---

## Task 2 — Reschedule AI After Undo (CRITICAL)

**Problem:** After undo, if it becomes the AI's turn (e.g., player is black and undoes to move 0, or double-undo lands on AI's turn), no `scheduleAIMove()` is called. The game hangs permanently — the AI never moves.

**File:** `src/gameController.ts` `undoMove()` (end of function, ~line 350)

### Plan A — Add AI reschedule check at end of `undoMove()`
1. After undo is complete and `notifyStateChange()` is called, check if it's now the AI's turn.
2. If `engine.turn() !== state.playerColor` and game is still active, call `scheduleAIMove()`.

**Technical steps:**
```
gameController.ts undoMove(), after notifyStateChange():
  + if (!state.gameOver && engine.turn() !== state.playerColor) {
  +   scheduleAIMove();
  + }
```

### Plan B — Prevent undo from landing on AI's turn
1. Instead of rescheduling AI, make undo always undo in pairs (player + AI) regardless of whose turn it is.
2. If there's only an AI move (no player move before it), block undo entirely.

**Why Plan A is better:** Plan B changes intended behavior and prevents legitimate undo of AI's opening move. Plan A preserves all existing logic and just adds the missing reschedule.

---

## Task 3 — Roll Back Promotions on Undo

**Problem:** When a player promotes a pawn, `currentGamePromotions.push(pieceType)` tracks it. If that promotion move is undone, the promotion is still in the array. If the player wins, they get credit for a promotion they reversed.

**File:** `src/gameController.ts` `undoMove()` (~line 330) and `completePromotion()` (~line 486)

### Plan A — Pop from `currentGamePromotions` when undoing a promotion move
1. Before each `engine.undo()`, check if the last move in history was a promotion (the move string ends with `=Q`/`=R`/`=B`/`=N` in chess.js SAN notation, or check via chess.js verbose history).
2. If it was a promotion by the player, pop the last entry from `currentGamePromotions`.

**Technical steps:**
```
gameController.ts undoMove():
  Before each engine.undo():
  + const history = engine.getMoveHistory();
  + const lastMove = history[history.length - 1];  // SAN notation
  + // chess.js SAN for promotions contains '=' (e.g., "e8=Q")
  + if (lastMove && lastMove.includes('=') && engine.turn() !== state.playerColor) {
  +   // This was a player promotion (about to undo player's move). 
  +   // Actually: whose move it WAS = opposite of current turn
  +   // If undoing player's move and it was a promotion, pop
  +   currentGamePromotions.pop();
  + }
```

### Plan B — Clear `currentGamePromotions` entirely on any undo
1. Simpler: just reset `currentGamePromotions = []` any time undo is pressed.
2. Downside: if player promoted on move 5, played 10 more moves, then undoes once — all promotions are lost, not just the undone one.

**Why Plan A is better:** Surgical — only removes the specific promotion that was undone. Plan B is lossy.

---

## Task 4 — Force Move List Refresh After Undo

**Problem:** `refreshMoveList()` has a throttle (200ms) and a move-count equality guard. After undo, if the function was recently called, the update could be silently skipped, leaving stale moves visible.

**File:** `src/moveListUI.ts` `refreshMoveList()` (~line 194)

### Plan A — Add `forceRefreshMoveList()` function, call it from undo path
1. Create a new `forceRefreshMoveList()` that bypasses both the throttle and the count guard.
2. Call it from `syncRendererState()` when undo is detected, OR add a dedicated call after undo.

**Technical steps:**
```
moveListUI.ts:
  + export function forceRefreshMoveList(): void {
  +   lastRefreshTime = 0;
  +   lastMoveCount = -1; // Force count mismatch
  +   refreshMoveList();
  + }

main-3d.ts undo handler:
  Change: MoveListUI.refreshMoveList() → MoveListUI.forceRefreshMoveList()
  (Or: call forceRefreshMoveList in syncRendererState when move count decreased)
```

### Plan B — Remove the count-equality guard entirely
1. The count guard `if (moves.length === lastMoveCount) return` is a premature optimization.
2. Remove it. Let the DOM update happen every time (it's infrequent enough not to matter).

**Why Plan A is better:** Preserves the optimization for the normal move path (which fires frequently during AI games) while guaranteeing correctness for undo. Plan B works but removes a valid perf guard.

---

## Task 5 — Prevent Stale Stockfish Resolver Confusion

**Problem:** When `cancelPendingAIMove()` sends `stockfishEngine.stop()`, Stockfish replies with a `bestmove` for the cancelled search. This resolves the `currentMoveResolver` promise with a stale move. The generation check catches it, but `currentMoveResolver` is consumed. If a new `getBestMove()` is called at the exact same moment, the new resolver could receive the stale response.

**File:** `src/stockfishEngine.ts` `stop()`, `handleMessage()`, `getBestMove()`

### Plan A — Clear `currentMoveResolver` in `stop()` and resolve with `null`
1. In `stop()`, resolve the existing `currentMoveResolver` with `null` immediately, then clear it.
2. This way, the stale `bestmove` message from Stockfish has no resolver to consume.

**Technical steps:**
```
stockfishEngine.ts stop():
  stop(): void {
  +  // Resolve any pending promise with null to prevent stale resolution
  +  if (this.currentMoveResolver) {
  +    this.currentMoveResolver(null);
  +    this.currentMoveResolver = null;
  +  }
     this.sendCommand('stop');
  }
```

### Plan B — Add a request ID to each `getBestMove()` call
1. Tag each `getBestMove()` call with a unique request ID.
2. On `bestmove`, check if the ID matches the current request.
3. This is more robust but significantly more complex.

**Why Plan A is better:** Simple, direct, fixes the specific bug. Plan B is over-engineered for this scenario since the generation guard already catches stale moves.

---

## Task 6 — Debounce Undo Button

**Problem:** Rapid clicks on the undo button call `undoMove()` multiple times without any feedback. Each call undoes 1-2 moves. Three rapid clicks on a 6-move game undoes everything.

**File:** `src/main-3d.ts` undo handler (~line 1358)

### Plan A — Add a cooldown timer to the undo button handler
1. After a successful undo, set a cooldown flag and disable it for 300ms.
2. This prevents rapid double/triple undos while still allowing intentional repeated undos.

**Technical steps:**
```
main-3d.ts, undo handler:
  + let undoCooldown = false;
  
  undoBtn.addEventListener('click', () => {
  +  if (undoCooldown) return;
     ...existing guards...
     if (Game.undoMove()) {
  +    undoCooldown = true;
  +    undoBtn.setAttribute('disabled', 'true');
       Sound.play('move');
       syncRendererState();
  +    setTimeout(() => {
  +      undoCooldown = false;
  +      undoBtn.removeAttribute('disabled');
  +    }, 300);
     }
  });
```

### Plan B — Use `requestAnimationFrame` to batch rapid clicks
1. On click, set a flag to undo on the next animation frame.
2. Multiple clicks in the same frame only trigger one undo.

**Why Plan A is better:** More predictable timing, gives visual feedback (disabled state), simpler to reason about.

---

## Task 7 — Prevent Double `onAIThinking(false)` Call

**Problem:** `cancelPendingAIMove()` calls `onAIThinking(false)`. Later, when `makeAIMoveAsync()` returns (due to generation mismatch), it also calls `onAIThinking(false)`. Harmless but messy.

**File:** `src/gameController.ts` `makeAIMoveAsync()` (~line 1477)

### Plan A — Guard the cleanup call in `makeAIMoveAsync` 
1. At the end of `makeAIMoveAsync`, only call `onAIThinking(false)` if generation still matches.
2. If generation is stale, the cancel function already handled it.

**Technical steps:**
```
gameController.ts, end of makeAIMoveAsync():
  - if (onAIThinking) onAIThinking(false);
  + if (generation === moveGeneration && onAIThinking) onAIThinking(false);
```

### Plan B — Make `onAIThinking` idempotent
1. Track the current thinking state in a boolean.
2. Only fire the callback when state actually changes.
3. More defensive but adds state tracking overhead.

**Why Plan A is better:** Single line change, directly addresses the issue. Plan B adds unnecessary complexity.

---

## Task 8 — Add Explicit Turn Guard to `handleSquareClick`

**Problem:** `handleSquareClick` doesn't explicitly reject clicks when it's not the player's turn. It relies on downstream selection guards. This is fragile.

**File:** `src/gameController.ts` `handleSquareClick()` (~line 393)

### Plan A — Add early return for wrong turn
1. After the existing guards, add: `if (currentTurn !== state.playerColor) return false;`

**Technical steps:**
```
gameController.ts handleSquareClick():
  After: const currentTurn = engine.turn();
  + if (currentTurn !== state.playerColor && !aiVsAiMode) return false;
```

### Plan B — Keep current behavior but add a comment
1. The current code is technically safe because selection guards prevent illegal moves.
2. Just add explanatory comments documenting why it works.

**Why Plan A is better:** Defense in depth. Prevents any future code changes from accidentally allowing wrong-turn moves. Single line, zero risk.

---

## Task 9 — Integration Test for Undo

**Problem:** No test currently exercises the full undo → re-render → AI reschedule flow. We need a regression test.

**File:** `tests/gameController.test.ts` (new test section)

### Plan A — Add undo test cases to existing gameController test file
1. Test: undo returns `false` when no moves exist.
2. Test: undo removes the last move from history.
3. Test: undo on player's turn undoes 2 moves (AI + player).
4. Test: undo on AI's turn undoes 1 move (player only).
5. Test: undo with empty history returns `false` and doesn't crash.
6. Test: undo returns correct turn after undoing.
7. Test: rapid undo doesn't crash or corrupt state.

**Technical steps:**
```
tests/gameController.test.ts:
  describe('Undo Move', () => {
    it('should return false when no moves to undo', ...);
    it('should undo player move and restore board', ...);
    it('should handle undo at game start gracefully', ...);
    it('should return correct turn after undo', ...);
    it('should survive rapid consecutive undos', ...);
  });
```

### Plan B — Create a separate `tests/undo.test.ts` file
1. Same tests but in a dedicated file to keep tests organized.

**Why Plan A is better:** The undo tests belong with the game controller tests. Separate file adds file-management overhead without benefit.

---

## Execution Order

Tasks are ordered by dependency and impact:

1. **T1** — Fix `engine.undo()` return value (prerequisite for reliable T2/T3)
2. **T2** — AI reschedule after undo (**CRITICAL**, fixes game hang)
3. **T3** — Promotion rollback (correctness)
4. **T8** — Turn guard in `handleSquareClick` (defense in depth)
5. **T4** — Force move list refresh (UI correctness)
6. **T5** — Stockfish resolver cleanup (race condition)
7. **T6** — Undo button debounce (UX polish)
8. **T7** — Double AI-thinking call (cleanup)
9. **T9** — Integration tests (verification)

---

## Files Modified (In Scope Only)

| File | Tasks |
|------|-------|
| `src/chessEngine.ts` | T1 |
| `src/gameController.ts` | T1, T2, T3, T7, T8 |
| `src/moveListUI.ts` | T4 |
| `src/stockfishEngine.ts` | T5 |
| `src/main-3d.ts` | T4, T6 |
| `tests/gameController.test.ts` | T9 |

---

## Out of Scope

- Any UI/visual changes beyond the undo button
- AI difficulty tuning
- New features
- Board rendering changes
- Sound system changes
- Save/load system changes
- Anything not directly related to the undo button flow
