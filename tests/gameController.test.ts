/**
 * Game Controller Tests
 * Covers game state, ELO system, promotions, and save/load
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Game from '../src/gameController';
import { BALANCE } from '../src/constants';

describe('Game Controller', () => {
    beforeEach(() => {
        // Reset game state before each test
        Game.initGame();
    });

    // ==========================================
    // INITIALIZATION
    // ==========================================
    describe('Initialization', () => {
        it('should initialize with default ELO', () => {
            const state = Game.getState();
            expect(state.elo).toBe(BALANCE.startingElo);
        });

        it('should start with zero games played', () => {
            const state = Game.getState();
            expect(state.gamesPlayed).toBe(0);
            expect(state.gamesWon).toBe(0);
            expect(state.gamesLost).toBe(0);
        });

        it('should set player as white', () => {
            const state = Game.getState();
            expect(state.playerColor).toBe('white');
        });

        it('should not be game over at start', () => {
            const state = Game.getState();
            expect(state.gameOver).toBe(false);
        });

        it('should have no selected square at start', () => {
            const state = Game.getState();
            expect(state.selectedSquare).toBeNull();
        });
    });

    // ==========================================
    // BOARD STATE
    // ==========================================
    describe('Board State', () => {
        it('should return valid board', () => {
            const board = Game.getBoard();
            expect(board).toBeDefined();
            expect(board.length).toBe(8);
            expect(board[0].length).toBe(8);
        });

        it('should have pieces in starting positions', () => {
            const board = Game.getBoard();
            // Check white king (row 7 = rank 1)
            expect(board[7][4]?.type).toBe('K');
            expect(board[7][4]?.color).toBe('white');
            // Check black king (row 0 = rank 8)
            expect(board[0][4]?.type).toBe('K');
            expect(board[0][4]?.color).toBe('black');
        });
    });

    // ==========================================
    // TURN MANAGEMENT
    // ==========================================
    describe('Turn Management', () => {
        it('should start with white to move', () => {
            expect(Game.getCurrentTurn()).toBe('white');
        });

        it('should track whose turn it is', () => {
            const turn = Game.getCurrentTurn();
            expect(['white', 'black']).toContain(turn);
        });
    });

    // ==========================================
    // SQUARE CLICK HANDLING
    // ==========================================
    describe('handleSquareClick', () => {
        beforeEach(() => {
            Game.startGame(); // Must start game before clicks work
        });

        it('should select piece on first click', () => {
            // Click on a white pawn (row 6 = rank 2)
            Game.handleSquareClick(6, 4); // e2
            const state = Game.getState();
            expect(state.selectedSquare).toEqual({ row: 6, col: 4 });
        });

        it('should reselect when clicking same square (not toggle)', () => {
            Game.handleSquareClick(6, 4); // Select e2
            Game.handleSquareClick(6, 4); // Click again - reselects same piece
            const state = Game.getState();
            // Game keeps piece selected (reselects it)
            expect(state.selectedSquare).toEqual({ row: 6, col: 4 });
        });

        it('should show legal moves after selection', () => {
            Game.handleSquareClick(6, 4); // Select e2
            const state = Game.getState();
            expect(state.legalMovesForSelected.length).toBeGreaterThan(0);
        });

        it('should move piece on valid second click', () => {
            Game.handleSquareClick(6, 4); // Select e2
            const moved = Game.handleSquareClick(4, 4); // Move to e4
            expect(moved).toBe(true);
        });

        it('should not allow clicking opponent pieces', () => {
            // Try to click on black pawn as white (row 1 = rank 7)
            Game.handleSquareClick(1, 4); // e7 (black pawn)
            const state = Game.getState();
            expect(state.selectedSquare).toBeNull();
        });
    });

    // ==========================================
    // NEW GAME
    // ==========================================
    describe('New Game', () => {
        it('should reset board to starting position', () => {
            // Make a move first (white pawn e2-e4)
            Game.handleSquareClick(6, 4);
            Game.handleSquareClick(4, 4);

            // Start new game
            Game.newGame();

            const board = Game.getBoard();
            expect(board[4][4]).toBeNull(); // e4 should be empty
            expect(board[6][4]?.type).toBe('P'); // e2 should have pawn
        });

        it('should preserve ELO across games', () => {
            const initialElo = Game.getState().elo;
            Game.newGame();
            expect(Game.getState().elo).toBe(initialElo);
        });
    });

    // ==========================================
    // LEVEL SYSTEM
    // ==========================================
    describe('Level System', () => {
        it('should return current level info', () => {
            const level = Game.getCurrentLevel();
            expect(level).toBeDefined();
            expect(level.name).toBeDefined();
            expect(level.minElo).toBeDefined();
            expect(level.maxElo).toBeDefined();
        });

        it('should calculate progress percentage', () => {
            const progress = Game.getCurrentProgress();
            expect(progress).toBeGreaterThanOrEqual(0);
            expect(progress).toBeLessThanOrEqual(100);
        });
    });

    // ==========================================
    // CHECK DETECTION
    // ==========================================
    describe('Check Detection', () => {
        it('should not be in check at start', () => {
            expect(Game.isInCheck()).toBe(false);
        });
    });

    // ==========================================
    // PROMOTED PIECES
    // ==========================================
    describe('Promoted Pieces', () => {
        it('should start with no promoted pieces', () => {
            expect(Game.hasPromotedPieces()).toBe(false);
            expect(Game.getPromotedPieces().length).toBe(0);
        });
    });

    // ==========================================
    // CALLBACKS
    // ==========================================
    describe('Callbacks', () => {
        it('should accept callback registration', () => {
            const mockCallback = vi.fn();

            Game.registerCallbacks({
                onStateChange: mockCallback,
            });

            // Start game and make a move to trigger state change
            Game.startGame();
            Game.handleSquareClick(6, 4);
            Game.handleSquareClick(4, 4);

            expect(mockCallback).toHaveBeenCalled();
        });
    });

    // ==========================================
    // SAVE/LOAD
    // ==========================================
    describe('Save System', () => {
        it('should return current save data', () => {
            const saveData = Game.getCurrentSaveData();
            expect(saveData).toBeDefined();
            expect(saveData.elo).toBeDefined();
            expect(saveData.gamesWon).toBeDefined();
            expect(saveData.gamesLost).toBeDefined();
        });
    });

    // ==========================================
    // IMMUTABILITY
    // ==========================================
    describe('State Immutability', () => {
        it('should return immutable state copy', () => {
            const state1 = Game.getState();
            const state2 = Game.getState();

            // Should be equal but not same reference
            expect(state1.elo).toBe(state2.elo);
            expect(state1).not.toBe(state2);
        });
    });
});
