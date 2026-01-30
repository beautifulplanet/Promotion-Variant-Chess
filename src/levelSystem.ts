// src/levelSystem.ts
// Player level progression system

export interface LevelInfo {
  level: number;
  name: string;
  minElo: number;
  maxElo: number;
  aiDepth: number;
  aiRandomness: number;
}

/**
 * All levels in the game (infinite scaling after max)
 */
export const LEVELS: LevelInfo[] = [
  { level: 1,  name: 'Beginner',        minElo: 100,  maxElo: 299,  aiDepth: 1, aiRandomness: 0.6 },
  { level: 2,  name: 'Novice',          minElo: 300,  maxElo: 499,  aiDepth: 1, aiRandomness: 0.5 },
  { level: 3,  name: 'Apprentice',      minElo: 500,  maxElo: 699,  aiDepth: 1, aiRandomness: 0.4 },
  { level: 4,  name: 'Student',         minElo: 700,  maxElo: 899,  aiDepth: 2, aiRandomness: 0.35 },
  { level: 5,  name: 'Amateur',         minElo: 900,  maxElo: 1099, aiDepth: 2, aiRandomness: 0.3 },
  { level: 6,  name: 'Club Player',     minElo: 1100, maxElo: 1299, aiDepth: 2, aiRandomness: 0.25 },
  { level: 7,  name: 'Tournament',      minElo: 1300, maxElo: 1499, aiDepth: 2, aiRandomness: 0.2 },
  { level: 8,  name: 'Expert',          minElo: 1500, maxElo: 1699, aiDepth: 3, aiRandomness: 0.15 },
  { level: 9,  name: 'Candidate Master',minElo: 1700, maxElo: 1899, aiDepth: 3, aiRandomness: 0.1 },
  { level: 10, name: 'Master',          minElo: 1900, maxElo: 2099, aiDepth: 3, aiRandomness: 0.05 },
  { level: 11, name: 'International',   minElo: 2100, maxElo: 2299, aiDepth: 3, aiRandomness: 0.02 },
  { level: 12, name: 'Grandmaster',     minElo: 2300, maxElo: 2499, aiDepth: 4, aiRandomness: 0.01 },
  { level: 13, name: 'Super GM',        minElo: 2500, maxElo: 2699, aiDepth: 4, aiRandomness: 0 },
  { level: 14, name: 'World Class',     minElo: 2700, maxElo: 2999, aiDepth: 4, aiRandomness: 0 },
  { level: 15, name: 'Legend',          minElo: 3000, maxElo: 3499, aiDepth: 5, aiRandomness: 0 },
  { level: 16, name: 'Immortal',        minElo: 3500, maxElo: 3999, aiDepth: 5, aiRandomness: 0 },
  { level: 17, name: 'Chess God',       minElo: 4000, maxElo: 4499, aiDepth: 5, aiRandomness: 0 },
  { level: 18, name: 'Transcendent',    minElo: 4500, maxElo: 4999, aiDepth: 6, aiRandomness: 0 },
  { level: 19, name: 'Beyond',          minElo: 5000, maxElo: 9999, aiDepth: 6, aiRandomness: 0 },
];

/**
 * Get level info for a given ELO
 */
export function getLevelForElo(elo: number): LevelInfo {
  for (const level of LEVELS) {
    if (elo >= level.minElo && elo <= level.maxElo) {
      return level;
    }
  }
  // If above max, return highest level
  return LEVELS[LEVELS.length - 1];
}

/**
 * Get progress within current level (0-100%)
 */
export function getLevelProgress(elo: number): number {
  const level = getLevelForElo(elo);
  const range = level.maxElo - level.minElo;
  const progress = elo - level.minElo;
  return Math.min(100, Math.max(0, (progress / range) * 100));
}

/**
 * Check if player leveled up or down
 */
export function checkLevelChange(oldElo: number, newElo: number): 'up' | 'down' | null {
  const oldLevel = getLevelForElo(oldElo);
  const newLevel = getLevelForElo(newElo);
  
  if (newLevel.level > oldLevel.level) return 'up';
  if (newLevel.level < oldLevel.level) return 'down';
  return null;
}

/**
 * Get AI settings for current level
 */
export function getAISettingsForLevel(elo: number): { depth: number; randomness: number } {
  const level = getLevelForElo(elo);
  return { depth: level.aiDepth, randomness: level.aiRandomness };
}
