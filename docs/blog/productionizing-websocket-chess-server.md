# Productionizing a WebSocket Chess Server: From localhost to Fly.io

*How I took a multiplayer chess game from "it works on my machine" to a production deployment with persistent storage, health monitoring, and real-time gameplay — all for $0/month.*

---

## The Starting Point

The Chess Chronicle is a chess variant game built with:
- **Frontend**: TypeScript + Three.js canvas rendering, deployed on Vercel
- **Server**: Node.js + Express + Socket.io for real-time multiplayer
- **Database**: Prisma ORM + SQLite for player accounts, ELO ratings, game history
- **Engine**: Custom Rust chess engine compiled to WebAssembly (bitboards, magic bitboards, alpha-beta search with quiescence)

Everything worked locally. The frontend served from `localhost:5173`, the server on `localhost:3001`, WebSocket connections flowed, games were played. But "works locally" doesn't get you a portfolio piece. Here's the production checklist I worked through.

---

## Decision 1: Why SQLite in Production?

This is controversial. The conventional wisdom is "use PostgreSQL in production." But consider:

- **Traffic**: This is a portfolio project. Peak concurrent users: maybe 5.
- **Complexity**: PostgreSQL means a managed database addon ($), connection pooling, separate migration paths, and different behavior between dev and prod.
- **SQLite is fast**: For read-heavy workloads with low write concurrency, SQLite outperforms PostgreSQL (no network round-trip).

The trade-off: SQLite requires a persistent filesystem. Fly.io provides this via volumes. Railway does not — which is exactly why I chose Fly.io (see [ADR-001](../adr/001-fly-io-over-railway.md)).

```toml
# fly.toml
[mounts]
  source = "chess_data"
  destination = "/data"
```

The DATABASE_URL points to `/data/chess.db`, which survives deploys.

---

## Decision 2: Multi-Stage Docker Build

The Dockerfile uses two stages to keep the production image small:

```dockerfile
# Build stage: compile TypeScript, generate Prisma client
FROM node:20-slim AS builder
# ... npm ci, prisma generate, tsc

# Production stage: only runtime dependencies
FROM node:20-slim AS production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN npm ci --omit=dev
```

Key decisions:
- **`node:20-slim`** over Alpine (Prisma's query engine needs glibc)
- **`openssl`** installed explicitly (Prisma requirement)
- **Prisma client copied from builder** rather than regenerated (saves ~30s in production stage)

---

## Decision 3: WebSocket Configuration

Socket.io needs more than just HTTP. The `fly.toml` configures both an HTTP service (for REST endpoints, health checks) and a raw TCP service (for WebSocket upgrade):

```toml
[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true

[[services]]
  protocol = "tcp"
  internal_port = 3001
```

The concurrency limits (soft: 200, hard: 250) are tuned for WebSocket connections which are long-lived — unlike HTTP requests where you'd set these much higher.

---

## Decision 4: Health Checks and Observability

The server exposes two endpoints:

### `/health` — Liveness + Readiness
```json
{
  "status": "ok",
  "uptime": 3600,
  "database": "connected",
  "activePlayers": 12,
  "activeGames": 3
}
```

This combines liveness (process is running) and readiness (database is connected). Fly.io's TCP check hits this every 15 seconds.

### `/metrics` — Prometheus Format
Using `prom-client`, the server exposes:
- `chess_active_connections` — gauge of WebSocket connections
- `chess_games_total` — counter of games played (by result type)
- `chess_move_duration_seconds` — histogram of move processing time
- Default Node.js metrics (event loop lag, heap usage, GC pauses)

These metrics can be scraped by Grafana Cloud's free tier for dashboards and alerts.

---

## Decision 5: Auto-Stop for Cost Control

```toml
auto_stop_machines = "stop"
auto_start_machines = true
min_machines_running = 1
```

Wait — `min_machines_running = 1` means the machine never stops? Correct. For a chess server, the cold-start penalty (2-3s) would disconnect active WebSocket clients. Since Fly.io's free tier allows one always-on machine, this is the right trade-off. For a less latency-sensitive service, setting `min_machines_running = 0` would further reduce costs.

---

## The Deployment Checklist

Here's the exact sequence to go from zero to production:

```bash
# 1. Install Fly CLI and authenticate
curl -L https://fly.io/install.sh | sh
fly auth login

# 2. Create the app (from server/ directory)
cd server
fly launch --no-deploy

# 3. Create persistent volume for SQLite
fly volumes create chess_data --region iad --size 1

# 4. Set secrets
fly secrets set JWT_SECRET=$(openssl rand -hex 32)

# 5. Deploy
fly deploy

# 6. Verify
curl https://chess-server-falling-lake-2071.fly.dev/health
curl https://chess-server-falling-lake-2071.fly.dev/metrics
```

Total time: ~10 minutes. Total cost: $0.

---

## Lessons Learned

1. **Prisma + SQLite + Docker is tricky.** The Prisma query engine binary must match the production OS. Using the same `node:20-slim` base in both stages avoids architecture mismatches.

2. **Don't overengineer persistence for portfolio projects.** SQLite + a volume is simpler, cheaper, and faster than managed PostgreSQL. Save the Postgres complexity for when you actually need it.

3. **WebSocket servers need TCP service config.** Most PaaS platforms (Vercel, Netlify, Cloudflare Workers) don't support long-lived connections. Fly.io and Railway do, but only Fly.io gives you direct TCP service configuration.

4. **Health checks should include dependency status.** A `/health` that returns `200 OK` but doesn't check the database connection is lying. Include `database: "connected"` so your orchestrator knows the truth.

5. **Instrument from day one.** Adding Prometheus metrics after the fact is painful. Adding them in the initial server setup (with `prom-client`) takes 20 lines of code and gives you production visibility forever.

---

## What's Next

- **Grafana Cloud dashboard** — Free tier scrapes the `/metrics` endpoint every 60s
- **Mobile PWA** — Already implemented with service worker + manifest
- **Android APK** — Using Bubblewrap/TWA to wrap the PWA for Play Store

---

*The Chess Chronicle is open source at [github.com/beautifulplanet/Promotion-Variant-Chess](https://github.com/beautifulplanet/Promotion-Variant-Chess).*
