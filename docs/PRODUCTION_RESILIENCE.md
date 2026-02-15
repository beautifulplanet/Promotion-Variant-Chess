# Production Resilience & SLO Documentation

## Service Level Objectives (SLOs)

### Availability
- **Target:** 99.5% uptime (measured monthly)
- **Budget:** ~3.6 hours downtime per month
- **Measurement:** `1 - (failed health checks / total health checks)`

### Latency
| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| `GET /health` | < 10ms | < 50ms | < 200ms |
| `POST /api/auth/*` | < 50ms | < 200ms | < 500ms |
| `GET /api/leaderboard` | < 100ms | < 300ms | < 800ms |
| WebSocket connect | < 200ms | < 1000ms | < 2000ms |
| WebSocket message | < 20ms | < 100ms | < 500ms |

### Throughput
- **HTTP:** 100+ requests/second sustained
- **WebSocket:** 200+ concurrent connections
- **Game rooms:** 500 concurrent games

### Error Rate
- **HTTP:** < 1% 5xx error rate under normal load
- **WebSocket:** < 5% connection failure rate
- **Rate limit false positives:** < 0.1% of legitimate traffic

---

## Defense-in-Depth Architecture

```
Layer 1: Edge (Fly.io Anycast)
├── TLS termination
├── DDoS protection (volumetric)
└── Geographic routing

Layer 2: Application Gateway
├── Helmet.js security headers
│   ├── X-Content-Type-Options: nosniff
│   ├── X-Frame-Options: DENY
│   ├── Strict-Transport-Security
│   ├── X-XSS-Protection
│   └── Referrer-Policy: no-referrer
├── CORS origin whitelist
└── Request body size limit (16KB)

Layer 3: Rate Limiting
├── Global API: 100 req/min per IP (express-rate-limit)
├── Auth endpoints: 10 req/min per IP
├── WebSocket messages: 20 msg/sec per socket
└── Per-IP connection limit: 10 concurrent WS

Layer 4: Input Validation
├── Zod schema validation on all payloads
├── chess.js server-side move validation
├── Room name sanitization
└── Player name length limits

Layer 5: Resource Protection
├── Max 500 game rooms (prevents unbounded memory)
├── 30-second reconnection grace period
├── Automatic room cleanup on disconnect
└── Stale rate-limit entry cleanup (60s interval)

Layer 6: Observability
├── Prometheus metrics (/metrics endpoint)
│   ├── chess_active_connections (gauge)
│   ├── chess_active_games (gauge)
│   ├── chess_ws_messages_total (counter)
│   ├── chess_http_requests_total (counter)
│   ├── chess_game_durations_seconds (histogram)
│   ├── chess_move_validation_errors_total (counter)
│   ├── chess_rate_limit_hits_total (counter)
│   ├── chess_ws_rate_limit_total (counter)
│   ├── chess_shutdown_in_progress (gauge)
│   └── chess_process_crashes_total (counter)
├── Structured console logging (timestamps)
└── Health check endpoint with DB connectivity test

Layer 7: Recovery
├── Graceful shutdown (15s drain on SIGTERM)
│   ├── Stops accepting new connections
│   ├── Sends server_shutdown to all clients
│   ├── Waits for active connections to drain
│   └── Closes DB connection, clears intervals
├── Crash recovery (uncaughtException handler)
│   ├── Logs full error + stack trace
│   ├── Increments crash counter metric
│   └── Exits with code 1 for container restart
├── Unhandled rejection handler (logs, survives)
└── Memory warning at 85% heap utilization
```

---

## Failure Modes & Mitigations

| Failure Mode | Impact | Detection | Mitigation | Recovery Time |
|-------------|--------|-----------|------------|---------------|
| **Server crash** | All games lost | Process exit → container restart | Crash recovery handler logs context; Fly.io auto-restarts | 10-30s |
| **OOM kill** | All games lost | Memory warning at 85% | Room limit (500), connection limit (10/IP) | 10-30s |
| **Database lock** | Auth/leaderboard fail | Prisma error logs | Graceful shutdown drains DB writes | 5-15s |
| **DDoS (HTTP)** | Latency spike | Rate limit counter spike | Rate limiting (100/min), Fly.io edge | Automatic |
| **DDoS (WS)** | Connection exhaustion | Connection gauge spike | Per-IP limit (10), room limit (500) | Automatic |
| **WS message flood** | CPU spike | WS rate limit counter | 20 msg/sec limit, auto-disconnect | Automatic |
| **Deploy** | Brief interruption | Planned | 15s graceful drain, rolling deploy | 15-30s |
| **Fly.io outage** | Full outage | External monitoring | Wait for Fly.io recovery; consider multi-cloud | Variable |
| **DB corruption** | Data loss | Integrity check failure | Recovery from volume snapshot | 5-30m |
| **Bad deploy** | Various | Error rate spike | Rollback to previous release image | 2-5m |

