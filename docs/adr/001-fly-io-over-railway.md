# ADR-001: Fly.io over Railway for Server Deployment

**Status:** Accepted  
**Date:** 2025-06-20  
**Decision Makers:** Project Owner

---

## Context

The Chess Chronicle multiplayer server (Node.js + Express + Socket.io + Prisma/SQLite) needs a production host that supports:

1. **WebSocket connections** — Socket.io requires long-lived TCP connections for real-time gameplay
2. **Persistent storage** — SQLite database needs a mounted volume that survives deploys
3. **Low latency** — Chess games are latency-sensitive; sub-100ms round-trip matters
4. **Docker support** — Multi-stage Dockerfile already exists
5. **Free/cheap tier** — Portfolio project with minimal traffic

## Options Considered

### 1. Fly.io (Selected)

- **Pros:**
  - First-class WebSocket support via TCP services
  - Persistent volumes for SQLite (`fly volumes create`)
  - Edge deployment in 30+ regions (chose `iad` — US East)
  - Docker-native — deploys any Dockerfile
  - Generous free tier: 3 shared-cpu-1x VMs, 1 GB persistent volume
  - `fly.toml` is declarative and version-controlled
  - Auto-stop/start machines to save resources
  - Built-in health checks and metrics

- **Cons:**
  - SQLite on a single node (no horizontal scaling)
  - Cold start ~2-3s when machine auto-starts
  - CLI-driven workflow (no web dashboard for deploys)

### 2. Railway

- **Pros:**
  - GitHub-connected auto-deploy
  - Nice web dashboard
  - Managed PostgreSQL addon
  - WebSocket support

- **Cons:**
  - **No persistent volumes** — SQLite would lose data on every deploy
  - Forces PostgreSQL for persistence (adds complexity)
  - $5/month minimum after trial ($5 credit/month)
  - Less control over networking (no raw TCP service config)
  - WebSocket configuration is implicit, less tunable

### 3. Render

- **Pros:**
  - Free tier for web services
  - Managed PostgreSQL

- **Cons:**
  - Free tier sleeps after 15 min inactivity (~30s cold start)
  - No persistent disk on free tier
  - WebSocket support is basic (no TCP service config)

### 4. Vercel (already used for frontend)

- **Cons:**
  - Serverless — no WebSocket support
  - No persistent processes
  - Not suitable for stateful game servers

## Decision

**Fly.io** because:

1. **WebSocket-native**: The `[[services]]` TCP block in `fly.toml` maps directly to Socket.io's transport needs. Railway's WebSocket support works but offers no equivalent configuration surface.

2. **SQLite + Volumes**: A 1 GB persistent volume (`chess_data` mounted at `/data`) lets us keep SQLite in production. This avoids adding PostgreSQL complexity for a single-instance portfolio server. Railway has no volume support — switching to PostgreSQL would mean rewriting migrations, adding a managed DB addon, and changing the test setup.

3. **Cost**: Fly.io's free tier covers this project entirely (1 shared-cpu-1x VM, 512 MB RAM, 1 GB volume). Railway's $5/month credit expires and then bills.

4. **Docker parity**: The same `Dockerfile` builds locally and on Fly. Railway also supports Docker but defaults to Nixpacks, adding an abstraction layer.

## Consequences

- **Positive:** Zero-cost hosting, SQLite consistency between dev and prod, sub-50ms latency for US East users
- **Negative:** Single-node limitation means no horizontal scaling (acceptable for portfolio traffic)
- **Risk:** If Fly.io changes free tier, migration to Railway + PostgreSQL is straightforward (schema already has PostgreSQL docker-compose config)

## References

- [Fly.io Volumes](https://fly.io/docs/volumes/)
- [Fly.io WebSocket docs](https://fly.io/docs/networking/services/#tcp-services)
- [Railway limitations](https://docs.railway.app/reference/limits)
- Project: `server/fly.toml`, `server/Dockerfile`
