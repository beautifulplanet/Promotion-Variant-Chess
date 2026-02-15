// =============================================================================
// Server Integration Tests — Socket.io end-to-end
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { ServerMessage, GameFound, MoveAck, OpponentMove, GameOver, QueueStatus, ServerError } from '../src/protocol.js';
import { startServer, io, rooms, matchmaker, playerData, httpServer as sharedHttpServer } from '../src/index.js';
import { createPlayer, getPrisma } from '../src/database.js';
import type { AddressInfo } from 'net';

let port: number;

function connectClient(name: string = 'TestPlayer'): ClientSocket {
  const client = ioClient(`http://localhost:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  });
  return client;
}

function waitForMessage<T extends ServerMessage>(
  client: ClientSocket,
  msgType: T['type'],
  timeout = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${msgType}`)), timeout);
    client.on('message', (msg: ServerMessage) => {
      if (msg.type === msgType) {
        clearTimeout(timer);
        resolve(msg as T);
      }
    });
  });
}

describe('Server Integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    await startServer(0); // random port
    await new Promise<void>(resolve => {
      if (sharedHttpServer.listening) return resolve();
      sharedHttpServer.once('listening', resolve);
    });
    const addr = sharedHttpServer.address() as AddressInfo;
    port = addr.port;
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>(resolve => sharedHttpServer.close(() => resolve()));
  });

  afterEach(() => {
    // Clear state
    rooms.clear();
    playerData.clear();
  });

  it('health endpoint returns ok', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.activeGames).toBeDefined();
  });

  it('two players join queue and get matched', async () => {
    const client1 = connectClient();
    const client2 = connectClient();

    await new Promise<void>(resolve => client1.on('connect', resolve));
    await new Promise<void>(resolve => client2.on('connect', resolve));

    const game1Promise = waitForMessage<GameFound>(client1, 'game_found');
    const game2Promise = waitForMessage<GameFound>(client2, 'game_found');

    client1.emit('message', {
      type: 'join_queue', v: 1, playerName: 'Alice', elo: 1200,
      timeControl: { initial: 600, increment: 0 },
    });

    client2.emit('message', {
      type: 'join_queue', v: 1, playerName: 'Bob', elo: 1200,
      timeControl: { initial: 600, increment: 0 },
    });

    const [game1, game2] = await Promise.all([game1Promise, game2Promise]);

    expect(game1.gameId).toBe(game2.gameId);
    expect(game1.color).not.toBe(game2.color);
    expect(game1.fen).toContain('rnbqkbnr');

    client1.disconnect();
    client2.disconnect();
  });

  it('invalid message returns error', async () => {
    const client = connectClient();
    await new Promise<void>(resolve => client.on('connect', resolve));

    const errPromise = waitForMessage<ServerError>(client, 'error');
    client.emit('message', { type: 'join_queue', v: 1, playerName: '' }); // empty name
    const err = await errPromise;

    expect(err.type).toBe('error');
    expect(err.code).toBe('INVALID_MESSAGE');

    client.disconnect();
  });

  it('matched players can exchange moves', async () => {
    const client1 = connectClient();
    const client2 = connectClient();

    await new Promise<void>(resolve => client1.on('connect', resolve));
    await new Promise<void>(resolve => client2.on('connect', resolve));

    const game1Promise = waitForMessage<GameFound>(client1, 'game_found');
    const game2Promise = waitForMessage<GameFound>(client2, 'game_found');

    client1.emit('message', {
      type: 'join_queue', v: 1, playerName: 'White', elo: 1200,
      timeControl: { initial: 600, increment: 0 },
    });
    client2.emit('message', {
      type: 'join_queue', v: 1, playerName: 'Black', elo: 1200,
      timeControl: { initial: 600, increment: 0 },
    });

    const [game1, game2] = await Promise.all([game1Promise, game2Promise]);

    // Determine who is white
    const whiteClient = game1.color === 'w' ? client1 : client2;
    const blackClient = game1.color === 'w' ? client2 : client1;
    const gameId = game1.gameId;

    // White plays e4
    const ackPromise = waitForMessage<MoveAck>(whiteClient, 'move_ack');
    const opMovePromise = waitForMessage<OpponentMove>(blackClient, 'opponent_move');

    whiteClient.emit('message', {
      type: 'make_move', v: 1, gameId, move: 'e2e4',
    });

    const [ack, opMove] = await Promise.all([ackPromise, opMovePromise]);
    expect(ack.move).toBe('e4');
    expect(opMove.move).toBe('e4');

    client1.disconnect();
    client2.disconnect();
  });

  it('resign ends game with elo changes', async () => {
    const client1 = connectClient();
    const client2 = connectClient();

    await new Promise<void>(resolve => client1.on('connect', resolve));
    await new Promise<void>(resolve => client2.on('connect', resolve));

    const game1Promise = waitForMessage<GameFound>(client1, 'game_found');
    const game2Promise = waitForMessage<GameFound>(client2, 'game_found');

    client1.emit('message', {
      type: 'join_queue', v: 1, playerName: 'Alice', elo: 1200,
      timeControl: { initial: 600, increment: 0 },
    });
    client2.emit('message', {
      type: 'join_queue', v: 1, playerName: 'Bob', elo: 1200,
      timeControl: { initial: 600, increment: 0 },
    });

    const [game1, game2] = await Promise.all([game1Promise, game2Promise]);
    const gameId = game1.gameId;

    const gameOver1 = waitForMessage<GameOver>(client1, 'game_over');
    const gameOver2 = waitForMessage<GameOver>(client2, 'game_over');

    // Client1 resigns
    client1.emit('message', { type: 'resign', v: 1, gameId });

    const [over1, over2] = await Promise.all([gameOver1, gameOver2]);
    expect(over1.reason).toBe('resignation');
    expect(over1.eloChange).toBeDefined();
    expect(over2.eloChange).toBeDefined();

    client1.disconnect();
    client2.disconnect();
  });

  it('leaderboard endpoint returns sorted players', async () => {
    // Seed the database with test players
    const db = getPrisma();
    await db.game.deleteMany();
    await db.player.deleteMany();
    await createPlayer({ username: 'Alice', elo: 1500, isGuest: true });
    await createPlayer({ username: 'Bob', elo: 1300, isGuest: true });
    await createPlayer({ username: 'Charlie', elo: 1700, isGuest: true });

    const res = await fetch(`http://localhost:${port}/api/leaderboard`);
    const data = await res.json();

    expect(data.players.length).toBe(3);
    expect(data.players[0].name).toBe('Charlie');
    expect(data.players[0].rank).toBe(1);
    expect(data.players[1].name).toBe('Alice');
    expect(data.players[2].name).toBe('Bob');
    expect(data.total).toBe(3);

    // Clean up
    await db.player.deleteMany();
  });
});
