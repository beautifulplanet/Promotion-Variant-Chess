# Changelog

All notable changes to Chess Wars Chronicle.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

---

## [Unreleased]

### Added
- Welcome dashboard — newspaper-themed landing screen with game mode buttons, preferences, stats ribbon
- docs/SCOPE.md — MVP definition, non-goals, invariants, performance floors
- docs/REQUIREMENTS.md — MUST/SHOULD/MAY requirements (UX, functional, security, performance)
- docs/ACCEPTANCE_TESTS.md — requirements → verification mapping with exact commands
- docs/DEFINITION_OF_DONE.md — fast checklist for every change
- docs/RELEASE_CHECKLIST.md — pre-deploy verification steps
- CHANGELOG.md (this file)
- `.github/ISSUE_TEMPLATE/change.md` — scope/acceptance/edge-case/rollback template

### Changed
- README.md — major upgrade: impact block, evidence table, security posture, performance numbers, system invariants, interview drill sheet, audience-based navigation
- E2E test helpers now dismiss welcome dashboard before game interactions

---

## [0.1.0] — 2026-02-21

### Added
- Explore mode — view 3D era scenery from Classic Mode
- Classic Mode scrollable articles below board
- Welcome dashboard (initial wiring)

### Fixed
- Explore mode Back button moved to body root for visibility
- Classic mode board sizing and overlay hidden correctly
- SAN notation fix in move list
- Square board sizing with no grey gaps

---

## [0.0.9] — 2026-02-20

### Added
- Classic Mode overhaul — proper chess.com-style dark UI
- Flat orthographic board for Classic Mode
- Player bars with captured pieces and move list
- 8 color themes + 3 GFX quality presets (Low/Med/High)

### Changed
- Simplified move quality display
- Updated all 5 docs (E2E count, line counts, file map)

### Fixed
- Opening book FEN normalization
- Board toast overlay positioning

---

## [0.0.8] — 2026-02-19

### Added
- Automated playtest agent (13 Playwright tests: gameplay, visual correctness, stress)
- TESTING.md documenting bugs found and test architecture

### Fixed
- Stability hardening: click debounce (100ms), input lock, RAF coalescing
- WebGL context loss: replaced `alert()` with non-blocking toast
- Three.js memory leak: dispose geometry + materials on piece removal
- Flip board glitch: made `toggleBoardFlip()` synchronous

---

## [0.0.7] — 2026-02-18

### Added
- PGN export with clipboard copy and file download
- Screen shake effect on piece captures
- Check/checkmate visual flair (pulsing red king square)
- Piece style preview toast when cycling 2D styles
- Keyboard shortcuts overlay (? key)

### Changed
- Slowed down piece animations for more satisfying feel
- Replaced broken pharaoh2d with Lichess SVG piece set
- Shrunk move history panel 40%, reflow articles on narrow screens

### Fixed
- Context-aware camera: right-click/two-finger orbits
- Mobile button overflow, MP cancel, CSP localhost
- Server keepalive, duplicate undo-btn, infinite retries
- Draw modal theming, status refactor, tutorial button

---

## [0.0.6] — 2026-02-17

### Added
- 3 new 2D piece styles: Art Deco, Steampunk, Tribal
- L-system procedural trees (cypress, garden, oak presets)
- Lorenz attractor particle system for Digital era
- Guest play buttons for instant multiplayer without account
- Android Coming Soon badge
