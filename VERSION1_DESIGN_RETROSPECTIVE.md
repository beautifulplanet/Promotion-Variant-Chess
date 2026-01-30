# Sideways Chess Chronicle – Version 1 Design & Retrospective

## 1. Game Overview

**Working title:** The Chess Chronicle / Sideways Chess Side Scroller 3D

**Core fantasy:**
- You are playing chess inside a living newspaper and a traveling 3D "ribbon world".
- The chessboard is a floating highway sliding through different eras and worlds as your ELO climbs.
- The newspaper layout around the game turns every win/loss into a sarcastic front-page story.

**High–level pillars:**
- **Serious chess, playful framing** – Real chess rules and AI, wrapped in a fun, story-driven UI.
- **ELO road trip** – You start at low rating and travel through increasingly intense eras and environments as your rating grows.
- **Custom lineup & permanent bonuses** – Wins give you bonus pieces and a custom starting formation you can drag into place before each game.

---

## 2. Core Rules & Progression

### 2.1 Chess Rules
- Standard Western chess:
  - 8×8 board, white vs black.
  - Legal moves and rules are enforced: check, checkmate, stalemate, legal castling, en passant, promotion.
- The underlying engine is a proper chess rules engine (chess.js style).
- The 3D view and sideways presentation are **visual only**; game logic is classic chess.

### 2.2 ELO / Rating System
- Player ELO is tracked persistently.
- You **start at low ELO** (original plan: 100; current UI shows default 400 in sidebar).
- After each game:
  - **Win:** ELO goes up.
  - **Loss:** ELO goes down (or at least, you don’t progress and can fall back).
- ELO drives:
  - **AI difficulty** (deeper search, stronger evaluation, better openings).
  - **Era / environment** you are flying through on the ribbon.
  - **Article tone** in the newspaper stories.

### 2.3 Bonus Pieces & Promotions
- When pawns promote in past games, those promotions are tracked as **bonus pieces**.
- Before a new game, you get a **setup phase** where bonus pieces from wins can be slotted into your starting lineup.
- The setup overlay displays:
  - 
    - Message: "Drag pieces to rearrange your starting position. You have X bonus pieces from wins."
  - A 2×8 mini-board for your back ranks.
  - Squares are clickable/drag targets; you can rearrange pieces and place bonus ones.

### 2.4 Custom Lineup & Setup Phase
- Triggered by **Setup** (⚙️ button) or automatically before a game.
- UI:
  - Semi-transparent dark overlay over the whole screen.
  - Center panel with title **"⚙️ Game Setup"** and instructions.
  - A compact 2-row 8-column grid representing your back-rank area.
  - Squares are colored light/dark and highlight on selection and valid drop.
- Controls:
  - **Reset Default (↩️)** – restore standard chess starting position.
  - **Start Game (✅)** – lock in the lineup and begin.
  - **Cancel (❌)** – exit setup without applying changes.
- Functionally:
  - You can drag pieces around within the allowed rows.
  - Bonus pieces can be swapped into the lineup if you have any.

---

## 3. Game Loop

1. **Launch game** – Newspaper layout loads, 3D ribbon world initializes, board spawns.
2. **(Optional) Setup phase** – Player customizes starting lineup using bonus pieces.
3. **Play chess match**:
   - Standard turn-based chess.
   - Camera can be in **Pan** (3D orbit) or **Play** (more top-down) mode.
4. **End of game**:
   - Engine detects win/loss/draw.
   - ELO is adjusted.
   - Bonus pieces are granted on certain conditions (e.g., successful promotions).
   - Newspaper stories update to reflect the outcome.
5. **Progression**:
   - New ELO may trigger **era change** in the ribbon world.
   - Difficulty ramps up.
   - Player goes back to step 2 (with upgraded lineup options from past wins).

---

## 4. Visual & UI Design

### 4.1 Newspaper Shell (2D UI)

**Header:**
- Title: **"The Chess Chronicle"**.
- Tagline: **"All the Moves That's Fit to Print"**.
- Dynamic date line showing today’s date in full newspaper style.

**Overall layout:**
- Background is a warm, slightly textured off-white paper with subtle vertical and horizontal line patterns (printed paper feel).
- Three-column structure:
  - **Left column** – Stack of 3 story boxes with headline + snippet.
  - **Center column** – Game canvas on top, bottom menu bar beneath.
  - **Right column** – Another stack of 3 story boxes.
