# Part 1: Summary

*30 seconds. What this is, what it does, why it matters.*

> This is a standalone version of Part 1 from the [main README](../README.md).
> [← Back to main README](../README.md#part-1-summary)

---

## Table of Contents

- [What](#what)
- [Why It's Interesting (for Interviewers)](#why-its-interesting-for-interviewers)
- [Key Numbers](#key-numbers)

---

## What

A chess game that combines:
- **Custom Rust chess engine** compiled to WebAssembly (bitboards, magic bitboards, alpha-beta search, transposition tables)
- **3D rendering** with Three.js — 20 procedurally generated era environments with procedural skyboxes, L-system trees, Lorenz attractor particles, and dynamic lighting
- **24 piece styles** (7 3D + 17 2D canvas-drawn including Art Deco, Steampunk, and Tribal) and **12 board visual styles** with per-style theme-aware highlights
- **Real-time multiplayer** via Socket.io with ELO matchmaking, JWT auth, guest play, and game persistence
- **Progressive Web App** — installable on mobile, offline-capable, with Android hybrid build via Capacitor

🎮 **[▶ PLAY NOW](https://promotion-variant-chess.vercel.app)** 🎮
🔌 **[Multiplayer Server](https://chess-server-falling-lake-2071.fly.dev)** 🔌
📈 **[Health Check](https://chess-server-falling-lake-2071.fly.dev/health)** · 📊 **[Metrics](https://chess-server-falling-lake-2071.fly.dev/metrics)**

---

## Why It's Interesting (for Interviewers)

| Talking Point | Detail |
|---|---|
| Systems programming | Rust engine: bitboard move gen, magic bitboard lookups, Zobrist hashing — all compiled to WASM |
| Full-stack ownership | Frontend (TS + Three.js), backend (Node + Express + Prisma), engine (Rust), infra (Docker + Fly.io) |
| Testing discipline | 806 tests: 218 Rust (cargo test) + 420 frontend (Vitest) + 168 server (Vitest) |
| Performance engineering | Engine does ~5M positions/sec in WASM. Magic bitboards reduce sliding piece lookup from O(28) to O(1) |
| Graceful degradation | Triple AI fallback: Rust WASM → Stockfish.js Worker → TypeScript minimax. Game always works. |
| Production resilience | Rate limiting (HTTP + WS), graceful shutdown, crash recovery, Helmet.js security headers, k6 load testing |
| Large-scale AI experimentation | 1-million-player tournament runner with Swiss pairing, A/B testing, rayon parallelism, SQLite analytics |

---

## Key Numbers

| Metric | Value |
|---|---|
| Rust engine source | 12 files, ~7,000 lines (includes 866-line tournament runner) |
| Frontend source | 40+ files, TypeScript (renderer3d.ts alone is 4,400+ lines) |
| Server source | 10+ files, 1,020-line main server + resilience module |
| Load test scripts | 3 k6 scripts (HTTP, WebSocket, stress) |
| Perft correctness | Matches all standard values through depth 5 (4,865,609 nodes) |
| WASM binary | ~170 KB gzipped |
| Piece styles | 24 total — 7 3D + 17 2D canvas-drawn |
| Board styles | 12 with per-style theme-aware highlight colors |
| Era environments | 20 with procedural skyboxes, dynamic lighting, L-system trees, and particle systems |
| Test count | 806 total across 3 languages |
| Prometheus metrics | 16 custom metrics + Node.js defaults |

---

*[← Back to main README](../README.md) · [Part 2: Tech Stack →](PART2_TECH_STACK.md)*
