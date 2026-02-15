// =============================================================================
// k6 Load Test — Stress Test (Breaking Point Discovery)
// =============================================================================
// Pushes the server to its limits to discover the breaking point.
// Ramps up connections until failures start occurring, then documents
// the maximum capacity.
//
// Usage:
//   k6 run load-tests/stress-test.js
//   K6_CLOUD=true k6 run load-tests/stress-test.js
// =============================================================================

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://chess-server-falling-lake-2071.fly.dev';
const WS_URL = __ENV.WS_URL || 'wss://chess-server-falling-lake-2071.fly.dev';

// =============================================================================
// STRESS PROFILE — Ramp to breaking point
// =============================================================================

export const options = {
  scenarios: {
    // Scenario 1: HTTP stress — ramp to 500 RPS
    http_stress: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: '30s', target: 50 },    // Warm: 50 RPS
        { duration: '1m',  target: 100 },   // Medium: 100 RPS
        { duration: '1m',  target: 200 },   // High: 200 RPS
        { duration: '30s', target: 500 },   // Extreme: 500 RPS
        { duration: '30s', target: 500 },   // Hold extreme
        { duration: '30s', target: 0 },     // Cool-down
      ],
      exec: 'httpStress',
    },

    // Scenario 2: WebSocket storm — 250 concurrent connections
    ws_storm: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 25 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 175 },
        { duration: '30s', target: 250 },   // Max concurrent WS connections
        { duration: '30s', target: 250 },   // Hold
        { duration: '15s', target: 0 },     // Drop all at once (thundering herd)
      ],
      exec: 'wsStorm',
    },
  },

  thresholds: {
    // At this level, we EXPECT some failures — we're looking for the ceiling
    'http_req_duration{scenario:http_stress}': ['p(95) < 2000'],
    'http_req_failed{scenario:http_stress}': ['rate < 0.20'],  // <20% error rate
    'stress_first_failure_vus': ['value > 0'],
  },
};

// =============================================================================
// METRICS
// =============================================================================

const stressErrors = new Counter('stress_errors');
const stressTimeouts = new Counter('stress_timeouts');
const stress429s = new Counter('stress_429_responses');
const stressFirstFailure = new Trend('stress_first_failure_vus');
let firstFailureLogged = false;

// =============================================================================
// HTTP STRESS SCENARIO
// =============================================================================

export function httpStress() {
  // Rapid-fire health checks
  const healthRes = http.get(`${BASE_URL}/health`, { timeout: '5s' });
  if (healthRes.status !== 200) {
    stressErrors.add(1);
    if (!firstFailureLogged) {
      stressFirstFailure.add(__VU);
      firstFailureLogged = true;
    }
  }
  if (healthRes.status === 429) stress429s.add(1);
  if (healthRes.timings.duration > 5000) stressTimeouts.add(1);

  check(healthRes, {
    'stress-http: responded': (r) => r.status > 0,
  });

  sleep(0.1);
}

// =============================================================================
// WEBSOCKET STORM SCENARIO
// =============================================================================

export function wsStorm() {
  const res = ws.connect(WS_URL, {}, function (socket) {
    socket.on('message', function () {
      // Just consume messages, don't process
    });

    socket.on('error', function () {
      stressErrors.add(1);
    });

    // Join queue to create server-side state
    socket.send(JSON.stringify({
      type: 'join_queue',
      playerName: `StressBot_${__VU}`,
      elo: 1200,
    }));

    // Hold connection for test duration
    sleep(15 + Math.random() * 15);

    socket.close();
  });

  if (!res || res.status !== 101) {
    stressErrors.add(1);
    if (!firstFailureLogged) {
      stressFirstFailure.add(__VU);
      firstFailureLogged = true;
    }
  }
}

// =============================================================================
// SUMMARY
// =============================================================================

export function handleSummary(data) {
  const httpErrors = data.metrics['http_req_failed']?.values?.rate || 0;
  const httpP95 = data.metrics['http_req_duration']?.values?.['p(95)'] || 'N/A';
  const totalReqs = data.metrics['http_reqs']?.values?.count || 0;
  const errors = data.metrics['stress_errors']?.values?.count || 0;
  const timeouts = data.metrics['stress_timeouts']?.values?.count || 0;
  const rateLimited = data.metrics['stress_429_responses']?.values?.count || 0;

  const summary = `
╔══════════════════════════════════════════════════════╗
║   CHESS SERVER — STRESS TEST RESULTS                ║
║   (Breaking Point Discovery)                        ║
╚══════════════════════════════════════════════════════╝

  Total HTTP Requests:  ${totalReqs}
  HTTP P95 Latency:     ${typeof httpP95 === 'number' ? httpP95.toFixed(0) : httpP95}ms
  HTTP Error Rate:      ${(httpErrors * 100).toFixed(1)}%
  Total Errors:         ${errors}
  Timeouts (>5s):       ${timeouts}
  Rate Limited (429):   ${rateLimited}

  CAPACITY ANALYSIS:
    Server handles ~${totalReqs > 0 ? Math.round(totalReqs / 4 / 60) : '?'} RPS sustained
    First failure at VU: ${data.metrics['stress_first_failure_vus']?.values?.min || 'None'}
    Rate limiter working: ${rateLimited > 0 ? '✅ Yes' : '⚠️  Not triggered'}
`;
  console.log(summary);

  return {
    'load-tests/results/stress-results.json': JSON.stringify(data, null, 2),
  };
}
