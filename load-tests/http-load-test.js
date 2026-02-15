// =============================================================================
// k6 Load Test — HTTP API Endpoints
// =============================================================================
// Tests the REST API under load: health, auth, leaderboard.
// Validates response times, error rates, and rate limiting behavior.
//
// Prerequisites:
//   brew install k6    (macOS)
//   choco install k6   (Windows)
//   apt install k6     (Ubuntu)
//
// Usage:
//   k6 run load-tests/http-load-test.js
//   k6 run --vus 50 --duration 60s load-tests/http-load-test.js
//   k6 run --out json=results.json load-tests/http-load-test.js
// =============================================================================

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'https://chess-server-falling-lake-2071.fly.dev';

export const options = {
  // Ramp-up pattern: simulate realistic traffic growth
  stages: [
    { duration: '30s', target: 10 },   // Warm-up: 0 → 10 users
    { duration: '1m',  target: 50 },   // Ramp: 10 → 50 users
    { duration: '2m',  target: 50 },   // Sustained: hold 50 users
    { duration: '30s', target: 100 },  // Spike: 50 → 100 users
    { duration: '1m',  target: 100 },  // Sustained spike: hold 100
    { duration: '30s', target: 0 },    // Cool-down: 100 → 0
  ],

  thresholds: {
    // SLOs — Service Level Objectives
    http_req_duration: [
      'p(95) < 500',    // 95th percentile < 500ms
      'p(99) < 1000',   // 99th percentile < 1s
    ],
    http_req_failed: ['rate < 0.05'],        // Error rate < 5%
    'health_check_duration': ['p(95) < 200'],
    'auth_duration': ['p(95) < 800'],
    'rate_limit_triggered': ['count > 0'],   // Verify rate limiting works
  },
};

// =============================================================================
// CUSTOM METRICS
// =============================================================================

const healthCheckDuration = new Trend('health_check_duration');
const authDuration = new Trend('auth_duration');
const rateLimitTriggered = new Counter('rate_limit_triggered');
const successfulRegistrations = new Counter('successful_registrations');
const authErrors = new Rate('auth_error_rate');

// =============================================================================
// TEST SCENARIOS
// =============================================================================

export default function () {
  // Scenario 1: Health check (lightweight, high frequency)
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}/health`);
    healthCheckDuration.add(res.timings.duration);

    check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: has status field': (r) => {
        const body = JSON.parse(r.body);
        return body.status === 'ok';
      },
      'health: has uptime': (r) => {
        const body = JSON.parse(r.body);
        return typeof body.uptime === 'number';
      },
      'health: has database status': (r) => {
        const body = JSON.parse(r.body);
        return body.database === 'connected' || body.database === 'disconnected';
      },
      'health: response < 200ms': (r) => r.timings.duration < 200,
    });
  });

  sleep(0.5);

  // Scenario 2: Root endpoint (API directory)
  group('Root Endpoint', function () {
    const res = http.get(`${BASE_URL}/`);
    check(res, {
      'root: status 200': (r) => r.status === 200,
      'root: has endpoints': (r) => {
        const body = JSON.parse(r.body);
        return body.endpoints && body.endpoints.health;
      },
    });
  });

  sleep(0.3);

  // Scenario 3: Guest registration (moderate load)
  group('Guest Auth', function () {
    const guestName = `LoadTest_${__VU}_${__ITER}_${Date.now()}`;
    const res = http.post(
      `${BASE_URL}/api/auth/guest`,
      JSON.stringify({ name: guestName }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    authDuration.add(res.timings.duration);

    const isSuccess = res.status === 201;
    const isRateLimited = res.status === 429;
    const isConflict = res.status === 409;

    if (isRateLimited) {
      rateLimitTriggered.add(1);
    }
    if (isSuccess) {
      successfulRegistrations.add(1);
    }
    authErrors.add(!isSuccess && !isRateLimited && !isConflict);

    check(res, {
      'guest: status 201 or 429': (r) => r.status === 201 || r.status === 429,
      'guest: has token on success': (r) => {
        if (r.status !== 201) return true; // Skip check if rate limited
        const body = JSON.parse(r.body);
        return typeof body.token === 'string' && body.token.length > 0;
      },
      'guest: response < 800ms': (r) => r.timings.duration < 800,
    });
  });

  sleep(1);

  // Scenario 4: Leaderboard (read-heavy)
  group('Leaderboard', function () {
    const res = http.get(`${BASE_URL}/api/leaderboard`);
    check(res, {
      'leaderboard: status 200': (r) => r.status === 200,
      'leaderboard: is array': (r) => {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      },
      'leaderboard: response < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(0.5);

  // Scenario 5: Metrics endpoint (Prometheus scrape simulation)
  group('Metrics', function () {
    const res = http.get(`${BASE_URL}/metrics`);
    check(res, {
      'metrics: status 200': (r) => r.status === 200,
      'metrics: has chess_ prefix': (r) => r.body.includes('chess_'),
      'metrics: has connected_players': (r) => r.body.includes('chess_connected_players'),
    });
  });

  sleep(0.5);

  // Scenario 6: Rate limit verification (burst 15 requests rapidly)
  if (__ITER === 0) {
    group('Rate Limit Test', function () {
      let rateLimitHit = false;
      for (let i = 0; i < 15; i++) {
        const res = http.post(
          `${BASE_URL}/api/auth/guest`,
          JSON.stringify({ name: `RateTest_${__VU}_${i}_${Date.now()}` }),
          { headers: { 'Content-Type': 'application/json' } }
        );
        if (res.status === 429) {
          rateLimitHit = true;
          rateLimitTriggered.add(1);
          break;
        }
      }
      check(null, {
        'rate-limit: triggered on burst': () => rateLimitHit,
      });
    });
  }

  sleep(1);
}

// =============================================================================
// SUMMARY HANDLER — Custom output
// =============================================================================

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 'N/A';
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 'N/A';
  const errRate = data.metrics.http_req_failed?.values?.rate || 0;
  const totalReqs = data.metrics.http_reqs?.values?.count || 0;

  const summary = `
╔══════════════════════════════════════════════════════╗
║   CHESS SERVER — HTTP LOAD TEST RESULTS             ║
╚══════════════════════════════════════════════════════╝

  Total Requests:     ${totalReqs}
  P95 Latency:        ${typeof p95 === 'number' ? p95.toFixed(1) : p95}ms
  P99 Latency:        ${typeof p99 === 'number' ? p99.toFixed(1) : p99}ms
  Error Rate:         ${(errRate * 100).toFixed(2)}%

  SLO Status:
    P95 < 500ms:      ${p95 < 500 ? '✅ PASS' : '❌ FAIL'}
    P99 < 1000ms:     ${p99 < 1000 ? '✅ PASS' : '❌ FAIL'}
    Error Rate < 5%:  ${errRate < 0.05 ? '✅ PASS' : '❌ FAIL'}
`;
  console.log(summary);

  return {
    'load-tests/results/http-results.json': JSON.stringify(data, null, 2),
  };
}
