# Sideways Chess Side Scroller - Game Plan

## 1. Core Concept
- Chess-inspired side-scrolling game.
- Player starts at ELO 100, faces increasingly difficult AI up to 4000+.
- Each battle is a chess puzzle/mini-game on a horizontal board.
- No timers; focus on strategy and progression.

## 2. Gameplay Loop
- Player starts with basic chess pieces.
- Win: gain ELO, face tougher AI.
- Lose: lose ELO or retry.
- Pawn promotion: promoted piece can start in place of a pawn in future games.
- Rearrangement: player can rearrange lineup after each game.

## 3. Board & Movement
- Flat, horizontal 2D chessboard (Canvas/SVG/HTML grid).
- Standard chess movement rules, side-scroller visual.
- Each turn is a move, animated as a side-scroller action.

## 4. Progression & Difficulty
- ELO system: 100 to 4000+.
- AI difficulty scales with ELO.
- Odds get worse as ELO increases (AI gets more pieces, better positions, etc).

## 5. Promotion & Rewards
- Pawn promotion lets player start with that piece in future games.
- Custom/rearrange lineup after each game.

## 6. Statistics & UI
- Sidebar: total games, wins/losses, current/highest ELO, most promoted piece, win streaks.
- Detailed stats/history view.

## 7. Game Modes
- Main progression (ELO climb)
- Practice (no ELO change)
- Puzzle (special challenges)

## 8. Visuals & UX
- Flat 2D art (SVG/PNG placeholders for now).
- Smooth piece movement, simple effects.
- Minimal, readable UI.

## 9. Technical Notes
- Use TypeScript for modularity and maintainability.
- Rendering: HTML5 Canvas or SVG.
- Chess logic: chess.js or similar library.
- Save system for ELO, stats, promoted pieces.

## 10. Stretch Goals
- Unlockable themes/boards/pieces
- Online leaderboards
- Achievements/badges

## 11. Ribbon World Visual System 🌌

### Concept: Cosmic Highway
The chess board exists as a floating "ribbon" traveling through time and space - a highway that passes through different worlds depending on player level. Future potential: circling the center of the galaxy itself.

### Two Camera Modes
1. **Pan Mode (3D)**: Free camera to explore the epic 3D environment
   - Mouse drag to orbit camera
   - Scroll to zoom
   - See the ribbon floating through spectacular worlds
   - Can still play chess in this mode

2. **Play Mode (2D)**: Focused top-down view
   - Clean, minimal distractions
   - Classic chess board perspective
   - For serious concentration

### Four World Environments (Phase 1)
| World | Theme | Elements |
|-------|-------|----------|
| **Forest** | Ancient nature | Giant trees, floating leaves, sunlight rays |
| **City** | Cyberpunk | Neon buildings, flying vehicles, holograms |
| **Space** | Cosmic | Stars, nebulae, planets, asteroids |
| **Ocean** | Underwater | Coral reefs, fish schools, light rays |

### Ribbon Motion
- Continuous forward movement like a highway
- Smooth transitions between worlds
- Parallax layers for depth (near/far objects)
- Environment-specific lighting and atmosphere

---

**Next Steps:**
- Set up TypeScript project in `version 1` folder.
- Implement board rendering with placeholder graphics.
- Implement basic chess logic and ELO system.
- Modularize code for easy asset swapping.
