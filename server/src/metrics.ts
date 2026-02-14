// =============================================================================
// Prometheus Metrics — prom-client based observability
// Exposes /metrics endpoint for Prometheus/Grafana scraping
// =============================================================================

import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

// =============================================================================
// REGISTRY
// =============================================================================

export const registry = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register: registry, prefix: 'chess_' });

// =============================================================================
// CUSTOM METRICS
// =============================================================================

// --- Connections ---
export const connectedPlayersGauge = new Gauge({
  name: 'chess_connected_players',
  help: 'Number of currently connected WebSocket clients',
  registers: [registry],
});

// --- Games ---
export const activeGamesGauge = new Gauge({
  name: 'chess_active_games',
  help: 'Number of currently active games',
  registers: [registry],
});

export const gamesStartedCounter = new Counter({
  name: 'chess_games_started_total',
  help: 'Total number of games started',
  registers: [registry],
});

export const gamesCompletedCounter = new Counter({
  name: 'chess_games_completed_total',
  help: 'Total number of games completed',
  labelNames: ['result', 'reason'] as const,
  registers: [registry],
});

// --- Queue ---
export const queueLengthGauge = new Gauge({
  name: 'chess_queue_length',
  help: 'Number of players currently in the matchmaking queue',
  registers: [registry],
});

export const queueWaitHistogram = new Histogram({
  name: 'chess_queue_wait_seconds',
  help: 'Time spent in matchmaking queue before finding a match',
  buckets: [1, 5, 10, 15, 30, 60],
  registers: [registry],
});

// --- Moves ---
export const movesCounter = new Counter({
  name: 'chess_moves_total',
  help: 'Total number of moves made across all games',
  registers: [registry],
});

export const moveLatencyHistogram = new Histogram({
  name: 'chess_move_processing_seconds',
  help: 'Time to process and validate a move',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [registry],
});

// --- Auth ---
export const authCounter = new Counter({
  name: 'chess_auth_total',
  help: 'Authentication attempts',
  labelNames: ['type', 'result'] as const,
  registers: [registry],
});

// --- Errors ---
export const errorsCounter = new Counter({
  name: 'chess_errors_total',
  help: 'Total errors by type',
  labelNames: ['code'] as const,
  registers: [registry],
});

// --- Database ---
export const dbQueryHistogram = new Histogram({
  name: 'chess_db_query_seconds',
  help: 'Database query duration',
  labelNames: ['operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

// =============================================================================
// HELPER — time a database operation
// =============================================================================

export async function timeDbQuery<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const end = dbQueryHistogram.startTimer({ operation });
  try {
    return await fn();
  } finally {
    end();
  }
}
