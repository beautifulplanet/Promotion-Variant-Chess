# SOW: Full Board Position Editor (Analysis & Puzzle Mode)

**Author:** AI Agent  
**Date:** 2026-03-16  
**Status:** SCOPING  
**Priority:** Feature Request  

---

## Problem Statement

Players currently cannot set up arbitrary board positions. The existing "Setup Board"
feature is a **deployment tool** — it only lets the player rearrange their own starting
pieces within their 3 home rows before a game. There is no way to:

- Place any piece on any square (full 8x8 editor)
- Load a position from a FEN string (standard chess notation)
- Practice puzzles from books or websites
- Analyze a specific position against the AI
- Share positions with other players

This limits the game to "play from start" only, excluding the huge audience of players
who follow chess books, study tactics puzzles, or want to replay interesting positions.

---

## What Exists Today

| Capability | Status | Location |
|---|---|---|
| Rearrange own pieces in 3 home rows | Working | `main-3d.ts` `openSetupMode()` |
| Save/load board profiles | Working | Setup overlay, localStorage |
| FEN export (debug) | Partial | `chessEngine.ts` `getFEN()` |
| FEN import (multiplayer) | Working | `gameController.ts` `startMultiplayerGame(fen)` |
| FEN import (save restore) | Working | `gameController.ts` `loadGame()` |
| `engine.loadFEN(fen)` | Working | `chessEngine.ts` line 323 |
| Full board editor UI | **Missing** | — |
| Side-to-move selector | **Missing** | — |
| Castling rights editor | **Missing** | — |
| Play-from-position mode | **Missing** | — |

**Key insight:** The engine already supports `loadFEN()` and `getFEN()`. The backend
plumbing exists. What's missing is the **UI** to let the user build a position and a
**game mode** that starts from an arbitrary FEN.

---

## Scope Breakdown

### Phase A: Full Board Editor UI

**Goal:** 8x8 clickable board where user can place/remove any piece on any square.

| Task | Detail |
|---|---|
| A1 | New overlay or tab in existing setup panel: "Position Editor" |
| A2 | 8x8 grid, all 64 squares interactive |
| A3 | Piece palette sidebar: W/B x K/Q/R/B/N/P (12 buttons) |
| A4 | Click palette piece, then click square to place |
| A5 | Click occupied square to remove piece |
| A6 | Drag-and-drop (stretch goal, not required for v1) |
| A7 | "Clear Board" button — empties all squares |
| A8 | "Starting Position" button — loads standard setup |
| A9 | Visual: piece palette highlights selected piece |

**Constraints:**
- Must enforce exactly 1 white king and 1 black king (warn if missing)
- Pawns cannot be on rank 1 or rank 8 (standard FEN rule)

### Phase B: FEN Input/Output

**Goal:** User can paste a FEN string to load a position, or copy the current position as FEN.

| Task | Detail |
|---|---|
| B1 | Text input field for FEN string with "Load" button |
| B2 | "Copy FEN" button that copies current editor position to clipboard |
| B3 | FEN validation with clear error messages ("Invalid FEN: missing king") |
| B4 | Parse FEN to populate editor board |
| B5 | Generate FEN from editor board state |

**Existing code to reuse:**
- `chessEngine.ts` `loadFEN()` — already validates and loads
- `chessEngine.ts` `getFEN()` — already exports

### Phase C: Side-to-Move & Castling Rights

**Goal:** User controls whose turn it is and which castling rights are available.

| Task | Detail |
|---|---|
| C1 | Toggle: "White to move" / "Black to move" |
| C2 | Checkboxes: O-O and O-O-O for each side (4 checkboxes) |
| C3 | Auto-detect castling rights from piece positions (if king/rook moved from starting squares, uncheck) |
| C4 | These feed into the FEN string generation |

### Phase D: Play From Position

**Goal:** Start a game against AI from the editor's position.

| Task | Detail |
|---|---|
| D1 | "Play as White" / "Play as Black" buttons in editor |
| D2 | On click: load FEN into engine, dismiss editor, start game |
| D3 | AI responds to the position as if mid-game |
| D4 | ELO changes should be disabled or reduced for custom positions (prevents gaming the system) |
| D5 | Clear indicator in UI that this is an "Analysis Game" (not ranked) |

**Integration points:**
- `Game.loadFEN()` or similar — need to expose a public function
- `Game.startGame()` — needs to support arbitrary start position
- Renderer sync — `syncRendererState()` already handles this

### Phase E: Puzzle Mode (Stretch Goal)

**Goal:** Structured puzzle experience with success/failure feedback.

| Task | Detail |
|---|---|
| E1 | Define puzzle format: `{ fen, solutionMoves: string[], hint?: string }` |
| E2 | Bundle 50-100 starter puzzles (mate-in-1, mate-in-2, forks, pins) |
| E3 | Puzzle UI: show position, player tries to find the right move(s) |
| E4 | Success: confetti/animation + "Correct!" |
| E5 | Failure: "Try again" with optional hint |
| E6 | Puzzle browser: list of puzzles sorted by difficulty |
| E7 | Track solved/unsolved in localStorage |

**Note:** This is a significant standalone feature. Can be deferred to a later SOW.

### Phase F: Verification

| Task | Detail |
|---|---|
| F1 | Load standard starting position FEN — board matches |
| F2 | Load complex mid-game FEN — all pieces correct |
| F3 | Copy FEN, paste into lichess.org — positions match |
| F4 | Play from custom position — AI responds correctly |
| F5 | Works in Chronicle mode (3D) |
| F6 | Works in Classic mode (2D) |
| F7 | Works on mobile (touch interactions) |
| F8 | No ELO manipulation from custom positions |
| F9 | Invalid FEN shows clear error, doesn't crash |

---

## Acceptance Criteria

- [ ] Player can place any piece on any square of an 8x8 board
- [ ] Player can paste a FEN and see the position rendered
- [ ] Player can copy current position as FEN to clipboard
- [ ] Player can choose side to move and castling rights
- [ ] Player can start a game vs AI from any legal position
- [ ] Custom-position games are clearly marked as unranked
- [ ] Works in all modes (Chronicle, Classic, mobile)
- [ ] No regression to existing setup/deployment feature

---

## Recommended Implementation Order

```
Phase A (UI)  →  Phase B (FEN)  →  Phase C (Castling)  →  Phase D (Play)
                                                              ↓
                                                        Phase F (Verify)
                                                              ↓
                                                        Phase E (Puzzles) — separate SOW
```

Phases A-D are one feature. Phase E (Puzzles) is large enough to warrant its own SOW
once the position editor is working.

---

## Risk Notes

- **Engine compatibility:** `chess.js` (used via `chessEngine.ts`) already supports
  `load(fen)` natively. Low risk.
- **Rust/WASM engine:** The Rust engine also supports FEN. If active, it needs the
  same FEN fed to it. Check `rustGameState.ts` and `rustEngine.ts`.
- **Save system:** Custom positions shouldn't corrupt the save file. The save system
  already stores FEN when a game is in progress, so this should work naturally.
- **Multiplayer:** Position editor is single-player only (analysis). Multiplayer
  custom positions are a separate concern.
