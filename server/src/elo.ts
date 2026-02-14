// =============================================================================
// ELO Rating Calculator
// Standard ELO with K-factor adjustment for new players
// =============================================================================

export interface EloResult {
  newElo: number;
  change: number;
}

export interface EloMatchResult {
  white: EloResult;
  black: EloResult;
}

/**
 * Calculate the expected score for a player against an opponent.
 * E = 1 / (1 + 10^((R_opponent - R_player) / 400))
 */
export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Get the K-factor based on number of games played.
 * - New players (< 30 games): K=32 (rating adjusts quickly)
 * - Established players: K=16 (rating more stable)
 */
export function kFactor(gamesPlayed: number): number {
  return gamesPlayed < 30 ? 32 : 16;
}

/**
 * Calculate new ELO rating after a game.
 * @param playerElo Current rating
 * @param opponentElo Opponent's rating
 * @param score Actual score: 1 (win), 0.5 (draw), 0 (loss)
 * @param gamesPlayed Player's total games (for K-factor)
 */
export function calculateNewElo(
  playerElo: number,
  opponentElo: number,
  score: number,
  gamesPlayed: number,
): EloResult {
  const expected = expectedScore(playerElo, opponentElo);
  const k = kFactor(gamesPlayed);
  const change = Math.round(k * (score - expected));
  return {
    newElo: Math.max(0, playerElo + change), // Floor at 0
    change,
  };
}

/**
 * Calculate ELO changes for both players after a game.
 * @param whiteElo White's current rating
 * @param blackElo Black's current rating
 * @param result 'white' | 'black' | 'draw'
 * @param whiteGames White's total games
 * @param blackGames Black's total games
 */
export function calculateMatchElo(
  whiteElo: number,
  blackElo: number,
  result: 'white' | 'black' | 'draw',
  whiteGames: number,
  blackGames: number,
): EloMatchResult {
  let whiteScore: number;
  let blackScore: number;

  switch (result) {
    case 'white':
      whiteScore = 1;
      blackScore = 0;
      break;
    case 'black':
      whiteScore = 0;
      blackScore = 1;
      break;
    case 'draw':
      whiteScore = 0.5;
      blackScore = 0.5;
      break;
  }

  return {
    white: calculateNewElo(whiteElo, blackElo, whiteScore, whiteGames),
    black: calculateNewElo(blackElo, whiteElo, blackScore, blackGames),
  };
}
