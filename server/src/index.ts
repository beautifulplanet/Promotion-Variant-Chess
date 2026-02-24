// =============================================================================
// Chess Multiplayer Server — Main Entry Point
// Express + Socket.io WebSocket server
// With Prisma DB, JWT Auth, and Prometheus Metrics
// =============================================================================

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { resolveCorsOrigins } from './corsConfig';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

import { ClientMessageSchema, PROTOCOL_VERSION } from './protocol.js';
import type {
  ServerMessage, GameFound, OpponentMove, MoveAck, GameOver, DrawOffer,
  DrawDeclined, TablesList, TableCreated, ServerError, TimeControl, GameResult, GameEndReason,
  TableInfo,
} from './protocol.js';
import { GameRoom, type Player } from './GameRoom.js';
import { TableManager, type OpenTable } from './TableManager.js';
import { calculateMatchElo } from './elo.js';
import {
  findPlayerByUsername, findPlayerById, createPlayer, updatePlayerAfterGame,
  upgradeGuestAccount, getLeaderboard, saveGame, getPlayerGames, getTotalGames,
  getPrisma, disconnectDB, type PlayerRecord,
} from './database.js';
import {
  hashPassword, verifyPassword, generateToken, verifyToken,
  extractToken, isValidUsername, isValidPassword,
  requireAuth, optionalAuth, type AuthenticatedRequest,
} from './auth.js';
import {
  registry, connectedPlayersGauge, activeGamesGauge, gamesStartedCounter,
  gamesCompletedCounter, queueLengthGauge, queueWaitHistogram,
  movesCounter, moveLatencyHistogram, authCounter, errorsCounter,
  timeDbQuery,
} from './metrics.js';
import {
  setupGracefulShutdown, setupCrashRecovery, isServerShuttingDown,
  checkWsRateLimit, clearWsRateLimit, trackConnection, releaseConnection,
  canCreateRoom, rateLimitCounter,
} from './resilience.js';

// =============================================================================
// SERVER SETUP
// =============================================================================

const PORT = parseInt(process.env.PORT || '3001', 10);
const allowedOrigins = resolveCorsOrigins(process.env.CORS_ORIGIN);

const app = express();

// Trust first proxy (Fly.io) so express-rate-limit sees real client IPs
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // CSP handled by frontend
  crossOriginEmbedderPolicy: false, // Allow WASM/cross-origin resources
}));

// CORS — consistent for Express + Socket.io
app.use(cors({ origin: allowedOrigins }));

// Body parsing with size limit (prevent large payload attacks)
app.use(express.json({ limit: '16kb' }));

// Rate limiting — disabled in test environment to avoid flaky tests
const isTestEnv = process.env.NODE_ENV === 'test';

if (!isTestEnv) {
  // Global rate limiter — 100 requests per minute per IP
  const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      rateLimitCounter.inc({ endpoint: 'global' });
      res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
    },
  });
  app.use('/api/', globalLimiter);

  // Auth-specific rate limiter — 10 per minute (prevent brute-force)
  const authLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      rateLimitCounter.inc({ endpoint: 'auth' });
      res.status(429).json({ error: 'Too many auth attempts — try again in a minute', code: 'AUTH_RATE_LIMITED' });
    },
  });
  app.use('/api/auth/', authLimiter);
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  pingInterval: 10_000,
  pingTimeout: 5_000,
});

// =============================================================================
// STATE (in-memory for active sessions — DB for persistence)
// =============================================================================

const rooms = new Map<string, GameRoom>();          // gameId → GameRoom
const playerRooms = new Map<string, string>();      // socketId → gameId
const playerTokens = new Map<string, string>();     // socketId → playerToken
const tableManager = new TableManager();            // open tables lobby

// Map socket → authenticated player ID (from DB)
const socketPlayerIds = new Map<string, string>();  // socketId → player.id (DB)

// Legacy in-memory fallback (for backward compat during migration)
const playerData = new Map<string, { name: string; elo: number; games: number }>();

// =============================================================================
// HEALTH & MONITORING ENDPOINTS
// =============================================================================

app.get('/', (_req, res) => {
  res.json({
    name: 'The Chess Chronicle — Multiplayer Server',
    status: 'online',
    endpoints: {
      health: '/health',
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      leaderboard: '/api/leaderboard',
    },
  });
});

