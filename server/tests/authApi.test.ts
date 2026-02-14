// =============================================================================
// Auth API Integration Tests — HTTP endpoint testing
// Tests registration, login, guest auth, upgrade, and profile
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { setPrisma, disconnectDB } from '../src/database.js';
import { app } from '../src/index.js';
import type { Server as HttpServer } from 'http';
import { createServer } from 'http';

let httpServer: HttpServer;
let port: number;
let prisma: PrismaClient;
let baseUrl: string;

// Simple fetch wrapper for testing
async function api(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return { status: res.status, data };
}

beforeAll(async () => {
  prisma = new PrismaClient();
  setPrisma(prisma);

  httpServer = createServer(app);
  await new Promise<void>(resolve => {
    httpServer.listen(0, () => resolve());
  });
  const addr = httpServer.address() as { port: number };
  port = addr.port;
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  await disconnectDB();
});

beforeEach(async () => {
  await prisma.game.deleteMany();
  await prisma.player.deleteMany();
});

// =============================================================================
// GUEST AUTH
// =============================================================================

describe('Guest Authentication', () => {
  it('POST /api/auth/guest — creates guest with auto name', async () => {
    const { status, data } = await api('POST', '/api/auth/guest', {});

    expect(status).toBe(201);
    expect(data.token).toBeDefined();
    expect(data.player.username).toMatch(/^Guest_/);
    expect(data.player.elo).toBe(1200);
    expect(data.player.isGuest).toBe(true);
  });

  it('POST /api/auth/guest — creates guest with custom name', async () => {
    const { status, data } = await api('POST', '/api/auth/guest', { name: 'CoolGuest' });

    expect(status).toBe(201);
    expect(data.player.username).toBe('CoolGuest');
  });

  it('POST /api/auth/guest — rejects duplicate name', async () => {
    await api('POST', '/api/auth/guest', { name: 'DupeName' });
    const { status, data } = await api('POST', '/api/auth/guest', { name: 'DupeName' });

    expect(status).toBe(409);
    expect(data.code).toBe('NAME_TAKEN');
  });
});

// =============================================================================
// REGISTRATION
// =============================================================================

describe('Registration', () => {
  it('POST /api/auth/register — creates account', async () => {
    const { status, data } = await api('POST', '/api/auth/register', {
      username: 'NewUser',
      password: 'secure123',
    });

    expect(status).toBe(201);
    expect(data.token).toBeDefined();
    expect(data.player.username).toBe('NewUser');
    expect(data.player.isGuest).toBe(false);
  });

  it('POST /api/auth/register — rejects missing fields', async () => {
    const { status } = await api('POST', '/api/auth/register', { username: 'OnlyUser' });
    expect(status).toBe(400);
  });

  it('POST /api/auth/register — rejects invalid username', async () => {
    const { status, data } = await api('POST', '/api/auth/register', {
      username: '1bad',
      password: 'secure123',
    });
    expect(status).toBe(400);
    expect(data.code).toBe('INVALID_USERNAME');
  });

  it('POST /api/auth/register — rejects short password', async () => {
    const { status, data } = await api('POST', '/api/auth/register', {
      username: 'ValidUser',
      password: '12345',
    });
    expect(status).toBe(400);
    expect(data.code).toBe('INVALID_PASSWORD');
  });

  it('POST /api/auth/register — rejects duplicate username', async () => {
    await api('POST', '/api/auth/register', { username: 'Taken', password: 'secure123' });
    const { status, data } = await api('POST', '/api/auth/register', {
      username: 'Taken',
      password: 'different456',
    });

    expect(status).toBe(409);
    expect(data.code).toBe('USERNAME_TAKEN');
  });
});

// =============================================================================
// LOGIN
// =============================================================================

