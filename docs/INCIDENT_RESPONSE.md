# Incident Response Runbook

## Overview

This document provides step-by-step procedures for responding to production incidents for the Chess Engine server (`chess-server-falling-lake-2071.fly.dev`).

---

## Severity Levels

| Level | Name | Description | Response Time | Examples |
|-------|------|-------------|---------------|---------|
| **P0** | Critical | Complete outage, data loss | < 15 min | Server unreachable, DB corruption |
| **P1** | Major | Degraded service, partial outage | < 1 hour | High error rates, WS drops |
| **P2** | Minor | Non-critical feature broken | < 4 hours | Leaderboard slow, auth issues |
| **P3** | Low | Cosmetic / minor bug | Next business day | Metrics gap, logging issue |

---

## Diagnostic Commands

### Quick Health Check
```bash
# HTTP health endpoint
curl -w "\n%{http_code} %{time_total}s" https://chess-server-falling-lake-2071.fly.dev/health

# Check Fly.io machine status
flyctl status -a chess-server-falling-lake-2071

# View recent logs (last 100 lines)
flyctl logs -a chess-server-falling-lake-2071 --count 100

# Check machine resource usage
flyctl machine status -a chess-server-falling-lake-2071
```

### Prometheus Metrics
```bash
# Scrape all metrics
curl https://chess-server-falling-lake-2071.fly.dev/metrics

# Key metrics to check:
# chess_active_connections   — Current WebSocket connections
# chess_active_games         — Current game rooms
# chess_ws_messages_total    — Message throughput
# chess_http_requests_total  — HTTP request count
# chess_rate_limit_hits_total — Rate limiting events
# chess_process_crashes_total — Crash recovery events
```

---

## Incident Procedures

### 1. Server Unreachable (P0)

**Symptoms:** Health check returns non-200 or times out. Users see "Server unavailable."

**Steps:**
1. Verify it's a server issue, not DNS/CDN:
   ```bash
   dig chess-server-falling-lake-2071.fly.dev
   curl -v https://chess-server-falling-lake-2071.fly.dev/health
   ```
2. Check Fly.io machine status:
   ```bash
   flyctl status -a chess-server-falling-lake-2071
   flyctl machine list -a chess-server-falling-lake-2071
   ```
3. If machine is stopped (auto-stop is enabled with `min_machines_running=0`):
   ```bash
   # The health check request should auto-start the machine
   # If not, manually start:
   flyctl machine start <machine-id> -a chess-server-falling-lake-2071
   ```
4. If machine is running but unresponsive:
   ```bash
   # Check logs for crash loop or OOM
   flyctl logs -a chess-server-falling-lake-2071 --count 200
   
   # Restart the machine
   flyctl machine restart <machine-id> -a chess-server-falling-lake-2071
   ```
5. If persistent failure:
   ```bash
   # Redeploy from latest image
   flyctl deploy -a chess-server-falling-lake-2071
   ```

### 2. High Error Rate (P1)

**Symptoms:** > 5% of requests returning 5xx. Prometheus shows elevated `chess_http_errors_total`.

**Steps:**
1. Check error logs:
   ```bash
   flyctl logs -a chess-server-falling-lake-2071 --count 200 | grep -i "error\|exception\|fatal"
   ```
2. Check rate limiting metrics:
   ```bash
   curl -s https://chess-server-falling-lake-2071.fly.dev/metrics | grep rate_limit
   ```
3. If rate limiter is aggressively blocking legitimate traffic:
   - Consider temporarily increasing limits in environment variables
   - `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` control HTTP limits
4. Check for database lock or corruption:
   ```bash
   flyctl ssh console -a chess-server-falling-lake-2071
   # Inside the machine:
   ls -la /data/chess.db*
   sqlite3 /data/chess.db "PRAGMA integrity_check;"
   ```
5. If DB is locked, the graceful shutdown handler should handle it. If not:
   ```bash
   flyctl machine restart <machine-id> -a chess-server-falling-lake-2071
   ```

### 3. WebSocket Connection Storms (P1)

**Symptoms:** Sudden spike in `chess_active_connections`. Server latency increases. Memory usage spikes.

**Steps:**
1. Check connection metrics:
   ```bash
   curl -s https://chess-server-falling-lake-2071.fly.dev/metrics | grep -E "connections|rooms"
   ```
2. The server has built-in protections:
   - **Per-IP connection limit:** Max 10 connections per IP address
   - **Room limit:** Max 500 game rooms
   - **WS message rate limit:** 20 messages/second per socket
