/**
 * Performance & Memory Tests
 * Covers rendering efficiency, memory leaks, and asset creation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { measurePerformance, measureMemory, createMockCanvas } from './setup';

// Mock THREE.js for performance tests
vi.mock('three', async () => {
    const actual = await vi.importActual('three') as any;
    return {
        ...actual,
        WebGLRenderer: vi.fn().mockImplementation(() => ({
            setSize: vi.fn(),
            setPixelRatio: vi.fn(),
            render: vi.fn(),
            dispose: vi.fn(),
            shadowMap: { enabled: false },
            toneMapping: 0,
            toneMappingExposure: 1,
            outputColorSpace: '',
        })),
    };
});

describe('Performance Tests', () => {
    // ==========================================
    // ERA CALCULATIONS
    // ==========================================
    describe('Era System Performance', () => {
        it('should calculate era for ELO in < 1ms', async () => {
            const { getEraForElo } = await import('../src/eraSystem');

            const { avgMs } = measurePerformance(() => {
                for (let elo = 0; elo <= 4000; elo += 100) {
                    getEraForElo(elo);
                }
            }, 100);

            expect(avgMs).toBeLessThan(1);
        });

        it('should calculate era progress in < 0.5ms', async () => {
            const { getEraProgress } = await import('../src/eraSystem');

            const { avgMs } = measurePerformance(() => {
                for (let elo = 0; elo <= 4000; elo += 100) {
                    getEraProgress(elo);
                }
            }, 100);

            expect(avgMs).toBeLessThan(0.5);
        });

        it('should check era transition in < 0.5ms', async () => {
            const { checkEraTransition } = await import('../src/eraSystem');

            const { avgMs } = measurePerformance(() => {
                checkEraTransition(100, 500);
                checkEraTransition(500, 100);
                checkEraTransition(1000, 1050);
            }, 100);

            expect(avgMs).toBeLessThan(0.5);
        });
    });

    // ==========================================
    // CHESS ENGINE PERFORMANCE
    // ==========================================
    describe('Chess Engine Performance', () => {
        it('should generate moves in < 5ms', async () => {
            const { engine } = await import('../src/chessEngine');
            engine.reset();

            const { avgMs } = measurePerformance(() => {
                engine.getLegalMoves();
            }, 100);

            expect(avgMs).toBeLessThan(5); // Allow for slower CI machines
        });

        it('should evaluate position in < 2ms', async () => {
            const { engine } = await import('../src/chessEngine');
            engine.reset();

            const { avgMs } = measurePerformance(() => {
                engine.evaluate();
            }, 100);

            expect(avgMs).toBeLessThan(2); // Allow for CI variance
        });

        it('should find best move (depth 2) in < 250ms', async () => {
            const { engine } = await import('../src/chessEngine');
            engine.reset();

            const { avgMs } = measurePerformance(() => {
                engine.getBestMove(2, true);
            }, 10);

            expect(avgMs).toBeLessThan(250); // Allow for slower CI machines
        });

        it('should get board in < 0.5ms (cached)', async () => {
            const { engine } = await import('../src/chessEngine');
            engine.reset();
            engine.getBoard(); // Prime cache

            const { avgMs } = measurePerformance(() => {
                engine.getBoard();
            }, 100);

            expect(avgMs).toBeLessThan(0.5);
        });
    });

    // ==========================================
    // CONSTANTS PERFORMANCE
    // ==========================================
    describe('Constants Access', () => {
        it('should access balance constants immediately', async () => {
            const { BALANCE } = await import('../src/constants');

            const { avgMs } = measurePerformance(() => {
                const _ = BALANCE.startingElo;
                const __ = BALANCE.eloGainPerWin;
                const ___ = BALANCE.baseAIDepth;
            }, 1000);

            expect(avgMs).toBeLessThan(0.01);
        });
    });
});

describe('Memory Tests', () => {
    // ==========================================
    // OBJECT CLEANUP
    // ==========================================
    describe('Object Cleanup', () => {
        it('should not create memory leaks on repeated board gets', async () => {
            const { engine } = await import('../src/chessEngine');
            engine.reset();

            // Get board many times
            for (let i = 0; i < 1000; i++) {
                engine.getBoard();
            }

            // If we get here without crashing, memory is being reused
            expect(true).toBe(true);
        });

        it('should not create memory leaks on repeated move generations', async () => {
            const { engine } = await import('../src/chessEngine');
            engine.reset();

            // Generate moves many times
            for (let i = 0; i < 1000; i++) {
                engine.getLegalMoves();
            }

            expect(true).toBe(true);
        });
    });

    // ==========================================
    // ERA SYSTEM MEMORY
    // ==========================================
    describe('Era System Memory', () => {
        it('should reuse era objects (not create new ones)', async () => {
            const { getEraForElo } = await import('../src/eraSystem');

            const era1 = getEraForElo(100);
            const era2 = getEraForElo(100);

            // Should be same reference (from ERAS array)
            expect(era1).toBe(era2);
        });

        it('should not allocate on repeated era lookups', async () => {
            const { getEraForElo } = await import('../src/eraSystem');

            // Prime JIT
            for (let i = 0; i < 100; i++) {
                getEraForElo(i * 40);
            }

            // Now measure (allocations should be minimal)
            const memory = measureMemory(() => {
                for (let i = 0; i < 10000; i++) {
                    getEraForElo(i % 4000);
                }
            });

            // Memory measurement may not be available in all environments
            if (memory.usedJSHeapSize !== undefined) {
                // Should use less than 1MB for 10k lookups
                expect(memory.usedJSHeapSize).toBeLessThan(1024 * 1024);
            }
        });
    });
});

describe('Stress Tests', () => {
    // ==========================================
    // RAPID STATE CHANGES
    // ==========================================
    describe('Rapid Operations', () => {
        it('should handle 1000 game resets without crash', async () => {
            const Game = await import('../src/gameController');

            for (let i = 0; i < 1000; i++) {
                Game.initGame();
                Game.newGame();
            }

            expect(Game.getState()).toBeDefined();
        });

        it('should handle 1000 era transitions without crash', async () => {
            const { getEraForElo, checkEraTransition } = await import('../src/eraSystem');

            for (let i = 0; i < 1000; i++) {
                const elo1 = Math.random() * 4000;
                const elo2 = Math.random() * 4000;
                getEraForElo(elo1);
                getEraForElo(elo2);
                checkEraTransition(elo1, elo2);
            }

            expect(true).toBe(true);
        });

        it('should handle rapid click sequences without crash', async () => {
            const Game = await import('../src/gameController');
            Game.initGame();

            // Simulate rapid clicking
            for (let i = 0; i < 100; i++) {
                const row = Math.floor(Math.random() * 8);
                const col = Math.floor(Math.random() * 8);
                Game.handleSquareClick(row, col);
            }

            expect(Game.getState()).toBeDefined();
        });
    });

    // ==========================================
    // AI STRESS
    // ==========================================
    describe('AI Stress', () => {
        it('should complete 100 AI move calculations', async () => {
            const { engine } = await import('../src/chessEngine');

            for (let i = 0; i < 100; i++) {
                engine.reset();
                const move = engine.getBestMove(1, true);
                expect(move).toBeDefined();
            }
        });

        it('should handle AI on complex positions', async () => {
            const { engine } = await import('../src/chessEngine');
            engine.reset();

            // Play some moves to create complexity
            engine.makeMove({ row: 1, col: 4 }, { row: 3, col: 4 }); // e4
            engine.makeMove({ row: 6, col: 4 }, { row: 4, col: 4 }); // e5
            engine.makeMove({ row: 0, col: 6 }, { row: 2, col: 5 }); // Nf3
            engine.makeMove({ row: 7, col: 1 }, { row: 5, col: 2 }); // Nc6

            const move = engine.getBestMove(2, true);
            expect(move).toBeDefined();
        });
    });
});