describe('Login', () => {
  it('POST /api/auth/login — succeeds with correct credentials', async () => {
    await api('POST', '/api/auth/register', { username: 'LoginUser', password: 'mypass123' });
    const { status, data } = await api('POST', '/api/auth/login', {
      username: 'LoginUser',
      password: 'mypass123',
    });

    expect(status).toBe(200);
    expect(data.token).toBeDefined();
    expect(data.player.username).toBe('LoginUser');
    expect(data.player.gamesPlayed).toBe(0);
  });

  it('POST /api/auth/login — fails with wrong password', async () => {
    await api('POST', '/api/auth/register', { username: 'WrongPw', password: 'correct123' });
    const { status, data } = await api('POST', '/api/auth/login', {
      username: 'WrongPw',
      password: 'wrong123',
    });

    expect(status).toBe(401);
    expect(data.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/auth/login — fails for non-existent user', async () => {
    const { status } = await api('POST', '/api/auth/login', {
      username: 'NoSuchUser',
      password: 'doesntmatter',
    });

    expect(status).toBe(401);
  });

  it('POST /api/auth/login — fails for guest account (no password)', async () => {
    await api('POST', '/api/auth/guest', { name: 'GuestNoLogin' });
    const { status } = await api('POST', '/api/auth/login', {
      username: 'GuestNoLogin',
      password: 'anything',
    });

    expect(status).toBe(401);
  });
});

// =============================================================================
// PROFILE
// =============================================================================

describe('Profile', () => {
  it('GET /api/auth/me — returns player data with valid token', async () => {
    const { data: regData } = await api('POST', '/api/auth/register', {
      username: 'ProfileUser',
      password: 'mypass123',
    });

    const { status, data } = await api('GET', '/api/auth/me', undefined, regData.token);

    expect(status).toBe(200);
    expect(data.username).toBe('ProfileUser');
    expect(data.elo).toBe(1200);
    expect(data.gamesPlayed).toBe(0);
  });

  it('GET /api/auth/me — rejects without token', async () => {
    const { status } = await api('GET', '/api/auth/me');
    expect(status).toBe(401);
  });
});

// =============================================================================
// GUEST UPGRADE
// =============================================================================

describe('Guest Upgrade', () => {
  it('POST /api/auth/upgrade — converts guest to registered', async () => {
    const { data: guestData } = await api('POST', '/api/auth/guest', { name: 'TempGuest' });

    const { status, data } = await api('POST', '/api/auth/upgrade', {
      username: 'PermanentName',
      password: 'newpass123',
    }, guestData.token);

    expect(status).toBe(200);
    expect(data.player.username).toBe('PermanentName');
    expect(data.player.isGuest).toBe(false);
    expect(data.token).toBeDefined(); // new token

    // Can now login with new credentials
    const { status: loginStatus } = await api('POST', '/api/auth/login', {
      username: 'PermanentName',
      password: 'newpass123',
    });
    expect(loginStatus).toBe(200);
  });

  it('POST /api/auth/upgrade — rejects for already registered user', async () => {
    const { data: regData } = await api('POST', '/api/auth/register', {
      username: 'AlreadyReg',
      password: 'pass123456',
    });

    const { status, data } = await api('POST', '/api/auth/upgrade', {
      username: 'NewName',
      password: 'newpass123',
    }, regData.token);

    expect(status).toBe(400);
    expect(data.code).toBe('ALREADY_REGISTERED');
  });
});

// =============================================================================
// LEADERBOARD & PLAYER LOOKUP
// =============================================================================

describe('API Endpoints', () => {
  it('GET /api/leaderboard — returns sorted player list', async () => {
    await api('POST', '/api/auth/guest', { name: 'LowElo' });
    await api('POST', '/api/auth/guest', { name: 'HighElo' });

    const { status, data } = await api('GET', '/api/leaderboard');

    expect(status).toBe(200);
    expect(data.players.length).toBeGreaterThanOrEqual(2);
    expect(data.total).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/player/:username — returns player profile', async () => {
    await api('POST', '/api/auth/register', { username: 'LookupUser', password: 'pass123456' });

    const { status, data } = await api('GET', '/api/player/LookupUser');

    expect(status).toBe(200);
    expect(data.username).toBe('LookupUser');
    expect(data.elo).toBe(1200);
  });

  it('GET /api/player/:username — returns 404 for unknown player', async () => {
    const { status } = await api('GET', '/api/player/NoSuchPlayer');
    expect(status).toBe(404);
  });

  it('GET /health — includes database status', async () => {
    const { status, data } = await api('GET', '/health');

    expect(status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.database).toBe('connected');
    expect(typeof data.totalGamesRecorded).toBe('number');
  });

  it('GET /metrics — returns prometheus format', async () => {
    const res = await fetch(`${baseUrl}/metrics`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('chess_connected_players');
    expect(text).toContain('chess_active_games');
    expect(text).toContain('# HELP');
  });
});
