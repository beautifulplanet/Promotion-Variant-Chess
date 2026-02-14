# Part 3: Quick Start

*2 minutes. Clone, install, play.*

> This is a standalone version of Part 3 from the [main README](../README.md).
> [← Back to main README](../README.md#part-3-quick-start)

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Frontend (play the game)](#frontend-play-the-game)
- [Multiplayer Server (optional)](#multiplayer-server-optional)
- [Run Tests](#run-tests)
- [Build for Production](#build-for-production)
- [Rebuild the WASM Engine (optional)](#rebuild-the-wasm-engine-optional)

---

## Prerequisites

- **Node.js 18+**
- **Rust + wasm-pack** *(only if rebuilding the WASM engine — pre-built binary included)*

---

## Frontend (play the game)

```bash
git clone https://github.com/beautifulplanet/Promotion-Variant-Chess.git
cd "Promotion-Variant-Chess/version 1"
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). That's it.

---

## Multiplayer Server (optional)

```bash
cd server
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Server starts on `http://localhost:3001`.

---

## Run Tests

```bash
npm test                          # 382 frontend tests
cd server && npm test             # 154 server tests
cd rust-engine && cargo test      # 213 Rust engine tests
```

---

## Build for Production

```bash
npm run build                     # TypeScript check + Vite → dist/
```

---

## Rebuild the WASM Engine (optional)

```bash
cd rust-engine
wasm-pack build --target web --release --out-dir ../public/wasm
```

> **Need more detail?** See [Part 4: Full Tutorial](PART4_FULL_TUTORIAL.md) for step-by-step setup with explanations.

---

*[← Part 2: Tech Stack](PART2_TECH_STACK.md) · [Back to main README](../README.md) · [Part 4: Full Tutorial →](PART4_FULL_TUTORIAL.md)*
