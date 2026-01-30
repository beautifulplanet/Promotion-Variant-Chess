/**
 * Save System Tests
 * Covers: Save validation, data sanitization, edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
    createDefaultSave, 
    updateStatsAfterGame, 
    recordPromotion,
    type SaveData 
} from '../src/saveSystem';

describe('Save System', () => {
    describe('createDefaultSave', () => {
        it('should create valid default save', () => {
            const save = createDefaultSave();
            
            expect(save.elo).toBe(400);
            expect(save.gamesWon).toBe(0);
            expect(save.gamesLost).toBe(0);
            expect(save.gamesPlayed).toBe(0);
            expect(save.highestElo).toBe(400);
            expect(save.currentWinStreak).toBe(0);
            expect(save.bestWinStreak).toBe(0);
            expect(save.promotedPieces).toEqual([]);
            expect(save.saveVersion).toBeDefined();
            expect(save.savedAt).toBeDefined();
        });

        it('should create ISO timestamp', () => {
            const save = createDefaultSave();
            const date = new Date(save.savedAt);
            expect(date.toISOString()).toBe(save.savedAt);
        });
    });

    describe('updateStatsAfterGame', () => {
        let baseSave: SaveData;

        beforeEach(() => {
            baseSave = createDefaultSave();
        });

        it('should increment games played on win', () => {
            const updated = updateStatsAfterGame(baseSave, 450, true, false);
            expect(updated.gamesPlayed).toBe(1);
        });

        it('should increment gamesWon on win', () => {
            const updated = updateStatsAfterGame(baseSave, 450, true, false);
            expect(updated.gamesWon).toBe(1);
            expect(updated.gamesLost).toBe(0);
        });

        it('should increment gamesLost on loss', () => {
            const updated = updateStatsAfterGame(baseSave, 350, false, false);
            expect(updated.gamesLost).toBe(1);
            expect(updated.gamesWon).toBe(0);
        });

        it('should not increment wins/losses on draw', () => {
            const updated = updateStatsAfterGame(baseSave, 400, false, true);
            expect(updated.gamesWon).toBe(0);
            expect(updated.gamesLost).toBe(0);
            expect(updated.gamesPlayed).toBe(1);
        });

        it('should update ELO', () => {
            const updated = updateStatsAfterGame(baseSave, 500, true, false);
            expect(updated.elo).toBe(500);
        });

        it('should enforce minimum ELO (100)', () => {
            const updated = updateStatsAfterGame(baseSave, 50, false, false);
            expect(updated.elo).toBe(100);
        });

        it('should enforce maximum ELO (10000)', () => {
            const updated = updateStatsAfterGame(baseSave, 15000, true, false);
            expect(updated.elo).toBe(10000);
        });

        it('should update highest ELO on new high', () => {
            const updated = updateStatsAfterGame(baseSave, 600, true, false);
            expect(updated.highestElo).toBe(600);
        });

        it('should not lower highest ELO on loss', () => {
            baseSave.highestElo = 600;
            baseSave.elo = 600;
            const updated = updateStatsAfterGame(baseSave, 500, false, false);
            expect(updated.highestElo).toBe(600);
        });

        it('should update win streak on win', () => {
            const updated = updateStatsAfterGame(baseSave, 450, true, false);
            expect(updated.currentWinStreak).toBe(1);
        });

        it('should reset win streak on loss', () => {
            baseSave.currentWinStreak = 5;
            const updated = updateStatsAfterGame(baseSave, 350, false, false);
            expect(updated.currentWinStreak).toBe(0);
        });

        it('should preserve win streak on draw', () => {
            baseSave.currentWinStreak = 5;
            const updated = updateStatsAfterGame(baseSave, 400, false, true);
            expect(updated.currentWinStreak).toBe(5);
        });

        it('should update best win streak', () => {
            baseSave.currentWinStreak = 9;
            baseSave.bestWinStreak = 5;
            const updated = updateStatsAfterGame(baseSave, 500, true, false);
            expect(updated.bestWinStreak).toBe(10);
        });
    });

    describe('recordPromotion', () => {
        it('should add promoted piece to list', () => {
            const save = createDefaultSave();
            const updated = recordPromotion(save, 'Q');
            
            expect(updated.promotedPieces.length).toBe(1);
            expect(updated.promotedPieces[0].type).toBe('Q');
        });

        it('should record ELO at promotion time', () => {
            const save = createDefaultSave();
            save.elo = 1500;
            const updated = recordPromotion(save, 'R');
            
            expect(updated.promotedPieces[0].earnedAtElo).toBe(1500);
        });

        it('should update total promotions count', () => {
            const save = createDefaultSave();
            let updated = recordPromotion(save, 'Q');
            updated = recordPromotion(updated, 'Q');
            updated = recordPromotion(updated, 'R');
            
            expect(updated.totalPromotions['Q']).toBe(2);
            expect(updated.totalPromotions['R']).toBe(1);
        });

        it('should preserve existing pieces', () => {
            const save = createDefaultSave();
            let updated = recordPromotion(save, 'Q');
            updated = recordPromotion(updated, 'N');
            
            expect(updated.promotedPieces.length).toBe(2);
            expect(updated.promotedPieces[0].type).toBe('Q');
            expect(updated.promotedPieces[1].type).toBe('N');
        });
    });

    describe('ELO Bounds Validation', () => {
        it('should clamp ELO to minimum 100', () => {
            const save = createDefaultSave();
            const updated = updateStatsAfterGame(save, -500, false, false);
            expect(updated.elo).toBeGreaterThanOrEqual(100);
        });

        it('should clamp ELO to maximum 10000', () => {
            const save = createDefaultSave();
            const updated = updateStatsAfterGame(save, 99999, true, false);
            expect(updated.elo).toBeLessThanOrEqual(10000);
        });

        it('should clamp highestElo to maximum 10000', () => {
            const save = createDefaultSave();
            const updated = updateStatsAfterGame(save, 15000, true, false);
            expect(updated.highestElo).toBeLessThanOrEqual(10000);
        });
    });
});
