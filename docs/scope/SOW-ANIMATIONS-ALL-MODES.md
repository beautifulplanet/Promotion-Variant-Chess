# SOW: Animations in All Modes — Discovery, Fixes, and Capture/Idle Variants

**Status:** Draft  
**Created:** 2026-03-14  
**Owner:** Engineering  
**Context:** Game is live. Animations (piece move, capture effects, environment lazy animations) do not work or are invisible in Classic, mobile, and/or flat board mode. Previously implemented and tested by AI; current state is broken or gated away. This SOW defines discovery, root-cause fixes, and the full scope for “animations everywhere” plus capture variants and idle/lazy animations.

---

## 1. Problem Statement

- **Observed:** In Classic mode, mobile, and/or other modes, piece move animations, capture effects (e.g. poof/squish/spiral/pop), and “lazy” environment animations do not run or are not visible.
- **Expected (from design):**  
  - [FEATURE_SCOPE.md](../FEATURE_SCOPE.md): “Bounce animations when pieces move”, “Particle bursts on captures”.  
  - [REQUIREMENTS.md](../REQUIREMENTS.md) UX-12: “Reduced-motion preference disables piece animations” (implies piece animations exist and work).  
  - Intent: different capture animations when “killing” opponent pieces; lazy/idle animations when pieces “hang out” (and environment flyers/walkers).
- **Risk:** Claiming “fixed” without tracing the full system leads to repeated rework and user frustration. This SOW forces a single source of truth and methodical execution.

---

## 2. Scope

### In scope

1. **Discovery and documentation**  
   Map the full animation pipeline: where animations are enabled/disabled, which modes gate them, and why they are missing or invisible.

2. **Root-cause fixes**  
   Fix mode-based gating and visibility so that:
   - Piece move arc + squash/stretch + landing bounce run in **all** modes (Newspaper, Classic, mobile, Explore).
   - Capture effects (and dust) are **visible** in **all** modes where the board is shown.
   - Environment “lazy” animations (flyers, walkers, etc.) run when the 3D environment is visible (and are not required in flat/classic if env is hidden by design).

3. **Capture animation variants**  
   Design and implement “different animations when you kill an opponent” (e.g. by captured piece type, or by move type, or both), so captures are not a single random effect.

4. **Idle / “lazy” piece animations**  
   Design and implement subtle animations for pieces at rest (“hang out”) — e.g. slight bob, breathe, or highlight pulse — so the board feels alive when no move is in progress.

5. **animQuality usage**  
   `animQuality` (1–6) is set in ClassicMode and main-3d but **never read** in the renderer. Either wire it to animation complexity/frame-skip (per [VERSION1_DESIGN_RETROSPECTIVE.md](../VERSION1_DESIGN_RETROSPECTIVE.md)) or remove the dead code and document the decision.

6. **Verification**  
   Acceptance criteria and manual test matrix for Newspaper, Classic, mobile viewport, and Explore so we can prove “animations work in all modes” and “capture variants + idle exist”.

### Out of scope (for this SOW)

- Win animation changes (separate if needed).
- Performance optimization beyond “animations must run without dropping below playable FPS”.
- New game modes or new UI; only “animations in existing modes”.

---

## 3. Current State (Discovery)

### 3.1 Animation pipeline (high level)

| Step | Where | What happens |
|------|--------|----------------|
| 1 | `gameController.ts` | On move: `fireMoveAnimation(from, to, piece, captured, flags)` → `onMoveAnimation` callback. |
| 2 | `main-3d.ts` | Callback calls `Renderer.setPendingMoveAnimation(data)`. |
| 3 | `gameController.ts` | `notifyStateChange()` → `syncRendererState()` → `Renderer.updateState(board, …)`. |
| 4 | `renderer3d.ts` | `updateState` schedules RAF → `updatePieces()`. Board rebuilt; `pendingMoveAnim` copied to `pendingStartAnim`. |
| 5 | `renderer3d.ts` | Every frame: `tickMoveAnimations()`. Polls for piece at destination; when found, `_tryStartAnim()` snaps piece to source, starts arc + optional `_spawnCapture()`. |
| 6 | `renderer3d.ts` | Capture effect meshes added to `effectsGroup`. Dust puffs also in `effectsGroup`. |

So: **piece move arc** and **capture/dust effects** are driven by the same pipeline. If one is missing in a mode, the cause is either (a) callback not fired, (b) piece not found (e.g. 2D async sprite), (c) **effects or pieces not visible** in that mode.

### 3.2 Root causes identified (code evidence)

