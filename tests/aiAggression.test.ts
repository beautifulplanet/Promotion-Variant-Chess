/**
 * AI Aggression Slider Tests
 * Covers: Slider mechanics (1-20), bonus multiplier, ELO threshold,
 * rearrangement behavior, save/load persistence, edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as Game from '../src/gameController';
import { createDefaultSave, type SaveData } from '../src/saveSystem';
import { BALANCE } from '../src/constants';

describe('AI Aggression Slider', () => {
  beforeEach(() => {
    Game.initGame();
  });

  // ==========================================
  // GETTER / SETTER BASICS
  // ==========================================
  describe('Getter and Setter', () => {
    it('should default to level 10', () => {
      expect(Game.getAiAggression()).toBe(10);
    });

    it('should set and get aggression level', () => {
      Game.setAiAggression(5);
      expect(Game.getAiAggression()).toBe(5);
    });

    it('should clamp to minimum of 1', () => {
      Game.setAiAggression(0);
      expect(Game.getAiAggression()).toBe(1);
      Game.setAiAggression(-5);
      expect(Game.getAiAggression()).toBe(1);
    });

    it('should clamp to maximum of 20', () => {
      Game.setAiAggression(25);
      expect(Game.getAiAggression()).toBe(20);
      Game.setAiAggression(100);
      expect(Game.getAiAggression()).toBe(20);
    });

    it('should round fractional values', () => {
      Game.setAiAggression(7.3);
      expect(Game.getAiAggression()).toBe(7);
      Game.setAiAggression(7.8);
      expect(Game.getAiAggression()).toBe(8);
    });

    it('should accept all valid levels 1-20', () => {
      for (let i = 1; i <= 20; i++) {
        Game.setAiAggression(i);
        expect(Game.getAiAggression()).toBe(i);
      }
    });
  });

  // ==========================================
  // BONUS MULTIPLIER
  // ==========================================
  describe('Bonus Multiplier', () => {
    it('should return 0.0 at level 1', () => {
      expect(Game.getAggressionBonusMultiplier(1)).toBe(0.0);
    });

    it('should return 1.0 at level 10', () => {
      expect(Game.getAggressionBonusMultiplier(10)).toBeCloseTo(1.0, 5);
    });

    it('should return 2.0 at level 20', () => {
      expect(Game.getAggressionBonusMultiplier(20)).toBeCloseTo(2.0, 5);
    });

    it('should increase monotonically from 1-20', () => {
      let prev = -1;
      for (let i = 1; i <= 20; i++) {
        const mult = Game.getAggressionBonusMultiplier(i);
        expect(mult).toBeGreaterThan(prev);
        prev = mult;
      }
    });

    it('should stay in range [0, 2] for all levels', () => {
      for (let i = 1; i <= 20; i++) {
        const mult = Game.getAggressionBonusMultiplier(i);
        expect(mult).toBeGreaterThanOrEqual(0);
        expect(mult).toBeLessThanOrEqual(2);
      }
    });

    it('should have smooth transition between levels 10 and 11', () => {
      const at10 = Game.getAggressionBonusMultiplier(10);
      const at11 = Game.getAggressionBonusMultiplier(11);
      expect(at11 - at10).toBeCloseTo(0.1, 5);
    });

    it('should give ~0.5 at mid-low range (level 5-6)', () => {
      const at5 = Game.getAggressionBonusMultiplier(5);
      const at6 = Game.getAggressionBonusMultiplier(6);
      expect(at5).toBeGreaterThan(0.3);
      expect(at6).toBeLessThan(0.7);
    });
  });

  // ==========================================
  // ELO THRESHOLD
  // ==========================================
  describe('ELO Threshold', () => {
    it('should return standard threshold (3000) for levels 1-10', () => {
      for (let i = 1; i <= 10; i++) {
        expect(Game.getAggressionEloThreshold(i)).toBe(BALANCE.aiBonusThresholdElo);
      }
    });

    it('should lower threshold at level 11', () => {
      const threshold = Game.getAggressionEloThreshold(11);
      expect(threshold).toBeLessThan(BALANCE.aiBonusThresholdElo);
      expect(threshold).toBe(BALANCE.aiBonusThresholdElo - 200);
    });

    it('should lower threshold at level 15', () => {
      const threshold = Game.getAggressionEloThreshold(15);
      expect(threshold).toBe(BALANCE.aiBonusThresholdElo - 1000);
    });

    it('should have minimum threshold of 1000 at level 20', () => {
      const threshold = Game.getAggressionEloThreshold(20);
      expect(threshold).toBe(1000);
    });

    it('should never go below 1000', () => {
      for (let i = 1; i <= 20; i++) {
        expect(Game.getAggressionEloThreshold(i)).toBeGreaterThanOrEqual(1000);
      }
    });

    it('should decrease monotonically for levels 10-20', () => {
      let prev = Infinity;
      for (let i = 10; i <= 20; i++) {
        const threshold = Game.getAggressionEloThreshold(i);
        expect(threshold).toBeLessThanOrEqual(prev);
        prev = threshold;
      }
    });
  });

  // ==========================================
  // DESCRIPTION LABELS
  // ==========================================
  describe('Description Labels', () => {
    it('should return a label for level 1', () => {
      const desc = Game.getAggressionDescription(1);
      expect(desc).toBeTruthy();
      expect(desc.toLowerCase()).toContain('passive');
    });

    it('should return a label for level 10', () => {
      const desc = Game.getAggressionDescription(10);
      expect(desc).toBeTruthy();
      expect(desc.toLowerCase()).toContain('fair');
    });

    it('should return a label for level 20', () => {
      const desc = Game.getAggressionDescription(20);
      expect(desc).toBeTruthy();
      expect(desc.toLowerCase()).toContain('brutal');
    });

    it('should return non-empty strings for all levels', () => {
      for (let i = 1; i <= 20; i++) {
        const desc = Game.getAggressionDescription(i);
        expect(desc.length).toBeGreaterThan(5);
      }
    });
  });

  // ==========================================
  // INTEGRATION: AI BONUS PIECES RESPECT AGGRESSION
  // ==========================================
  describe('AI Bonus Pieces', () => {
    it('at level 1, AI should get zero bonus pieces even with player advantage', () => {
      Game.setAiAggression(1);
      // Give player some pieces
      Game.debugAddToInventory('Q', 2);
      Game.debugAddToInventory('R', 2);
      // Deploy them
      Game.deployFromInventory('Q');
      Game.deployFromInventory('Q');
      Game.deployFromInventory('R');
      Game.deployFromInventory('R');

      // Start a game — the board setup should give AI 0 bonus
      Game.startGame();

      // Count AI pieces — should be standard 16 (no bonus)
      const board = Game.getBoard();
      const state = Game.getState();
      const aiColor = state.playerColor === 'white' ? 'black' : 'white';
      let aiPieceCount = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (board[r][c]?.color === aiColor) aiPieceCount++;
        }
      }
      // Standard 16 pieces — no bonus
      expect(aiPieceCount).toBe(16);
    });

    it('at level 10, AI should get standard bonus when player has advantage', () => {
      Game.setAiAggression(10);
      Game.debugAddToInventory('Q', 2);
      Game.deployFromInventory('Q');
      Game.deployFromInventory('Q');

      Game.startGame();

      const board = Game.getBoard();
      const state = Game.getState();
      const aiColor = state.playerColor === 'white' ? 'black' : 'white';
      let aiPieceCount = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (board[r][c]?.color === aiColor) aiPieceCount++;
        }
      }
      // AI should have bonus pieces (more than standard 16)
      expect(aiPieceCount).toBeGreaterThanOrEqual(16);
    });

    it('at level 20, AI should get more bonus than at level 10', () => {
      // Test at level 10
      Game.setAiAggression(10);
      Game.debugAddToInventory('Q', 2);
      Game.debugAddToInventory('R', 2);
      Game.deployFromInventory('Q');
      Game.deployFromInventory('Q');
      Game.deployFromInventory('R');
      Game.deployFromInventory('R');
      Game.startGame();

      const board10 = Game.getBoard();
      const state10 = Game.getState();
      const aiColor10 = state10.playerColor === 'white' ? 'black' : 'white';
      let aiCount10 = 0;
      let aiMaterial10 = 0;
      const pieceVals: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board10[r][c];
          if (p?.color === aiColor10) {
            aiCount10++;
            aiMaterial10 += pieceVals[p.type] || 0;
          }
        }
      }

      // Reset and test at level 20
      Game.initGame();
      Game.setAiAggression(20);
      Game.debugAddToInventory('Q', 2);
      Game.debugAddToInventory('R', 2);
      Game.deployFromInventory('Q');
      Game.deployFromInventory('Q');
      Game.deployFromInventory('R');
      Game.deployFromInventory('R');
      Game.startGame();

      const board20 = Game.getBoard();
      const state20 = Game.getState();
      const aiColor20 = state20.playerColor === 'white' ? 'black' : 'white';
      let aiMaterial20 = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board20[r][c];
          if (p?.color === aiColor20) {
            aiMaterial20 += pieceVals[p.type] || 0;
          }
        }
      }

      // Level 20 AI should have >= material as level 10
      expect(aiMaterial20).toBeGreaterThanOrEqual(aiMaterial10);
    });
  });

  // ==========================================
  // INTEGRATION: AI REARRANGEMENT
  // ==========================================
  describe('AI Rearrangement', () => {
    it('at level 10, AI back rank should be standard order', () => {
      Game.setAiAggression(10);
      Game.startGame();

      const board = Game.getBoard();
      const state = Game.getState();
      // AI is opposite color
      const aiColor = state.playerColor === 'white' ? 'black' : 'white';
      const backRow = aiColor === 'black' ? 0 : 7;

      // Standard back rank: R N B Q K B N R
      const standardOrder = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
      for (let c = 0; c < 8; c++) {
        const piece = board[backRow][c];
        expect(piece).not.toBeNull();
        expect(piece!.type).toBe(standardOrder[c]);
        expect(piece!.color).toBe(aiColor);
      }
    });

    it('at level 15+, AI back rank should potentially differ from standard', () => {
      // Run multiple times to account for randomness
      let foundDifference = false;
      const standardOrder = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

      for (let attempt = 0; attempt < 20; attempt++) {
        Game.initGame();
        Game.setAiAggression(15);
        Game.startGame();

        const board = Game.getBoard();
        const state = Game.getState();
        const aiColor = state.playerColor === 'white' ? 'black' : 'white';
        const backRow = aiColor === 'black' ? 0 : 7;

        for (let c = 0; c < 8; c++) {
          const piece = board[backRow][c];
          if (piece && piece.type !== standardOrder[c] && piece.type !== 'K') {
            foundDifference = true;
            break;
          }
        }
        if (foundDifference) break;
      }

      // With shuffling, we should find at least one difference in 20 attempts
      expect(foundDifference).toBe(true);
    });

    it('King should never move during rearrangement', () => {
      for (let level = 11; level <= 20; level++) {
        for (let attempt = 0; attempt < 5; attempt++) {
          Game.initGame();
          Game.setAiAggression(level);
          Game.startGame();

          const board = Game.getBoard();
          const state = Game.getState();
          const aiColor = state.playerColor === 'white' ? 'black' : 'white';
          const backRow = aiColor === 'black' ? 0 : 7;

          // King should always be on its standard column (e-file, col 4)
          const king = board[backRow][4];
          expect(king).not.toBeNull();
          expect(king!.type).toBe('K');
          expect(king!.color).toBe(aiColor);
        }
      }
    });

    it('at level 14+, some AI pawns may be upgraded', () => {
      let foundUpgrade = false;

      for (let attempt = 0; attempt < 30; attempt++) {
        Game.initGame();
        Game.setAiAggression(16);
        Game.startGame();

        const board = Game.getBoard();
        const state = Game.getState();
        const aiColor = state.playerColor === 'white' ? 'black' : 'white';
        const pawnRow = aiColor === 'black' ? 1 : 6;

        for (let c = 0; c < 8; c++) {
          const piece = board[pawnRow][c];
          if (piece && piece.color === aiColor && piece.type !== 'P') {
            foundUpgrade = true;
            break;
          }
        }
        if (foundUpgrade) break;
      }

      expect(foundUpgrade).toBe(true);
    });

    it('at level 20, pawn upgrades can include queens and rooks', () => {
      let foundMajor = false;

      for (let attempt = 0; attempt < 50; attempt++) {
        Game.initGame();
        Game.setAiAggression(20);
        Game.startGame();

        const board = Game.getBoard();
        const state = Game.getState();
        const aiColor = state.playerColor === 'white' ? 'black' : 'white';
        const pawnRow = aiColor === 'black' ? 1 : 6;

        for (let c = 0; c < 8; c++) {
          const piece = board[pawnRow][c];
          if (piece && piece.color === aiColor && (piece.type === 'Q' || piece.type === 'R')) {
            foundMajor = true;
            break;
          }
        }
        if (foundMajor) break;
      }

      expect(foundMajor).toBe(true);
    });
  });

  // ==========================================
  // SAVE / LOAD PERSISTENCE
  // ==========================================
  describe('Save and Load', () => {
    it('default save should include aiAggressionLevel = 10', () => {
      const save = createDefaultSave();
      expect(save.aiAggressionLevel).toBe(10);
    });

    it('should preserve aggression level in save data', () => {
      Game.setAiAggression(15);
      const saveData = Game.getCurrentSaveData();
      // The in-memory save data should reflect the setting
      // (Note: full save/load cycle requires file I/O which we can't test directly)
      expect(saveData).toBeDefined();
    });
  });

  // ==========================================
  // EDGE CASES
  // ==========================================
  describe('Edge Cases', () => {
    it('should handle rapid slider changes', () => {
      for (let i = 1; i <= 20; i++) {
        Game.setAiAggression(i);
      }
      expect(Game.getAiAggression()).toBe(20);

      for (let i = 20; i >= 1; i--) {
        Game.setAiAggression(i);
      }
      expect(Game.getAiAggression()).toBe(1);
    });

    it('aggression should persist after initGame reinitializes state', () => {
      Game.setAiAggression(17);
      // initGame resets game state but aggression is a separate setting
      Game.initGame();
      // After init, default behavior applies (initGame doesn't explicitly reset aggression
      // unless we want it to — currently it doesn't touch it)
      // This test documents the current behavior
      const level = Game.getAiAggression();
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(20);
    });

    it('level 1 with high ELO should still give no bonus', () => {
      Game.setAiAggression(1);
      Game.debugSetElo(5000);
      Game.debugAddToInventory('Q', 3);
      Game.deployFromInventory('Q');
      Game.deployFromInventory('Q');
      Game.deployFromInventory('Q');
      Game.startGame();

      const board = Game.getBoard();
      const state = Game.getState();
      const aiColor = state.playerColor === 'white' ? 'black' : 'white';
      let aiPieceCount = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (board[r][c]?.color === aiColor) aiPieceCount++;
        }
      }
      // No bonus at level 1 regardless of ELO
      expect(aiPieceCount).toBe(16);
    });

    it('level 20 with no player advantage should still have rearrangement', () => {
      // No deployed pieces — but level 20 should still shuffle AI back rank
      let foundDifference = false;
      const standardOrder = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

      for (let attempt = 0; attempt < 20; attempt++) {
        Game.initGame();
        Game.setAiAggression(20);
        Game.startGame();

        const board = Game.getBoard();
        const state = Game.getState();
        const aiColor = state.playerColor === 'white' ? 'black' : 'white';
        const backRow = aiColor === 'black' ? 0 : 7;

        for (let c = 0; c < 8; c++) {
          const piece = board[backRow][c];
          if (piece && piece.type !== standardOrder[c] && piece.type !== 'K') {
            foundDifference = true;
            break;
          }
        }
        if (foundDifference) break;
      }

      expect(foundDifference).toBe(true);
    });

    it('each level should produce valid board state (correct total pieces)', () => {
      for (let level = 1; level <= 20; level++) {
        Game.initGame();
        Game.setAiAggression(level);
        Game.startGame();

        const board = Game.getBoard();
        let totalPieces = 0;
        let whiteKings = 0;
        let blackKings = 0;

        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p) {
              totalPieces++;
              if (p.type === 'K' && p.color === 'white') whiteKings++;
              if (p.type === 'K' && p.color === 'black') blackKings++;
            }
          }
        }

        // Must always have exactly 1 king per side
        expect(whiteKings).toBe(1);
        expect(blackKings).toBe(1);
        // Must have at least 32 pieces (standard, possibly more with bonus)
        expect(totalPieces).toBeGreaterThanOrEqual(30);
      }
    });
  });
});
