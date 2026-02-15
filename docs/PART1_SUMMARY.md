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
- **3D rendering** with Three.js — 20 procedurally generated era environments
- **Real-time multiplayer** via Socket.io with ELO matchmaking, JWT auth, game persistence
- **Progressive Web App** — installable on mobile, offline-capable

🎮 **[▶ PLAY NOW](https://promotion-variant-chess.vercel.app)** 🎮
🔌 **[Multiplayer Server](https://chess-server-falling-lake-2071.fly.dev)** 🔌
📈 **[Health Check](https://chess-server-falling-lake-2071.fly.dev/health)** · 📊 **[Metrics](https://chess-server-falling-lake-2071.fly.dev/metrics)**

---

## Why It's Interesting (for Interviewers)

| Talking Point | Detail |
|---|---|
| Systems programming | Rust engine: bitboard move gen, magic bitboard lookups, Zobrist hashing — all compiled to WASM |
| Full-stack ownership | Frontend (TS + Three.js), backend (Node + Express + Prisma), engine (Rust), infra (Docker + Fly.io) |
| Testing discipline | 749 tests: 213 Rust (cargo test) + 382 frontend (Vitest) + 154 server (Vitest) |
| Performance engineering | Engine does ~5M positions/sec in WASM. Magic bitboards reduce sliding piece lookup from O(28) to O(1) |
| Graceful degradation | Triple AI fallback: Rust WASM → Stockfish.js Worker → TypeScript minimax. Game always works. |

---

## Key Numbers

| Metric | Value |
|---|---|
| Rust engine source | 11 files, ~6,000 lines |
| Frontend source | 20+ files, TypeScript |
| Server source | 10+ files, 979-line main server |
| Perft correctness | Matches all standard values through depth 5 (4,865,609 nodes) |
| WASM binary | ~170 KB gzipped |
| Test count | 749 total across 3 languages |

---

*[← Back to main README](../README.md) · [Part 2: Tech Stack →](PART2_TECH_STACK.md)*
