# Sideways Chess Chronicle – Complete Game Design Document

> **Purpose**: This document captures EVERY rule, feature, UI element, and visual system from Version 1 so we can remake the game properly.

---

## 1. Game Overview

**Working title:** The Chess Chronicle / Sideways Chess Side Scroller 3D

**Core fantasy:**
- You are playing chess inside a living newspaper and a traveling 3D "ribbon world".
- The chessboard is a floating highway sliding through different eras and worlds as your ELO climbs.
- The newspaper layout around the game turns every win/loss into a sarcastic front-page story.

**High-level pillars:**
- **Serious chess, playful framing** – Real chess rules and AI, wrapped in a fun, story-driven UI.
- **ELO road trip** – You start at low rating and travel through increasingly intense eras and environments as your rating grows.
- **Custom lineup & permanent bonuses** – Wins give you bonus pieces and a custom starting formation you can drag into place before each game.

---

## 2. Core Rules & Progression

### 2.1 Chess Rules
- Standard Western chess:
  - 8×8 board, white vs black.
  - Legal moves: check, checkmate, stalemate, castling (king-side/queen-side), en passant, promotion.
- The underlying engine is chess.js style with minimax AI.
- The 3D view and sideways presentation are **visual only**; game logic is classic chess.
- **Auto-queen**: When pawns promote, they automatically become Queens (no selection UI yet).
- Player is **always white**, AI is **always black**.

### 2.2 ELO / Rating System
- Player ELO is tracked persistently (save/load via JSON file).
- You **start at ELO 400** (default).
- After each game:
  - **Win:** ELO goes up (calculated via standard ELO formula with K-factor).
  - **Loss:** ELO goes down.
  - **Draw:** Minor adjustment based on expected outcome.
- ELO drives:
  - **AI difficulty** (deeper search, less randomness).
  - **Era / environment** you are flying through on the ribbon.
  - **AI bonus pieces** at extreme ELO (≥3000).

### 2.3 Level System (19 Named Levels)

ELO maps to 19 discrete levels that control AI difficulty:

| Level | Name | ELO Range | AI Depth | Blunder % |
|-------|------|-----------|----------|-----------|
| 1 | Beginner | 100–299 | 1 | 60% |
| 2 | Novice | 300–499 | 1 | 50% |
| 3 | Apprentice | 500–699 | 1 | 40% |
| 4 | Student | 700–899 | 2 | 35% |
| 5 | Amateur | 900–1099 | 2 | 30% |
| 6 | Club Player | 1100–1299 | 2 | 25% |
| 7 | Tournament | 1300–1499 | 2 | 20% |
| 8 | Expert | 1500–1699 | 3 | 15% |
| 9 | Candidate Master | 1700–1899 | 3 | 10% |
| 10 | Master | 1900–2099 | 3 | 5% |
| 11 | International | 2100–2299 | 3 | 2% |
| 12 | Grandmaster | 2300–2499 | 4 | 1% |
| 13 | Super GM | 2500–2699 | 4 | 0% |
| 14 | World Class | 2700–2999 | 4 | 0% |
| 15 | Legend | 3000–3499 | 5 | 0% |
| 16 | Immortal | 3500–3999 | 5 | 0% |
| 17 | Chess God | 4000–4499 | 5 | 0% |
| 18 | Transcendent | 4500–4999 | 6 | 0% |
| 19 | Beyond | 5000+ | 6 | 0% |

**AI Blunder System**: At lower levels, the AI has a % chance to make a completely random legal move instead of its best move, simulating human mistakes and making early game more forgiving.

### 2.4 Bonus Pieces & Promotions (CUSTOM RULE)

This is a **unique mechanic** that creates permanent progression:

1. **Earning bonus pieces**: Every time you successfully promote a pawn during a game AND WIN that game, the promoted piece is **permanently saved** to your profile.
2. **Losing forfeits pending promotions**: If you lose the game, any promotions you made during that game are NOT saved. You must WIN to keep them.
3. **Using bonus pieces**: Before each new game, you can place your earned bonus pieces in your starting lineup using the Setup panel.
4. **Piece slots**: Bonus pieces replace pawns first (row 2), then back-rank minor/major pieces.
   - Slot order: d2, e2, c2, f2, b2, g2, a2, h2, then b1, g1, c1, f1, a1, h1
   - Up to 14 bonus slots (8 pawns + 6 back rank excluding King/Queen).
