# SOW: Welcome Screen — Mode Selection, Graphics Picker, and Game Load

**Status:** Phase A–E implemented. Phase F (verification) pending.  
**Created:** 2026-03-14  
**Owner:** Engineering  
**Context:** Game is live. Before this SOW the welcome dashboard existed as a UI shell but did not help users understand or choose their experience: mode selection was a single small toggle button, graphics quality was a single cycle button, and load-game was buried. New users had no guided onboarding before a game started.

---

## 1. Problem Statement

- **Observed:** On first load, the welcome screen showed stats, a big Play button, and small preference toggles. A new user had no way to understand that the game has two fundamentally different modes (immersive 3D vs. clean 2D) or that they could choose between six graphics quality presets. The Load Game feature was present but not prominent.
- **Expected:** A well-designed welcome screen that asks the player — before any game starts — what mode they want to play, what graphics level suits their device, and gives a clear, accessible path to resume a saved game from a `.json` file.
- **Risk:** Without explicit mode guidance, new users default to 3D on low-end devices (hurts performance), or never discover Classic mode (misses target audience), or lose saved progress because Load Game is not obvious.

---

## 2. Scope

### In scope

1. **Mode selection (visual cards)**  
   Replace the single `♟ Classic Mode` pref toggle with two prominent visual cards — 3D Chronicle and Classic Mode — each with an icon, name, and description. The active mode is highlighted. Clicking a card switches the mode immediately.

2. **Graphics quality selector (visual pills)**  
   Replace the single `🔥 GFX: High` cycle button with six quality pills (Potato / Low / Balanced / High / Ultra / Extreme) in a row. The active level is highlighted. Clicking any pill sets that quality level directly — no cycling.

3. **Load Game prominence**  
   Elevate the Load Game button to the top of the Actions grid (first position, above Setup Board, Play Online, How to Play) and update its description to "Resume from a .json save file" — matching the actual file format users produce.

4. **Layout and information hierarchy**  
   Establish a clear top-to-bottom decision flow: choose mode → choose graphics → play (or load). The hero "Play vs AI" button moves below the configuration options so users configure before committing.

5. **Theme button**  
   Retain the theme toggle as a full-width button below the quality row so it is accessible without searching.

### Out of scope (for this SOW)

- Piece style picker on the welcome screen (in-game via Options panel; out of scope here).
- Board style picker on the welcome screen (same reason).
- Accounts/profiles screen (placeholder in footer; separate SOW when accounts are built).
- AI difficulty/colour selection on welcome screen (in-game via Setup Board).
- Animation or gameplay changes; only the welcome screen UI.

---

## 3. Current State (Discovery)

### 3.1 What existed before this SOW

| Element | Before | Problem |
|---------|--------|---------|
| Mode toggle | `♟ Classic Mode` pref button (1 of 3 in a row) | Invisible to new users; no explanation of what Classic means |
| Graphics toggle | `🔥 GFX: High` pref button — cycles through all 6 levels | Requires N clicks to reach desired level; no at-a-glance view |
| Load Game | 2×2 grid button, 3rd position | Not prominent; description ("Resume from a save file") did not mention file format |
| Layout | Stats → Play → Game Modes grid → Preferences row | Configuration at bottom, action at top — backwards for new users |

### 3.2 Component map

| File | Relevant sections |
|------|-------------------|
| `index.html` | `#welcome-dashboard` HTML (lines ~2652–2725); welcome dashboard CSS (lines ~2388–2647) |
| `src/main-3d.ts` | Dashboard init: lines ~2369–2464 (date, button sync, click handlers) |
| `src/classicMode.ts` | `isClassicMode()`, `setClassicMode()`, `setGraphicsQuality()`, `GraphicsQuality` type, `QUALITY_INFO`, `QUALITY_ORDER` |
| `src/saveSystem.ts` | `SaveData` interface — load/save JSON format (ELO, styles, FEN, etc.) |

### 3.3 Quality levels available