- On smaller screens (< 1400px), side article columns are hidden to keep focus on the game.

**Story cards:**
- Each article has:
  - Headline element (`article-X-headline`).
  - Snippet/body (`article-X-snippet`).
- Headlines are bold serif, short and punchy; snippets are smaller body text.
- On win/loss, these are filled with humorous or self-deprecating "news stories" like:
  - "LOCAL GENIUS DEFEATS MACHINE, DEMANDS PARADE"
  - "MOUSE SLIP BLAMED FOR 47TH CONSECUTIVE LOSS"

This system gives every game result a **diegetic, in-world story**.

### 4.2 Center Game Area

**Canvas wrapper:**
- Thick black border, treated like a framed photograph on the newspaper.
- Inside is the WebGL canvas:
  - ID: `game-canvas`.
  - Resolution: 1150×650.

**3D chess scene:**
- Three.js scene with:
  - Highly detailed Staunton-inspired 3D pieces.
  - Physically-based board and frame.
  - Dynamic lighting and shadows.
  - Procedural skybox and ribbon environment.
- Camera modes:
  - **Pan (🎥 Pan button)** – orbit camera around the board to appreciate environments.
  - **Play** – more functional view for competitive play.

### 4.3 Bottom Stats & Controls Bar

Sits directly under the canvas, styled as a clean info bar:

**World name:**
- Label: `world-name` – shows current era/world name (e.g., Forest, City, Space, Ocean, or later many more eras).

**Stats groups:**
- **Turn** – text like "White" / "Black".
- **Rating** – current ELO.
- **Level** – abstract level number based on ELO bands.
- **Record** – W / L counters (`games-won`, `games-lost`).

**Control buttons (left to right):**
- **⚙️ Setup** – Opens setup overlay for lineup customization.
- **🎥 Pan** – Toggles view mode between Pan and Play.
- **♟️ Style** – Cycles or opens menu for piece styles (3D Staunton, fantasy, 2D newspaper, etc.).
- **🏁 Board** – Changes board style/theme (classic, marble, neon, crystal, etc.).
- **💾 Save** – Saves current profile: ELO, record, unlocked bonuses, lineup, style choices.
- **📂 Load** – Loads saved profile state.

**FPS display:**
- Small italic text in the corner: `FPS: XX` for live performance feedback.

### 4.4 Setup Overlay (Custom Lineup)

- Full-screen dark overlay (`#setup-overlay`).
- Central newspaper-style panel (`#setup-panel`) with:
  - Title: **"⚙️ Game Setup"**.
  - Description text with dynamic bonus piece count.
  - Grid `#setup-board` (8 columns × 2 rows) for placing pieces.
  - Light/dark squares that mirror normal chessboard coloring.
- Buttons in `#setup-controls`:
  - **↩️ Reset Default** – return to standard chess starting position.
  - **✅ Start Game** – accept the arrangement and begin.
  - **❌ Cancel** – close without changes.

### 4.5 Level / Era Notification

- `#level-notification` – a fixed top banner that slides down with an animation.
- Used for messages like: "Welcome to Era 5 – Neon City" or big jumps in rating.

---

## 5. Ribbon World & Era System (3D Background)

### 5.1 Concept

- The chessboard sits on a long, glowing "ribbon" or platform.
- The ribbon is moving continuously along the Z-axis (like an endless highway).
- Environments and assets spawn along this path to create the feeling of traveling through worlds.

### 5.2 Eras

- ELO is mapped to a set of **eras** (target was ~20), for example:
  - Forest
  - Medieval / Castle
  - City / Cyberpunk
  - Industrial
  - Space / Cosmic
  - Ocean / Underwater
  - Abstract / Neon
- Each era:
  - Has its own palette, fog density, and light colors.
  - Spawns era-appropriate buildings/props (trees, temples, skyscrapers, satellites, coral, etc.).
  - Uses particle systems (fireflies, sparks, leaves, snow, stars, bubbles).

### 5.3 Procedural Environment

Implemented mainly in `eraWorlds.ts` and `eraBuildings.ts`:
- Procedurally places a limited number of **primary** and **secondary** assets along the ribbon.
- Caps (after optimization) around:
  - ~12 primary assets (big landmarks per chunk).
  - ~15 secondary assets (small props).
  - ~1200 particles.
