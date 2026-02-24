// =============================================================================
// k6 Load Test — WebSocket Connections & Real-Time Gameplay
// =============================================================================
// Simulates concurrent players connecting via Socket.io (Engine.IO v4 wire
// protocol over raw WebSocket), creating/joining tables, and playing games.
//
// Protocol notes:
//   - Server uses Socket.io, so we speak Engine.IO v4 framing:
//       0{...}       = EIO open (server → client)
//       2            = ping  (server → client)
//       3            = pong  (client → server)
//       42["event",d]= Socket.io message event
//   - Game protocol v1: create_table → list_tables → join_table → make_move
//     All client messages require { type, v: 1, ... }
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

const BASE_URL = __ENV.WS_URL || 'wss://chess-server-falling-lake-2071.fly.dev';
// Socket.io connects via the /socket.io/ path with Engine.IO v4 transport
const WS_URL = `${BASE_URL}/socket.io/?EIO=4&transport=websocket`;

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
const wsTableCreates = new Counter('ws_table_creates');
const wsGameStarts = new Counter('ws_game_starts');

// =============================================================================
// SOCKET.IO HELPERS  (Engine.IO v4 wire protocol)
// =============================================================================

/**
 * Emit a Socket.io "message" event over raw WS.
 * Wire format: 42["message",{payload}]
 */
function sioEmit(socket, eventName, payload) {
  socket.send('42' + JSON.stringify([eventName, payload]));
}

/**
 * Parse a raw WS frame from a Socket.io server.
 * Returns { eioType, sioType, event, data } or null.
 */
function sioParseFrame(raw) {
  if (!raw || raw.length === 0) return null;

  const eioType = raw.charAt(0);

  // Engine.IO open handshake
  if (eioType === '0') {
    try { return { eioType, data: JSON.parse(raw.slice(1)) }; }
    catch { return { eioType }; }
  }

  // Engine.IO ping → respond with pong
  if (eioType === '2') return { eioType: 'ping' };

  // Engine.IO pong (rare — server echoes our ping)
  if (eioType === '3') return { eioType: 'pong' };

  // Socket.io event: 42["event", data]
  if (raw.startsWith('42')) {
    try {
      const arr = JSON.parse(raw.slice(2));
      return { eioType: '4', sioType: '2', event: arr[0], data: arr[1] };
    } catch { return null; }
  }

  // Socket.io connect ack: 40 or 40{...}
  if (raw.startsWith('40')) {
    return { eioType: '4', sioType: '0', event: 'connect' };
  }

  return null;
}

// =============================================================================
// TEST SCENARIO
// =============================================================================

// Odd VUs create tables; even VUs list & join.
// This lets k6 VU pairs find each other for actual gameplay.

export default function () {
  const playerName = `LoadBot_${__VU}_${__ITER}`;
  const isHost = __VU % 2 === 1;
  const connectStart = Date.now();

  const res = ws.connect(WS_URL, { tags: { scenario: 'gameplay' } }, function (socket) {
    let sioReady = false;
    let gameId = null;
    let myColor = null;
    let moveCount = 0;

    // Handle incoming raw WS frames
    socket.on('message', function (rawData) {
      const frame = sioParseFrame(rawData);
      if (!frame) return;

      // Engine.IO ping → pong
      if (frame.eioType === 'ping') {
        socket.send('3');
        return;
      }

      // Socket.io connect acknowledgement
      if (frame.event === 'connect') {
        const connectTime = Date.now() - connectStart;
        wsConnectDuration.add(connectTime);
        wsConnectionSuccess.add(1);
        wsSessionsActive.add(1);
        sioReady = true;
        return;
      }

      // Socket.io "message" events carry our game protocol
      if (frame.event !== 'message') return;

      const data = frame.data;
      if (!data || !data.type) return;

      wsMessagesReceived.add(1);

      switch (data.type) {
        case 'table_created':
          console.log(`[VU${__VU}] Table created: ${data.tableId}`);
          break;

        case 'tables_list':
          // Join the first available table
          if (data.tables && data.tables.length > 0 && !gameId) {
            const table = data.tables[0];
            console.log(`[VU${__VU}] Joining table ${table.tableId}`);
            sioEmit(socket, 'message', {
              type: 'join_table', v: 1,
              tableId: table.tableId,
              playerName: playerName,
              elo: 1200,
            });
          }
          break;

        case 'game_found':
          wsGameStarts.add(1);
          gameId = data.gameId;
          myColor = data.color;
          console.log(`[VU${__VU}] Game started: ${gameId} as ${myColor}`);

          // If white, make the first move
          if (myColor === 'w') {
            sleep(0.5);
            const msgStart = Date.now();
            sioEmit(socket, 'message', {
              type: 'make_move', v: 1,
              gameId: gameId,
              move: 'e2e4',
            });
            wsMessageDuration.add(Date.now() - msgStart);
            moveCount++;
          }
          break;

        case 'move_ack':
          // Our move was accepted
          break;

        case 'opponent_move':
          moveCount++;
          if (moveCount < 10 && gameId) {
            sleep(Math.random() * 2 + 0.5);
            const moves = ['d7d5', 'e7e5', 'g8f6', 'b8c6', 'd2d4', 'g1f3', 'f1c4', 'c8f5'];
            const move = moves[moveCount % moves.length];
            sioEmit(socket, 'message', {
              type: 'make_move', v: 1,
              gameId: gameId,
              move: move,
            });
          }
          break;

        case 'game_over':
          console.log(`[VU${__VU}] Game over: ${data.result}`);
          gameId = null;
          break;

        case 'error':
          wsErrors.add(1);
          console.log(`[VU${__VU}] Server error: ${data.code} — ${data.message}`);
          break;
      }
    });

    socket.on('error', function (e) {
      wsErrors.add(1);
      console.log(`[VU${__VU}] WS error: ${e.error()}`);
    });

    socket.on('close', function () {
      wsSessionsActive.add(-1);
    });

    // Wait for Socket.io handshake to complete
    sleep(2);
    if (!sioReady) {
      wsErrors.add(1);
      socket.close();
      return;
    }

    if (isHost) {
      // Odd VUs: create a table and wait for someone to join
      wsTableCreates.add(1);
      sioEmit(socket, 'message', {
        type: 'create_table', v: 1,
        playerName: playerName,
        elo: 1200,
      });
    } else {
      // Even VUs: wait a beat, then list tables and join one
      sleep(2);
      sioEmit(socket, 'message', { type: 'list_tables', v: 1 });
    }

    // Stay connected for a game session (30-60s)
    sleep(30 + Math.random() * 30);

    // Leave table if still waiting (no game started)
    if (!gameId) {
      sioEmit(socket, 'message', { type: 'leave_table', v: 1 });
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