5. **Save data tracks**:
   - `promotedPieces[]` – Array of earned pieces with type (Q/R/B/N), the ELO you earned it at, and game number.
   - `totalPromotions{}` – Lifetime count of each piece type promoted.

**Result**: Winning games literally makes future games easier by giving you extra/upgraded pieces. A player with 8 bonus Queens starts with 9 Queens total!

### 2.5 AI Bonus Pieces (Scaling Challenge)

To balance the player's bonus pieces AND provide late-game challenge, the AI also gets bonus pieces:

**ELO-Based AI Bonuses** (kicks in at ELO ≥3000):

| ELO Threshold | AI Material Bonus |
|---------------|-------------------|
| 3000+ | +9 pts (1 Queen) |
| 3200+ | +18 pts (2 Queens) |
| 3500+ | +36 pts (4 Queens) |
| 4000+ | +72 pts (8 Queens) |
| 4500+ | +144 pts (16 Queens) |

**Material Matching Rule**:
- The AI calculates the **total material value** of player's bonus pieces.
- If player has >2 points of bonus material, AI gets matching value to compensate.
- Example: If you have 3 bonus Queens (27 pts), AI gets ~25+ points of extra pieces.
- Material values: Q=9, R=5, B=3, N=3, P=1.
- Maximum combined material value capped at 130 points.

**AI Piece Placement**:
- Bonus pieces replace black pawns first: d7, e7, c7, f7, b7, g7, a7, h7
- Then back-rank pieces: b8, g8, c8, f8, a8, h8
- King (e8) and Queen (d8) squares are NEVER replaced.
- Maximum 14 bonus pieces per side.

**Piece Type Selection**:
- AI fills material value with Queens first (most efficient)
- Then Rooks
- Then random mix of Bishops/Knights
- This creates interesting endgame scenarios at high ELO

### 2.6 Custom Lineup & Setup Phase

**Setup Mode** (triggered by ⚙️ Setup button):
- Full-screen dark overlay appears
- Center panel shows:
  - Title: "⚙️ Game Setup"
  - Message: "Drag pieces to rearrange your starting position. You have X bonus pieces from wins."
  - 2×8 grid representing your back two ranks (rows 7 and 8 in chess notation)
- You can **drag pieces to rearrange** your starting position.
- Piece arrangement is stored in `currentArrangement[]`.

**Setup Controls**:
- **↩️ Reset Default** – Restore standard chess starting position.
- **✅ Start Game** – Lock in the lineup and begin the match.
- **❌ Cancel** – Exit without applying changes.

**Castling Impact**: If you rearrange pieces such that rooks are moved from a1/h1 or replaced by bonus pieces, castling rights are automatically disabled for that side.

### 2.7 Save System (File-Based)

- **No auto-save / localStorage** – Player explicitly saves and loads via buttons.
- **💾 Save** – Downloads a JSON file named `sideways-chess-save-elo{X}-{timestamp}.json`.
- **📂 Load** – Opens file picker to load a previously saved JSON.

**Save file structure**:
```json
{
  "elo": 1200,
  "gamesWon": 45,
  "gamesLost": 32,
  "gamesPlayed": 77,
  "highestElo": 1450,
  "currentWinStreak": 3,
  "bestWinStreak": 8,
  "promotedPieces": [
    { "type": "Q", "earnedAtElo": 800, "gameNumber": 12 },
    { "type": "R", "earnedAtElo": 1100, "gameNumber": 34 }
  ],
  "totalPromotions": { "Q": 5, "R": 2, "B": 1, "N": 0 },
  "saveVersion": 1,
  "savedAt": "2026-01-27T..."
}
```

---

## 3. Game Loop

1. **Launch game** – Newspaper layout loads, 3D ribbon world initializes, board spawns at current ELO's era.
2. **(Optional) Setup phase** – Player clicks ⚙️ Setup to customize starting lineup using bonus pieces.
3. **Play chess match**:
   - Player (white) moves first.
   - Click piece to select, click destination to move.
   - Legal moves are highlighted.
   - AI thinks after player moves (with "thinking" indicator).
   - Camera can be in **Pan** (3D orbit) or **Play** (more top-down) mode.