- Assets are positioned with:
  - Minimum distance away from the board/camera.
  - Random spread on X/Z so it feels varied.

### 5.4 Dynamic Lighting & Skybox

- Custom **ProceduralSkybox** shader with:
  - Gradient sky, horizon, and sun glow.
  - Large sphere around the scene for environment reflections.
- **DynamicLighting** system:
  - Directional sun light.
  - Rim lights for highlights.
  - Hemisphere light.
  - Optional accent point lights in some eras.
- Lighting parameters and colors are tweaked per era.

### 5.5 Camera & Motion

- Scroll motion controlled by a `ribbonSpeed` derived from current ELO / era.
- `travelSpeedScale` factor to globally speed up or slow down motion (1.6 default after tuning).
- Option for **Reduced Motion** via debug toggle.
- Two main view modes:
  - **Pan** – orbit camera with mouse drag and scroll zoom.
  - **Play** – more fixed overhead/angled camera.

---

## 6. Debug Menu & Performance Controls

The debug menu is a floating panel (bottom-right) that can be toggled via debug key.

### 6.1 Buttons & Inputs

- **🏆 Win** – Force a win outcome (for testing story and progression).
- **Jump ELO**:
  - Number input – direct ELO value (0–5000).
  - "Jump ELO" button to apply.

### 6.2 Feature Toggles

Each is a checkbox in the debug panel:
- **Environment** – Show/hide all 3D world assets.
- **Particles** – Enable/disable particle systems.
- **Skybox** – Toggle the procedural sky dome.
- **Lighting** – Toggle dynamic lighting.
- **Shadows** – Toggle shadow rendering.
- **Env Anim** – Turn environment animation updates on/off.
- **Wormhole** – Toggle special transition effects.
- **Reduced Motion** – Scale down motion speed.

### 6.3 Performance Sliders

- **Auto FPS** – If enabled, render scale adjusts itself to target FPS.
- **Target FPS** – Desired FPS when Auto FPS is on (default 60).
- **Fixed Step** – Use fixed-time-step simulation (can help jitter but adds cost).
- **Fixed FPS** – Timestep target for fixed-step mode.
- **Anim Quality (1–6)** – Higher = less frequent environment/lighting animation updates.
- **Travel Speed (0.5–2.5)** – Global multiplier for ribbon scroll speed.
- **Asset Density (0.2–1.2)** – Scales how many environment assets spawn.
- **Particle Density (0–1.5)** – Scales particle count.
- **Render Scale (0.5–1.5)** – Multiplier on device pixel ratio (resolution vs performance).

This menu is key for testing what causes slowdowns and tuning visuals on the fly.

---

## 7. Chess Systems & Styles

### 7.1 Engine & AI

- Backed by a chess engine using:
  - Minimax with alpha–beta pruning (or equivalent search algorithm).
  - Positional evaluation with piece-square tables.
  - Difficulty scaling with depth and heuristics based on ELO.
- Game state includes:
  - Board array of pieces.
  - Current turn.
  - Legal move list, check detection, and game over conditions.

### 7.2 Piece & Board Styles

**Piece styles (planned/partial):**
- Staunton3D – classic, realistic pieces (current primary style).
- Fantasy3D – glowing magical variant.
- Newspaper2D – flat, overhead symbols for pure readability.
- Others as experiments.

**Board styles:**
- Classic/tournament woods.
- Marble, crystal, neon, ocean, forest, royal, etc.
- Each style controls:
  - Square colors.
  - Roughness/metalness.
  - Optional emissive glow.
  - Transparency (for crystal-style boards).

### 7.3 Newspaper 2D Mode

- When camera tilts overhead enough, or a 2D style is chosen, the renderer swaps out heavy 3D pieces for sprites/glyphs.
- This improves performance and matches the newspaper aesthetic.

---

## 8. Why This Version Is Laggy (Postmortem)

This version looks ambitious but pushed too far for a browser. The main performance problems:

### 8.1 Overly High Geometry Complexity

- Chess pieces are constructed with **high-poly LatheGeometry**, torus rings, cones, and spheres:
  - 48 rotational segments on lathe geometries.
  - 16–32 segment spheres and cylinders.
  - Extra decorative geometry (rings, spikes, balls, mane segments, nostrils, eyes, ears, etc.).
- There are up to 32 pieces on the board; each is a **group of many meshes**.
- Combined with all the board and environment meshes, the triangle count is very high for WebGL on a typical laptop.