app.get('/health', async (_req, res) => {
  let dbStatus = 'unknown';
  try {
    const db = getPrisma();
    await db.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Prometheus metrics endpoint (protected — requires METRICS_TOKEN in production)
app.get('/metrics', async (req, res) => {
  const metricsToken = process.env.METRICS_TOKEN;
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, always require a token (even if not set — return 401)
  if (isProduction && !metricsToken) {
    res.status(401).json({ error: 'METRICS_TOKEN not configured' });
    return;
  }

  if (metricsToken) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${metricsToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  try {
    // Update gauges before scrape
    connectedPlayersGauge.set(io.engine.clientsCount);
    activeGamesGauge.set(rooms.size);
    queueLengthGauge.set(tableManager.length);

    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  } catch (err) {
    res.status(500).end(String(err));
  }
});

// =============================================================================
// AUTH ENDPOINTS
// =============================================================================

/**
 * POST /api/auth/guest — Create a guest account with auto-generated name.
 * Returns JWT token + player info.
 */
app.post('/api/auth/guest', async (req, res) => {
  try {
    const { name } = req.body as { name?: string };

    // Validate custom guest name if provided (H5: prevent XSS via stored name)
    if (name) {
      const validation = isValidUsername(name);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error, code: 'INVALID_NAME' });
        authCounter.inc({ type: 'guest', result: 'invalid_name' });
        return;
      }
    }

    const guestName = name || `Guest_${uuidv4().slice(0, 8)}`;

    // Check if name already taken
    const existing = await timeDbQuery('findPlayer', () => findPlayerByUsername(guestName));
    if (existing) {
      res.status(409).json({ error: 'Name already taken', code: 'NAME_TAKEN' });
      authCounter.inc({ type: 'guest', result: 'name_taken' });
      return;
    }

    const player = await timeDbQuery('createPlayer', () => createPlayer({
      username: guestName,
      isGuest: true,
    }));

    const token = generateToken({
      playerId: player.id,
      username: player.username,
      isGuest: true,
    });

    authCounter.inc({ type: 'guest', result: 'success' });
    res.status(201).json({
      token,
      player: {
        id: player.id,
        username: player.username,
        elo: player.elo,
        isGuest: player.isGuest,
      },
    });
  } catch (err) {
    errorsCounter.inc({ code: 'AUTH_ERROR' });
    res.status(500).json({ error: 'Failed to create guest account', code: 'INTERNAL' });
  }
});

/**
 * POST /api/auth/register — Register a new account with username + password.
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required', code: 'MISSING_FIELDS' });
      return;
    }

    const usernameCheck = isValidUsername(username);
    if (!usernameCheck.valid) {
      res.status(400).json({ error: usernameCheck.error, code: 'INVALID_USERNAME' });
      return;
    }

    const passwordCheck = isValidPassword(password);
    if (!passwordCheck.valid) {
      res.status(400).json({ error: passwordCheck.error, code: 'INVALID_PASSWORD' });
      return;
    }

    const existing = await timeDbQuery('findPlayer', () => findPlayerByUsername(username));
    if (existing) {
      res.status(409).json({ error: 'Username already taken', code: 'USERNAME_TAKEN' });
      authCounter.inc({ type: 'register', result: 'username_taken' });
      return;
    }

    const hashed = await hashPassword(password);
    const player = await timeDbQuery('createPlayer', () => createPlayer({
      username,
      password: hashed,
      isGuest: false,
    }));

    const token = generateToken({
      playerId: player.id,
      username: player.username,
      isGuest: false,
    });

    authCounter.inc({ type: 'register', result: 'success' });
    res.status(201).json({
      token,
      player: {
        id: player.id,
        username: player.username,
        elo: player.elo,
        isGuest: player.isGuest,
      },
    });
  } catch (err) {
    errorsCounter.inc({ code: 'AUTH_ERROR' });
    res.status(500).json({ error: 'Registration failed', code: 'INTERNAL' });
  }
});

/**
 * POST /api/auth/login — Log in with username + password.
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required', code: 'MISSING_FIELDS' });
      return;
    }

    const player = await timeDbQuery('findPlayer', () => findPlayerByUsername(username));
    if (!player || !player.password) {
      res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      authCounter.inc({ type: 'login', result: 'invalid' });
      return;
    }

    const valid = await verifyPassword(password, player.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      authCounter.inc({ type: 'login', result: 'invalid' });
      return;
    }

    const token = generateToken({
      playerId: player.id,
      username: player.username,
      isGuest: player.isGuest,
    });

    authCounter.inc({ type: 'login', result: 'success' });
    res.json({
      token,
      player: {
        id: player.id,
        username: player.username,
        elo: player.elo,
        isGuest: player.isGuest,
        gamesPlayed: player.gamesPlayed,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
      },
    });
  } catch (err) {
    errorsCounter.inc({ code: 'AUTH_ERROR' });
    res.status(500).json({ error: 'Login failed', code: 'INTERNAL' });
  }
});

/**
 * POST /api/auth/upgrade — Convert a guest account to a registered account.
 * Requires valid guest JWT.
 */
app.post('/api/auth/upgrade', requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.player?.isGuest) {
      res.status(400).json({ error: 'Account is already registered', code: 'ALREADY_REGISTERED' });
      return;
    }

    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required', code: 'MISSING_FIELDS' });
      return;
    }

    const usernameCheck = isValidUsername(username);
    if (!usernameCheck.valid) {
      res.status(400).json({ error: usernameCheck.error, code: 'INVALID_USERNAME' });
      return;
    }

    const passwordCheck = isValidPassword(password);
    if (!passwordCheck.valid) {
      res.status(400).json({ error: passwordCheck.error, code: 'INVALID_PASSWORD' });
      return;
    }

    const existing = await timeDbQuery('findPlayer', () => findPlayerByUsername(username));
    if (existing) {
      res.status(409).json({ error: 'Username already taken', code: 'USERNAME_TAKEN' });
      return;
    }

    const hashed = await hashPassword(password);
    const player = await timeDbQuery('upgradeGuest', () =>
      upgradeGuestAccount(req.player!.playerId, username, hashed)
    );

    const token = generateToken({
      playerId: player.id,
      username: player.username,
      isGuest: false,
    });

    authCounter.inc({ type: 'upgrade', result: 'success' });
    res.json({
      token,
      player: {
        id: player.id,
        username: player.username,
        elo: player.elo,
        isGuest: player.isGuest,
      },
    });
  } catch (err) {
    errorsCounter.inc({ code: 'AUTH_ERROR' });
    res.status(500).json({ error: 'Upgrade failed', code: 'INTERNAL' });
  }
});