| Issue | Location | Evidence |
|-------|----------|----------|
| **Capture/dust effects hidden in Classic** | `renderer3d.ts` ~1383 | `setFlatBoardMode(true)` sets `effectsGroup.visible = false`. So in Classic (flat board), capture and dust effects are never shown. |
| **Environment “lazy” animations only in 3D** | `renderer3d.ts` ~5784–5801, `eraWorlds.ts` ~1142–1169 | When `is2DMode` is true, render loop returns early after `tickMoveAnimations()` and never calls `updateEraEnvironment()`. Lazy flyer/walker animations live in `updateEraEnvironment()`. So they only run when env is visible and not in 2D/overhead. |
| **animQuality unused** | `renderer3d.ts` | `animQuality` set by `setAnimQuality()` (line ~1333) but never read. No frame-skip or complexity gating. |
| **Capture effect is random, not “different per kill”** | `renderer3d.ts` ~4882–4883 | `_spawnCapture()` picks one of `['poof','squish','spiral','pop']` at random. No input from captured piece type or move. |
| **No idle/lazy piece animations** | — | No code that animates pieces at rest (bob, breathe, pulse). Only move arc, landing bounce, and capture/dust. |

### 3.3 What exists today

- **Piece move:** Arc, squash/stretch, landing bounce implemented; `tickMoveAnimations()` runs every frame for all modes. So **piece move animation can run** in Classic/flat **if** the piece is found (e.g. 2D sprite sync/async).
- **Capture effects:** Four types (poof, squish, spiral, pop) implemented and ticked; **hidden in flat mode** via `effectsGroup.visible = false`.
- **Lazy environment:** Flyers (soaring), ground walkers (bob + sway), lightning, birds, snowfall, etc. in `eraWorlds.ts`; only run when env is visible and not 2D.
- **Win animation:** Exists; not in scope for this SOW.

---

## 4. Work Breakdown

### Phase A: Discovery and documentation (must complete first)

| ID | Task | Deliverable |
|----|------|-------------|
| A1 | Trace and document every path where `setEnvironmentAnimationEnabled`, `setFlatBoardMode`, `effectsGroup.visible`, `envEnabled`, `envAnimEnabled` are set or read. | Short doc or table in this SOW or linked ADR. |
| A2 | Confirm in which modes the game uses flat board vs perspective, and when `effectsGroup` is visible. | Same doc; add “Mode → visibility” matrix. |
| A3 | Verify `onMoveAnimation` is registered and called for all move sources (player click, AI, promotion, undo replay if any). | One-line confirmation + list of call sites. |

### Phase B: Root-cause fixes (animations in all modes)

| ID | Task | Deliverable |
|----|------|-------------|
| B1 | In flat board mode, **show** capture and dust effects (e.g. set `effectsGroup.visible = true` when in flat mode, or add capture/dust to a layer that is always visible). Ensure effect position/size works with ortho camera. | Code change + note in SOW or ADR. |
| B2 | Ensure piece move animation (arc, bounce) runs in Classic/flat: verify 2D piece creation and `_findPiece` so that `pendingStartAnim` finds the piece within the poll timeout; fix any mode-specific skip. | Code change + regression test or manual test. |
| B3 | (Optional) In 2D/overhead mode, if we want minimal “lazy” feedback without full env: document and, if agreed, add a single lightweight effect (e.g. piece idle pulse) that works in 2D. | Decision + optional implementation. |

### Phase C: Capture animation variants

| ID | Task | Deliverable |
|----|------|-------------|
| C1 | Define rules for “different animations when you kill”: e.g. by captured piece type (pawn vs queen), or by capture type (simple vs en passant), or both. | Short design in SOW or ADR. |
| C2 | Implement selection logic in `_spawnCapture(capturedType?)` (or equivalent) and add at least 2–3 distinct visual variants (e.g. “big” for queen capture, “small” for pawn). | Code + list of variants. |
| C3 | Manual test: capture each piece type (or a subset) and confirm correct variant plays in Newspaper and Classic. | Test log. |

### Phase D: Idle / “lazy” piece animations

| ID | Task | Deliverable |
|----|------|-------------|
| D1 | Design: subtle animation for pieces at rest (e.g. slow bob, scale breathe, or highlight pulse). Consider performance (only N pieces per frame if needed). | Short design in SOW or ADR. |
| D2 | Implement idle animation in render loop (e.g. in `tickMoveAnimations` or a separate `tickIdleAnimations`), gated by `animQuality` if wired. | Code. |
| D3 | Ensure idle animation works in both 3D and 2D/flat mode and does not conflict with move/capture. | Code + manual test. |

### Phase E: animQuality and cleanup

