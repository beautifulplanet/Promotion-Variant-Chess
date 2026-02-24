# Architecture Decisions FAQ

*Every "why?" an interviewer might ask, answered once so you never have to think about it again.*

> This is the document you hand someone who asks "why did you choose X?" — or open yourself 10 minutes before an interview. Each question is something a Staff+/Principal engineer at a top-500 company would reasonably ask while reviewing this project.

---

## Table of Contents

- [Deployment & Infrastructure](#deployment--infrastructure)
  - [Why Fly.io over Kubernetes?](#why-flyio-over-kubernetes)
  - [Why Fly.io over Railway or Render?](#why-flyio-over-railway-or-render)
  - [Why not just use Vercel for everything?](#why-not-just-use-vercel-for-everything)
  - [Why auto-stop machines?](#why-auto-stop-machines)
  - [Why a single VM instead of a cluster?](#why-a-single-vm-instead-of-a-cluster)
- [Database](#database)
  - [Why SQLite in production?](#why-sqlite-in-production)
  - [Why not PostgreSQL everywhere?](#why-not-postgresql-everywhere)
  - [What breaks when SQLite hits its limits?](#what-breaks-when-sqlite-hits-its-limits)
  - [Why Prisma over raw SQL or Drizzle?](#why-prisma-over-raw-sql-or-drizzle)
- [Frontend Architecture](#frontend-architecture)
  - [Why no React/Vue/Svelte?](#why-no-reactvuesvelte)
  - [Why Three.js instead of a game engine?](#why-threejs-instead-of-a-game-engine)
  - [Why Vite?](#why-vite)
  - [Why a 1,641-line index.html?](#why-a-1641-line-indexhtml)
- [Chess Engine](#chess-engine)
  - [Why write a custom Rust engine?](#why-write-a-custom-rust-engine)
  - [Why WASM instead of running the engine server-side?](#why-wasm-instead-of-running-the-engine-server-side)
  - [Why the three-tier AI fallback chain?](#why-the-three-tier-ai-fallback-chain)
  - [Why magic bitboards?](#why-magic-bitboards)
- [Server Architecture](#server-architecture)
  - [Why Express + Socket.io instead of tRPC or GraphQL?](#why-express--socketio-instead-of-trpc-or-graphql)
  - [Why custom JWT auth instead of Passport/Auth0/Clerk?](#why-custom-jwt-auth-instead-of-passportauth0clerk)
  - [Why Zod for protocol validation?](#why-zod-for-protocol-validation)
  - [Why Prometheus metrics instead of Datadog/New Relic?](#why-prometheus-metrics-instead-of-datadognew-relic)
  - [Why custom rate limiting instead of Cloudflare/API gateway?](#why-custom-rate-limiting-instead-of-cloudflareapi-gateway)
- [Testing & Quality](#testing--quality)
  - [Why 806 tests for a portfolio project?](#why-806-tests-for-a-portfolio-project)
  - [Why Vitest over Jest?](#why-vitest-over-jest)
  - [Why k6 over Artillery or Locust?](#why-k6-over-artillery-or-locust)
- [Rust & WASM](#rust--wasm)
  - [Why dual crate types (cdylib + rlib)?](#why-dual-crate-types-cdylib--rlib)
  - [Why LTO and opt-level 3?](#why-lto-and-opt-level-3)
  - [Why a tournament binary in the engine crate?](#why-a-tournament-binary-in-the-engine-crate)
- [Trade-offs I'd Change](#trade-offs-id-change)

---

## Deployment & Infrastructure

### Why Fly.io over Kubernetes?

**Short answer:** Kubernetes solves problems I don't have yet, and introduces problems I'd have immediately.

| | Fly.io | Kubernetes (EKS/GKE) |
|---|---|---|
| **Time to deploy** | `fly deploy` — 90 seconds | Cluster setup + Helm charts + ingress controller — days |
| **Cost at my scale** | $0–6/month (free tier) | $70+/month (control plane alone on EKS) |
| **WebSocket support** | Native TCP services in `fly.toml` | Requires sticky sessions, ingress annotations, pod disruption budgets |
| **Persistent volume** | `fly volumes create` — one command | PersistentVolumeClaim + StorageClass + CSI driver |
| **Operational burden** | Zero — managed platform | Upgrades, node pools, RBAC, network policies, monitoring stack |

**When I'd switch:** At 10K+ concurrent players, when I need multi-region, horizontal scaling, and a dedicated DevOps team. The architecture is already containerized (Docker), so migration is a packaging change, not a rewrite.

**The real answer for interviews:** "I chose Fly.io because the infrastructure decision should match the current scale, not the aspirational scale. Kubernetes at 100 users is resume-driven development. I documented the exact inflection points where I'd migrate — see the scaling roadmap in the README."

---

### Why Fly.io over Railway or Render?

Three concrete requirements eliminated the alternatives:

1. **Persistent volumes** — SQLite needs a filesystem that survives deploys. Railway has no volume support. Render's free tier has no persistent disk. Fly.io has `fly volumes` with 1 GB free.

2. **WebSocket configuration** — Fly.io's `fly.toml` has explicit TCP service blocks with configurable concurrency limits (`hard_limit = 250`). Railway and Render treat WebSockets as a side-effect of HTTP, with no tuning surface.

3. **Auto-stop/start** — `min_machines_running = 0` means the VM sleeps when unused and wakes on request. This keeps a portfolio project at $0 while still being "deployed." Render's free tier also sleeps but with a 30-second cold start vs. Fly's ~2-3 seconds.

Full decision record: [ADR-001: Fly.io over Railway](adr/001-fly-io-over-railway.md).

---

### Why not just use Vercel for everything?

Vercel is already hosting the frontend. The server can't go there because:

- **Vercel is serverless** — functions execute and die. Socket.io needs a long-lived process to hold WebSocket connections.
- **No persistent state** — no filesystem, no SQLite, no in-memory game rooms that persist between requests.
- **Cold starts on every request** — a chess game room needs to exist for 30+ minutes. Serverless functions time out at 10–60 seconds.

Vercel is perfect for the static frontend (CDN, instant deploys, zero config). The server needs a different host.

---

### Why auto-stop machines?

`min_machines_running = 0` in `fly.toml` means:

- **Cost:** $0/month when nobody is playing (the VM literally stops)
- **Trade-off:** 2–3 second cold start on first request after idle
- **Why it's acceptable:** This is a portfolio project. Nobody is playing at 3 AM. The first visitor waits 2 seconds; subsequent visitors get sub-50ms responses.
- **When I'd change:** Set `min_machines_running = 1` ($6/month) when real users depend on instant availability.

---

### Why a single VM instead of a cluster?

**Because the bottleneck isn't what people think it is.**

The AI runs client-side in WASM. 10,000 single-player sessions produce zero server load. The server only handles multiplayer — typically 1–5% of registered users. A single shared-cpu-1x Fly VM can handle 250 concurrent WebSocket connections (`hard_limit` in `fly.toml`), which is roughly 125 simultaneous games.

Horizontal scaling would require:
- Redis for shared state (game rooms)
- Sticky sessions or pub/sub for WebSocket routing
- PostgreSQL instead of SQLite (no more single-file DB)

I've documented exactly when each change triggers. (See README Section F: Scaling Roadmap.)

---

## Database

### Why SQLite in production?

| Factor | SQLite | Managed PostgreSQL |
|---|---|---|
| **Cost** | $0 (file on disk) | $7–15/month (Neon, Supabase, RDS) |
| **Latency** | 0ms network hop (same filesystem) | 1–5ms per query (even in same region) |
| **Backup** | `cp chess.db chess.db.bak` or Litestream | Point-in-time recovery (managed) |
| **Deployment** | No connection pool, no credentials, no secrets | Connection string, pool size, SSL config |
| **Scale limit** | ~50 concurrent writes/sec | Thousands of concurrent writes |

SQLite is the right choice at current scale because:
1. Single server = single writer (no write contention)
2. Read-heavy workload (leaderboard queries >> game inserts)
3. Zero operational cost
4. In-process queries are faster than any network database

---

### Why not PostgreSQL everywhere?

The `docker-compose.yml` actually does use PostgreSQL for local development. The schema is Prisma — it's database-agnostic. Switching production to PostgreSQL is a one-line change:

```prisma
datasource db {
  provider = "postgresql"  // was "sqlite"
  url      = env("DATABASE_URL")
}
```

I didn't do this because PostgreSQL adds $7–15/month and operational complexity (managed service credentials, connection pooling, SSL) for a server that currently has zero active users. That's premature optimization.

---

### What breaks when SQLite hits its limits?

**Specific failure mode:** SQLite uses a single writer lock. Under concurrent multiplayer load:

| Concurrent Games | What Happens | Detection |
|---|---|---|
| 1–50 | No issues | — |
| 50–100 | Occasional `SQLITE_BUSY` on game-end writes | `chess_db_query_seconds` P95 > 100ms |
| 100–250 | Write queue backpressure, timeouts | P95 > 500ms, error rate > 1% |
| 250+ | Server capacity limit regardless | `hard_limit` in fly.toml |

**Mitigation already in place:** WAL mode (Write-Ahead Logging) gives SQLite ~10x better concurrent read performance and eliminates reader-blocks-writer.

**Migration trigger:** When `chess_db_query_seconds` P95 exceeds 200ms consistently, I migrate to PostgreSQL. The Prisma schema already supports it.

---

### Why Prisma over raw SQL or Drizzle?

- **Over raw SQL:** Type-safe queries, auto-generated client, migration tracking. For a project with 2 models it's marginal, but it demonstrates I can use an ORM properly — schema-first, migration-based, not entity-sync.
- **Over Drizzle:** Prisma has better documentation, wider adoption (for interview signal), and the schema DSL is more readable. Drizzle's SQL-like API is better for complex queries that don't exist in this project yet.
- **Over TypeORM/Sequelize:** Dead or dying. Prisma is the industry direction.

**Trade-off accepted:** Prisma's generated client adds ~3MB to `node_modules` and startup time. For a server that auto-stops and cold-starts, this is 200ms of boot time that's dwarfed by the 2-second Fly machine start.

---

## Frontend Architecture

### Why no React/Vue/Svelte?

**This is the question I get asked most.** The answer has three parts:

1. **Performance:** React's virtual DOM reconciliation is designed for UI with frequent partial updates. A chess game renders via `requestAnimationFrame` on a Three.js `<canvas>`. React would be a VDOM layer sitting above a WebGL render loop — two rendering systems fighting each other. The DOM elements (move list, capture panel, ELO display) change infrequently and are trivially managed with direct DOM manipulation.

2. **Bundle size:** The project already ships Three.js (~600KB), chess.js, stockfish.js, and a WASM binary. Adding React + ReactDOM is 40KB more of code that does nothing the `<canvas>` can't do. Vanilla TS + Vite's tree-shaking keeps the bundle tight.

3. **Portfolio differentiation:** Every junior developer's portfolio has a React app. A production-quality project built without a framework demonstrates understanding of what frameworks abstract away — event delegation, state management, component lifecycle, DOM diffing — because I had to implement those concerns manually.

**When I'd use React:** If the UI had complex form state, nested routing, or server-side rendering needs. A settings page with 20 inputs and validation? React. A full-screen `<canvas>` game? Vanilla.

---

### Why Three.js instead of a game engine?

| Option | Pros | Cons for this project |
|---|---|---|
| **Unity** | Full game engine, C# | 10MB+ runtime, no source access, overkill for a board game |
| **PlayCanvas** | WebGL engine | Proprietary editor dependency, heavy runtime |
| **Babylon.js** | Full 3D engine | 2x bundle size of Three.js, fewer examples for chess |
| **Three.js** | Minimal, stable, huge ecosystem | No physics engine (don't need one), manual state management |
| **Raw WebGL** | Maximum control | Person-months of shader/math code for a chess game |

Three.js hits the sweet spot: enough abstraction to be productive (scene graph, materials, lighting), thin enough to not bloat the bundle, and ubiquitous enough that any 3D developer can read the code.

---

### Why Vite?

- **HMR** that actually works (sub-100ms hot reload vs. Webpack's multi-second rebuilds)
- **WASM support** via explicit loader configuration — Vite handles `.wasm` files as assets with proper MIME types
- **Worker bundling** — `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` just works
- **Tree-shaking** for Three.js (only ship used modules)
- **No config for 90% of use cases** — the `vite.config.ts` is 20 lines

Over Webpack: faster, simpler, modern ESM-first. Over Parcel: more control, better plugin ecosystem. Over esbuild directly: Vite uses esbuild for dev and Rollup for prod, getting the best of both.

---

### Why a 1,641-line index.html?

**Trade-off I accept with eyes open.**

The HTML is a single-page app with all DOM structure inline. In a framework project, this would be 30+ component files. Here it's one file because:

1. **No build step for HTML** — the DOM structure is static. Components would add a build abstraction layer (JSX, templates) for markup that rarely changes.
2. **CSS is co-located** — styles are in `<style>` blocks near their markup. No CSS-in-JS runtime, no CSS module config.
3. **Simple mental model** — open one file, see everything the browser sees.

**Why I wouldn't do this at scale:** Beyond ~2K lines, the file becomes hard to navigate. If I added a settings panel, chat UI, or tournament bracket, I'd extract those into web components or lit-html templates.

---

## Chess Engine

### Why write a custom Rust engine?

This is the single highest-leverage portfolio decision:

1. **Demonstrates systems programming** — bitboard manipulation, alpha-beta search with transposition tables, null-move pruning, late-move reductions. This is algorithms + data structures at a level that separates senior from staff.

2. **WASM compilation** — shows I can bridge Rust ↔ JavaScript via `wasm-bindgen`, handle async loading, and gracefully degrade when WASM isn't available.

3. **Measurable performance** — the Rust engine searches ~2M nodes/sec vs. the TypeScript fallback at ~50K nodes/sec. That's a 40x speedup that I can quantify in an interview.

4. **It's not a toy** — magic bitboards, transposition tables with Zobrist hashing, and killer move heuristics are techniques used in Stockfish. Writing them proves I can read and implement academic computer science.

---

### Why WASM instead of running the engine server-side?

**Economics.** If the AI runs server-side:

| Users | Server CPU Cost | WASM Cost |
|---|---|---|
| 100 | $15/month (compute) | $0 |
| 10,000 | $500/month | $0 |
| 1,000,000 | $50K/month | $0 |

The user's browser does the computation. The server only handles multiplayer. This means single-player is infinitely scalable at zero marginal cost — every user brings their own CPU.

**Trade-off:** Users on slow devices get a slower AI. That's why the three-tier fallback exists — if WASM is too slow or unavailable, the engine degrades to lighter alternatives rather than failing.

---

### Why the three-tier AI fallback chain?

```
Tier 1: Rust WASM engine     → Fastest, not available in all browsers
Tier 2: Stockfish.js Worker   → Strong, runs in background thread
Tier 3: TypeScript minimax    → Weakest, but works everywhere
```

**Why not just Stockfish?** Stockfish.js is 1.2MB of JavaScript. It requires a Web Worker and takes 2–3 seconds to initialize. The Rust engine is 200KB of WASM and initializes in <100ms.

**Why not just Rust WASM?** Safari on iOS had inconsistent WASM support until recently. Older Android browsers may not support WASM at all. The fallback chain ensures every user gets the best AI their browser can run.

**Why not just TS minimax?** It's 40x slower than Rust. Searching to depth 5 takes ~2 seconds in TS vs. ~50ms in Rust. It exists only as a last-resort guarantee that the game is playable.

Each tier is tried in order. If a tier fails (import error, timeout, crash), the next tier is seamlessly activated. The user never sees an error.

---

### Why magic bitboards?

A chess position has 64 squares. A 64-bit integer can represent which squares a piece attacks with a single bitmask. Magic bitboards use hash-based lookup tables to compute sliding piece attacks (bishops, rooks, queens) in O(1) instead of O(n) ray scanning.

**Performance difference:** Bishop attacks via ray scan is ~20 operations. Via magic bitboard lookup: 1 multiply + 1 shift + 1 array access = 3 operations. At 2M nodes/sec search speed, this matters.

**Why not mailbox (array) representation?** Mailbox is simpler to implement but 5–10x slower for move generation. Since move generation runs millions of times per AI decision, the O(1) lookup justifies the implementation complexity.

---

## Server Architecture

### Why Express + Socket.io instead of tRPC or GraphQL?

| Protocol | Best For | This Project |
|---|---|---|
| **REST (Express)** | CRUD resources, stateless ops | Auth endpoints, leaderboard queries ✓ |
| **WebSocket (Socket.io)** | Real-time bidirectional | Live gameplay, matchmaking ✓ |
| **GraphQL** | Complex nested queries | Overkill — 2 models, simple queries |
| **tRPC** | Full-stack type safety | Requires coupled frontend — my frontend is vanilla |
| **gRPC** | Service-to-service | No microservices, browser doesn't speak gRPC |

Express handles the REST surface (auth, leaderboard). Socket.io handles the real-time surface (game moves, matchmaking). Two protocols, each used where it fits. GraphQL would add a query language, schema definition, and resolver boilerplate for a data model that has 2 tables and 5 queries.

---

### Why custom JWT auth instead of Passport/Auth0/Clerk?

- **Passport:** Adds 15+ npm packages for a strategy pattern I can implement in 40 lines. `jwt.sign()` and `jwt.verify()` are the entire auth surface for a game that doesn't have OAuth, SAML, or MFA.
- **Auth0/Clerk:** $0 for <7K MAU, then $25–100/month. Adds a third-party dependency for a portfolio project. Also means auth is a black box I can't explain in an interview.
- **Custom:** 80 lines total between `generateToken`, `verifyToken`, and the Express middleware. I can explain every line. In an interview, I can discuss token expiry, refresh tokens (not implemented — I would for production), and bcrypt password hashing (implemented).

**When I'd use Auth0/Clerk:** When I need OAuth providers (Google, GitHub login), MFA, or compliance certifications (SOC2) that I shouldn't build myself.

---

### Why Zod for protocol validation?

Every WebSocket message from a client is untrusted input. Without validation:

```typescript
// Client sends: { type: "move", gameId: "rm -rf /", from: undefined }
// Server crashes with TypeError: Cannot read properties of undefined
```

With Zod:

```typescript
const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), gameId: z.string().uuid(), from: z.string(), to: z.string() }),
  // ...
]);
```

Invalid messages are rejected before touching any game logic. Zod gives runtime type checking with TypeScript inference — the validated object is automatically typed.

**Over io-ts:** Zod has a cleaner API and doesn't require fp-ts. **Over joi/yup:** Zod is TypeScript-first with better inference. **Over manual validation:** 50+ lines of `if` statements vs. one schema.

---

### Why Prometheus metrics instead of Datadog/New Relic?

- **Cost:** Prometheus is free. Datadog is $15–23/host/month. New Relic is $0.30/GB ingested.
- **Portability:** Prometheus exposition format is an industry standard. Any monitoring system (Grafana, Fly.io metrics, AWS CloudWatch) can scrape it. Vendor lock-in is zero.
- **Weight:** `prom-client` is 150KB. Datadog's `dd-trace` is 15MB+ and monkey-patches `http`, `express`, and `net`.
- **Control:** I define exactly 16 metrics that answer specific operational questions (see README Section D12). Datadog would auto-generate 200 metrics, most useless, and bill for all of them.

**When I'd use Datadog:** When a team needs APM traces, inter-service correlation, and someone else is paying $15K/year.

---

### Why custom rate limiting instead of Cloudflare/API gateway?

Two layers of rate limiting exist:

1. **HTTP:** `express-rate-limit` — 100 requests/minute per IP, applied to REST endpoints
2. **WebSocket:** Custom `checkWsRateLimit` — tracks messages per IP per time window

**Why not Cloudflare?** Cloudflare sits in front of DNS. It would protect the HTTP layer but has no visibility into WebSocket message frequency inside an established connection. The per-message rate limiter catches abuse that happens after the connection is already open.

**Why not API Gateway (Kong, AWS API GW)?** Cost and complexity for a single-origin server. Kong requires its own deployment. AWS API GW charges per request and doesn't handle WebSockets natively (WebSocket API is a separate product with different pricing).

---

## Testing & Quality

### Why 806 tests for a portfolio project?

Because the number of tests is the fastest proxy a reviewer has for code quality.

- **420 frontend tests** cover game logic, era progression, save/load, AI integration, aggression slider
- **168 server tests** cover auth, matchmaking, protocol validation, database operations, CORS config
- **218 Rust engine tests** cover move generation, search correctness, perft (position enumeration), tournament runner

A reviewer opens the repo, sees the test count, and immediately knows this isn't a tutorial copy-paste. The actual testing showed real bugs — off-by-one errors in castling rights, en passant square corruption after null moves, ELO calculation edge cases with zero draws.

---

### Why Vitest over Jest?

- **Speed:** Vitest runs in Vite's dev server — no separate compilation step. Tests start in <100ms vs. Jest's 2–5 second startup.
- **ESM native:** The project uses ES modules (`"type": "module"`). Jest's ESM support is experimental and requires `--experimental-vm-modules`. Vitest handles ESM natively.
- **Config sharing:** Vitest reads `vite.config.ts` — path aliases, env variables, and plugins are inherited. Jest needs a separate `babel.config.js` or transform map.
- **API compatible:** `describe`, `it`, `expect`, `vi.fn()` are the same API as Jest. Migration cost is near-zero.

---

### Why k6 over Artillery or Locust?

- **Over Artillery:** k6 scripts are real JavaScript with ES modules. Artillery uses YAML — harder to write conditional logic, custom metrics, or WebSocket game simulations.
- **Over Locust:** Locust is Python. The project is TypeScript/Rust. k6's JavaScript stays in the same language ecosystem.
- **Over JMeter:** XML configuration files. Nobody should have to explain JMeter XML in 2026.

k6 also produces results in Prometheus exposition format — consistent with the server's own metrics. Load test dashboards and server dashboards use the same data format.

---

## Rust & WASM

### Why dual crate types (cdylib + rlib)?

```toml
[lib]
crate-type = ["cdylib", "rlib"]
```

- **`cdylib`:** Required for `wasm-pack` to produce a `.wasm` binary. This is the browser-facing chess engine.
- **`rlib`:** Required for the `bin/tournament.rs` binary to link against the same library code. Without `rlib`, Cargo can't compile native binaries that import from the lib.

This lets one codebase produce two artifacts: a WASM module for browsers and a native binary for tournament simulation. The `#[cfg(not(target_arch = "wasm32"))]` gates keep WASM-incompatible dependencies (rayon, rusqlite) out of the browser build.

---

### Why LTO and opt-level 3?

```toml
[profile.release]
opt-level = 3
lto = true
```

- **`opt-level = 3`:** Maximum compiler optimization. The search function's tight loop (move generation → evaluation → alpha-beta cutoff) benefits from aggressive inlining and vectorization.
- **`lto = true`:** Link-Time Optimization across crate boundaries. The `wasm-bindgen` glue code and the chess engine code get optimized together, eliminating cross-crate call overhead.

**Trade-off:** Release builds take ~30 seconds instead of ~5 seconds. This only matters during development (where `debug` profile is used anyway), not in CI or deployment.

---

### Why a tournament binary in the engine crate?

The tournament binary (`bin/tournament.rs`, 866 lines) serves two purposes:

1. **A/B testing engine changes** — run 1,000 games between two configurations (e.g., different search depths, evaluation weights) and measure win-rate difference with statistical significance. This is how Stockfish development works.

2. **Portfolio artifact** — a Staff+ candidate should show data-driven engineering. "I ran 10,000 AI vs. AI games and this parameter change improved win rate by 3.2% with p < 0.05" is a different conversation than "I think this number should be higher."

The binary uses `rayon` for parallel game execution and `rusqlite` for result persistence. These are gated behind `#[cfg(not(target_arch = "wasm32"))]` so they don't bloat the WASM build.

---

## Trade-offs I'd Change

Transparency about what I'd do differently is as important as defending what I did.

| Decision | What I'd change | Why |
|---|---|---|
| **1,641-line index.html** | Extract into web components or lit-html templates | File navigation becomes painful beyond ~1K lines |
| **CSP disabled in Helmet** | Enable strict CSP with nonces for server responses | Currently `contentSecurityPolicy: false` — CSP is enforced via frontend `<meta>` tag + `vercel.json` headers, not at the server layer |
| **Google Fonts via CDN** | Self-host fonts | Eliminates third-party request, improves privacy, avoids FOUT on slow connections |
| **No refresh tokens** | Add JWT refresh token rotation (httpOnly cookie) + `tokenVersion` column for server-side revocation | Current tokens are purely stateless — no logout, no revocation, no password-change invalidation. Leaked tokens are valid until expiry. Acceptable for a portfolio-scale game with 1-day token TTL; would be a hard blocker for any SaaS or financial app |
| **SQLite in prod** | Keep it, but add Litestream replication | SQLite on a single volume has no backup. A disk failure = data loss |
| **No OpenTelemetry** | Add OTel traces | Metrics tell you *what* is slow. Traces tell you *why*. At multi-service scale, traces are essential |
| **No feature flags** | Add a simple flag system | A/B testing engine changes requires redeployment. In-app flags would allow runtime experimentation |

---

*Last updated: February 2026. Questions? Open an issue or see the [main README](../README.md) for project context.*
