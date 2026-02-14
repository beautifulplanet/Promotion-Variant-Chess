# The Chess Chronicle ♟️

**A 3D chess game where you journey through the ages of human history — from the age of dinosaurs to transcendent cosmic realms.**

🎮 **[▶ PLAY NOW — Live Demo](https://promotion-variant-chess.vercel.app)** 🎮

<!-- TODO: Replace with actual screenshots -->
<!-- ![Gameplay Screenshot](docs/screenshot.png) -->

---

## Features

- **20 Unique Eras** — Progress from Jurassic jungles → Ice Age glaciers → Stone Age caves → Bronze Age pyramids → Classical temples → Medieval castles → Renaissance palaces → Industrial factories → Modern cities → Digital towers → Near Future holograms → Cyberpunk megacities → Space stations → Lunar colonies → Mars terraforming → Solar System mining → Type I Dyson swarms → Type II stellar megastructures → Type II.5 interstellar travel → Type III cosmic transcendence
- **Custom Rust Chess Engine** — Bitboard-based engine compiled to WebAssembly. Alpha-beta search with transposition tables, killer moves, null-move pruning, late move reductions, and quiescence search
- **3D & 2D Rendering** — Three.js-powered 3D board with procedural skyboxes, dynamic lighting, and era-themed environments. Fallback 2D canvas renderer
- **ELO Rating System** — Earn rating points by winning games. Your ELO determines which historical era you inhabit
- **Multiplayer** — Real-time WebSocket matchmaking with Socket.io. Ranked queue, game rooms, spectating
- **Sound & Atmosphere** — Era-appropriate ambient audio and move sounds
- **Save System** — Local game state persistence with undo/redo support
- **AI Difficulty Scaling** — Engine strength adapts to your rating

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | TypeScript, Three.js, Vite |
| Chess Engine | Rust → WebAssembly (wasm-bindgen) |
| Multiplayer Server | Node.js, Express, Socket.io |
| Database | Prisma ORM, SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT + bcrypt |
| Metrics | Prometheus (prom-client) |
| Testing | Vitest (frontend + server), cargo test (Rust) |
| Deployment | Vercel (frontend), Docker / Fly.io (server) |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Three.js │  │   Game    │  │  Multiplayer │  │
│  │ Renderer │◄─┤Controller ├──┤    Client    │  │
│  └──────────┘  └─────┬─────┘  └──────┬───────┘  │
│                      │               │           │
│              ┌───────▼───────┐       │           │
│              │ Engine Bridge │       │           │
│              │  (TypeScript) │       │           │
│              └───────┬───────┘       │           │
│                      │               │           │
│              ┌───────▼───────┐       │           │
│              │  Rust Engine  │       │           │
│              │    (WASM)     │       │           │
│              └───────────────┘       │           │
└──────────────────────────────────────┼───────────┘
                                       │ WebSocket
                              ┌────────▼────────┐
                              │  Chess Server   │
                              │  Express + WS   │
                              ├─────────────────┤
                              │ Matchmaker │ ELO│
                              │ Game Rooms │Auth│
                              ├─────────────────┤
                              │  Prisma + DB    │
                              └─────────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Rust + wasm-pack (only if rebuilding the engine)

### Frontend

```bash
npm install
npm run dev        # Start dev server on http://localhost:5173
```

### Multiplayer Server

```bash
cd server
npm install
cp .env.example .env
npx prisma migrate dev    # Set up SQLite database
npm run dev               # Start server on http://localhost:3000
```

### Building for Production

```bash
npm run build      # TypeScript check + Vite build → dist/
```

---

## Building the Rust Engine

The WASM binary is pre-built in `public/wasm/`. To rebuild from source:

```bash
cd rust-engine
wasm-pack build --target web --release --out-dir ../public/wasm
```

See [rust-engine/README.md](rust-engine/README.md) for details on the engine architecture, magic bitboards, and search algorithms.

---

## Testing

```bash
# Frontend tests (10 test files)
npm test

# Server tests (9 test files)
cd server && npm test

# Rust engine tests
cd rust-engine && cargo test
```

---

## Project Structure

```
├── src/                  # Frontend TypeScript source
│   ├── eras/             # Era-specific 3D world definitions
│   ├── gameController.ts # Core game logic
│   ├── chessEngine.ts    # TypeScript chess engine
│   ├── rustEngine.ts     # WASM bridge to Rust engine
│   ├── renderer3d.ts     # Three.js 3D rendering
│   └── ...
├── rust-engine/          # Rust chess engine (compiles to WASM)
│   └── src/
│       ├── lib.rs        # WASM entry points
│       ├── search.rs     # Alpha-beta with TT, NMP, LMR
│       ├── movegen.rs    # Legal move generation
│       ├── eval.rs       # Position evaluation
│       └── ...
├── server/               # Multiplayer backend
│   ├── src/
│   │   ├── index.ts      # Express + Socket.io server
│   │   ├── GameRoom.ts   # Game session management
│   │   ├── Matchmaker.ts # Ranked queue + pairing
│   │   ├── auth.ts       # JWT authentication
│   │   ├── database.ts   # Prisma service layer
│   │   └── ...
│   └── prisma/
│       └── schema.prisma # Database schema
├── tests/                # Frontend test suite
├── public/wasm/          # Pre-built WASM binary
└── index.html            # Single-page app entry
```

---

## License

[MIT](LICENSE)

---

## AI Disclosure

This project uses AI-assisted development. Architecture decisions, testing strategy, and code review by [beautifulplanet](https://github.com/beautifulplanet).