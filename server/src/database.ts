// =============================================================================
// Database Service — Prisma-backed persistence for players & games
// Abstracts all DB operations behind clean async methods
// =============================================================================

import 'dotenv/config';
import { PrismaClient } from './generated/prisma/client.js';

// Singleton Prisma client
let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL || 'file:./dev.db',
    });
  }
  return prisma;
}

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export async function disconnectDB(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// =============================================================================
// PLAYER OPERATIONS
// =============================================================================

export interface PlayerRecord {
  id: string;
  username: string;
  password: string | null;
  isGuest: boolean;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: Date;
}

/**
 * Find a player by username. Returns null if not found.
 */
export async function findPlayerByUsername(username: string): Promise<PlayerRecord | null> {
  const db = getPrisma();
  return db.player.findUnique({ where: { username } });
}

/**
 * Find a player by ID. Returns null if not found.
 */
export async function findPlayerById(id: string): Promise<PlayerRecord | null> {
  const db = getPrisma();
  return db.player.findUnique({ where: { id } });
}

/**
 * Create a new player (guest or registered).
 */
export async function createPlayer(data: {
  username: string;
  password?: string;
  isGuest?: boolean;
  elo?: number;
}): Promise<PlayerRecord> {
  const db = getPrisma();
  return db.player.create({
    data: {
      username: data.username,
      password: data.password ?? null,
      isGuest: data.isGuest ?? true,
      elo: data.elo ?? 1200,
    },
  });
}

/**
 * Update player ELO and game stats after a match.
 */
export async function updatePlayerAfterGame(
  playerId: string,
  newElo: number,
  result: 'win' | 'loss' | 'draw',
): Promise<PlayerRecord> {
  const db = getPrisma();
  const increment: { wins?: number; losses?: number; draws?: number } = {};
  if (result === 'win') increment.wins = 1;
  else if (result === 'loss') increment.losses = 1;
  else increment.draws = 1;

  return db.player.update({
    where: { id: playerId },
    data: {
      elo: newElo,
      gamesPlayed: { increment: 1 },
      ...increment.wins ? { wins: { increment: 1 } } : {},
      ...increment.losses ? { losses: { increment: 1 } } : {},
      ...increment.draws ? { draws: { increment: 1 } } : {},
    },
  });
}

/**
 * Convert a guest account to a registered account.
 */
export async function upgradeGuestAccount(
  playerId: string,
  newUsername: string,
  hashedPassword: string,
): Promise<PlayerRecord> {
  const db = getPrisma();
  return db.player.update({
    where: { id: playerId },
    data: {
      username: newUsername,
      password: hashedPassword,
      isGuest: false,
    },
  });
}

/**
 * Get leaderboard — top players sorted by ELO.
 */
export async function getLeaderboard(
  page: number = 1,
  limit: number = 20,
): Promise<{ players: PlayerRecord[]; total: number }> {
  const db = getPrisma();
  const offset = (page - 1) * limit;

  const [players, total] = await Promise.all([
    db.player.findMany({
      orderBy: { elo: 'desc' },
      skip: offset,
      take: limit,
    }),
    db.player.count(),
  ]);

  return { players, total };
}

// =============================================================================
// GAME OPERATIONS
// =============================================================================

export interface GameRecord {
  id: string;
  whiteId: string;
  blackId: string;
  result: string;
  reason: string;
  pgn: string | null;
  fen: string | null;
  moves: number;
  timeControl: string;
  duration: number;
  createdAt: Date;
}

/**
 * Save a completed game to the database.
 */
export async function saveGame(data: {
  whiteId: string;
  blackId: string;
  result: string;
  reason: string;
  pgn?: string;
  fen?: string;
  moves?: number;
  timeControl: { initial: number; increment: number };
  duration?: number;
}): Promise<GameRecord> {
  const db = getPrisma();
  return db.game.create({
    data: {
      whiteId: data.whiteId,
      blackId: data.blackId,
      result: data.result,
      reason: data.reason,
      pgn: data.pgn ?? null,
      fen: data.fen ?? null,
      moves: data.moves ?? 0,
      timeControl: JSON.stringify(data.timeControl),
      duration: data.duration ?? 0,
    },
  });
}

/**
 * Get a player's recent games.
 */
export async function getPlayerGames(
  playerId: string,
  limit: number = 20,
): Promise<GameRecord[]> {
  const db = getPrisma();
  return db.game.findMany({
    where: {
      OR: [{ whiteId: playerId }, { blackId: playerId }],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get total number of games played on the server.
 */
export async function getTotalGames(): Promise<number> {
  const db = getPrisma();
  return db.game.count();
}
