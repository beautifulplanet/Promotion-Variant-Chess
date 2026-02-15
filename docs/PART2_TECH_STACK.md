# Part 2: Tech Stack & Architecture

*1 minute. What's used, how it fits together, and the key design decisions.*

> This is a standalone version of Part 2 from the [main README](../README.md).
> [← Back to main README](../README.md#part-2-tech-stack--architecture)

---

## Table of Contents

- [Stack](#stack)
- [Architecture](#architecture)
- [AI Fallback Chain](#ai-fallback-chain)
- [Key Design Decisions](#key-design-decisions)

---

## Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | TypeScript, Three.js, Vite | WebGL 3D rendering, zero-framework for canvas-heavy app |
| Chess Engine | Rust → WebAssembly (wasm-bindgen) | 10–100× faster than JS, runs client-side for zero server cost |
| Multiplayer | Node.js, Express, Socket.io | Real-time WebSocket with HTTP long-polling fallback |
| Database | Prisma ORM, SQLite (dev/prod) | Type-safe queries, zero-config dev, persistent volume in prod |
| Auth | JWT + bcryptjs | Stateless auth, guest accounts with optional registration |
| Security | Helmet.js, express-rate-limit, CORS | Security headers, brute-force protection, origin whitelisting |
| Metrics | Prometheus (prom-client) | 16 custom metrics + Node.js defaults, `/metrics` endpoint |
| Load Testing | k6 (Grafana) | HTTP, WebSocket, and stress test scripts with SLO thresholds |
| AI Tournament | Rust (rayon, clap, rusqlite) | 1M-player Swiss tournament with A/B testing and parallel execution |
| Testing | Vitest + cargo test + Playwright | Unit, integration, E2E across all 3 languages |
| Deploy | Vercel (frontend), Docker + Fly.io (server) | Edge CDN for static, persistent VM for WebSocket server |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Browser                          │
│                                                      │
│  ┌──────────┐   ┌────────────┐   ┌──────────────┐   │
│  │ Three.js │   │   Game     │   │  Socket.io   │   │
│  │ Renderer │◄──┤ Controller ├──►│   Client     │   │
│  └──────────┘   └─────┬──────┘   └──────┬───────┘   │
│                       │                  │           │
│               ┌───────▼────────┐         │           │
│               │  Engine Bridge │         │           │
│               │  (TypeScript)  │         │           │
│               └───────┬────────┘         │           │
│                       │                  │           │
│               ┌───────▼────────┐         │           │
│               │  Rust Engine   │         │           │
│               │    (WASM)      │         │           │
│               └────────────────┘         │           │
└──────────────────────────────────────────┼───────────┘
                                           │ WebSocket
                                  ┌────────▼─────────┐
                                  │   Chess Server    │
                                  │  Express + WS     │
                                  ├──────────────────-┤
                                  │ Matchmaker  │ ELO │
                                  │ Game Rooms  │ Auth│
                                  ├──────────────────-┤
                                  │   Prisma + SQLite  │
                                  └────────────────────┘
```

---

## AI Fallback Chain

The engine runs **in the browser**, not on the server. Three engines cascade for 100% availability:

```
Request → Rust WASM (~1M+ NPS)
             ↓ if WASM fails to load
          Stockfish.js Worker (~200K NPS, skill 0-20)
             ↓ if Worker fails
          TypeScript minimax (~10K NPS, always works)
```

**Why 3 engines?** WASM can fail (old browsers, CSP). Workers can fail (Safari bugs). TypeScript always works. User never sees a broken AI.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Engine in browser, not server | Zero latency for single-player, zero server cost for AI, scales to infinite players |
| Vanilla TS, no React | App is 80% canvas. React's virtual DOM adds overhead for `<canvas>` updates |
| SQLite in production | Portfolio-scale traffic. Persistent Fly.io volume. Avoids Postgres complexity |
| Bitboard representation | O(1) attack lookups via magic bitboards. Industry standard for chess engines |
| 16-bit move encoding | 2 bytes per move. 256-move list fits in 512 bytes (L1 cache) |

---

*[← Part 1: Summary](PART1_SUMMARY.md) · [Back to main README](../README.md) · [Part 3: Quick Start →](PART3_QUICK_START.md)*
