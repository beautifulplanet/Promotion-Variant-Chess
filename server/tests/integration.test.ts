// =============================================================================
// Server Integration Tests — Socket.io end-to-end
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { ServerMessage, GameFound, MoveAck, OpponentMove, GameOver, TablesList, TableCreated, ServerError } from '../src/protocol.js';
import { startServer, io, rooms, tableManager, playerData, httpServer as sharedHttpServer } from '../src/index.js';
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
    expect(data.database).toBeDefined();
    expect(data.uptime).toBeDefined();
  });

  it('two players create and join table to start game', async () => {
    const client1 = connectClient();
    const client2 = connectClient();

    await new Promise<void>(resolve => client1.on('connect', resolve));
    await new Promise<void>(resolve => client2.on('connect', resolve));

    // Client1 creates a table
    const tableCreatedPromise = waitForMessage<TableCreated>(client1, 'table_created');
    client1.emit('message', {
      type: 'create_table', v: 1, playerName: 'Alice', elo: 1200,
    });
    const tableCreated = await tableCreatedPromise;
    expect(tableCreated.tableId).toBeDefined();

    // Client2 joins the table → both get game_found
    const game1Promise = waitForMessage<GameFound>(client1, 'game_found');
    const game2Promise = waitForMessage<GameFound>(client2, 'game_found');

    client2.emit('message', {
      type: 'join_table', v: 1, tableId: tableCreated.tableId,
      playerName: 'Bob', elo: 1200,
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

    // Create table + join to start game
    const tableCreatedPromise = waitForMessage<TableCreated>(client1, 'table_created');
    client1.emit('message', { type: 'create_table', v: 1, playerName: 'White', elo: 1200 });
    const tc = await tableCreatedPromise;

    const game1Promise = waitForMessage<GameFound>(client1, 'game_found');
    const game2Promise = waitForMessage<GameFound>(client2, 'game_found');
    client2.emit('message', { type: 'join_table', v: 1, tableId: tc.tableId, playerName: 'Black', elo: 1200 });

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

    // Create table + join to start game
    const tableCreatedPromise = waitForMessage<TableCreated>(client1, 'table_created');
    client1.emit('message', { type: 'create_table', v: 1, playerName: 'Alice', elo: 1200 });
    const tc = await tableCreatedPromise;

    const game1Promise = waitForMessage<GameFound>(client1, 'game_found');
    const game2Promise = waitForMessage<GameFound>(client2, 'game_found');
    client2.emit('message', { type: 'join_table', v: 1, tableId: tc.tableId, playerName: 'Bob', elo: 1200 });

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

  it('reconnect token restores game session after disconnect', async () => {
    const client1 = connectClient();
    const client2 = connectClient();

    await new Promise<void>(resolve => client1.on('connect', resolve));
    await new Promise<void>(resolve => client2.on('connect', resolve));

    // Create table + join to start game
    const tableCreatedPromise = waitForMessage<TableCreated>(client1, 'table_created');
    client1.emit('message', { type: 'create_table', v: 1, playerName: 'Alice', elo: 1200 });
    const tc = await tableCreatedPromise;

    const game1Promise = waitForMessage<GameFound>(client1, 'game_found');
    const game2Promise = waitForMessage<GameFound>(client2, 'game_found');
    client2.emit('message', { type: 'join_table', v: 1, tableId: tc.tableId, playerName: 'Bob', elo: 1200 });

    const [game1, game2] = await Promise.all([game1Promise, game2Promise]);

    // Both should receive a playerToken
    expect(game1.playerToken).toBeDefined();
    expect(typeof game1.playerToken).toBe('string');
    expect(game2.playerToken).toBeDefined();
    expect(game1.playerToken).not.toBe(game2.playerToken);

    // Disconnect client1, then reconnect with a new socket
    const token1 = game1.playerToken;
    const gameId = game1.gameId;
    client1.disconnect();

    // Small delay so disconnect registers server-side
    await new Promise(r => setTimeout(r, 200));

    const client1b = connectClient();
    await new Promise<void>(resolve => client1b.on('connect', resolve));

    // Reconnect with the saved token
    const reconnectPromise = waitForMessage<GameFound>(client1b, 'game_found');
    client1b.emit('message', { type: 'reconnect', v: 1, playerToken: token1, gameId });

    const reconnected = await reconnectPromise;
    expect(reconnected.gameId).toBe(gameId);
    expect(reconnected.color).toBe(game1.color);
    expect(reconnected.playerToken).toBe(token1);

    client1b.disconnect();
    client2.disconnect();
  });

  it('reconnect with invalid token returns error', async () => {
    const client1 = connectClient();
    const client2 = connectClient();

    await new Promise<void>(resolve => client1.on('connect', resolve));
    await new Promise<void>(resolve => client2.on('connect', resolve));

    // Create a game
    const tableCreatedPromise = waitForMessage<TableCreated>(client1, 'table_created');
    client1.emit('message', { type: 'create_table', v: 1, playerName: 'Alice', elo: 1200 });
    const tc = await tableCreatedPromise;

    const game1Promise = waitForMessage<GameFound>(client1, 'game_found');
    const game2Promise = waitForMessage<GameFound>(client2, 'game_found');
    client2.emit('message', { type: 'join_table', v: 1, tableId: tc.tableId, playerName: 'Bob', elo: 1200 });
    const [game1] = await Promise.all([game1Promise, game2Promise]);

    // Disconnect and try reconnecting with a bogus token
    client1.disconnect();
    await new Promise(r => setTimeout(r, 200));

    const client1b = connectClient();
    await new Promise<void>(resolve => client1b.on('connect', resolve));

    const errPromise = waitForMessage<ServerError>(client1b, 'error');
    client1b.emit('message', { type: 'reconnect', v: 1, playerToken: 'bogus-token', gameId: game1.gameId });

    const err = await errPromise;
    expect(err.code).toBe('INVALID_TOKEN');

    client1b.disconnect();
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
