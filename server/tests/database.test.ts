// =============================================================================
// Database Service Tests — Prisma + SQLite
// Uses a separate test database to avoid conflicts
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setPrisma, getPrisma, disconnectDB,
  createPlayer, findPlayerByUsername, findPlayerById,
  updatePlayerAfterGame, upgradeGuestAccount,
  getLeaderboard, saveGame, getPlayerGames, getTotalGames,
} from '../src/database.js';

let prisma: ReturnType<typeof getPrisma>;

beforeAll(async () => {
  prisma = getPrisma();
});

afterAll(async () => {
  await disconnectDB();
});

// Clean the database before each test
beforeEach(async () => {
  await prisma.game.deleteMany();
  await prisma.player.deleteMany();
});

// =============================================================================
// PLAYER CRUD
// =============================================================================

describe('Player Operations', () => {
  it('creates a guest player with default ELO', async () => {
    const player = await createPlayer({ username: 'GuestAlice', isGuest: true });

    expect(player.id).toBeDefined();
    expect(player.username).toBe('GuestAlice');
    expect(player.isGuest).toBe(true);
    expect(player.elo).toBe(1200);
    expect(player.gamesPlayed).toBe(0);
    expect(player.wins).toBe(0);
    expect(player.losses).toBe(0);
    expect(player.draws).toBe(0);
  });

  it('creates a registered player with password', async () => {
    const player = await createPlayer({
      username: 'RegisteredBob',
      password: 'hashed-pw',
      isGuest: false,
    });

    expect(player.username).toBe('RegisteredBob');
    expect(player.password).toBe('hashed-pw');
    expect(player.isGuest).toBe(false);
  });

  it('enforces unique usernames', async () => {
    await createPlayer({ username: 'UniquePlayer' });
    await expect(createPlayer({ username: 'UniquePlayer' })).rejects.toThrow();
  });

  it('finds player by username', async () => {
    await createPlayer({ username: 'FindMe' });

    const found = await findPlayerByUsername('FindMe');
    expect(found).not.toBeNull();
    expect(found!.username).toBe('FindMe');

    const notFound = await findPlayerByUsername('NonExistent');
    expect(notFound).toBeNull();
  });

  it('finds player by ID', async () => {
    const created = await createPlayer({ username: 'ByIdPlayer' });
    const found = await findPlayerById(created.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });
});

// =============================================================================
// PLAYER UPDATES
// =============================================================================

describe('Player Updates', () => {
  it('updates ELO after a win', async () => {
    const player = await createPlayer({ username: 'Winner' });
    const updated = await updatePlayerAfterGame(player.id, 1216, 'win');

    expect(updated.elo).toBe(1216);
    expect(updated.gamesPlayed).toBe(1);
    expect(updated.wins).toBe(1);
    expect(updated.losses).toBe(0);
  });

  it('updates ELO after a loss', async () => {
    const player = await createPlayer({ username: 'Loser' });
    const updated = await updatePlayerAfterGame(player.id, 1184, 'loss');

    expect(updated.elo).toBe(1184);
    expect(updated.gamesPlayed).toBe(1);
    expect(updated.losses).toBe(1);
    expect(updated.wins).toBe(0);
  });

  it('updates ELO after a draw', async () => {
    const player = await createPlayer({ username: 'Drawer' });
    const updated = await updatePlayerAfterGame(player.id, 1200, 'draw');

    expect(updated.elo).toBe(1200);
    expect(updated.gamesPlayed).toBe(1);
    expect(updated.draws).toBe(1);
  });

  it('accumulates multiple game results', async () => {
    const player = await createPlayer({ username: 'MultiGame' });

    await updatePlayerAfterGame(player.id, 1216, 'win');
    await updatePlayerAfterGame(player.id, 1230, 'win');
    const final = await updatePlayerAfterGame(player.id, 1220, 'loss');

    expect(final.gamesPlayed).toBe(3);
    expect(final.wins).toBe(2);
    expect(final.losses).toBe(1);
    expect(final.elo).toBe(1220);
  });

  it('upgrades a guest account', async () => {
    const guest = await createPlayer({ username: 'Guest_abc' });
    expect(guest.isGuest).toBe(true);

    const upgraded = await upgradeGuestAccount(guest.id, 'RealUsername', 'hashed-new-pw');

    expect(upgraded.username).toBe('RealUsername');
    expect(upgraded.password).toBe('hashed-new-pw');
    expect(upgraded.isGuest).toBe(false);
    // ELO preserved
    expect(upgraded.elo).toBe(guest.elo);
  });
});

// =============================================================================
// LEADERBOARD
// =============================================================================

describe('Leaderboard', () => {
  it('returns players sorted by ELO descending', async () => {
    await createPlayer({ username: 'Low', elo: 800 });
    await createPlayer({ username: 'High', elo: 2000 });
    await createPlayer({ username: 'Mid', elo: 1400 });

    const { players, total } = await getLeaderboard(1, 10);

    expect(total).toBe(3);
    expect(players[0].username).toBe('High');
    expect(players[1].username).toBe('Mid');
    expect(players[2].username).toBe('Low');
  });

  it('supports pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await createPlayer({ username: `Player${i}`, elo: 1000 + i * 100 });
    }

    const page1 = await getLeaderboard(1, 2);
    expect(page1.players).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.players[0].elo).toBe(1400); // highest

    const page2 = await getLeaderboard(2, 2);
    expect(page2.players).toHaveLength(2);
    expect(page2.players[0].elo).toBe(1200);

    const page3 = await getLeaderboard(3, 2);
    expect(page3.players).toHaveLength(1);
  });
});

// =============================================================================
// GAME RECORDS
// =============================================================================

describe('Game Records', () => {
  it('saves a game record', async () => {
    const white = await createPlayer({ username: 'WhitePlayer' });
    const black = await createPlayer({ username: 'BlackPlayer' });

    const game = await saveGame({
      whiteId: white.id,
      blackId: black.id,
      result: 'white',
      reason: 'checkmate',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
      moves: 30,
      timeControl: { initial: 600, increment: 0 },
      duration: 300,
    });

    expect(game.id).toBeDefined();
    expect(game.whiteId).toBe(white.id);
    expect(game.blackId).toBe(black.id);
    expect(game.result).toBe('white');
    expect(game.reason).toBe('checkmate');
    expect(game.moves).toBe(30);
    expect(game.duration).toBe(300);
  });

  it('retrieves player games in reverse chronological order', async () => {
    const white = await createPlayer({ username: 'White2' });
    const black = await createPlayer({ username: 'Black2' });

    await saveGame({
      whiteId: white.id,
      blackId: black.id,
      result: 'white',
      reason: 'checkmate',
      timeControl: { initial: 600, increment: 0 },
    });

    await saveGame({
      whiteId: black.id,
      blackId: white.id,
      result: 'draw',
      reason: 'stalemate',
      timeControl: { initial: 300, increment: 5 },
    });

    const games = await getPlayerGames(white.id);
    expect(games).toHaveLength(2);
    // Most recent first
    expect(games[0].result).toBe('draw');
    expect(games[1].result).toBe('white');
  });

  it('counts total games', async () => {
    const p1 = await createPlayer({ username: 'Counter1' });
    const p2 = await createPlayer({ username: 'Counter2' });

    expect(await getTotalGames()).toBe(0);

    await saveGame({
      whiteId: p1.id, blackId: p2.id,
      result: 'white', reason: 'checkmate',
      timeControl: { initial: 600, increment: 0 },
    });

    expect(await getTotalGames()).toBe(1);
  });
});
