// =============================================================================
// Metrics Tests — Prometheus metric definitions and helpers
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  registry,
  connectedPlayersGauge,
  activeGamesGauge,
  gamesStartedCounter,
  gamesCompletedCounter,
  queueLengthGauge,
  queueWaitHistogram,
  movesCounter,
  moveLatencyHistogram,
  authCounter,
  errorsCounter,
  dbQueryHistogram,
  timeDbQuery,
} from '../src/metrics.js';

// =============================================================================
// METRIC DEFINITIONS
// =============================================================================

describe('Metric Definitions', () => {
  it('registry contains all custom metrics', async () => {
    const metrics = await registry.getMetricsAsJSON();
    const names = metrics.map(m => m.name);

    expect(names).toContain('chess_connected_players');
    expect(names).toContain('chess_active_games');
    expect(names).toContain('chess_games_started_total');
    expect(names).toContain('chess_games_completed_total');
    expect(names).toContain('chess_queue_length');
    expect(names).toContain('chess_queue_wait_seconds');
    expect(names).toContain('chess_moves_total');
    expect(names).toContain('chess_move_processing_seconds');
    expect(names).toContain('chess_auth_total');
    expect(names).toContain('chess_errors_total');
    expect(names).toContain('chess_db_query_seconds');
  });

  it('exports prometheus-compatible text format', async () => {
    const output = await registry.metrics();
    expect(typeof output).toBe('string');
    expect(output).toContain('chess_connected_players');
    expect(output).toContain('# HELP');
    expect(output).toContain('# TYPE');
  });
});

// =============================================================================
// GAUGE OPERATIONS
// =============================================================================

describe('Gauge Metrics', () => {
  it('connected players gauge increments and decrements', async () => {
    connectedPlayersGauge.set(0);
    connectedPlayersGauge.inc();
    connectedPlayersGauge.inc();

    const metrics = await registry.getSingleMetricAsString('chess_connected_players');
    expect(metrics).toContain('2');

    connectedPlayersGauge.dec();
    const after = await registry.getSingleMetricAsString('chess_connected_players');
    expect(after).toContain('1');
  });

  it('active games gauge tracks game count', async () => {
    activeGamesGauge.set(5);
    const metrics = await registry.getSingleMetricAsString('chess_active_games');
    expect(metrics).toContain('5');
  });

  it('queue length gauge updates', async () => {
    queueLengthGauge.set(3);
    const metrics = await registry.getSingleMetricAsString('chess_queue_length');
    expect(metrics).toContain('3');
  });
});

// =============================================================================
// COUNTER OPERATIONS
// =============================================================================

describe('Counter Metrics', () => {
  it('games started counter increments', async () => {
    const before = (await gamesStartedCounter.get()).values[0]?.value ?? 0;
    gamesStartedCounter.inc();
    const after = (await gamesStartedCounter.get()).values[0]?.value ?? 0;
    expect(after).toBe(before + 1);
  });

  it('moves counter increments', async () => {
    const before = (await movesCounter.get()).values[0]?.value ?? 0;
    movesCounter.inc();
    movesCounter.inc();
    const after = (await movesCounter.get()).values[0]?.value ?? 0;
    expect(after).toBe(before + 2);
  });

  it('games completed counter tracks result and reason', async () => {
    gamesCompletedCounter.inc({ result: 'white', reason: 'checkmate' });
    gamesCompletedCounter.inc({ result: 'draw', reason: 'stalemate' });

    const values = (await gamesCompletedCounter.get()).values;
    const checkmate = values.find(v => v.labels.reason === 'checkmate');
    expect(checkmate).toBeDefined();
    expect(checkmate!.value).toBeGreaterThanOrEqual(1);
  });

  it('auth counter tracks login types', async () => {
    authCounter.inc({ type: 'guest', result: 'success' });
    authCounter.inc({ type: 'login', result: 'invalid' });

    const values = (await authCounter.get()).values;
    const guestSuccess = values.find(v => v.labels.type === 'guest' && v.labels.result === 'success');
    expect(guestSuccess).toBeDefined();
  });

  it('errors counter tracks error codes', async () => {
    errorsCounter.inc({ code: 'PARSE_ERROR' });

    const values = (await errorsCounter.get()).values;
    const parseError = values.find(v => v.labels.code === 'PARSE_ERROR');
    expect(parseError).toBeDefined();
    expect(parseError!.value).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// HISTOGRAM OPERATIONS
// =============================================================================

describe('Histogram Metrics', () => {
  it('move latency histogram records observations', async () => {
    moveLatencyHistogram.observe(0.005);
    moveLatencyHistogram.observe(0.01);
    moveLatencyHistogram.observe(0.002);

    const data = await moveLatencyHistogram.get();
    expect(data.values.length).toBeGreaterThan(0);
  });

  it('queue wait histogram records wait times', async () => {
    queueWaitHistogram.observe(5);
    queueWaitHistogram.observe(15);

    const data = await queueWaitHistogram.get();
    expect(data.values.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// DB QUERY TIMER
// =============================================================================

describe('DB Query Timer', () => {
  it('times an async operation', async () => {
    const result = await timeDbQuery('test-op', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 42;
    });

    expect(result).toBe(42);

    const data = await dbQueryHistogram.get();
    const testOp = data.values.find(v => v.labels.operation === 'test-op');
    expect(testOp).toBeDefined();
  });

  it('times operation even if it throws', async () => {
    await expect(
      timeDbQuery('failing-op', async () => {
        throw new Error('DB error');
      })
    ).rejects.toThrow('DB error');

    // Metric should still be recorded
    const data = await dbQueryHistogram.get();
    const failing = data.values.find(v => v.labels.operation === 'failing-op');
    expect(failing).toBeDefined();
  });
});
