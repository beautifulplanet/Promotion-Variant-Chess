// =============================================================================
// Chess Multiplayer Server — Main Entry Point
// Express + Socket.io WebSocket server
// =============================================================================

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

import { ClientMessageSchema, PROTOCOL_VERSION } from './protocol.js';
import type {
  ServerMessage, GameFound, OpponentMove, MoveAck, GameOver, DrawOffer,
  DrawDeclined, QueueStatus, ServerError, TimeControl,
} from './protocol.js';
import { GameRoom, type Player } from './GameRoom.js';
import { Matchmaker, type QueueEntry } from './Matchmaker.js';
import { calculateMatchElo } from './elo.js';

// =============================================================================
// SERVER SETUP
// =============================================================================

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
  pingInterval: 10_000,
  pingTimeout: 5_000,
});

// =============================================================================
// STATE
// =============================================================================

const rooms = new Map<string, GameRoom>();          // gameId → GameRoom
const playerRooms = new Map<string, string>();      // socketId → gameId
const playerTokens = new Map<string, string>();     // socketId → playerToken
const matchmaker = new Matchmaker();

// In-memory player data (replace with DB in Phase 6)
const playerData = new Map<string, { name: string; elo: number; games: number }>();

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeGames: rooms.size,
    queueLength: matchmaker.length,
    connectedPlayers: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/leaderboard', (_req, res) => {
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
});

// =============================================================================
// SOCKET HANDLERS
// =============================================================================

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('message', (rawData: unknown) => {
    // Parse and validate
    let data;
    try {
      const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      const result = ClientMessageSchema.safeParse(parsed);
      if (!result.success) {
        sendError(socket, 'INVALID_MESSAGE', result.error.issues[0]?.message || 'Invalid message');
        return;
      }
      data = result.data;
    } catch {
      sendError(socket, 'PARSE_ERROR', 'Invalid JSON');
      return;
    }

    switch (data.type) {
      case 'join_queue':
        handleJoinQueue(socket, data.playerName, data.elo ?? 1200, data.timeControl);
        break;
      case 'leave_queue':
        handleLeaveQueue(socket);
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
    matchmaker.removePlayer(socket.id);

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

function handleJoinQueue(
  socket: ReturnType<typeof io.sockets.sockets.get> & { id: string },
  playerName: string,
  elo: number,
  timeControl?: TimeControl,
) {
  const tc = timeControl ?? { initial: 600, increment: 0 };

  // Store/update player data
  if (!playerData.has(playerName)) {
    playerData.set(playerName, { name: playerName, elo, games: 0 });
  }

  const entry: QueueEntry = {
    socketId: socket.id,
    playerName,
    elo,
    timeControl: tc,
    joinedAt: Date.now(),
  };

  const match = matchmaker.addPlayer(entry);

  if (match) {
    createGame(match.player1, match.player2, tc);
  } else {
    const pos = matchmaker.getPosition(socket.id);
    send(socket, {
      type: 'queue_status', v: PROTOCOL_VERSION,
      position: pos,
      estimatedWait: 15,
    });
  }
}

function handleLeaveQueue(socket: { id: string }) {
  matchmaker.removePlayer(socket.id);
}

function handleMakeMove(socket: { id: string; emit: Function }, gameId: string, moveStr: string) {
  const room = rooms.get(gameId);
  if (!room) {
    sendError(socket, 'GAME_NOT_FOUND', 'Game not found');
    return;
  }

  const result = room.makeMove(socket.id, moveStr);

  if (!result.ok) {
    sendError(socket, 'ILLEGAL_MOVE', result.error);
    return;
  }

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

function createGame(p1: QueueEntry, p2: QueueEntry, timeControl: TimeControl) {
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
    });
  }

  if (blackSocket) {
    blackSocket.join(room.id);
    send(blackSocket, {
      type: 'game_found', v: PROTOCOL_VERSION,
      gameId: room.id, color: 'b',
      opponent: { name: white.name, elo: white.elo },
      timeControl, fen: room.fen,
    });
  }

  console.log(`[game] ${room.id} — ${white.name} (${white.elo}) vs ${black.name} (${black.elo})`);
}

function endGame(room: GameRoom, result: 'white' | 'black' | 'draw', reason: string) {
  // Calculate ELO changes
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

  // Notify white
  const whiteSocket = io.sockets.sockets.get(room.white.id);
  if (whiteSocket) {
    send(whiteSocket, {
      type: 'game_over', v: PROTOCOL_VERSION,
      gameId: room.id, result, reason: reason as any,
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
      gameId: room.id, result, reason: reason as any,
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
  setTimeout(() => rooms.delete(room.id), 60_000);

  console.log(`[game over] ${room.id} — ${result} by ${reason}`);
}

// =============================================================================
// PERIODIC TASKS
// =============================================================================

// Scan for matches every 5 seconds (expanding ELO windows)
setInterval(() => {
  const matches = matchmaker.scanForMatches();
  for (const match of matches) {
    createGame(match.player1, match.player2, match.player1.timeControl);
  }

  // Check queue timeouts
  const timedOut = matchmaker.checkTimeouts();
  for (const entry of timedOut) {
    const socket = io.sockets.sockets.get(entry.socketId);
    if (socket) {
      sendError(socket, 'QUEUE_TIMEOUT', 'No opponent found — try again or play vs AI');
    }
  }
}, 5_000);

// Check disconnection timeouts every 10 seconds
setInterval(() => {
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
// START
// =============================================================================

export { app, httpServer, io, rooms, matchmaker, playerData };

export function startServer(port: number = PORT) {
  httpServer.listen(port, () => {
    console.log(`♟️  Chess server listening on port ${port}`);
  });
  return httpServer;
}

// Only auto-start if run directly (not imported for testing)
const isDirectRun = process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts');
if (isDirectRun) {
  startServer();
}