3. If protections are insufficient:
   ```bash
   # Check which IPs have most connections
   flyctl logs -a chess-server-falling-lake-2071 | grep "client connected"
   ```
4. If under DDoS, consider Fly.io's built-in DDoS protection or adding Cloudflare.

### 4. Memory Exhaustion (P1)

**Symptoms:** Server becomes sluggish, then crashes. Logs show "Memory usage warning" or OOM kill.

**Steps:**
1. Check memory:
   ```bash
   flyctl machine status <machine-id> -a chess-server-falling-lake-2071
   ```
2. The crash recovery handler (`setupCrashRecovery` in `resilience.ts`) monitors memory and logs warnings at 85% utilization.
3. If chronic:
   - Check for connection/room leaks in metrics
   - Review `chess_active_connections` and `chess_active_games` for monotonic increase
   - Consider scaling the machine:
     ```bash
     flyctl scale memory 512 -a chess-server-falling-lake-2071  # 512MB
     # or
     flyctl scale memory 1024 -a chess-server-falling-lake-2071 # 1GB
     ```

### 5. Database Issues (P2)

**Symptoms:** Auth failures, leaderboard not updating, game history lost.

**Steps:**
1. SSH into the machine and check DB:
   ```bash
   flyctl ssh console -a chess-server-falling-lake-2071
   sqlite3 /data/chess.db "PRAGMA integrity_check;"
   sqlite3 /data/chess.db "SELECT count(*) FROM User;"
   sqlite3 /data/chess.db "SELECT count(*) FROM GameRecord;"
   ```
2. If DB is corrupted:
   ```bash
   # The volume has the DB file — check for WAL/journal
   ls -la /data/chess.db*
   
   # Try recovery
   sqlite3 /data/chess.db ".recover" | sqlite3 /data/chess_recovered.db
   mv /data/chess.db /data/chess.db.corrupted
   mv /data/chess_recovered.db /data/chess.db
   
   # Restart to re-initialize Prisma
   flyctl machine restart <machine-id> -a chess-server-falling-lake-2071
   ```

### 6. Rate Limiting False Positives (P2)

**Symptoms:** Legitimate users getting 429 responses. `chess_rate_limit_hits_total` elevated.

**Steps:**
1. Check current rate limit configuration (in `index.ts`):
   - Global API: 100 requests per minute per IP
   - Auth endpoints: 10 requests per minute per IP
   - WebSocket messages: 20 per second per socket
2. If limits are too aggressive:
   - Update environment variables or code and redeploy
   - Monitor after change with: `curl -s .../metrics | grep rate_limit`

---

## Deployment Rollback

If a bad deploy causes issues:

```bash
# List recent deployments
flyctl releases -a chess-server-falling-lake-2071

# Rollback to previous image
flyctl deploy --image <previous-image-ref> -a chess-server-falling-lake-2071
```

The graceful shutdown handler ensures active games get a `server_shutdown` message before the old instance terminates, giving the 15-second drain window.

---

## Post-Incident

After resolving any P0 or P1 incident:

1. **Document:** What happened, when, duration, impact, root cause
2. **Metrics:** Save relevant Prometheus snapshots
3. **Prevention:** Identify what monitoring/alerting would have caught this earlier
4. **Code:** If a code fix was needed, PR with tests
5. **Review:** Update this runbook if new scenarios were discovered

---

## Key Contacts

| Role | Contact |
|------|---------|
| Fly.io Dashboard | https://fly.io/apps/chess-server-falling-lake-2071 |
| GitHub Repo | https://github.com/beautifulplanet/Promotion-Variant-Chess |
| Vercel Frontend | https://promotion-variant-chess.vercel.app |
| Fly.io Status | https://status.flyio.net |

---

## Architecture Quick Reference

```
                    ┌──────────────┐
                    │   Vercel     │
                    │  (Frontend)  │
                    │  Static SPA  │
                    └──────┬───────┘
                           │ HTTPS / WSS
                    ┌──────▼───────┐
                    │   Fly.io     │
                    │  (Backend)   │
                    │  Express +   │
                    │  Socket.io   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  SQLite DB   │
                    │  (1GB Vol)   │
                    └──────────────┘

Protection Layers:
  1. Fly.io Edge → DDoS / TLS termination
  2. Helmet → Security headers
  3. express-rate-limit → HTTP rate limiting (100/min global, 10/min auth)
  4. Per-IP connection limit → Max 10 WS connections per IP
  5. WS message rate limit → 20 msg/sec per socket
  6. Room limit → Max 500 concurrent games
  7. Graceful shutdown → 15s drain on SIGTERM
  8. Crash recovery → Logs + metrics on uncaught exceptions
```
