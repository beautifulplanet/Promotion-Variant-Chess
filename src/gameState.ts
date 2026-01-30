// src/gameState.ts
// ELO calculation utility

/**
 * Calculate ELO change after a game using standard ELO formula
 * @param playerElo - Current player ELO
 * @param opponentElo - Opponent's ELO
 * @param result - 'win', 'loss', or 'draw'
 * @param kFactor - K-factor determining volatility (default 32)
 * @returns ELO change (can be negative for losses)
 */
export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  result: 'win' | 'loss' | 'draw',
  kFactor: number = 32
): number {
  // Expected score formula: E = 1 / (1 + 10^((Ro-Rp)/400))
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  
  // Actual score: 1 for win, 0 for loss, 0.5 for draw
  let actualScore: number;
  if (result === 'win') actualScore = 1;
  else if (result === 'loss') actualScore = 0;
  else actualScore = 0.5;
  
  // ELO change: K * (actual - expected)
  return Math.round(kFactor * (actualScore - expectedScore));
}
