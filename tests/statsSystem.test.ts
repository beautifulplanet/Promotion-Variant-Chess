/**
 * Stats System Tests
 * Covers: Career stats tracking, recording, streaks, persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Stats from '../src/statsSystem';

describe('Stats System', () => {
  beforeEach(() => {
    // Reset all stats before each test
    Stats.reset();
  });

  // ==========================================
  // INITIALIZATION
  // ==========================================
  describe('Initialization', () => {
    it('should start with zero games', () => {
      const stats = Stats.getStats();
      expect(stats.totalGames).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.draws).toBe(0);
    });

    it('should start with 0% win rate', () => {
      expect(Stats.getWinRate()).toBe(0);
    });

    it('should start with zero streak', () => {
      expect(Stats.getCurrentStreak()).toBe(0);
    });

    it('should start with default ELO range', () => {
      const stats = Stats.getStats();
      expect(stats.highestElo).toBe(400);
      expect(stats.lowestElo).toBe(400);
    });
  });

  // ==========================================
  // RECORDING GAMES
  // ==========================================
  describe('recordGame', () => {
    it('should count wins', () => {
      Stats.recordGame('win', 420);
      const stats = Stats.getStats();
      expect(stats.totalGames).toBe(1);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(0);
      expect(stats.draws).toBe(0);
    });

    it('should count losses', () => {
      Stats.recordGame('loss', 380);
      const stats = Stats.getStats();
      expect(stats.totalGames).toBe(1);
      expect(stats.losses).toBe(1);
    });

    it('should count draws', () => {
      Stats.recordGame('draw', 400);
      const stats = Stats.getStats();
      expect(stats.totalGames).toBe(1);
      expect(stats.draws).toBe(1);
    });

    it('should accumulate multiple games', () => {
      Stats.recordGame('win', 420);
      Stats.recordGame('loss', 400);
      Stats.recordGame('win', 430);
      Stats.recordGame('draw', 430);
      const stats = Stats.getStats();
      expect(stats.totalGames).toBe(4);
      expect(stats.wins).toBe(2);
      expect(stats.losses).toBe(1);
      expect(stats.draws).toBe(1);
    });
  });

  // ==========================================
  // WIN RATE
  // ==========================================
  describe('Win Rate', () => {
    it('should calculate correct win rate', () => {
      Stats.recordGame('win', 420);
      Stats.recordGame('loss', 400);
      expect(Stats.getWinRate()).toBe(50);
    });

    it('should return 100% for all wins', () => {
      Stats.recordGame('win', 420);
      Stats.recordGame('win', 440);
      expect(Stats.getWinRate()).toBe(100);
    });

    it('should return 0% for all losses', () => {
      Stats.recordGame('loss', 380);
      Stats.recordGame('loss', 360);
      expect(Stats.getWinRate()).toBe(0);
    });

    it('should round win rate', () => {
      Stats.recordGame('win', 420);
      Stats.recordGame('loss', 400);
      Stats.recordGame('loss', 380);
      // 1/3 = 33.33... → 33
      expect(Stats.getWinRate()).toBe(33);
    });
  });

  // ==========================================
  // STREAKS
  // ==========================================
  describe('Streaks', () => {
    it('should track positive win streak', () => {
      Stats.recordGame('win', 420);
      Stats.recordGame('win', 440);
      Stats.recordGame('win', 460);
      expect(Stats.getCurrentStreak()).toBe(3);
    });

    it('should track negative loss streak', () => {
      Stats.recordGame('loss', 380);
      Stats.recordGame('loss', 360);
      expect(Stats.getCurrentStreak()).toBe(-2);
    });

    it('should reset streak on draw', () => {
      Stats.recordGame('win', 420);
      Stats.recordGame('win', 440);
      Stats.recordGame('draw', 440);
      expect(Stats.getCurrentStreak()).toBe(0);
    });

    it('should flip streak on result change', () => {
      Stats.recordGame('win', 420);
      Stats.recordGame('win', 440);
      Stats.recordGame('loss', 420);
      expect(Stats.getCurrentStreak()).toBe(-1);
    });

    it('should track longest win streak', () => {
      Stats.recordGame('win', 420);
      Stats.recordGame('win', 440);
      Stats.recordGame('win', 460);
      Stats.recordGame('loss', 440);
      Stats.recordGame('win', 460);
      const stats = Stats.getStats();
      expect(stats.longestWinStreak).toBe(3);
    });

    it('should display streak correctly', () => {
      Stats.recordGame('win', 420);
      Stats.recordGame('win', 440);
      expect(Stats.getStreakDisplay()).toContain('🔥');
      expect(Stats.getStreakDisplay()).toContain('2');
    });

    it('should display loss streak with ice emoji', () => {
      Stats.recordGame('loss', 380);
      expect(Stats.getStreakDisplay()).toContain('❄️');
      expect(Stats.getStreakDisplay()).toContain('1');
    });

    it('should display empty for zero streak', () => {
      expect(Stats.getStreakDisplay()).toBe('');
    });
  });

  // ==========================================
  // ELO TRACKING
  // ==========================================
  describe('ELO Tracking', () => {
    it('should track highest ELO', () => {
      Stats.recordGame('win', 500);
      Stats.recordGame('win', 600);
      Stats.recordGame('loss', 550);
      const stats = Stats.getStats();
      expect(stats.highestElo).toBe(600);
    });

    it('should track lowest ELO', () => {
      Stats.recordGame('loss', 350);
      Stats.recordGame('win', 400);
      const stats = Stats.getStats();
      expect(stats.lowestElo).toBe(350);
    });
  });

  // ==========================================
  // PLAY TIME
  // ==========================================
  describe('Play Time', () => {
    it('should format play time as minutes', () => {
      const display = Stats.getPlayTimeDisplay();
      expect(display).toMatch(/\d+m/);
    });
  });

  // ==========================================
  // PERSISTENCE
  // ==========================================
  describe('Persistence', () => {
    it('should survive reset', () => {
      Stats.recordGame('win', 420);
      Stats.reset();
      const stats = Stats.getStats();
      expect(stats.totalGames).toBe(0);
      expect(stats.wins).toBe(0);
    });
  });
});
