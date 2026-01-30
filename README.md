# Promotion Variant Chess

A stunning 3D chess game where you journey through the ages of human history. Win games, gain ELO, and travel through 20 unique eras—from the age of dinosaurs to transcendent cosmic realms.

![Chess Through Time](Gemini_Generated_Image_htj81khtj81khtj8.png)

## 🎮 Features

### Dynamic Era System
- **20 Unique Historical Eras** - Progress through time as your ELO increases
- **Jurassic Period** → **Ice Age** → **Stone Age** → **Bronze Age** → **Classical** → **Medieval** → **Renaissance** → **Enlightenment** → **Industrial** → **Victorian** → and beyond to **Cosmic Transcendence**
- Each era features unique environments, lighting, architecture, and atmosphere

### Immersive 3D World
- **Procedural Environments** - Stonehenge, pyramids, cathedrals, skyscrapers, and more
- **Dynamic Lighting** - Era-specific atmospheres with god rays, ambient occlusion, and soft shadows
- **Animated Elements** - Flickering campfires, falling snow, flying pterodactyls, and more
- **Infinite Path** - Chess board sits on an endless road through each era

### Intelligent AI Opponent
- **Adaptive Difficulty** - AI scales from beginner (400 ELO) to grandmaster levels
- **Bonus Piece System** - At 3000+ ELO, the AI gains extra pieces that scale infinitely
- **Chess.js Engine** - Robust move validation and game state management

### Promotion Mechanics
- **Keep Your Pieces** - Promoted pawns that survive carry over to the next game
- **Strategic Depth** - Build an army of queens across multiple victories
- **Risk vs Reward** - Bonus pieces can be lost if captured

### Visual Polish
- **12 Board Styles** - Classic, Tournament, Marble, Walnut, Crystal, Neon, and more
- **3D Chess Pieces** - Premium materials with proper reflections and shadows
- **Newspaper Sidebar** - 96 satirical Onion-style chess articles that refresh on wins

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/promotion-variant-chess.git

# Navigate to project
cd promotion-variant-chess

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## 🎯 How to Play

1. **Start a Game** - You play as White by default
2. **Make Moves** - Click a piece, then click a valid destination square
3. **Win Games** - Checkmate the AI to gain ELO and progress through eras
4. **Promote Pawns** - Get pawns to the opposite side to promote them
5. **Keep Winning** - Promoted pieces that survive carry over to future games

## 🏆 ELO & Era Progression

| ELO Range | Era |
|-----------|-----|
| 400-450 | Jurassic |
| 451-499 | Ice Age |
| 500-699 | Stone Age |
| 700-899 | Bronze Age |
| 900-1099 | Classical |
| 1100-1299 | Medieval |
| ... | ... |
| 3000+ | AI gets bonus pieces! |

## 🛠️ Tech Stack

- **Three.js** - 3D rendering and WebGL
- **Chess.js** - Chess move validation and game logic
- **TypeScript** - Type-safe codebase
- **Vite** - Fast build tooling and HMR

## 📁 Project Structure

```
src/
├── main-3d.ts          # Main entry point
├── renderer3d.ts       # Three.js rendering
├── gameController.ts   # Game state and logic
├── chessEngine.ts      # Chess.js wrapper
├── eraSystem.ts        # Era definitions (20 eras)
├── eraWorlds.ts        # Procedural environment generation
├── eraBuildings.ts     # 3D building generators
├── dynamicLighting.ts  # Era-based lighting system
├── boardStyles.ts      # 12 board themes
└── newspaperArticles.ts # 96 satirical articles
```

## 🎨 Board Styles

- Classic • Tournament • Marble • Walnut • Ebony • Stone
- Ocean • Forest • Lava • Crystal • Neon • Void

## 📜 License

MIT License - feel free to use, modify, and distribute.

## 🙏 Acknowledgments

- Chess.js for robust chess logic
- Three.js for beautiful 3D rendering
- The chess community for endless inspiration

---

*"The only thing better than playing chess is playing chess while dinosaurs roam in the distance."*