**Lesson:**
- Use **low-poly** shapes with carefully designed silhouettes.
- Share and instance geometries across pieces.
- Fake detail with **textures and normal maps**, not with extra polygons.

### 8.2 Heavy PBR Materials Everywhere

- The board and squares originally used `MeshPhysicalMaterial` with:
  - Clearcoat, clearcoatRoughness.
  - High reflectivity and envMapIntensity.
  - Real-time environment map sampling.
- Many square meshes (64) each had their own physical material.
- PBR on every surface increases shader complexity and fill rate.

**Lesson:**
- Default to `MeshStandardMaterial` with simple parameters.
- Reserve physical/clearcoat materials for 1–2 hero objects only.
- Reuse materials; avoid creating a new material per square/piece if not necessary.

### 8.3 Shadows + Many Lights

- Multiple directional and point lights with shadows enabled is expensive.
- Shadow maps were using **soft PCF** filtering for high-quality penumbra.
- Many objects (board, pieces, environment assets) were set to cast/receive shadows.

**Lesson:**
- Only 1 (or at most 2) **shadow-casting lights**.
- Use **BasicShadowMap** or disable shadows completely on low-end devices.
- Mark only the most important objects to cast/receive shadows.

### 8.4 Too Many Environment Assets & Particles

- Initial caps for assets/particles were too high:
  - Lots of buildings, trees, props per segment.
  - Particle counts in the thousands.
- Many of these are off-screen or very small but still contribute to draw calls and fill rate.

**Lesson:**
- Hard-cap environment counts (e.g., ~10–15 big assets, ~500–1000 particles).
- Use **LOD (Level of Detail)** and simpler impostors for distant objects.
- Aggressively cull anything that is behind the camera or far outside the view frustum.

### 8.5 High Resolution & Fixed Cost Rendering

- Canvas resolution is high (1150×650) and initially rendered at full device pixel ratio.
- On high-DPI screens this can easily become > 4 million pixels per frame.
- When combined with heavy shaders and many objects, GPU gets overloaded.

**Lesson:**
- Provide a **render scale** slider and default it to something like 0.75.
- Dynamically lower resolution if FPS drops below target.

### 8.6 Animation & Update Cost

- Environment, skybox, wormhole, lighting, and particles all update every frame by default.
- Some systems were running even when not visible.
- Early versions regenerated environment too often.

**Lesson:**
- Throttle animation updates (e.g., every 2nd/3rd/4th frame based on quality level).
- Skip environment updates when in 2D/newspaper mode or when environment is hidden.
- Avoid regenerating whole scenes frequently; update in-place instead.

### 8.7 CPU-Side Inefficiencies

- Rebuilding all piece meshes when minor changes occurred.
- Using string operations (like `toUpperCase`) inside hot evaluation loops.
- Extra allocations (new arrays, vectors, raycasters) per frame.

**Lesson:**
- Cache everything you can: geometries, materials, temp vectors, raycasters.
- Only rebuild pieces when the board state actually changes.
- Keep evaluation inner loops **branch-light and allocation-free**.

---

## 9. Guidelines for the Remake

When you rebuild this game (or a new version), keep the **feel** but change the tech approach:

### 9.1 Preserve
- The **newspaper wrapper** with sarcastic headlines.
- The **ELO-driven journey** through different eras.
- The **custom lineup / bonus pieces** setup phase.
- The **Pan vs Play** camera concept.
- The feeling of a **traveling ribbon world**.

### 9.2 Change

**Rendering Strategy:**
- Aim for **low-poly, stylized art** instead of hyper-detailed realism.
- Use a single instanced geometry per piece type or even per-color/per-type.
- Favor one or two main light sources with simple shading.

**Environment:**
- Treat environment as **background art**, not a full simulation.
- Pre-bake or pre-generate bands of scenery that scroll by, instead of heavy per-frame procedural placement.

**Performance Budgeting:**
- Decide a hard budget: e.g., "target 60 FPS on mid-range laptop".
- From that, allocate triangles, draw calls, lights, and particle limits.
- Use the debug menu early to measure and keep the budget.

**Code Architecture:**
- Keep the chess engine and UI **separate** from 3D eye candy.
- Make it trivial to **turn off** all 3D and still play a clean 2D mode.

If you follow these guidelines, you can remake this idea with the same personality and visual identity but with **much better performance and cleaner code**.