---

## Rate Limiting Configuration

### HTTP Rate Limits (express-rate-limit)

```typescript
// Global API rate limit
const globalLimiter = rateLimit({
  windowMs: 60_000,           // 1 minute window
  max: 100,                    // 100 requests per window per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});
// Applied to: /api/*

// Auth rate limit (stricter)
const authLimiter = rateLimit({
  windowMs: 60_000,           // 1 minute window
  max: 10,                     // 10 auth requests per window per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many auth requests' },
});
// Applied to: /api/auth/*
```

### WebSocket Rate Limits (custom implementation)

```typescript
// Per-socket message rate limit
const WS_RATE_LIMIT = 20;     // messages per second
const WS_RATE_WINDOW = 1000;  // 1-second sliding window

// Per-IP connection limit
const MAX_CONNECTIONS_PER_IP = 10;

// Room limit
const MAX_ROOMS = 500;
```

---

## Monitoring & Alerting Strategy

### Key Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|-------------------|-------------------|--------|
| `chess_active_connections` | > 150 | > 250 | Scale up / investigate |
| `chess_active_games` | > 300 | > 450 | Check room cleanup |
| `chess_rate_limit_hits_total` rate | > 10/min | > 50/min | Possible attack |
| `chess_process_crashes_total` | > 0 | > 3 in 1 hour | Investigate immediately |
| `chess_shutdown_in_progress` | = 1 | — | Expected during deploy |
| Process memory | > 80% | > 90% | Scale memory |
| HTTP error rate (5xx) | > 1% | > 5% | Check logs |
| Health check latency | > 500ms | > 2000ms | Check DB / load |

### Prometheus Queries (for Grafana)

```promql
# Active connections over time
chess_active_connections

# Rate of new games (5m window)
rate(chess_games_created_total[5m])

# Error rate
rate(chess_http_errors_total[5m]) / rate(chess_http_requests_total[5m])

# Rate limit trigger rate
rate(chess_rate_limit_hits_total[5m])

# P95 game duration
histogram_quantile(0.95, rate(chess_game_durations_seconds_bucket[5m]))
```

---

## Graceful Shutdown Sequence

```
SIGTERM received
    │
    ▼
1. Set shutdownInProgress = true
    │
    ▼
2. Stop accepting new HTTP requests (return 503)
    │
    ▼
3. Stop accepting new WebSocket connections
    │
    ▼
4. Send "server_shutdown" message to all connected clients
    │
    ▼
5. Wait for drain (up to 15 seconds)
    │     │
    │     ▼ (if connections drain before timeout)
    │     Close server cleanly
    │
    ▼ (if timeout reached)
6. Force-disconnect remaining sockets
    │
    ▼
7. Run cleanup:
   - Clear all intervals
   - Disconnect Prisma
   - Clear rate-limit maps
    │
    ▼
8. Process exits with code 0
```

---

## Load Testing Results Template

After running the k6 test suite, record results here:

```
Date: YYYY-MM-DD
Environment: [Fly.io production / Local dev]
Server Spec: [shared-cpu-1x 256MB / etc.]

HTTP Load Test:
  - Peak VUs: __
  - Total Requests: __
  - P95 Latency: __ms
  - P99 Latency: __ms
  - Error Rate: __%
  - Rate Limited: __ requests

WebSocket Load Test:
  - Peak Concurrent: __
  - Connection Success: __%
  - Message P95: __ms
  - Errors: __

Stress Test:
  - Breaking Point VU: __
  - Max RPS before degradation: __
  - First failure at: __ VUs

Verdict: [PASS / FAIL / NEEDS SCALING]
```

---

## Future Improvements (Roadmap)

### Near-term
- [ ] Structured JSON logging (replace console.log)
- [ ] Prometheus alerting rules (via Grafana Cloud free tier)
- [ ] SQLite backup via Litestream → S3-compatible storage
- [ ] Health check that includes DB query latency

### Medium-term
- [ ] Circuit breaker pattern for DB operations
- [ ] Request tracing (correlation IDs across WebSocket sessions)
- [ ] Canary deploys (deploy to 1 machine, validate, then roll out)
- [ ] Client-side retry with exponential backoff

### Long-term
- [ ] Multi-region deployment (iad + lhr)
- [ ] Read replicas for leaderboard queries
- [ ] Redis for session state (enable horizontal scaling)
- [ ] Chaos engineering: random container kills in staging
