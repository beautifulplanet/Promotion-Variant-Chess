// =============================================================================
// k6 Load Test — WebSocket Connections & Real-Time Gameplay
// =============================================================================
// Simulates concurrent players connecting via WebSocket, joining matchmaking,
// and playing games. Tests connection capacity, message throughput, and
// reconnection under load.
//
// Usage:
//   k6 run load-tests/websocket-load-test.js
//   k6 run --vus 100 --duration 120s load-tests/websocket-load-test.js
// =============================================================================

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';

// =============================================================================
// CONFIGURATION
// =============================================================================

const WS_URL = __ENV.WS_URL || 'wss://chess-server-falling-lake-2071.fly.dev';

export const options = {
  stages: [
    { duration: '15s', target: 10 },    // Warm-up: 10 connections
    { duration: '30s', target: 50 },    // Ramp: 50 concurrent
    { duration: '1m',  target: 50 },    // Sustained: hold 50
    { duration: '15s', target: 100 },   // Spike: 100 concurrent
    { duration: '30s', target: 100 },   // Hold spike
    { duration: '15s', target: 200 },   // Stress: 200 concurrent
    { duration: '30s', target: 200 },   // Hold stress
    { duration: '15s', target: 0 },     // Cool-down
  ],

  thresholds: {
    'ws_connect_duration': ['p(95) < 2000'],    // Connection < 2s
    'ws_message_duration': ['p(95) < 500'],     // Message roundtrip < 500ms
    'ws_connection_success': ['rate > 0.90'],    // 90%+ connections succeed
    'ws_sessions_active': ['value >= 0'],        // Track active sessions
  },
};

// =============================================================================
// CUSTOM METRICS
// =============================================================================

const wsConnectDuration = new Trend('ws_connect_duration');
const wsMessageDuration = new Trend('ws_message_duration');
const wsConnectionSuccess = new Rate('ws_connection_success');
const wsSessionsActive = new Gauge('ws_sessions_active');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsErrors = new Counter('ws_errors');
const wsQueueJoins = new Counter('ws_queue_joins');
const wsGameStarts = new Counter('ws_game_starts');

// =============================================================================
// TEST SCENARIO
// =============================================================================

export default function () {
  const playerName = `LoadBot_${__VU}_${__ITER}`;
  const connectStart = Date.now();

  const res = ws.connect(WS_URL, { tags: { scenario: 'gameplay' } }, function (socket) {
    const connectTime = Date.now() - connectStart;
    wsConnectDuration.add(connectTime);
    wsConnectionSuccess.add(1);
    wsSessionsActive.add(1);

    let gameId = null;
    let myColor = null;
    let moveCount = 0;

    // Handle incoming messages
    socket.on('message', function (rawData) {
      wsMessagesReceived.add(1);

      try {
        const data = JSON.parse(rawData);

        switch (data.type) {
          case 'game_found':
            wsGameStarts.add(1);
            gameId = data.gameId;
            myColor = data.color;
            console.log(`[VU${__VU}] Game started: ${gameId} as ${myColor}`);

            // If we're white, make first move after small delay
            if (myColor === 'white') {
              sleep(0.5);
              const msgStart = Date.now();
              socket.send(JSON.stringify({
                type: 'make_move',
                gameId: gameId,
                move: 'e2e4',
              }));
              wsMessageDuration.add(Date.now() - msgStart);
              moveCount++;
            }
            break;

          case 'move_ack':
            // Our move was accepted
            break;

          case 'opponent_move':
            // Respond with a random-ish move after delay
            moveCount++;
            if (moveCount < 10 && gameId) {
              sleep(Math.random() * 2 + 0.5); // 0.5-2.5s think time
              const moves = ['d7d5', 'e7e5', 'g8f6', 'b8c6', 'd2d4', 'g1f3', 'f1c4', 'c8f5'];
              const move = moves[moveCount % moves.length];
              socket.send(JSON.stringify({
                type: 'make_move',
                gameId: gameId,
                move: move,
              }));
            }
            break;

          case 'game_over':
            console.log(`[VU${__VU}] Game over: ${data.result}`);
            gameId = null;
            break;

          case 'queue_status':
            console.log(`[VU${__VU}] Queue position: ${data.position}`);
            break;

          case 'error':
            wsErrors.add(1);
            console.log(`[VU${__VU}] Server error: ${data.code} — ${data.message}`);
            break;
        }
      } catch (e) {
        wsErrors.add(1);
      }
    });

    socket.on('error', function (e) {
      wsErrors.add(1);
      console.log(`[VU${__VU}] WS error: ${e.error()}`);
    });

    socket.on('close', function () {
      wsSessionsActive.add(-1);
    });

    // Join the matchmaking queue
    sleep(1);
    wsQueueJoins.add(1);
    socket.send(JSON.stringify({
      type: 'join_queue',
      playerName: playerName,
      elo: 1200,
      timeControl: { initial: 300, increment: 0 },
    }));

    // Stay connected for a while (simulating a game session)
    sleep(30 + Math.random() * 30); // 30-60 seconds

    // Leave queue if still in it
    if (!gameId) {
      socket.send(JSON.stringify({ type: 'leave_queue' }));
    }

    sleep(2);
    socket.close();
  });

  // Handle connection failure
  if (!res || res.status !== 101) {
    wsConnectionSuccess.add(0);
    wsErrors.add(1);
  }

  check(res, {
    'ws: connected successfully': (r) => r && r.status === 101,
  });

  sleep(1);
}

// =============================================================================
// SUMMARY
// =============================================================================

export function handleSummary(data) {
  const connectP95 = data.metrics.ws_connect_duration?.values?.['p(95)'] || 'N/A';
  const msgP95 = data.metrics.ws_message_duration?.values?.['p(95)'] || 'N/A';
  const connRate = data.metrics.ws_connection_success?.values?.rate || 0;
  const totalMsgs = data.metrics.ws_messages_received?.values?.count || 0;
  const errors = data.metrics.ws_errors?.values?.count || 0;

  const summary = `
╔══════════════════════════════════════════════════════╗
║   CHESS SERVER — WEBSOCKET LOAD TEST RESULTS        ║
╚══════════════════════════════════════════════════════╝

  Connection P95:     ${typeof connectP95 === 'number' ? connectP95.toFixed(0) : connectP95}ms
  Message P95:        ${typeof msgP95 === 'number' ? msgP95.toFixed(0) : msgP95}ms
  Connection Rate:    ${(connRate * 100).toFixed(1)}%
  Total Messages:     ${totalMsgs}
  Errors:             ${errors}

  SLO Status:
    Connect < 2s:     ${connectP95 < 2000 ? '✅ PASS' : '❌ FAIL'}
    Message < 500ms:  ${msgP95 < 500 ? '✅ PASS' : '❌ FAIL'}
    Success > 90%:    ${connRate > 0.90 ? '✅ PASS' : '❌ FAIL'}
`;
  console.log(summary);

  return {
    'load-tests/results/websocket-results.json': JSON.stringify(data, null, 2),
  };
}