/**
 * GET /api/auth/me — Get current player info from JWT.
 */
app.get('/api/auth/me', requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const player = await timeDbQuery('findPlayer', () => findPlayerById(req.player!.playerId));
    if (!player) {
      res.status(404).json({ error: 'Player not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({
      id: player.id,
      username: player.username,
      elo: player.elo,
      isGuest: player.isGuest,
      gamesPlayed: player.gamesPlayed,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile', code: 'INTERNAL' });
  }
});

// =============================================================================
// LEADERBOARD & GAME HISTORY
// =============================================================================

app.get('/api/leaderboard', async (_req, res) => {
  try {
    const page = parseInt((_req.query.page as string) || '1', 10);
    const limit = Math.min(parseInt((_req.query.limit as string) || '20', 10), 100);

    const { players, total } = await timeDbQuery('leaderboard', () => getLeaderboard(page, limit));

    const offset = (page - 1) * limit;
    res.json({
      page,
      limit,
      total,
      players: players.map((p, i) => ({
        rank: offset + i + 1,
        name: p.username,
        elo: p.elo,
        gamesPlayed: p.gamesPlayed,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
      })),
    });
  } catch (err) {
    // Fallback to in-memory data if DB is unavailable
    const page = parseInt((_req.query.page as string) || '1', 10);
    const limit = Math.min(parseInt((_req.query.limit as string) || '20', 10), 100);
    const offset = (page - 1) * limit;

    const sorted = [...playerData.entries()]
      .sort((a, b) => b[1].elo - a[1].elo)
      .slice(offset, offset + limit)
      .map(([key, data], i) => ({
        rank: offset + i + 1,
        name: data.name,
        elo: data.elo,
        gamesPlayed: data.games,
      }));

    res.json({ page, limit, total: playerData.size, players: sorted });
  }
});

app.get('/api/games/:playerId', async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
    const games = await timeDbQuery('playerGames', () => getPlayerGames(req.params.playerId, limit));
    res.json({ games });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch games', code: 'INTERNAL' });
  }
});

