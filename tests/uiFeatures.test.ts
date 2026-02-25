/**
 * UI Features Tests
 * Covers: AI speed, piece style lists, classic mode bar button availability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { STYLES_3D_ORDER, STYLES_2D_ORDER, PIECE_STYLE_ORDER, getPieceStyleConfig, is2DPieceStyle } from '../src/pieceStyles';
import * as Game from '../src/gameController';

describe('Piece Style System', () => {
  describe('Style Lists', () => {
    it('should have 7 3D styles', () => {
      expect(STYLES_3D_ORDER.length).toBe(7);
    });

    it('should have 17 2D styles', () => {
      expect(STYLES_2D_ORDER.length).toBe(17);
    });

    it('should have combined order = 3D + 2D', () => {
      expect(PIECE_STYLE_ORDER.length).toBe(24);
      expect(PIECE_STYLE_ORDER).toEqual([...STYLES_3D_ORDER, ...STYLES_2D_ORDER]);
    });
  });

  describe('Style Config', () => {
    it('should return valid config for each 3D style', () => {
      for (const id of STYLES_3D_ORDER) {
        const config = getPieceStyleConfig(id);
        expect(config.id).toBe(id);
        expect(config.name).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.type).toBe('3d');
      }
    });

    it('should return valid config for each 2D style', () => {
      for (const id of STYLES_2D_ORDER) {
        const config = getPieceStyleConfig(id);
        expect(config.id).toBe(id);
        expect(config.name).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.type).toBe('2d');
        expect(config.drawStyle).toBeTruthy();
      }
    });

    it('should identify 2D styles correctly', () => {
      for (const id of STYLES_2D_ORDER) {
        expect(is2DPieceStyle(id)).toBe(true);
      }
      for (const id of STYLES_3D_ORDER) {
        expect(is2DPieceStyle(id)).toBe(false);
      }
    });

    it('should return fallback config for unknown style', () => {
      const config = getPieceStyleConfig('nonexistent');
      expect(config.id).toBe('staunton3d');
    });
  });
});

describe('AI Speed System', () => {
  beforeEach(() => {
    Game.initGame();
  });

  it('should default speed multiplier to 1', () => {
    expect(Game.getAiSpeed()).toBe(1);
  });

  it('should set speed within bounds', () => {
    Game.setAiSpeed(2);
    expect(Game.getAiSpeed()).toBe(2);
  });

  it('should clamp speed at minimum', () => {
    Game.setAiSpeed(0.01);
    expect(Game.getAiSpeed()).toBe(0.1);
  });

  it('should clamp speed at maximum', () => {
    Game.setAiSpeed(100);
    expect(Game.getAiSpeed()).toBe(10);
  });

  it('should allow 0.1x speed for fast mode', () => {
    Game.setAiSpeed(0.1);
    expect(Game.getAiSpeed()).toBe(0.1);
  });

  describe('AI vs AI Mode', () => {
    it('should not be in AI vs AI by default', () => {
      // startGame resets aiVsAi flag  
      Game.startGame();
      expect(Game.isAiVsAiMode()).toBe(false);
    });

    it('should start AI vs AI mode', () => {
      Game.startGame();
      Game.initGame();
      Game.startAiVsAi();
      expect(Game.isAiVsAiMode()).toBe(true);
    });
  });
});
