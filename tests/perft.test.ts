/**
 * Perft correctness tests — validates the JS chess.js perft against
 * known reference values for standard positions.
 *
 * These use depths 1-3 which are fast (< 1 s total) and catch 99 % of
 * move-generation bugs.  The benchmark page (benchmarks/perft.html) is
 * used for deeper depths and speed comparisons.
 */
import { describe, it, expect } from 'vitest';
import { jsPerft, jsPerftDivide, PERFT_POSITIONS } from '../src/perft';
import { Chess } from 'chess.js';

describe('JS Perft Correctness', () => {
  describe('Starting Position', () => {
    const pos = PERFT_POSITIONS[0];
    
    it('depth 1 = 20', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 1)).toBe(20);
    });

    it('depth 2 = 400', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 2)).toBe(400);
    });

    it('depth 3 = 8902', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 3)).toBe(8902);
    });
  });

  describe('Kiwipete', () => {
    const pos = PERFT_POSITIONS[1];

    it('depth 1 = 48', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 1)).toBe(48);
    });

    it('depth 2 = 2039', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 2)).toBe(2039);
    });

    it('depth 3 = 97862', { timeout: 30000 }, () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 3)).toBe(97862);
    });
  });

  describe('Position 3 (endgame)', () => {
    const pos = PERFT_POSITIONS[2];

    it('depth 1 = 14', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 1)).toBe(14);
    });

    it('depth 2 = 191', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 2)).toBe(191);
    });

    it('depth 3 = 2812', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 3)).toBe(2812);
    });
  });

  describe('Position 4 (rich promotions)', () => {
    const pos = PERFT_POSITIONS[3];

    it('depth 1 = 6', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 1)).toBe(6);
    });

    it('depth 2 = 264', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 2)).toBe(264);
    });

    it('depth 3 = 9467', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 3)).toBe(9467);
    });
  });

  describe('Position 5 (Edwards)', () => {
    const pos = PERFT_POSITIONS[4];

    it('depth 1 = 44', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 1)).toBe(44);
    });

    it('depth 2 = 1486', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 2)).toBe(1486);
    });

    it('depth 3 = 62379', { timeout: 30000 }, () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 3)).toBe(62379);
    });
  });

  describe('Position 6', () => {
    const pos = PERFT_POSITIONS[5];

    it('depth 1 = 46', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 1)).toBe(46);
    });

    it('depth 2 = 2079', () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 2)).toBe(2079);
    });

    it('depth 3 = 89890', { timeout: 30000 }, () => {
      const game = new Chess(pos.fen);
      expect(jsPerft(game, 3)).toBe(89890);
    });
  });
});

describe('JS Perft Divide', () => {
  it('starting position depth 1 has 20 root moves totalling 20 nodes', () => {
    const game = new Chess();
    const results = jsPerftDivide(game, 1);
    expect(results.length).toBe(20);
    const total = results.reduce((s, r) => s + r.nodes, 0);
    expect(total).toBe(20);
  });

  it('starting position depth 2 has 20 root moves totalling 400 nodes', () => {
    const game = new Chess();
    const results = jsPerftDivide(game, 2);
    expect(results.length).toBe(20);
    const total = results.reduce((s, r) => s + r.nodes, 0);
    expect(total).toBe(400);
  });

  it('each divide entry has move and nodes properties', () => {
    const game = new Chess();
    const results = jsPerftDivide(game, 1);
    for (const r of results) {
      expect(r).toHaveProperty('move');
      expect(r).toHaveProperty('nodes');
      expect(typeof r.move).toBe('string');
      expect(typeof r.nodes).toBe('number');
      expect(r.nodes).toBeGreaterThan(0);
    }
  });
});

describe('Perft edge cases', () => {
  it('depth 0 returns 1', () => {
    const game = new Chess();
    expect(jsPerft(game, 0)).toBe(1);
  });

  it('checkmate position returns 0 at depth 1', () => {
    // Scholar's mate final position (checkmate)
    const game = new Chess('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(jsPerft(game, 1)).toBe(0);
  });

  it('stalemate position returns 0 at depth 1', () => {
    // Black king trapped in corner by white king + queen
    const game = new Chess('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1');
    expect(game.isStalemate()).toBe(true);
    expect(jsPerft(game, 1)).toBe(0);
  });
});
