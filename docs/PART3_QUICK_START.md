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
- [Load Testing (optional)](#load-testing-optional)
- [AI Tournament (optional)](#ai-tournament-optional)
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
npm test                          # 420 frontend tests
cd server && npm test             # 168 server tests
cd rust-engine && cargo test      # 218 Rust engine tests
```

---

## Load Testing (optional)

Requires [k6](https://k6.io/docs/getting-started/installation/) installed.

```bash
# Start the server first, then:
k6 run load-tests/http-load-test.js          # HTTP API: ramp to 100 VUs
k6 run load-tests/websocket-load-test.js     # WebSocket: 200 concurrent
k6 run load-tests/stress-test.js             # Breaking point: 500 RPS
```

Results include P95 latency, error rates, and connection counts. See [LOAD_TEST_PLAN.md](LOAD_TEST_PLAN.md) for methodology and SLOs.

---

## AI Tournament (optional)

Requires Rust toolchain installed.

```bash
cd rust-engine
cargo run --release --bin tournament -- \
  --games 1000 \
  --threads 8 \
  --ab-test
```

Runs AI vs AI Swiss-system tournament with A/B testing. Results saved to `tournament_results.db` (SQLite). See [Part 4 D11](PART4_FULL_TUTORIAL.md#d11-ai-tournament-system) for details.

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