| Value | Label | Emoji | Target |
|-------|-------|-------|--------|
| `potato` | Potato | 🥔 | Budget tablets (Galaxy A7 Lite, Fire 7) |
| `low` | Low | 🔋 | Budget phones, older tablets |
| `med` | Balanced | ⚡ | Mid-range phones & tablets |
| `high` | High | 🔥 | Modern phones, older laptops |
| `ultra` | Ultra | 💎 | Modern laptops & desktops |
| `extreme` | Extreme | 🚀 | Gaming PCs, high-refresh displays |

---

## 4. Work Breakdown

### Phase A: Discovery

| ID | Task | Status |
|----|------|--------|
| A1 | Map all relevant components: welcome dashboard HTML, CSS, JS handlers in main-3d.ts, ClassicMode API, SaveSystem format | ✅ Done |
| A2 | Confirm what mode/quality identifiers are available and how they map to `classicMode.ts` exports | ✅ Done |
| A3 | Confirm Load Game is fully wired and what file format it expects | ✅ Done — `Game.loadProgress()` → file picker → JSON parse → `SaveData` |

### Phase B: Mode Selection (visual cards)

| ID | Task | Status |
|----|------|--------|
| B1 | Add CSS: `.wd-mode-grid`, `.wd-mode-card`, `.wd-mode-card.selected`, `.wd-mode-icon`, `.wd-mode-name`, `.wd-mode-desc` | ✅ Done |
| B2 | Add HTML: two-card grid with 🏰 3D Chronicle and ♟ Classic Mode; cards inside `#welcome-dashboard` content area above hero button | ✅ Done |
| B3 | JS: `syncModeCards()` — reads `ClassicMode.isClassicMode()`, adds/removes `.selected` on both cards | ✅ Done |
| B4 | JS: click handlers on `#wd-mode-3d` and `#wd-mode-classic` — call `handleClassicToggle()` only if switching, then `syncModeCards()` | ✅ Done |
| B5 | Remove old `wd-classic-btn` from HTML and remove its JS init/handler | ✅ Done |

### Phase C: Graphics Quality (visual pills)

| ID | Task | Status |
|----|------|--------|
| C1 | Add CSS: `.wd-quality-row`, `.wd-quality-btn`, `.wd-quality-btn.selected`, `.wd-quality-emoji` | ✅ Done |
| C2 | Add HTML: `#wd-quality-row` with six `<button class="wd-quality-btn" data-quality="...">` pills using `data-quality` attribute to match `GraphicsQuality` values | ✅ Done |
| C3 | JS: `syncQualityBtns()` — reads `ClassicMode.getGraphicsQuality()`, sets `.selected` on matching pill | ✅ Done |
| C4 | JS: click handler on each pill — reads `btn.dataset.quality`, calls `ClassicMode.setGraphicsQuality(q)`, then `syncQualityBtns()` | ✅ Done |
| C5 | Remove old `wd-gfx-btn` from HTML and remove its JS init/handler | ✅ Done |

### Phase D: Load Game prominence

| ID | Task | Status |
|----|------|--------|
| D1 | Move `#wd-load-btn` to first position in Actions grid | ✅ Done |
| D2 | Update button description to "Resume from a .json save file" to match actual file format | ✅ Done |
| D3 | Rename grid section header from "Game Modes" to "Actions" for clarity | ✅ Done |

### Phase E: Layout rework

| ID | Task | Status |
|----|------|--------|
| E1 | New content order: Stats → Play Mode cards → Graphics pills → Theme button → ▶ Play vs AI → Actions grid → Footer | ✅ Done |
| E2 | Add `margin-top: 18px` to hero button so it visually separates from config choices above | ✅ Done |
| E3 | Retain `.wd-pref-btn` for Theme button only; display full-width below quality row | ✅ Done |

### Phase F: Verification (pending)