4. **End of game**:
   - Engine detects checkmate, stalemate, or draw.
   - ELO is adjusted based on result.
   - **If WIN**: Any promotions made during game are permanently saved.
   - **If LOSS**: Promotions are discarded.
   - Newspaper stories update to reflect the outcome.
5. **Progression**:
   - New ELO may trigger **era change** in the ribbon world.
   - New level may trigger level-up notification.
   - Difficulty ramps up.
   - Player can go again with upgraded lineup options.

---

## 4. Visual & UI Design

### 4.1 Newspaper Shell (2D UI)

**Header:**
- Title: **"The Chess Chronicle"** (Playfair Display font, 42px, uppercase, letter-spacing 6px)
- Tagline: **"All the Moves That's Fit to Print"** (italic, 18px)
- Dynamic date line showing today's date (e.g., "Monday, January 27, 2026")

**Overall layout:**
- Background: Warm off-white (#faf6ed) with subtle line texture patterns
- Three-column structure:
  - **Left column** (240px) – Stack of 3 story boxes with headline + snippet
  - **Center column** (flex) – Game canvas on top, bottom menu bar beneath
  - **Right column** (240px) – Another stack of 3 story boxes
- Columns separated by 2px solid borders (#c0b090)

**Article Cards:**
- Each article has:
  - Headline: Playfair Display, 18px, bold
  - Snippet: Old Standard TT, 15px, regular
- 6 total articles (3 left, 3 right)
- On win/loss, articles populate with humorous newspaper stories

**Responsive behavior:**
- On screens < 1400px width, side article columns are hidden
- Game stays centered

### 4.2 Center Game Area

**Canvas wrapper:**
- 3px solid black border
- Black background behind canvas
- Contains WebGL canvas at 1150×650 pixels

**3D chess scene** (inside canvas):
- Three.js scene with:
  - Highly detailed Staunton-inspired 3D pieces
  - Physically-based board and frame
  - Dynamic lighting and shadows
  - Procedural skybox and ribbon environment
- Camera modes:
  - **Pan (🎥 Pan button)** – Orbit camera around the board to appreciate environments
  - **Play** – More functional overhead view for competitive play

### 4.3 Bottom Stats & Controls Bar

Sits directly under the canvas, styled as a clean info bar with newspaper aesthetic:

**Layout:** Horizontal flexbox with gaps, centered, wrapped

**World Name Display:**
- Shows current era name (e.g., "Jurassic", "Medieval", "Neon City")
- Dark background (#2a2a2a), light text (#faf6ed)
- Playfair Display, 14px, uppercase

**Stats Groups** (separated by vertical borders):

1. **Turn** – Shows "White" or "Black"
2. **Rating** – Current ELO (large, 22px bold)
3. **Level** – Current level number
4. **Record** – W: X / L: Y format

**Control Buttons** (dark buttons with hover effect):
- **⚙️ Setup** – Opens setup overlay for lineup customization
- **🎥 Pan** – Toggles view mode between Pan and Play
- **♟️ Style** – Cycles or opens menu for piece styles
- **🏁 Board** – Changes board style/theme
- **💾 Save** – Saves current profile to JSON file
- **📂 Load** – Loads saved profile from JSON file

**FPS Display:**
- Small italic text: "FPS: XX"
- Updates every second

### 4.4 Setup Overlay

**Overlay container:**
- Position: fixed, full screen
- Background: rgba(0, 0, 0, 0.85)
- z-index: 2000

**Setup Panel:**
- Background: #faf6ed (newspaper color)
- Border: 3px solid #2a2a2a
- Border-radius: 10px
- Padding: 25px 35px
- Max-width: 600px, centered

**Panel contents:**
- Title: "⚙️ Game Setup" (Playfair Display, 28px)
- Info text: "Drag pieces to rearrange your starting position. You have X bonus pieces from wins."
- Grid: 8×2 squares (50px each) representing back two ranks
- Squares alternate light (#f0d9b5) / dark (#b58863)
- Selected squares get blue outline
- Drop targets highlight green

**Buttons:**
- **↩️ Reset Default** – dark gray
- **✅ Start Game** – green (#2a6a2a)
- **❌ Cancel** – dark gray

### 4.5 Level / Era Notification

- Position: fixed top center
- Slides down with animation when triggered
- Used for level-up messages and era transitions
- Auto-dismisses after a few seconds

### 4.6 Debug Menu

**Location:** Fixed bottom-right corner, z-index 2500

**Visibility:** Hidden by default, toggle with Shift+D or backtick key

**Contents:**

Buttons:
- **🏆 Win** – Force a win (testing)
- **Jump ELO** – Input field (0-5000) + button to set ELO directly

Checkboxes (feature toggles):
- Environment – Show/hide 3D world assets
- Particles – Enable/disable particle systems
- Skybox – Toggle procedural sky
- Lighting – Toggle dynamic lights
- Shadows – Toggle shadow rendering
- Env Anim – Environment animation on/off
- Wormhole – Special transition effects
- Reduced Motion – Scale down motion speed
- Auto FPS – Adaptive render scale

Sliders:
- Target FPS (30-120, default 60)
- Fixed FPS (30-120, default 60)
- Anim Quality (1-6, higher = less frequent updates)
- Travel Speed (0.5-2.5, default 1.6)
- Asset Density (0.2-1.2, default 1.0)
- Particle Density (0-1.5, default 1.0)
- Render Scale (0.5-1.5, default 0.75)

---

## 5. Ribbon World & Era System (3D Background)

### 5.1 Concept

- The chessboard sits on a long, glowing "ribbon" or platform
- The ribbon moves continuously along the Z-axis (like an endless highway)
- Environments and assets spawn along this path based on current ELO
- Creates feeling of traveling through different worlds/time periods

### 5.2 The 20 Eras

Eras are mapped to ELO ranges:

| Era # | Name | ELO Range | Time Period | Visual Theme |
|-------|------|-----------|-------------|--------------|
| 1 | Jurassic | 0-450 | 150M years ago | Prehistoric jungle, ferns, mist |
| 2 | Cretaceous | 451-600 | 65M years ago | Volcanic, meteor sky |
| 3 | Ice Age | 601-750 | 20K years ago | Glaciers, mammoths |
| 4 | Ancient Egypt | 751-900 | 3000 BCE | Pyramids, sand, sun |
| 5 | Classical Greece | 901-1050 | 500 BCE | Columns, temples |
| 6 | Roman Empire | 1051-1200 | 100 CE | Colosseum, aqueducts |
| 7 | Medieval | 1201-1400 | 1200 CE | Castles, forests |
| 8 | Renaissance | 1401-1600 | 1500 CE | Art, cathedrals |
| 9 | Industrial | 1601-1800 | 1850 CE | Factories, steam |
| 10 | Art Deco | 1801-2000 | 1920 CE | Skyscrapers, jazz |
| 11 | Atomic Age | 2001-2200 | 1960 CE | Rockets, chrome |
| 12 | Digital Dawn | 2201-2400 | 2000 CE | Early computers |
| 13 | Neon City | 2401-2600 | 2050 CE | Cyberpunk |
| 14 | Orbital | 2601-2800 | 2150 CE | Space stations |
| 15 | Stellar | 2801-3000 | 2500 CE | Interstellar |
| 16 | Galactic | 3001-3300 | Type 1 | Dyson spheres |
| 17 | Intergalactic | 3301-3600 | Type 2 | Galaxy travel |
| 18 | Cosmic | 3601-4000 | Type 2.5 | Universe scale |
| 19 | Transcendent | 4001-4500 | Type 3 | Reality warping |
| 20 | Beyond | 4501+ | Beyond | Abstract infinite |

Each era has:
- Unique sky colors (top, mid, bottom, horizon glow)
- Era-specific fog color and density
- Custom sun color and angle
- Ambient lighting colors
- Primary assets (big landmarks)
- Secondary assets (small props)
- Particle type and color (leaves, snow, sparks, data, energy, etc.)
- Ribbon scroll speed

### 5.3 Procedural Environment

- Spawns limited number of assets along the ribbon:
  - ~12 primary assets (big landmarks)
  - ~15 secondary assets (small props)
  - ~1200 particles max
- Assets positioned with:
  - Minimum 12 unit distance from board center
  - Random X/Z spread for variety
  - Era-appropriate placement rules

### 5.4 Dynamic Lighting & Skybox

**ProceduralSkybox** shader:
- Gradient sky from zenith to horizon to ground
- Sun glow effect
- Stars (density varies by era)
- Nebula effects (space eras)
- Aurora effects (certain eras)

**DynamicLighting** system:
- Main directional sun light
- Rim lights for highlights
- Hemisphere ambient light
- Optional accent point lights
- All colors/intensities tuned per era

### 5.5 Camera & Motion

- Scroll motion: `ribbonSpeed` varies by era (faster at higher ELO)
- `travelSpeedScale`: Global multiplier (default 1.6)
- **Reduced Motion** option via debug toggle

**Camera Modes:**
- **Pan** – Orbit camera with mouse drag, scroll wheel zoom
- **Play** – Fixed overhead/angled view for gameplay focus

---

## 6. Chess Piece & Board Styles

### 6.1 Piece Styles (Planned)

| Style | Type | Description |
|-------|------|-------------|
| Staunton3D | 3D | Classic realistic tournament pieces |
| Lewis3D | 3D | Historic Lewis chessmen style |
| Modern3D | 3D | Minimalist contemporary |
| Fantasy3D | 3D | Glowing magical pieces |
| Marble3D | 3D | Stone texture |
| Wooden3D | 3D | Wood grain texture |
| Neon3D | 3D | Glowing outlines |
| Staunton2D | 2D | Flat Staunton silhouettes |
| Lewis2D | 2D | Flat Lewis style |
| Modern2D | 2D | Flat minimalist |
| Fantasy2D | 2D | Stylized hand-drawn |
| Newspaper2D | 2D | Unicode chess symbols (♔♕♖♗♘♙) |

### 6.2 Board Styles

| Style | Theme |
|-------|-------|
| Classic | Traditional wood tones |
| Tournament | Green/cream official look |
| Marble | White/gray marble |
| Walnut | Rich walnut wood |
| Ebony | Dark ebony/light maple |
| Stone | Ancient stone texture |
| Crystal | Transparent glass effect |
| Neon | Glowing grid lines |
| Newspaper | Sepia newsprint |
| Ocean | Blue/teal underwater |
| Forest | Green/brown natural |
| Royal | Purple/gold luxury |

Each board style controls:
- Light/dark square colors
- Roughness/metalness values
- Optional emissive glow
- Optional transparency
- Frame/border colors

---

## 7. Newspaper Article System

### 7.1 Win Stories (Celebratory/Sarcastic)

Example headlines:
- "LOCAL GENIUS DEFEATS MACHINE, DEMANDS PARADE"
- "OPPONENT RAGE-QUITS; CALLS IT 'TACTICAL RESIGNATION'"
- "BRILLIANT MOVE DISCOVERED TO BE COMPLETE ACCIDENT"
- "CHECKMATE DELIVERED WITH UNNECESSARY FLOURISH"
- "VICTORY LAP AROUND LIVING ROOM REPORTED"
- "PAWN PROMOTED TO QUEEN, IMMEDIATELY REQUESTS CORNER OFFICE"

### 7.2 Lose Stories (Self-Deprecating)

Example headlines:
- "I WAS WINNING UNTIL I WASN'T"
- "COMPUTER CHEATING SUSPECTED BY LOSER"
- "MOUSE SLIP BLAMED FOR 47TH CONSECUTIVE LOSS"
- "I COULD HAVE WON IF I PLAYED DIFFERENTLY"
- "PLAYER DISCOVERS CHESS IS ACTUALLY HARD"
- "PAWN'S LINKEDIN SHOWS 'QUEEN' AS CURRENT POSITION"

### 7.3 General/Filler Stories

Mix of chess-related humor and world-building for background articles.

---

## 8. Performance Retrospective (Why Version 1 Is Laggy)

### 8.1 Overly High Geometry Complexity

**Problem:**
- Chess pieces built with 48-segment LatheGeometry
- Extra meshes: torus rings, cones, spheres, decorative elements
- Each piece is a Group containing 5-15 separate meshes
- 32 pieces × 10 meshes = 320+ draw calls just for pieces

**Lesson for remake:**
- Use low-poly shapes (16-24 segments max)
- Share/instance geometries across pieces of same type
- Use textures/normal maps for detail, not polygons

### 8.2 Heavy PBR Materials

**Problem:**
- Board squares used MeshPhysicalMaterial with clearcoat
- 64 squares each with unique material instance
- Real-time environment map sampling on every surface

**Lesson for remake:**
- Default to MeshStandardMaterial
- Reserve physical materials for 1-2 hero objects only
- Reuse materials across similar objects

### 8.3 Shadows + Many Lights

**Problem:**
- Multiple directional and point lights
- Soft PCF shadow filtering (expensive)
- Many objects set to cast AND receive shadows

**Lesson for remake:**
- Maximum 1-2 shadow-casting lights
- Use BasicShadowMap or disable shadows on low-end
- Only hero objects should cast shadows

### 8.4 Too Many Environment Assets

**Problem:**
- Initial caps too high (18 primary, 22 secondary assets)
- Particle counts in thousands
- Many assets off-screen but still rendering

**Lesson for remake:**
- Hard cap: ~10-12 big assets, ~500-800 particles
- Implement LOD for distant objects
- Aggressive frustum culling

### 8.5 High Resolution Rendering

**Problem:**
- Canvas at 1150×650 at full device pixel ratio
- High-DPI screens = 4+ million pixels per frame
- Combined with heavy shaders = GPU overload

**Lesson for remake:**
- Default render scale at 0.75
- Dynamic resolution scaling based on FPS
- Provide quality presets

### 8.6 Per-Frame Animation Cost

**Problem:**
- Environment, skybox, lighting, particles ALL update every frame
- Systems running even when not visible
- Frequent environment regeneration

**Lesson for remake:**
- Throttle updates (every 2nd/3rd frame)
- Skip updates when systems are hidden
- Update in-place rather than regenerating

### 8.7 CPU-Side Inefficiencies

**Problem:**
- Rebuilding all pieces on minor changes
- String operations in evaluation loops
- New allocations (arrays, vectors) every frame

**Lesson for remake:**
- Cache geometries, materials, temp objects
- Only rebuild what actually changed
- Pre-allocate and reuse objects

---

## 9. Guidelines for the Remake

### 9.1 Must Preserve (Core Identity)

- ✅ **Newspaper wrapper** with sarcastic headlines
- ✅ **ELO-driven journey** through different eras
- ✅ **Custom lineup / bonus pieces** system (THE unique mechanic)
- ✅ **Pan vs Play** camera modes
- ✅ **Traveling ribbon world** feeling
- ✅ **19-level progression** with names
- ✅ **AI bonus pieces** at high ELO for scaling challenge
- ✅ **File-based save system** (explicit save/load)

### 9.2 Must Change (Technical Approach)

**Rendering:**
- Low-poly stylized art instead of hyper-detailed realism
- Instanced geometry per piece type
- 1-2 main light sources with simple shading
- Environment as background art, not simulation

**Performance:**
- Hard budget: 60 FPS on mid-range laptop
- Triangle/draw-call limits defined upfront
- Debug menu from day one to measure performance

**Architecture:**
- Chess engine and UI completely separate from 3D eye candy
- Easy to disable all 3D for pure 2D mode
- Modular systems that can be toggled independently

---

## 10. File Reference (Version 1 Structure)

Key source files for reference:
- `src/gameController.ts` – Core game logic, bonus pieces, setup
- `src/chessEngine.ts` – Chess rules and AI
- `src/levelSystem.ts` – 19 levels and AI difficulty
- `src/saveSystem.ts` – Save/load structure
- `src/eraSystem.ts` – 20 eras configuration
- `src/eraWorlds.ts` – Environment generation
- `src/renderer3d.ts` – Three.js rendering
- `src/dynamicLighting.ts` – Lighting system
- `src/proceduralSkybox.ts` – Sky rendering
- `src/newspaperArticles.ts` – Article content
- `src/pieceStyles.ts` – Piece style configs
- `src/boardStyles.ts` – Board style configs
- `index.html` – All UI structure and styling

---

*Document created: January 27, 2026*
*Purpose: Complete reference for game remake*
