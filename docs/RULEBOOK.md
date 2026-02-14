# The Chess Chronicle — Official Rulebook

## What Is This Game?

The Chess Chronicle is a chess side-scroller where you play standard chess on a floating board that travels through 20 unique 3D worlds — from prehistoric jungles to galaxy-spanning civilizations. Your ELO rating determines which era you inhabit, how strong your AI opponent is, and what the world looks like around you. A satirical newspaper wraps the entire UI.

The chess itself follows all standard Western chess rules. What makes this game unique is the **Piece Inventory system**, the **Era progression**, and the **AI scaling**.

---

## 1. Chess Rules

All standard chess rules apply:

- 8×8 board, 16 pieces per side
- All legal moves including **castling**, **en passant**, and **pawn promotion**
- **Checkmate** = win
- **Stalemate** = draw
- **Threefold repetition** = draw
- **50-move rule** = draw
- **Insufficient material** = draw

When you promote a pawn, you choose the piece (Queen, Rook, Bishop, or Knight) — no auto-queening.

You can **undo moves** at any time. Undo always rewinds a full turn (your move + the AI's response).

---

## 2. The Piece Inventory (Core Mechanic)

This is the heart of what makes The Chess Chronicle different.

### Earning Pieces

1. Every time you **promote a pawn** during a game, that piece is tracked as "pending"
2. If you **win the game** → all promoted pieces are **permanently added to your inventory**
3. If you **lose the game** → all promotions from that game are **discarded**

So winning matters — it's how you build your collection.

### Deploying Pieces

Before each game, you can open **Setup Mode** (the ⚙️ button) and:

- **Place pieces from your inventory** onto your starting 3 rows
- **Drag to rearrange** pieces on your home ranks
- **Deploy up to 24 extra pieces** maximum
- After the game ends (win, lose, or draw), deployed pieces are **returned to your inventory**

Your inventory tracks: Queens, Rooks, Bishops, Knights, and Pawns.

### Board Profiles

- Save your favorite board arrangements as named **Board Profiles**
- Load or delete profiles between games
- Profiles persist in your save file

---

## 3. AI Bonus Pieces (Fairness Scaling)

The AI can also receive bonus pieces in two cases:

### High ELO Threshold (≥ 3,000)

If your ELO reaches 3,000+, the AI starts receiving compensating material:
- **3 material points per 50 ELO** above the 3,000 threshold
- Example: At ELO 3,200, the AI gets ~12 points (a Queen + a Bishop)

### Player Material Matching

If you deploy bonus pieces worth more than 2 material points, the AI receives pieces to roughly match:
- You get **2 free points** — the AI only compensates above that
- Example: You deploy 3 Queens (27 pts) → AI gets ~25 pts of material

**Material values:** Pawn = 1, Knight = 3, Bishop = 3, Rook = 5, Queen = 9

The AI's bonus pieces are placed on its back ranks, center-outward. Maximum 54 material points (6 Queens).

---

## 4. ELO Rating

- **Starting ELO:** 400
- **Minimum:** 100 | **Maximum:** 10,000
- **K-Factor:** 32
- **Formula:** Standard ELO calculation — $\Delta = K \times (S - E)$ where $E = \frac{1}{1 + 10^{(R_{opponent} - R_{player})/400}}$
  - Win: S = 1, Loss: S = 0, Draw: S = 0.5

Your ELO determines your **Level**, your **Era** (world), and the **AI difficulty**.

---

## 5. Levels (19 Named Ranks)

| Level | Title | ELO Range |
|-------|-------|-----------|
| 1 | Beginner | 100–299 |
| 2 | Novice | 300–499 |
| 3 | Apprentice | 500–699 |
| 4 | Student | 700–899 |
| 5 | Amateur | 900–1,099 |
| 6 | Club Player | 1,100–1,299 |
| 7 | Tournament | 1,300–1,499 |
| 8 | Expert | 1,500–1,699 |
| 9 | Candidate Master | 1,700–1,899 |
| 10 | Master | 1,900–2,099 |
| 11 | International | 2,100–2,299 |
| 12 | Grandmaster | 2,300–2,499 |
| 13 | Super GM | 2,500–2,699 |
| 14 | World Class | 2,700–2,999 |
| 15 | Legend | 3,000–3,499 |
| 16 | Immortal | 3,500–3,999 |
| 17 | Chess God | 4,000–4,499 |
| 18 | Transcendent | 4,500–4,999 |
| 19 | Beyond | 5,000–9,999 |

Level changes trigger on-screen notifications.

---

## 6. AI Difficulty Scaling

The AI uses **Stockfish** (a world-class chess engine) with difficulty that scales to your ELO:

| Your ELO | Stockfish Skill | Think Time |
|----------|----------------|------------|
| 100 | Level 0 | 300ms |
| 600 | Level 4 | 300ms |
| 1,000 | Level 7 | 500ms |
| 1,500 | Level 10 | 1,000ms |
| 2,000 | Level 14 | 1,500ms |
| 2,500 | Level 17 | 2,500ms |
| 2,850+ | Level 20 (max) | 2,500ms |

At lower levels (1–6), the AI also injects randomness into its play so it makes human-like "mistakes."

---

## 7. The 20 Eras (3D Worlds)

As your ELO rises, the floating board travels through increasingly advanced civilizations:

| # | Era | ELO | Setting |
|---|-----|-----|---------|
| 1 | **Jurassic** | 0–450 | Prehistoric jungle with ferns and mist |
| 2 | **Ice Age** | 451–599 | Glaciers, mammoths, falling snow |
| 3 | **Stone Age** | 500–699 | Caves, campfires, fire sparks |
| 4 | **Bronze Age** | 700–899 | Pyramids, ziggurats, desert sun |
| 5 | **Classical** | 900–1,099 | Greek temples and marble columns |
| 6 | **Medieval** | 1,100–1,299 | Stone castles, dark forests, torchlight |
| 7 | **Renaissance** | 1,300–1,499 | Palazzos, domed cathedrals, gardens |
| 8 | **Industrial** | 1,500–1,699 | Factories, smokestacks, furnaces |
| 9 | **Modern** | 1,700–1,899 | Neon signs, retro diners, synthwave |
| 10 | **Digital** | 1,900–2,099 | Glass towers, floating data particles |
| 11 | **Near Future** | 2,100–2,299 | Delivery drones, holograms, clean energy |
| 12 | **Cyberpunk** | 2,300–2,499 | Neon rain, megacity skylines |
| 13 | **Space Age** | 2,500–2,699 | Orbital stations, rocket launches |
| 14 | **Lunar Colony** | 2,700–2,899 | Moon bases, Earth hanging in the sky |
| 15 | **Mars Colony** | 2,900–3,099 | Red landscape, terraforming domes |
| 16 | **Solar System** | 3,100–3,499 | Asteroid mining, Dyson swarm |
| 17 | **Type I Civilization** | 3,500–3,999 | Dyson spheres, planetary control |
| 18 | **Type II Civilization** | 4,000–4,499 | Star-harvesting megastructures |
| 19 | **Type II.5** | 4,500–4,999 | Interstellar travel, nebula harvesting |
| 20 | **Type III Civilization** | 5,000–9,999 | Galaxy-spanning civilization, cosmic scale |

Each era has its own sky colors, lighting, weather particles, 3D assets, fog, and ambient sounds. The board floats through an infinite ribbon of these procedural environments.

---

## 8. Move Quality Ratings

Every move you make is analyzed and classified:

| Rating | Eval Change (centipawns) |
|--------|--------------------------|
| ✨ Brilliant | Improved position by 50+ cp |
| ⭐ Best | Within 10 cp of engine's choice |
| ✅ Good | Within 30 cp |
| ⚠️ Inaccuracy | 30–80 cp lost |
| ❌ Mistake | 80–200 cp lost |
| 💀 Blunder | 200+ cp lost |

---

## 9. The Newspaper

The UI is wrapped in a satirical newspaper called **"The Chess Chronicle"**. 

- 100+ humorous articles appear in the sidebar
- Articles change after each game with context-relevant headlines
- Win headlines: *"LOCAL GENIUS DEFEATS MACHINE, DEMANDS PARADE"*
- Loss headlines: *"MOUSE SLIP BLAMED FOR 47TH CONSECUTIVE LOSS"*

---

## 10. Color Alternation

- You start as **White** in your first game
- After each game, you **swap colors** — White, then Black, then White, etc.

---

## 11. Saving & Loading

- Your progress is saved as a **JSON file** you download
- Save includes: ELO, win/loss record, piece inventory, board profiles, game settings, and mid-game state
- Load a save by uploading the JSON file
- Stats (total games, streaks, play time) are tracked separately in browser storage

---

## 12. Special Modes

### AI vs AI Spectator Mode
Watch two AIs battle. White plays at a fixed 1,800 ELO, Black plays at your current game ELO. Adjustable speed.

### Debug Menu (Shift+D)
ELO slider, era jumps, force win/lose, FPS counter, toggle visual effects, and more. For testing and exploration.

---

## Quick Start

1. **Click any piece** to see its legal moves highlighted
2. **Click a highlighted square** to move there
3. **Win games** to raise your ELO and unlock new eras
4. **Promote pawns and win** to build your piece inventory
5. **Deploy extra pieces** in Setup Mode before tough games
6. **Travel through time** as the world evolves around you

Good luck, Chronicle Champion. 🏆