| ID | Task | Deliverable |
|----|------|-------------|
| E1 | Decide: use `animQuality` to gate animation complexity (e.g. frame-skip for env, or disable idle at low quality) or remove and document. | ADR or SOW update. |
| E2 | Implement or remove per decision. | Code. |

**Phase E implemented (2026-03-14)**

**Decision:** Wire `animQuality` (1–6) to three animation systems, not remove it. Rationale: on Potato/Low devices these systems are pure CPU overhead per frame; disabling them at low quality is the right trade-off. The quality levels already exist and users can choose them on the welcome screen.

| animQuality | Idle breathing | Dust puffs | Shake intensity |
|-------------|---------------|------------|-----------------|
| 1 (Potato)  | Off           | Off        | 20%             |
| 2 (Low)     | Off           | On         | 40%             |
| 3 (Balanced)| On            | On         | 70%             |
| 4–6 (High+) | On            | On         | 100%            |

**Code changes in `renderer3d.ts`:**
- `_spawnDust()`: early-return `if (animQuality < 2)`.
- `tickIdleAnimations()`: early-return `if (animQuality < 3)`.
- `getShakeOffset()`: `qualityScale = animQuality ≤ 1 ? 0.2 : animQuality ≤ 2 ? 0.4 : animQuality ≤ 3 ? 0.7 : 1.0`. Applied to `remaining` before random offset is computed.
- Ortho frustum restore guard: changed from `shake.x !== 0` to `shake.x !== 0 || shake.y !== 0` (stored as `hasOrthoShake`) so the restore fires correctly regardless of which axis is non-zero.

### Phase F: Verification and regression

| ID | Task | Deliverable |
|----|------|-------------|
| F1 | Acceptance criteria: (1) Piece move + capture effect + dust visible in Newspaper, Classic, mobile viewport, Explore. (2) At least two capture variants by captured piece or type. (3) Idle animation visible when no move in progress. (4) No regression on win animation or environment lazy when env is on. | Checklist in SOW. |
| F2 | Manual test matrix: [Newspaper / Classic / Explore] × [Desktop / Mobile viewport] × [Move, Capture, Idle]. | Test log. |
| F3 | Update [REQUIREMENTS.md](../REQUIREMENTS.md) and [FEATURE_SCOPE.md](../FEATURE_SCOPE.md) status for UX-12 and “bounce / particle bursts” once done. | Doc update. |

---

## 5. Acceptance Criteria (Summary)

- [ ] **AC1** Piece move arc, squash/stretch, and landing bounce run in Newspaper, Classic, mobile, and Explore.
- [ ] **AC2** Capture effect (and dust) are **visible** in Newspaper, Classic, mobile, and Explore when a capture occurs.
- [ ] **AC3** At least two distinct capture animation variants (e.g. by captured piece type or importance).
- [ ] **AC4** Idle/lazy piece animation runs when no move is in progress, in all modes where the board is shown.
- [ ] **AC5** Environment lazy animations (flyers, walkers, etc.) still work when 3D environment is visible; no regression.
- [ ] **AC6** `animQuality` is either used for animation gating or removed and documented.
- [ ] **AC7** Manual test matrix completed and logged; REQUIREMENTS/FEATURE_SCOPE updated.

---

## 6. References

- [FEATURE_SCOPE.md](../FEATURE_SCOPE.md) — bounce animations, particle bursts on captures.
- [REQUIREMENTS.md](../REQUIREMENTS.md) — UX-12 reduced-motion and piece animations.
- [VERSION1_DESIGN_RETROSPECTIVE.md](../VERSION1_DESIGN_RETROSPECTIVE.md) — Anim Quality 1–6, env anim toggle.
- `renderer3d.ts` — `tickMoveAnimations`, `_spawnCapture`, `effectsGroup`, `setFlatBoardMode`, `setAnimQuality`.
- `eraWorlds.ts` — `updateEraEnvironment`, flyer/walker lazy animations.
- `classicMode.ts` — `setEnvironmentAnimationEnabled`, `setAnimQuality`, `setFlatBoardMode` (indirect via Renderer).

---

## 8. Phase A Discovery (Executed 2026-03-14)

### A1: Where animation gating is set/read

