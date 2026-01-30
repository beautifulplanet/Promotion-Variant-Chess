# Code Roadmap: Sideways Chess Side Scroller

## 1. Project Setup
- Vite + TypeScript scaffold
- HTML5 Canvas for board rendering
- Modular file structure in `src/`
- Placeholder graphics for board/pieces

## 2. Core Modules
- `src/board.ts` — Board rendering and logic
- `src/pieces.ts` — Piece definitions and movement
- `src/game.ts` — Game state, ELO, progression
- `src/ai.ts` — AI stub (expandable)
- `src/ui.ts` — Sidebar, stats, rearrangement UI
- `src/assets.ts` — Placeholder asset management
- `src/main.ts` — Entry point, app bootstrap

## 3. Features (MVP)
- Render 2D chessboard (sideways)
- Render pieces (placeholder art)
- Move pieces with chess rules
- Track ELO and stats
- Allow piece rearrangement after each game
- Pawn promotion system (promoted piece starts in future games)
- Basic AI opponent (random or simple logic)

## 4. Expansion Points
- Replace placeholder graphics with custom assets
- Improve AI difficulty scaling
- Add more game modes (practice, puzzles)
- Add animations and effects
- Save/load system for stats and progress

## 5. 3D Renderer Modules (Ribbon World)
- `src/renderer3d.ts` — Three.js 3D renderer with dual camera modes
- `src/worlds.ts` — World environment definitions (Forest, City, Space, Ocean)
- Camera system: Pan mode (orbit) / Play mode (top-down)
- Continuous ribbon motion through world environments
- Parallax layers and world-specific lighting

## 6. Development Notes
- Keep code modular for easy updates
- Use TypeScript interfaces/types for clarity
- Optimize for zero lag and smooth gameplay
- Document all modules for maintainability

---

**Start by scaffolding the project and implementing board/piece rendering with placeholders.**