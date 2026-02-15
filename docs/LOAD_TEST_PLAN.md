# Load Testing Plan

## Overview

This document describes the load testing strategy, tools, scenarios, and SLO targets for the Chess Engine server. Load tests validate that the server can handle expected traffic patterns while maintaining acceptable latency and reliability.

---

## Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **k6** | v0.50+ | Primary load testing framework |
| **Grafana** | Optional | Real-time dashboard for k6 metrics |

### Installation

```bash
# macOS
brew install k6

# Windows (winget)
winget install k6

# Windows (choco)
choco install k6

# Docker
docker run --rm -i grafana/k6 run - < script.js
```

---

## Test Scripts

### 1. HTTP Load Test (`load-tests/http-load-test.js`)

**Purpose:** Validates HTTP API performance under load.

**Scenarios tested:**
- Health check endpoint
- Root endpoint
- Guest authentication (POST with JSON)
- Leaderboard retrieval (GET)
- Prometheus metrics endpoint
- Rate limiter verification

**Traffic pattern:**
```
VUs:  10 ──▶ 50 ──▶ 50 (sustained) ──▶ 100 (spike) ──▶ 100 (sustained) ──▶ 0
Time: 30s    1m     2m                  30s              1m                  30s
```

**Run:**
```bash
k6 run load-tests/http-load-test.js

# Against local server:
BASE_URL=http://localhost:3001 k6 run load-tests/http-load-test.js
```

### 2. WebSocket Load Test (`load-tests/websocket-load-test.js`)

**Purpose:** Simulates concurrent chess players connecting, queuing, and playing.

**Scenarios tested:**
- WebSocket connection establishment
- Queue joining
- Game event handling (game_found, opponent_move, game_over)
- Move submission
- Concurrent connection scaling

**Traffic pattern:**
```
VUs:  10 ──▶ 50 ──▶ 50 ──▶ 100 ──▶ 100 ──▶ 200 ──▶ 200 ──▶ 0
Time: 15s    30s    1m     15s     30s     15s     30s     15s
```

**Run:**
```bash
k6 run load-tests/websocket-load-test.js

# Against local server:
WS_URL=ws://localhost:3001 k6 run load-tests/websocket-load-test.js
```

### 3. Stress Test (`load-tests/stress-test.js`)

**Purpose:** Discovers the server's breaking point by ramping to extreme loads.

**Scenarios tested:**
- HTTP arrival rate ramp to 500 RPS
- WebSocket concurrent connections to 250

**Run:**
```bash
k6 run load-tests/stress-test.js

# Against local server:
BASE_URL=http://localhost:3001 WS_URL=ws://localhost:3001 k6 run load-tests/stress-test.js
```

---

## Service Level Objectives (SLOs)

### HTTP API

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Availability** | 99.5% | `1 - (5xx responses / total responses)` |
| **Latency P95** | < 500ms | 95th percentile response time |
| **Latency P99** | < 1000ms | 99th percentile response time |
| **Error Rate** | < 5% | Rate of non-2xx responses |
| **Health Check P95** | < 200ms | Health endpoint specifically |

### WebSocket

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Connection Success** | > 90% | Successful WS upgrades / total attempts |
| **Connection P95** | < 2000ms | Time to establish WS connection |
| **Message Latency P95** | < 500ms | Time from send to server acknowledgment |
| **Max Concurrent** | 200+ | Connections before degradation |

### Rate Limiting

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Global API Rate** | 100 req/min/IP | Requests before 429 |
| **Auth Rate** | 10 req/min/IP | Auth requests before 429 |
| **WS Message Rate** | 20 msg/sec/socket | Messages before throttle |
| **Connection Limit** | 10/IP | Max WebSocket connections per IP |

---

## Capacity Planning

### Current Infrastructure

| Resource | Spec | Limit |
|----------|------|-------|
| **CPU** | 1x shared vCPU | Burstable |
| **Memory** | 256MB | OOM kill at limit |
| **Storage** | 1GB persistent volume | SQLite DB |
| **Region** | `iad` (Virginia) | Single region |
| **Scaling** | `min_machines_running=0` | Auto-stop/start |

### Estimated Capacity Tiers

| Tier | Concurrent Users | RPS | Config |
|------|-------------------|-----|--------|
| **Current** | ~50-100 | ~50 | shared-cpu-1x, 256MB |
| **Tier 1** | ~200-300 | ~150 | shared-cpu-1x, 512MB |
| **Tier 2** | ~500-1000 | ~300 | performance-1x, 1GB, 2 machines |
| **Tier 3** | ~5000+ | ~1000 | performance-2x, 2GB, auto-scale 2-10 |

### Scaling Commands

```bash
# Tier 1: Increase memory
flyctl scale memory 512 -a chess-server-falling-lake-2071

# Tier 2: Performance CPU + more memory + multiple machines
flyctl scale vm performance-1x -a chess-server-falling-lake-2071
flyctl scale memory 1024 -a chess-server-falling-lake-2071
flyctl scale count 2 -a chess-server-falling-lake-2071

# Tier 3: Full auto-scaling
flyctl autoscale set min=2 max=10 -a chess-server-falling-lake-2071
flyctl scale vm performance-2x -a chess-server-falling-lake-2071
flyctl scale memory 2048 -a chess-server-falling-lake-2071
```

---

## Baseline Results

> Run after each significant change. Record here or in `load-tests/results/`.

### Template

| Date | Test | VUs | Duration | P95 (ms) | P99 (ms) | Error % | Notes |
|------|------|-----|----------|----------|----------|---------|-------|
| YYYY-MM-DD | HTTP Load | 50 | 5m | — | — | — | Baseline |
| YYYY-MM-DD | WS Load | 100 | 4m | — | — | — | Baseline |
| YYYY-MM-DD | Stress | 500 | 5m | — | — | — | Breaking point |

---

## CI Integration (Future)

```yaml
# Example: Run load tests in GitHub Actions after deploy
load-test:
  runs-on: ubuntu-latest
  needs: deploy
  steps:
    - uses: actions/checkout@v4
    - uses: grafana/k6-action@v0.3.1
      with:
        filename: load-tests/http-load-test.js
      env:
        BASE_URL: https://chess-server-falling-lake-2071.fly.dev
    - uses: actions/upload-artifact@v4
      with:
        name: load-test-results
        path: load-tests/results/
```

---

## Running the Full Suite

```bash
# 1. HTTP load test (5 minutes)
k6 run load-tests/http-load-test.js

# 2. WebSocket load test (4 minutes)
k6 run load-tests/websocket-load-test.js

# 3. Stress test — breaking point (5 minutes)
k6 run load-tests/stress-test.js

# Results are saved to load-tests/results/
```