| ID | Task | Status |
|----|------|--------|
| F1 | Open game on desktop: confirm mode cards show, correct one is highlighted, clicking switches mode | ⬜ Pending |
| F2 | Open game on mobile viewport: confirm quality pills wrap/fit, cards are readable | ⬜ Pending |
| F3 | Select each quality pill, dismiss dashboard, confirm correct quality is active in-game | ⬜ Pending |
| F4 | Click Load Game, select a `.json` save file, confirm game resumes with correct ELO/styles | ⬜ Pending |
| F5 | Confirm no JS errors in browser console when welcome screen initialises | ⬜ Pending |
| F6 | Confirm switching mode on welcome screen then clicking Play starts the game in the selected mode | ⬜ Pending |

---

## 5. Acceptance Criteria

- [ ] **AC1** Welcome screen is the first thing a user sees; no game state is shown until dismissed.
- [ ] **AC2** Two mode cards are visible, the active mode is highlighted, and clicking a card changes the mode immediately (reflected by `.selected` state).
- [ ] **AC3** Six quality pills are visible, the active quality is highlighted, and clicking any pill changes quality directly without cycling.
- [ ] **AC4** Load Game button is in the first/top position of the Actions grid with description mentioning `.json`.
- [ ] **AC5** Play Mode and Graphics are above the Play button — users configure before committing.
- [ ] **AC6** Welcome screen works on mobile (≤500px): pills wrap, cards are readable, no overflow.
- [ ] **AC7** No regressions: Play vs AI, Setup Board, Play Online, How to Play, Theme all still function as before.

---

## 6. Implementation Record

### What changed (2026-03-14)

**`index.html` — CSS additions (before mobile tweaks block):**
- Added `.wd-mode-grid`, `.wd-mode-card`, `.wd-mode-card.selected`, `.wd-mode-icon`, `.wd-mode-name`, `.wd-mode-desc` for mode card UI.
- Added `.wd-quality-row`, `.wd-quality-btn`, `.wd-quality-btn.selected`, `.wd-quality-emoji` for quality pill row.
- Updated mobile `@media (max-width: 500px)` to include `min-width: 44px; font-size: 10px` for quality pills.

**`index.html` — HTML changes in `#welcome-dashboard`:**
- Inserted "Play Mode" section header + `wd-mode-grid` (two mode cards) above the hero button.
- Inserted "Graphics" section header + `#wd-quality-row` (six pills) + full-width theme button below mode cards.
- Moved `wd-play-btn` below the new config sections with `margin-top: 18px`.
- Renamed "Game Modes" section to "Actions"; moved `#wd-load-btn` to first position in grid.
- Removed `wd-classic-btn` and `wd-gfx-btn` pref buttons.

**`src/main-3d.ts` — JS changes:**
- Replaced `wdGfxBtn`/`wdClassicBtn` init block with `syncModeCards()` and `syncQualityBtns()` helper functions.
- Added click handlers for `#wd-mode-3d` and `#wd-mode-classic` mode cards (guard against no-op double-click).
- Added `querySelectorAll` click loop for `#wd-quality-row .wd-quality-btn` pills calling `ClassicMode.setGraphicsQuality(q)`.
- Removed `wdClassicBtn.addEventListener` and `wdGfxBtn.addEventListener` handlers.

---

## 7. References

- [SOW-ANIMATIONS-ALL-MODES.md](./SOW-ANIMATIONS-ALL-MODES.md) — companion SOW for animation fixes.
- `src/classicMode.ts` — `isClassicMode()`, `setClassicMode()`, `setGraphicsQuality()`, `getGraphicsQuality()`, `QUALITY_INFO`, `GraphicsQuality` type.
- `src/saveSystem.ts` — `SaveData` interface, `loadSaveFromFile()`, `validateAndSanitizeSaveData()`.
- `src/main-3d.ts` — `dismissWelcomeDashboard()`, dashboard button handlers (lines ~2369–2464).
- `index.html` — `#welcome-dashboard`, `.wd-*` CSS classes.