app.get('/api/player/:username', async (req, res) => {
  try {
    const player = await timeDbQuery('findPlayer', () => findPlayerByUsername(req.params.username));
    if (!player) {
      res.status(404).json({ error: 'Player not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({
      id: player.id,
      username: player.username,
      elo: player.elo,
      gamesPlayed: player.gamesPlayed,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      createdAt: player.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch player', code: 'INTERNAL' });
  }
});

// =============================================================================
// SOCKET HANDLERS
// =============================================================================

io.on('connection', (socket) => {
  // Reject connections during shutdown
  if (isServerShuttingDown()) {
    socket.emit('message', { type: 'error', v: PROTOCOL_VERSION, code: 'SHUTTING_DOWN', message: 'Server is restarting' });
    socket.disconnect(true);
    return;
  }

  // Per-IP connection limiting (max 10 sockets per IP)
  // Parse x-forwarded-for: take first IP (the real client), trim whitespace
  const xffHeader = socket.handshake.headers['x-forwarded-for'] as string | undefined;
  const clientIp = xffHeader
    ? xffHeader.split(',')[0].trim()
    : socket.handshake.address;
  if (!trackConnection(clientIp)) {
    socket.emit('message', { type: 'error', v: PROTOCOL_VERSION, code: 'TOO_MANY_CONNECTIONS', message: 'Too many connections from your IP' });
    socket.disconnect(true);
    return;
  }

  console.log(`[connect] ${socket.id} from ${clientIp}`);
  connectedPlayersGauge.inc();

  // Authenticate socket via JWT (auth payload only — never accept query-string tokens
  // because query strings leak into reverse-proxy logs, browser history, and referrers)
  const token = socket.handshake.auth?.token;
  if (token && typeof token === 'string') {
    const payload = verifyToken(token);
    if (payload) {
      socketPlayerIds.set(socket.id, payload.playerId);
    }
  }

  socket.on('message', (rawData: unknown) => {
    // WebSocket rate limiting — max 20 messages per second
    if (!checkWsRateLimit(socket.id)) {
      sendError(socket, 'RATE_LIMITED', 'Too many messages — slow down');
      return;
    }

    // Parse and validate
    let data;
    try {
      const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      const result = ClientMessageSchema.safeParse(parsed);
      if (!result.success) {
        const typeVal = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>).type : undefined;
        const msg = typeVal
          ? `Unknown message type: '${typeVal}'. Refresh your browser for the latest version.`
          : (result.error.issues[0]?.message || 'Invalid message');
        sendError(socket, 'INVALID_MESSAGE', msg);
        errorsCounter.inc({ code: 'INVALID_MESSAGE' });
        return;
      }
      data = result.data;
    } catch {
      sendError(socket, 'PARSE_ERROR', 'Invalid JSON');
      errorsCounter.inc({ code: 'PARSE_ERROR' });
      return;
    }

    switch (data.type) {
      case 'create_table':
        handleCreateTable(socket, data.playerName, data.elo ?? 1200, data.pieceBank);
        break;
      case 'list_tables':
        handleListTables(socket);
        break;
      case 'join_table':
        handleJoinTable(socket, data.tableId, data.playerName, data.elo ?? 1200, data.pieceBank);
        break;
      case 'leave_table':
        handleLeaveTable(socket);
        break;
      case 'make_move':
        handleMakeMove(socket, data.gameId, data.move);
        break;
      case 'resign':
        handleResign(socket, data.gameId);
        break;
      case 'offer_draw':
        handleOfferDraw(socket, data.gameId);
        break;
      case 'accept_draw':
        handleAcceptDraw(socket, data.gameId);
        break;
      case 'decline_draw':
        handleDeclineDraw(socket, data.gameId);
        break;
      case 'reconnect':
        handleReconnect(socket, data.playerToken, data.gameId);
        break;
    }
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    connectedPlayersGauge.dec();
    const hadTable = !!tableManager.getPlayerTableId(socket.id);
    tableManager.removePlayerTable(socket.id);
    if (hadTable) broadcastTableList();
    socketPlayerIds.delete(socket.id);
    clearWsRateLimit(socket.id);
    releaseConnection(clientIp);

    const gameId = playerRooms.get(socket.id);
    if (gameId) {
      const room = rooms.get(gameId);
      if (room && room.state === 'playing') {
        room.handleDisconnect(socket.id);
      }
    }
  });
});

// =============================================================================
// MESSAGE HANDLERS
// =============================================================================

function handleCreateTable(
  socket: ReturnType<typeof io.sockets.sockets.get> & { id: string },
  playerName: string,
  elo: number,
  pieceBank?: { P: number; N: number; B: number; R: number; Q: number },
) {
  // Store player data (in-memory fallback)
  if (!playerData.has(playerName)) {
    playerData.set(playerName, { name: playerName, elo, games: 0 });
  }

  const table = tableManager.createTable(socket.id, playerName, elo, pieceBank);
  queueLengthGauge.set(tableManager.length);

  // Confirm to creator
  send(socket, {
    type: 'table_created', v: PROTOCOL_VERSION,
    tableId: table.tableId,
  });

  // Broadcast updated table list to ALL connected sockets
  broadcastTableList();
}

function handleListTables(socket: { emit: Function }) {
  send(socket, {
    type: 'tables_list', v: PROTOCOL_VERSION,
    tables: tableManager.listTables(),
  });
}

function handleJoinTable(
  socket: ReturnType<typeof io.sockets.sockets.get> & { id: string },
  tableId: string,
  playerName: string,
  elo: number,
  pieceBank?: { P: number; N: number; B: number; R: number; Q: number },
) {
  const table = tableManager.getTable(tableId);
  if (!table) {
    sendError(socket, 'TABLE_NOT_FOUND', 'Table no longer available');
    return;
  }

  // Can't join your own table
  if (table.hostSocketId === socket.id) {
    sendError(socket, 'OWN_TABLE', 'You cannot join your own table');
    return;
  }

  // Store player data
  if (!playerData.has(playerName)) {
    playerData.set(playerName, { name: playerName, elo, games: 0 });
  }

  // Remove the table, then create the game
  tableManager.removeTable(tableId);
  queueLengthGauge.set(tableManager.length);

  // Create game entries (untimed)
  const hostEntry = {
    socketId: table.hostSocketId,
    playerName: table.hostName,
    elo: table.hostElo,
    pieceBank: table.pieceBank,
  };
  const joinerEntry = {
    socketId: socket.id,
    playerName,
    elo,
    pieceBank,
  };

  createGame(hostEntry, joinerEntry);

  // Broadcast updated table list (table was removed)
  broadcastTableList();
}

function handleLeaveTable(socket: { id: string }) {
  tableManager.removePlayerTable(socket.id);
  queueLengthGauge.set(tableManager.length);
  broadcastTableList();
}

/**
 * Send the current table list to all connected sockets
 * so everyone's lobby view stays in sync.
 */
function broadcastTableList() {
  const tables = tableManager.listTables();
  const msg: ServerMessage = {
    type: 'tables_list', v: PROTOCOL_VERSION,
    tables,
  };
  io.emit('message', msg);
}

function handleMakeMove(socket: { id: string; emit: Function }, gameId: string, moveStr: string) {
  const room = rooms.get(gameId);
  if (!room) {
    sendError(socket, 'GAME_NOT_FOUND', 'Game not found');
    errorsCounter.inc({ code: 'GAME_NOT_FOUND' });
    return;
  }

  const moveStart = performance.now();
  const result = room.makeMove(socket.id, moveStr);
  const moveEnd = performance.now();
  moveLatencyHistogram.observe((moveEnd - moveStart) / 1000);

  if (!result.ok) {
    sendError(socket, 'ILLEGAL_MOVE', result.error);
    errorsCounter.inc({ code: 'ILLEGAL_MOVE' });
    return;
  }

  movesCounter.inc();

  // Send acknowledgement to moving player
  send(socket, {
    type: 'move_ack', v: PROTOCOL_VERSION,
    gameId, move: result.move, fen: result.fen,
    whiteTime: result.whiteTime, blackTime: result.blackTime,
  });

  // Send move to opponent
  const playerInfo = room.getPlayerBySocketId(socket.id);
  if (playerInfo) {
    const opponent = room.getOpponent(playerInfo.color);
    const opponentSocket = io.sockets.sockets.get(opponent.id);
    if (opponentSocket) {
      send(opponentSocket, {
        type: 'opponent_move', v: PROTOCOL_VERSION,
        gameId, move: result.move, fen: result.fen,
        whiteTime: result.whiteTime, blackTime: result.blackTime,
      });
    }
  }

  // Handle game over
  if (result.gameOver) {
    endGame(room, result.gameOver.result, result.gameOver.reason);
  }
}

function handleResign(socket: { id: string }, gameId: string) {
  const room = rooms.get(gameId);
  if (!room) return;

  const result = room.resign(socket.id);
  if (result) {
    endGame(room, result.result, result.reason);
  }
}

function handleOfferDraw(socket: { id: string }, gameId: string) {
  const room = rooms.get(gameId);
  if (!room) return;

  const offeringColor = room.offerDraw(socket.id);
  if (offeringColor === null) return;

  // Notify opponent
  const opponent = room.getOpponent(offeringColor);
  const opponentSocket = io.sockets.sockets.get(opponent.id);
  if (opponentSocket) {
    const playerInfo = room.getPlayerBySocketId(socket.id);
    send(opponentSocket, {
      type: 'draw_offer', v: PROTOCOL_VERSION,
      gameId, from: playerInfo?.player.name ?? 'Opponent',
    });
  }
}

function handleAcceptDraw(socket: { id: string }, gameId: string) {
  const room = rooms.get(gameId);
  if (!room) return;

  const result = room.acceptDraw(socket.id);
  if (result) {
    endGame(room, result.result, result.reason);
  }
}

function handleDeclineDraw(socket: { id: string }, gameId: string) {
  const room = rooms.get(gameId);
  if (!room) return;

  if (room.declineDraw(socket.id)) {
    const playerInfo = room.getPlayerBySocketId(socket.id);
    if (playerInfo) {
      const offerer = room.getOpponent(playerInfo.color);
      const offererSocket = io.sockets.sockets.get(offerer.id);
      if (offererSocket) {
        send(offererSocket, { type: 'draw_declined', v: PROTOCOL_VERSION, gameId });
      }
    }
  }
}

function handleReconnect(
  socket: { id: string; join: (room: string) => void; emit: Function },
  playerToken: string,
  gameId: string,
) {
  const room = rooms.get(gameId);
  if (!room) {
    sendError(socket, 'GAME_NOT_FOUND', 'Game not found');
    return;
  }

  const player = room.handleReconnect(playerToken, socket.id);
  if (!player) {
    sendError(socket, 'INVALID_TOKEN', 'Invalid reconnect token');
    return;
  }

  playerRooms.set(socket.id, gameId);
  playerTokens.set(socket.id, playerToken);
  socket.join(gameId);

  // Send current game state
  const info = room.getPlayerBySocketId(socket.id)!;
  send(socket, {
    type: 'game_found', v: PROTOCOL_VERSION,
    gameId: room.id,
    color: info.color,
    opponent: {
      name: room.getOpponent(info.color).name,
      elo: room.getOpponent(info.color).elo,
    },
    timeControl: room.timeControl,
    fen: room.fen,
  });
}

// =============================================================================
// GAME LIFECYCLE
// =============================================================================

/** Entry for a player about to start a game (replaces old QueueEntry) */
interface TableEntry {
  socketId: string;
  playerName: string;
  elo: number;
  pieceBank?: { P: number; N: number; B: number; R: number; Q: number };
}

function createGame(p1: TableEntry, p2: TableEntry) {
  const timeControl: TimeControl = { initial: 0, increment: 0 }; // untimed

  // Room limit check — prevent unbounded memory growth
  if (!canCreateRoom(rooms.size)) {
    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);
    if (s1) sendError(s1, 'SERVER_FULL', 'Server at capacity — try again shortly');
    if (s2) sendError(s2, 'SERVER_FULL', 'Server at capacity — try again shortly');
    return;
  }

  // Randomly assign colors
  const isP1White = Math.random() < 0.5;

  const whiteEntry = isP1White ? p1 : p2;
  const blackEntry = isP1White ? p2 : p1;

  const whiteToken = uuidv4();
  const blackToken = uuidv4();

  const white: Player = {
    id: whiteEntry.socketId,
    name: whiteEntry.playerName,
    elo: whiteEntry.elo,
    token: whiteToken,
    connected: true,
  };

  const black: Player = {
    id: blackEntry.socketId,
    name: blackEntry.playerName,
    elo: blackEntry.elo,
    token: blackToken,
    connected: true,
  };

  const room = new GameRoom(white, black, timeControl);
  rooms.set(room.id, room);
  playerRooms.set(white.id, room.id);
  playerRooms.set(black.id, room.id);
  playerTokens.set(white.id, whiteToken);
  playerTokens.set(black.id, blackToken);

  // Metrics
  gamesStartedCounter.inc();
  activeGamesGauge.set(rooms.size);

  // Notify both players
  const whiteSocket = io.sockets.sockets.get(white.id);
  const blackSocket = io.sockets.sockets.get(black.id);

  if (whiteSocket) {
    whiteSocket.join(room.id);
    send(whiteSocket, {
      type: 'game_found', v: PROTOCOL_VERSION,
      gameId: room.id, color: 'w',
      opponent: { name: black.name, elo: black.elo },
      timeControl, fen: room.fen,
      myPieceBank: whiteEntry.pieceBank,
      opponentPieceBank: blackEntry.pieceBank,
    });
  }

  if (blackSocket) {
    blackSocket.join(room.id);
    send(blackSocket, {
      type: 'game_found', v: PROTOCOL_VERSION,
      gameId: room.id, color: 'b',
      opponent: { name: white.name, elo: white.elo },
      timeControl, fen: room.fen,
      myPieceBank: blackEntry.pieceBank,
      opponentPieceBank: whiteEntry.pieceBank,
    });
  }

  console.log(`[game] ${room.id} — ${white.name} (${white.elo}) vs ${black.name} (${black.elo})`);
}

async function endGame(room: GameRoom, result: GameResult, reason: GameEndReason) {
  // Calculate ELO changes (in-memory)
  const whiteData = playerData.get(room.white.name) ?? { name: room.white.name, elo: room.white.elo, games: 0 };
  const blackData = playerData.get(room.black.name) ?? { name: room.black.name, elo: room.black.elo, games: 0 };

  const eloResult = calculateMatchElo(
    whiteData.elo, blackData.elo, result, whiteData.games, blackData.games,
  );

  whiteData.elo = eloResult.white.newElo;
  whiteData.games++;
  blackData.elo = eloResult.black.newElo;
  blackData.games++;
  playerData.set(room.white.name, whiteData);
  playerData.set(room.black.name, blackData);

  // Persist to database (fire-and-forget for speed, log errors)
  persistGameResult(room, result, reason, eloResult).catch(err => {
    console.error('[db] Failed to persist game result:', err);
  });

  // Metrics
  gamesCompletedCounter.inc({ result, reason });
  activeGamesGauge.set(rooms.size - 1); // room is about to be removed

  // Notify white
  const whiteSocket = io.sockets.sockets.get(room.white.id);
  if (whiteSocket) {
    send(whiteSocket, {
      type: 'game_over', v: PROTOCOL_VERSION,
      gameId: room.id, result, reason,
      winner: result === 'draw' ? undefined : (result === 'white' ? room.white.name : room.black.name),
      eloChange: eloResult.white.change,
      newElo: eloResult.white.newElo,
    });
  }

  // Notify black
  const blackSocket = io.sockets.sockets.get(room.black.id);
  if (blackSocket) {
    send(blackSocket, {
      type: 'game_over', v: PROTOCOL_VERSION,
      gameId: room.id, result, reason,
      winner: result === 'draw' ? undefined : (result === 'white' ? room.white.name : room.black.name),
      eloChange: eloResult.black.change,
      newElo: eloResult.black.newElo,
    });
  }

  // Cleanup
  playerRooms.delete(room.white.id);
  playerRooms.delete(room.black.id);
  playerTokens.delete(room.white.id);
  playerTokens.delete(room.black.id);

  // Keep room for a bit for potential reconnect/review, then delete
  setTimeout(() => {
    rooms.delete(room.id);
    activeGamesGauge.set(rooms.size);
  }, 60_000);

  console.log(`[game over] ${room.id} — ${result} by ${reason}`);
}

/**
 * Persist game result to database — updates player ELOs and saves game record.
 */
async function persistGameResult(
  room: GameRoom,
  result: GameResult,
  reason: string,
  eloResult: { white: { newElo: number }; black: { newElo: number } },
) {
  // Try to find players in DB by name
  const [whitePlayer, blackPlayer] = await Promise.all([
    timeDbQuery('findPlayer', () => findPlayerByUsername(room.white.name)),
    timeDbQuery('findPlayer', () => findPlayerByUsername(room.black.name)),
  ]);

  // Update player records if they exist in DB
  if (whitePlayer) {
    const whiteResult = result === 'white' ? 'win' : result === 'black' ? 'loss' : 'draw';
    await timeDbQuery('updatePlayer', () =>
      updatePlayerAfterGame(whitePlayer.id, eloResult.white.newElo, whiteResult as 'win' | 'loss' | 'draw')
    );
  }

  if (blackPlayer) {
    const blackResult = result === 'black' ? 'win' : result === 'white' ? 'loss' : 'draw';
    await timeDbQuery('updatePlayer', () =>
      updatePlayerAfterGame(blackPlayer.id, eloResult.black.newElo, blackResult as 'win' | 'loss' | 'draw')
    );
  }

  // Save game record
  if (whitePlayer && blackPlayer) {
    const duration = Math.floor((Date.now() - room.createdAt) / 1000);
    await timeDbQuery('saveGame', () =>
      saveGame({
        whiteId: whitePlayer.id,
        blackId: blackPlayer.id,
        result,
        reason,
        fen: room.fen,
        moves: room.moveHistory.length,
        timeControl: room.timeControl,
        duration,
      })
    );
  }
}

// =============================================================================
// PERIODIC TASKS
// =============================================================================

// Scan for stale tables every 30 seconds (remove tables older than 10 min)
const staleTableInterval = setInterval(() => {
  const removed = tableManager.removeStale();
  if (removed.length > 0) {
    queueLengthGauge.set(tableManager.length);
    broadcastTableList();
  }
}, 30_000);

// Check disconnection timeouts every 10 seconds
const disconnectCheckInterval = setInterval(() => {
  for (const [gameId, room] of rooms) {
    if (room.state !== 'playing') continue;
    const timeout = room.checkDisconnectTimeout();
    if (timeout) {
      endGame(room, timeout.result, timeout.reason);
    }
  }
}, 10_000);

// =============================================================================
// HELPERS
// =============================================================================

function send(socket: { emit: Function }, msg: ServerMessage) {
  socket.emit('message', msg);
}

function sendError(socket: { emit: Function }, code: string, message: string) {
  send(socket, { type: 'error', v: PROTOCOL_VERSION, code, message });
}

// =============================================================================
// EXPORTS & START
// =============================================================================

export {
  app, httpServer, io, rooms, tableManager, playerData, socketPlayerIds,
  staleTableInterval, disconnectCheckInterval,
};

export async function startServer(port: number = PORT) {
  // Setup crash recovery FIRST (before anything can throw)
  setupCrashRecovery();

  // Ensure DB connection works + enable WAL mode for concurrent reads
  try {
    const db = getPrisma();
    await db.$queryRaw`SELECT 1`;
    // Enable WAL mode for better concurrent performance (M8)
    if (process.env.DATABASE_URL?.startsWith('file:')) {
      await db.$executeRawUnsafe('PRAGMA journal_mode=WAL');
      await db.$executeRawUnsafe('PRAGMA busy_timeout=5000');
      console.log('📦 Database connected (SQLite WAL mode)');
    } else {
      console.log('📦 Database connected');
    }
  } catch (err) {
    console.warn('⚠️  Database not available — running with in-memory only');
  }

  const host = '0.0.0.0';
  httpServer.listen(port, host, () => {
    console.log(`♟️  Chess server listening on ${host}:${port}`);

    // Setup graceful shutdown (needs httpServer to be listening)
    setupGracefulShutdown({
      httpServer,
      io,
      drainTimeoutMs: 15_000,
      onBeforeShutdown: async () => {
        clearInterval(staleTableInterval);
        clearInterval(disconnectCheckInterval);
        await disconnectDB();
      },
    });
  });
  return httpServer;
}

export async function stopServer() {
  clearInterval(staleTableInterval);
  clearInterval(disconnectCheckInterval);
  await disconnectDB();
  httpServer.close();
}

// Only auto-start if run directly (not imported for testing)
const isDirectRun = process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts');
if (isDirectRun) {
  startServer();
}
