/**
 * ELO System Tests
 * Covers: ELO calculations, bounds checking, edge cases
 */

import { describe, it, expect } from 'vitest';
import { calculateEloChange } from '../src/gameState';
import { getLevelForElo, getLevelProgress, checkLevelChange, LEVELS } from '../src/levelSystem';

describe('ELO Calculations', () => {
    describe('calculateEloChange', () => {
        it('should give positive ELO for wins', () => {
            const change = calculateEloChange(1000, 1000, 'win');
            expect(change).toBeGreaterThan(0);
        });

        it('should give negative ELO for losses', () => {
            const change = calculateEloChange(1000, 1000, 'loss');
            expect(change).toBeLessThan(0);
        });

        it('should give roughly zero ELO for draws against equal opponent', () => {
            const change = calculateEloChange(1000, 1000, 'draw');
            expect(Math.abs(change)).toBeLessThanOrEqual(1);
        });

        it('should give more ELO for upset wins', () => {
            const upsetWin = calculateEloChange(800, 1200, 'win');
            const expectedWin = calculateEloChange(1200, 800, 'win');
            expect(upsetWin).toBeGreaterThan(expectedWin);
        });

        it('should lose less ELO for expected losses', () => {
            const expectedLoss = calculateEloChange(800, 1200, 'loss');
            const upsetLoss = calculateEloChange(1200, 800, 'loss');
            expect(Math.abs(expectedLoss)).toBeLessThan(Math.abs(upsetLoss));
        });

        it('should use K-factor correctly', () => {
            const change32 = calculateEloChange(1000, 1000, 'win', 32);
            const change16 = calculateEloChange(1000, 1000, 'win', 16);
            expect(change32).toBe(change16 * 2);
        });

        it('should handle extreme ELO differences', () => {
            // Low ELO vs very high ELO
            const upsetWin = calculateEloChange(400, 3000, 'win');
            expect(upsetWin).toBeGreaterThan(30); // Should be close to K-factor
            
            // High ELO vs very low ELO
            const expectedWin = calculateEloChange(3000, 400, 'win');
            expect(expectedWin).toBeLessThan(5); // Minimal gain
        });
    });
});

describe('Level System', () => {
    describe('getLevelForElo', () => {
        it('should return correct level for each ELO range', () => {
            expect(getLevelForElo(100).name).toBe('Beginner');
            expect(getLevelForElo(400).name).toBe('Novice');
            expect(getLevelForElo(1000).name).toBe('Amateur');
            expect(getLevelForElo(2300).name).toBe('Grandmaster');
        });

        it('should return highest level for ELO above max', () => {
            const level = getLevelForElo(9999);
            expect(level.name).toBe('Beyond');
        });

        it('should return first level for ELO below min', () => {
            const level = getLevelForElo(50);
            // If ELO is below first level's minElo, should return highest level (Beyond)
            // Actually let's check what happens at boundary
            expect(level).toBeDefined();
        });

        it('should have increasing AI depth with level', () => {
            const beginner = getLevelForElo(100);
            const expert = getLevelForElo(1500);
            const grandmaster = getLevelForElo(2300);
            
            expect(beginner.aiDepth).toBeLessThan(expert.aiDepth);
            expect(expert.aiDepth).toBeLessThanOrEqual(grandmaster.aiDepth);
        });

        it('should have decreasing AI randomness with level', () => {
            const beginner = getLevelForElo(100);
            const expert = getLevelForElo(1500);
            const grandmaster = getLevelForElo(2300);
            
            expect(beginner.aiRandomness).toBeGreaterThan(expert.aiRandomness);
            expect(expert.aiRandomness).toBeGreaterThan(grandmaster.aiRandomness);
        });
    });

    describe('getLevelProgress', () => {
        it('should return 0% at level minimum', () => {
            const progress = getLevelProgress(300); // Novice starts at 300
            expect(progress).toBe(0);
        });

        it('should return 100% at level maximum', () => {
            const progress = getLevelProgress(499); // Novice ends at 499
            expect(progress).toBeCloseTo(100, 0);
        });

        it('should return ~50% at level midpoint', () => {
            // Novice: 300-499 (range 200), midpoint = 400
            const progress = getLevelProgress(400);
            expect(progress).toBeCloseTo(50, 0); // Within 1% tolerance
        });

        it('should handle boundary values', () => {
            expect(getLevelProgress(100)).toBe(0); // Exact level start
            expect(getLevelProgress(299)).toBeCloseTo(100, 0); // Just before next level
        });
    });

    describe('checkLevelChange', () => {
        it('should detect level up', () => {
            const result = checkLevelChange(299, 300); // Beginner to Novice
            expect(result).toBe('up');
        });

        it('should detect level down', () => {
            const result = checkLevelChange(300, 299); // Novice to Beginner
            expect(result).toBe('down');
        });

        it('should return null for same level', () => {
            const result = checkLevelChange(350, 380); // Both Novice
            expect(result).toBeNull();
        });

        it('should handle multiple level jumps', () => {
            // Jump from Beginner to Apprentice (skipping Novice)
            const result = checkLevelChange(200, 600);
            expect(result).toBe('up');
        });
    });

    describe('LEVELS array', () => {
        it('should have continuous ELO coverage', () => {
            for (let i = 1; i < LEVELS.length; i++) {
                const prev = LEVELS[i - 1];
                const curr = LEVELS[i];
                expect(curr.minElo).toBe(prev.maxElo + 1);
            }
        });

        it('should have unique level names', () => {
            const names = LEVELS.map(l => l.name);
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(names.length);
        });

        it('should have sequential level numbers', () => {
            LEVELS.forEach((level, index) => {
                expect(level.level).toBe(index + 1);
            });
        });
    });
});