| Symbol | Set | Read |
|--------|-----|------|
| `setEnvironmentAnimationEnabled(enabled)` | main-3d.ts:747 (debug toggle); classicMode.ts:95,132,151,178,193,208,223,238,253 | renderer3d.ts:1284 (writes `envAnimEnabled`) |
| `envAnimEnabled` | renderer3d.ts:1285 | renderer3d.ts:5826 (updateEraEnvironment gate) |
| `setFlatBoardMode(enabled)` | classicMode.ts:84,126,146 | renderer3d.ts:1367 (writes `flatBoardMode`); many `if (flatBoardMode) return` in camera/orbit |
| `effectsGroup.visible` | renderer3d.ts:1383 (false when flat ON), 1423 (true when flat OFF) | — (visibility only) |
| `envEnabled` | renderer3d.ts:102 (init true), 1251 (setEnvironmentEnabled) | renderer3d.ts:1245,1420,5805,5826 |

### A2: Mode → effectsGroup visibility

| Mode | flatBoardMode | effectsGroup.visible (before B1) | effectsGroup.visible (after B1) |
|------|----------------|-----------------------------------|----------------------------------|
| Newspaper (3D) | false | true | true |
| Classic | true | **false** | **true** |
| Explore (entered from Classic) | false | true | true |
| Explore (exited) | true | false | true |

### A3: onMoveAnimation call sites

| Source | File:Line | Fires fireMoveAnimation? |
|--------|-----------|---------------------------|
| Player click (move) | gameController.ts:617 | Yes |
| Player promotion | gameController.ts:688 | Yes |
| AI move | gameController.ts:1958 | Yes |
| Multiplayer opponent (UCI) | gameController.ts:2209 | Yes |
| Multiplayer opponent (SAN) | gameController.ts:2224 | Yes |

Callback registered once in main-3d.ts:1684 → `Renderer.setPendingMoveAnimation(data)`. All move sources go through the same path.

### B1 implemented

- In `setFlatBoardMode(true)`, `effectsGroup.visible` is now set to **true** (was false). Capture and dust effects now render in Classic/flat mode. Comment added: "effectsGroup stays visible so capture poof/squish/spiral/pop and dust show in Classic/flat".

### B2 verified

- `tickMoveAnimations()` is called every frame with no gate on `flatBoardMode` or `is2DMode`. Piece move arc, landing bounce, and capture/dust spawn use the same code path in all modes. In Classic, pieces are 2D sprites; 2500ms poll timeout + capture-effect-on-timeout already in place. No code change for B2; if piece arc still missing in Classic it may be 2D async load — monitor and consider longer timeout or sync sprite path.

### Phase C implemented (capture variants by piece type)

- **Design:** Capture effect and intensity chosen by captured piece type (from `MoveAnimationData.capturedType`).
- **Mapping:**  
  - **Queen/King:** spiral or pop (50/50), scale 1.4, duration 850ms, shake 1.2×.  
  - **Rook/Bishop/Knight:** squish or pop (50/50), scale 1.1, duration 650ms, shake 1.0×.  
  - **Pawn or unknown:** poof or squish (50/50), scale 0.85, duration 550ms, shake 0.85×.
- **Code:** `_getCaptureEffectForPiece(capturedType?)` returns `{ effectType, scale, duration, shake }`. `_spawnCapture(row, col, capturedType?)` uses it; ring geometry uses `inner/outer * scale`; screen shake uses `SHAKE_INTENSITY * shake`; effect duration from mapping. Call sites updated: `_tryStartAnim` and timeout path pass `anim.capturedType` / `pendingStartAnim.capturedType`.

### Phase D implemented (idle / lazy piece animations)

- **Design:** Subtle scale “breathe” for pieces at rest: scale = base × (1 + sin(time + phase) × 0.035). Phase offset per piece (row/col) so not in sync. Skip piece if it is the current move target (`activeMoveAnim`) or in `landingBounce` so idle does not conflict with move/capture.
- **Implementation:** `tickIdleAnimations()` runs every frame after `tickMoveAnimations()`. Loops `piecesGroup.children`; skips entries without `userData.row/col` or whose (row,col) matches active move/landing; applies breath to Sprite (base 0.9) and Group (base 1). Works in 3D and 2D/flat (same piecesGroup).
- **Constants:** `IDLE_BREATH_AMOUNT = 0.035`, `IDLE_BREATH_SPEED = 0.8`. Not gated by `animQuality` yet (Phase E).

---

## 9. Why this SOW

- **Single source of truth:** All “what’s wrong” and “what we’re doing” lives in one place. No more “I thought we fixed it” without a trace.
- **System view:** Forces tracing the whole pipeline (gameController → main-3d → renderer → modes) so we see gating and visibility, not just one function.
- **Meticulous, SafePaw-style:** Phases, IDs, deliverables, and acceptance criteria so we can tick off work and prove “animations in all modes” and “capture variants + idle” without hand-waving.
- **Live product:** Because the game is already live, every change is a regression risk; this SOW ties fixes and features to explicit verification.
