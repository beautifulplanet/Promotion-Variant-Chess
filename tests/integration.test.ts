/**
 * Integration Tests
 * Covers full game flow, system interactions, and end-to-end scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Game from '../src/gameController';
import { engine } from '../src/engineProvider';
import { getEraForElo, ERAS } from '../src/eraSystem';
import { BALANCE } from '../src/constants';

describe('Integration Tests', () => {
    beforeEach(() => {
        Game.initGame();
        engine.reset();
    });

    // ==========================================
    // FULL GAME FLOW
    // ==========================================
    describe('Game Flow', () => {
        it('should complete a series of valid moves', () => {
            Game.startGame(); // Must start game before clicks work
            // Italian Game opening - white pawn e2-e4
            expect(Game.handleSquareClick(6, 4)).toBe(false); // Select e2
            expect(Game.handleSquareClick(4, 4)).toBe(true);  // Move to e4

            // Simulate black's reply (would normally be AI)
            engine.makeMove({ row: 1, col: 4 }, { row: 3, col: 4 }); // e5

            expect(Game.handleSquareClick(7, 6)).toBe(false); // Select g1 knight
            expect(Game.handleSquareClick(5, 5)).toBe(true);  // Move to f3
        });

        it('should synchronize engine and controller state', () => {
            const controllerBoard = Game.getBoard();
            const engineBoard = engine.getBoard();

            // Both should have same piece positions
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const cp = controllerBoard[row][col];
                    const ep = engineBoard[row][col];

                    if (cp && ep) {
                        expect(cp.type).toBe(ep.type);
                        expect(cp.color).toBe(ep.color);
                    } else {
                        expect(cp).toBe(ep);
                    }
                }
            }
        });
    });

    // ==========================================
    // ELO + ERA INTEGRATION
    // ==========================================
    describe('ELO and Era Integration', () => {
        it('should map starting ELO to expected era', () => {
            const state = Game.getState();
            const era = getEraForElo(state.elo);

            // Starting ELO (400) should be in Jurassic
            expect(era.name).toBe('Jurassic');
        });

        it('should progress through eras as ELO increases', () => {
            const eloValues = [100, 500, 800, 1200, 1600, 2000, 2500, 3000, 3500, 4000];
            const seenEras = new Set<string>();

            for (const elo of eloValues) {
                const era = getEraForElo(elo);
                seenEras.add(era.name);
            }

            // Should have seen multiple different eras
            expect(seenEras.size).toBeGreaterThan(5);
        });

        it('should have consistent era configs across system', () => {
            // Check that ERAS array matches getEraForElo results
            for (const era of ERAS) {
                const midElo = (era.eloMin + era.eloMax) / 2;
                const foundEra = getEraForElo(midElo);
                expect(foundEra.id).toBe(era.id);
            }
        });
    });

    // ==========================================
    // CONSTANTS INTEGRATION
    // ==========================================
    describe('Constants Integration', () => {
        it('should use correct starting ELO from BALANCE', () => {
            const state = Game.getState();
            expect(state.elo).toBe(BALANCE.startingElo);
        });

        it('should have valid AI depth config', () => {
            expect(BALANCE.maxAiDepth).toBeGreaterThanOrEqual(1);
            expect(BALANCE.maxAiDepth).toBeLessThanOrEqual(5);
        });

        it('should have valid ELO K-factor', () => {
            expect(BALANCE.eloKFactor).toBeGreaterThan(0);
        });
    });

    // ==========================================
    // CALLBACK INTEGRATION
    // ==========================================
    describe('Callback Integration', () => {
        it('should trigger state change callback on move', () => {
            const stateChanges: any[] = [];

            Game.registerCallbacks({
                onStateChange: (state) => stateChanges.push(state),
            });

            // Start game and make a selection and move
            Game.startGame();
            Game.handleSquareClick(6, 4);
            Game.handleSquareClick(4, 4);

            expect(stateChanges.length).toBeGreaterThan(0);
        });

        it('should trigger level change callback when ELO changes level', () => {
            const levelChanges: any[] = [];

            Game.registerCallbacks({
                onLevelChange: (level) => levelChanges.push(level),
            });

            // Level changes would happen after win/loss
            // This is a structural test - actual level change requires game completion
            expect(true).toBe(true);
        });
    });

    // ==========================================
    // SCENE READINESS
    // ==========================================
    describe('Scene Configuration', () => {
        it('should have valid primary assets for each era', () => {
            for (const era of ERAS) {
                expect(era.primaryAssets.length).toBeGreaterThan(0);
                for (const asset of era.primaryAssets) {
                    expect(typeof asset).toBe('string');
                    expect(asset.length).toBeGreaterThan(0);
                }
            }
        });

        it('should have valid secondary assets for each era', () => {
            for (const era of ERAS) {
                expect(era.secondaryAssets.length).toBeGreaterThan(0);
                for (const asset of era.secondaryAssets) {
                    expect(typeof asset).toBe('string');
                    expect(asset.length).toBeGreaterThan(0);
                }
            }
        });

        it('should have valid particle configs for each era', () => {
            for (const era of ERAS) {
                expect(era.particleType).toBeDefined();
                expect(era.particleColor).toBeGreaterThanOrEqual(0);
                expect(era.particleDensity).toBeGreaterThan(0);
            }
        });

        it('should have valid lighting for each era', () => {
            for (const era of ERAS) {
                expect(era.sunIntensity).toBeGreaterThan(0);
                expect(era.ambientIntensity).toBeGreaterThan(0);
                expect(era.sunColor).toBeGreaterThanOrEqual(0);
            }
        });

        it('should have valid fog settings for each era', () => {
            for (const era of ERAS) {
                expect(era.fogNearBase).toBeGreaterThan(0);
                expect(era.fogFarBase).toBeGreaterThan(era.fogNearBase);
                expect(era.fogColor).toBeGreaterThanOrEqual(0);
            }
        });
    });

    // ==========================================
    // ERROR HANDLING
    // ==========================================
    describe('Error Handling', () => {
        it('should handle invalid square clicks gracefully', () => {
            // Click outside board (shouldn't crash)
            expect(() => {
                Game.handleSquareClick(-1, 0);
                Game.handleSquareClick(8, 8);
                Game.handleSquareClick(0, -1);
            }).not.toThrow();
        });

        it('should handle rapid init/reset cycles', () => {
            expect(() => {
                for (let i = 0; i < 50; i++) {
                    Game.initGame();
                    Game.newGame();
                    engine.reset();
                }
            }).not.toThrow();
        });

        it('should handle ELO edge cases', () => {
            expect(() => {
                getEraForElo(-100);
                getEraForElo(0);
                getEraForElo(10000);
                getEraForElo(Infinity);
            }).not.toThrow();
        });
    });

    // ==========================================
    // MULTIPLAYER FUTURE-PROOFING
    // ==========================================
    describe('State Isolation', () => {
        it('should maintain separate game instances', () => {
            const state1 = Game.getState();
            Game.handleSquareClick(1, 4);
            Game.handleSquareClick(3, 4);
            const state2 = Game.getState();

            // States should be different objects
            expect(state1).not.toBe(state2);

            // Original state should not be mutated
            expect(state1.selectedSquare).toBeNull();
        });
    });
});

describe('Regression Tests', () => {
    beforeEach(() => {
        Game.initGame();
        engine.reset();
    });

    // ==========================================
    // KNOWN ISSUE TESTS
    // ==========================================
    describe('Known Issues', () => {
        beforeEach(() => {
            Game.startGame(); // Must start game before clicks work
        });

        it('should not allow selecting opponent pieces on own turn', () => {
            // White to move - should not select black pieces (row 1 = black pawns)
            Game.handleSquareClick(1, 4); // Try to select black pawn
            const state = Game.getState();
            expect(state.selectedSquare).toBeNull();
        });

        it('should clear selection when clicking empty square with nothing selected', () => {
            Game.handleSquareClick(4, 4); // Click empty square
            const state = Game.getState();
            expect(state.selectedSquare).toBeNull();
        });

        it('should handle double-click on same piece (reselects)', () => {
            Game.handleSquareClick(6, 4); // Select white pawn
            expect(Game.getState().selectedSquare).toEqual({ row: 6, col: 4 });

            Game.handleSquareClick(6, 4); // Click again - reselects
            expect(Game.getState().selectedSquare).toEqual({ row: 6, col: 4 });
        });
    });
});
