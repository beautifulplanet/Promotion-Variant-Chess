// =============================================================================
// Server Resilience — Graceful Shutdown, Crash Recovery, Rate Limiting
// =============================================================================
// Production hardening for the chess multiplayer server.
// Handles SIGTERM/SIGINT from Fly.io deploys, uncaught exceptions,
// connection draining, and request rate limiting.
// =============================================================================

import type { Server as HttpServer } from 'http';
import type { Server as SocketServer } from 'socket.io';
import { Counter, Gauge } from 'prom-client';
import { registry } from './metrics.js';

// =============================================================================
// ADDITIONAL METRICS
// =============================================================================

export const shutdownGauge = new Gauge({
  name: 'chess_shutdown_in_progress',
  help: '1 if the server is draining connections for shutdown',
  registers: [registry],
});

export const rateLimitCounter = new Counter({
  name: 'chess_rate_limit_hits_total',
  help: 'Number of requests rejected by rate limiting',
  labelNames: ['endpoint'] as const,
  registers: [registry],
});

export const wsRateLimitCounter = new Counter({
  name: 'chess_ws_rate_limit_total',
  help: 'Number of WebSocket messages rejected by rate limiting',
  registers: [registry],
});

export const crashCounter = new Counter({
  name: 'chess_process_crashes_total',
  help: 'Number of uncaught exceptions / unhandled rejections',
  labelNames: ['type'] as const,
  registers: [registry],
});

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

interface ShutdownConfig {
  httpServer: HttpServer;
  io: SocketServer;
  drainTimeoutMs?: number;
  onBeforeShutdown?: () => Promise<void>;
}

let isShuttingDown = false;

export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}

export function setupGracefulShutdown(config: ShutdownConfig): void {
  const { httpServer, io, drainTimeoutMs = 15_000, onBeforeShutdown } = config;

  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    shutdownGauge.set(1);

    console.log(`\n🛑 ${signal} received — starting graceful shutdown...`);
    console.log(`   Drain timeout: ${drainTimeoutMs}ms`);
    console.log(`   Active connections: ${io.engine.clientsCount}`);

    // 1. Stop accepting new connections
    httpServer.close(() => {
      console.log('   ✓ HTTP server closed (no new connections)');
    });

    // 2. Notify all connected clients
    io.emit('message', {
      type: 'server_shutdown',
      v: 1,
      message: 'Server is restarting — please reconnect in a moment',
      reconnectAfterMs: 5_000,
    });
    console.log('   ✓ Shutdown notice sent to all clients');

    // 3. Run custom cleanup (clear intervals, save state, etc.)
    if (onBeforeShutdown) {
      try {
        await onBeforeShutdown();
        console.log('   ✓ Custom cleanup completed');
      } catch (err) {
        console.error('   ✗ Custom cleanup failed:', err);
      }
    }

    // 4. Wait for connections to drain (or force after timeout)
    const drainStart = Date.now();
    const drainCheck = setInterval(() => {
      const remaining = io.engine.clientsCount;
      const elapsed = Date.now() - drainStart;
      if (remaining === 0 || elapsed >= drainTimeoutMs) {
        clearInterval(drainCheck);
        if (remaining > 0) {
          console.log(`   ⚠ Force-closing ${remaining} connections after ${drainTimeoutMs}ms`);
          io.disconnectSockets(true);
        } else {
          console.log('   ✓ All connections drained');
        }
        console.log('🛑 Shutdown complete — exiting process');
        process.exit(0);
      }
    }, 500);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('🛡️  Graceful shutdown handlers registered (SIGTERM, SIGINT)');
}

// =============================================================================
// CRASH RECOVERY
// =============================================================================

export function setupCrashRecovery(): void {
  // Uncaught synchronous exceptions
  process.on('uncaughtException', (err: Error, origin: string) => {
    crashCounter.inc({ type: 'uncaughtException' });
    console.error('💥 UNCAUGHT EXCEPTION');
    console.error('   Origin:', origin);
    console.error('   Error:', err.message);
    console.error('   Stack:', err.stack);

    // For truly fatal errors, exit gracefully
    // The process manager (Fly.io) will restart us
    if (origin === 'uncaughtException') {
      console.error('   → Fatal: exiting with code 1');
      process.exit(1);
    }
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    crashCounter.inc({ type: 'unhandledRejection' });
    console.error('💥 UNHANDLED PROMISE REJECTION');
    console.error('   Reason:', reason);
    // Don't exit — just log. Most unhandled rejections are non-fatal.
  });

  // Memory warnings
  process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
      console.warn('⚠️  Max listeners exceeded:', warning.message);
    }
  });

  console.log('🛡️  Crash recovery handlers registered');
}

// =============================================================================
// WEBSOCKET RATE LIMITING
// =============================================================================

interface WsRateLimitConfig {
  windowMs: number;     // Time window in ms
  maxMessages: number;  // Max messages per window
}

// Per-socket message counters
const socketMessageCounts = new Map<string, { count: number; resetAt: number }>();

export function checkWsRateLimit(
  socketId: string,
  config: WsRateLimitConfig = { windowMs: 1_000, maxMessages: 20 }
): boolean {
  const now = Date.now();
  let entry = socketMessageCounts.get(socketId);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    socketMessageCounts.set(socketId, entry);
  }

  entry.count++;

  if (entry.count > config.maxMessages) {
    wsRateLimitCounter.inc();
    return false; // Rate limited
  }

  return true; // OK
}

export function clearWsRateLimit(socketId: string): void {
  socketMessageCounts.delete(socketId);
}

// Periodic cleanup of stale entries
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of socketMessageCounts) {
    if (now >= entry.resetAt) {
      socketMessageCounts.delete(id);
    }
  }
}, 60_000);

// =============================================================================
// CONNECTION LIMITING
// =============================================================================

const ipConnections = new Map<string, number>();

export function trackConnection(ip: string, maxPerIp: number = 10): boolean {
  const current = ipConnections.get(ip) || 0;
  if (current >= maxPerIp) {
    return false; // Reject — too many connections from this IP
  }
  ipConnections.set(ip, current + 1);
  return true;
}

export function releaseConnection(ip: string): void {
  const current = ipConnections.get(ip) || 0;
  if (current <= 1) {
    ipConnections.delete(ip);
  } else {
    ipConnections.set(ip, current - 1);
  }
}

// =============================================================================
// ROOM LIMITS (prevent unbounded memory growth)
// =============================================================================

const MAX_ACTIVE_ROOMS = 500;

export function canCreateRoom(currentRoomCount: number): boolean {
  return currentRoomCount < MAX_ACTIVE_ROOMS;
}

export function getMaxRooms(): number {
  return MAX_ACTIVE_ROOMS;
}
