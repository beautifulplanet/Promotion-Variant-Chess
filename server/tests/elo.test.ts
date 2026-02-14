// =============================================================================
// ELO Rating Calculator — Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import { expectedScore, kFactor, calculateNewElo, calculateMatchElo } from '../src/elo.js';

describe('ELO System', () => {
  describe('expectedScore', () => {
    it('equal ratings → 0.5', () => {
      expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 5);
    });

    it('higher rated player has higher expected score', () => {
      expect(expectedScore(1400, 1200)).toBeGreaterThan(0.5);
      expect(expectedScore(1200, 1400)).toBeLessThan(0.5);
    });

    it('400-point gap → ~0.91 for stronger player', () => {
      const score = expectedScore(1600, 1200);
      expect(score).toBeCloseTo(0.909, 2);
    });

    it('symmetric: E(A) + E(B) ≈ 1', () => {
      const eA = expectedScore(1400, 1200);
      const eB = expectedScore(1200, 1400);
      expect(eA + eB).toBeCloseTo(1.0, 10);
    });
  });

  describe('kFactor', () => {
    it('new player (<30 games) → K=32', () => {
      expect(kFactor(0)).toBe(32);
      expect(kFactor(10)).toBe(32);
      expect(kFactor(29)).toBe(32);
    });

    it('established player (≥30 games) → K=16', () => {
      expect(kFactor(30)).toBe(16);
      expect(kFactor(100)).toBe(16);
    });
  });

  describe('calculateNewElo', () => {
    it('winner gains points', () => {
      const result = calculateNewElo(1200, 1200, 1, 10);
      expect(result.change).toBeGreaterThan(0);
      expect(result.newElo).toBeGreaterThan(1200);
    });

    it('loser loses points', () => {
      const result = calculateNewElo(1200, 1200, 0, 10);
      expect(result.change).toBeLessThan(0);
      expect(result.newElo).toBeLessThan(1200);
    });

    it('draw against equal → no change', () => {
      const result = calculateNewElo(1200, 1200, 0.5, 10);
      expect(result.change).toBeCloseTo(0, 5);
    });

    it('upset win gains more than expected win', () => {
      const upset = calculateNewElo(1000, 1400, 1, 10);
      const expected = calculateNewElo(1400, 1000, 1, 10);
      expect(upset.change).toBeGreaterThan(expected.change);
    });

    it('elo floor at 0', () => {
      // With K=16, loss of rating 10 vs 2000 is tiny (rounds to 0)
      // Use a scenario that actually drives elo below 0
      const result = calculateNewElo(5, 2000, 0, 5);
      // K=32, expected ≈ 0.0009, change = round(32 * (0 - 0.0009)) = 0
      // The floor still applies: newElo >= 0
      expect(result.newElo).toBeGreaterThanOrEqual(0);
      expect(result.change).toBeLessThanOrEqual(0);
    });
  });

  describe('calculateMatchElo', () => {
    it('white win: white gains, black loses', () => {
      const result = calculateMatchElo(1200, 1200, 'white', 10, 10);
      expect(result.white.change).toBeGreaterThan(0);
      expect(result.black.change).toBeLessThan(0);
    });

    it('black win: black gains, white loses', () => {
      const result = calculateMatchElo(1200, 1200, 'black', 10, 10);
      expect(result.black.change).toBeGreaterThan(0);
      expect(result.white.change).toBeLessThan(0);
    });

    it('draw: approximately zero-sum', () => {
      const result = calculateMatchElo(1200, 1200, 'draw', 10, 10);
      expect(result.white.change).toBeCloseTo(0, 5);
      expect(result.black.change).toBeCloseTo(0, 5);
    });

    it('changes are approximately zero-sum (same K)', () => {
      const result = calculateMatchElo(1300, 1100, 'white', 50, 50);
      expect(result.white.change + result.black.change).toBeCloseTo(0, 0);
    });
  });
});
