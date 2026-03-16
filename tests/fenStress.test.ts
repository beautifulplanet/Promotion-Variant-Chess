/**
 * FEN engine stress tests — tries to break every FEN-handling path.
 * Covers: chessEngine, position editor (fenToGrid logic), startAnalysisGame,
 * save restore, and puzzle preparePuzzle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Chess } from 'chess.js';

// ── fenToGrid / gridToFEN logic (extracted for testability) ──

const VALID_PIECES = 'KQRBNP';

function fenToGrid(fen: string): string[][] | null {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 1) return null;

  const ranks = parts[0].split('/');
  if (ranks.length !== 8) return null;

  const newGrid: string[][] = [];
  for (const rank of ranks) {
    const row: string[] = [];
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < parseInt(ch); i++) row.push('');
      } else {
        const isWhite = ch === ch.toUpperCase();
        const color = isWhite ? 'w' : 'b';
        const type = ch.toUpperCase();
        if (!VALID_PIECES.includes(type)) return null;
        row.push(color + type);
      }
    }
    if (row.length !== 8) return null;
    newGrid.push(row);
  }

  return newGrid;
}

function gridToFEN(grid: string[][], turn: string, castling: string): string {
  let fen = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const piece = grid[r][c];
      if (!piece) {
        empty++;
      } else {
        if (empty > 0) { fen += empty; empty = 0; }
        const color = piece[0];
        const type = piece[1];
        fen += color === 'w' ? type : type.toLowerCase();
      }
    }
    if (empty > 0) fen += empty;
    if (r < 7) fen += '/';
  }
  return `${fen} ${turn} ${castling} - 0 1`;
}

function validate(grid: string[][]): string | null {
  let wK = 0, bK = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (grid[r][c] === 'wK') wK++;
      if (grid[r][c] === 'bK') bK++;
      const p = grid[r][c];
      if ((p === 'wP' || p === 'bP') && (r === 0 || r === 7)) {
        return 'Pawns cannot be on rank 1 or 8';
      }
    }
  }
  if (wK === 0) return 'Missing white king';
  if (bK === 0) return 'Missing black king';
  if (wK > 1) return 'Too many white kings';
  if (bK > 1) return 'Too many black kings';
  return null;
}

// ── Tests ──

describe('FEN Stress Tests — fenToGrid', () => {
  it('rejects empty string', () => {
    expect(fenToGrid('')).toBeNull();
  });

  it('rejects whitespace-only', () => {
    expect(fenToGrid('   ')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(fenToGrid('not a fen at all')).toBeNull();
  });

  it('rejects too few ranks', () => {
    expect(fenToGrid('rnbqkbnr/pppppppp/8/8 w KQkq - 0 1')).toBeNull();
  });

  it('rejects too many ranks', () => {
    expect(fenToGrid('8/8/8/8/8/8/8/8/8 w KQkq - 0 1')).toBeNull();
  });

  it('rejects rank with wrong square count (too few)', () => {
    expect(fenToGrid('rnbqkbn/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });

  it('rejects rank with wrong square count (too many)', () => {
    expect(fenToGrid('rnbqkbnrr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });

  it('rejects invalid piece characters', () => {
    expect(fenToGrid('rnbqkbnr/ppppppXp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });

  it('rejects numbers > 8', () => {
    expect(fenToGrid('rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });

  it('accepts valid starting position', () => {
    const grid = fenToGrid('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(grid).not.toBeNull();
    expect(grid!.length).toBe(8);
    expect(grid![0][0]).toBe('bR');
    expect(grid![7][4]).toBe('wK');
  });

  it('accepts empty board', () => {
    const grid = fenToGrid('8/8/8/8/8/8/8/8 w - - 0 1');
    expect(grid).not.toBeNull();
    for (const row of grid!) {
      for (const sq of row) {
        expect(sq).toBe('');
      }
    }
  });

  it('handles promotion-style FEN with multiple queens', () => {
    const grid = fenToGrid('Q1Q1Q1Q1/8/8/4k3/4K3/8/8/Q1Q1Q1Q1 w - - 0 1');
    expect(grid).not.toBeNull();
    expect(grid![0][0]).toBe('wQ');
  });

  it('survives XSS injection in FEN string', () => {
    expect(fenToGrid('<script>alert(1)</script>')).toBeNull();
  });

  it('survives extremely long string', () => {
    const longFen = 'a'.repeat(100000);
    expect(fenToGrid(longFen)).toBeNull();
  });

  it('survives null bytes', () => {
    expect(fenToGrid('rnbqkbnr/pppppppp/8/' + String.fromCharCode(0) + '8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });

  it('survives unicode', () => {
    expect(fenToGrid('♜♞♝♛♚♝♞♜/♟♟♟♟♟♟♟♟/8/8/8/8/♙♙♙♙♙♙♙♙/♖♘♗♕♔♗♘♖ w KQkq - 0 1')).toBeNull();
  });

  it('survives prototype pollution attempt', () => {
    expect(fenToGrid('__proto__')).toBeNull();
    expect(fenToGrid('constructor')).toBeNull();
  });
});

describe('FEN Stress Tests — validate (position editor)', () => {
  function emptyGrid(): string[][] {
    return Array.from({ length: 8 }, () => Array(8).fill(''));
  }

  it('rejects board with no kings', () => {
    const grid = emptyGrid();
    expect(validate(grid)).toBe('Missing white king');
  });

  it('rejects board with no black king', () => {
    const grid = emptyGrid();
    grid[4][4] = 'wK';
    expect(validate(grid)).toBe('Missing black king');
  });

  it('rejects board with two white kings', () => {
    const grid = emptyGrid();
    grid[0][0] = 'wK';
    grid[0][1] = 'wK';
    grid[7][7] = 'bK';
    expect(validate(grid)).toBe('Too many white kings');
  });

  it('rejects pawns on rank 1', () => {
    const grid = emptyGrid();
    grid[4][4] = 'wK';
    grid[0][0] = 'bK';
    grid[7][3] = 'wP';
    expect(validate(grid)).toBe('Pawns cannot be on rank 1 or 8');
  });

  it('rejects pawns on rank 8', () => {
    const grid = emptyGrid();
    grid[4][4] = 'wK';
    grid[7][0] = 'bK';
    grid[0][3] = 'bP';
    expect(validate(grid)).toBe('Pawns cannot be on rank 1 or 8');
  });

  it('accepts valid position with just two kings', () => {
    const grid = emptyGrid();
    grid[0][4] = 'bK';
    grid[7][4] = 'wK';
    expect(validate(grid)).toBeNull();
  });

  it('accepts full starting position', () => {
    const grid = fenToGrid('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(grid).not.toBeNull();
    expect(validate(grid!)).toBeNull();
  });
});

describe('FEN Stress Tests — chess.js resilience', () => {
  it('rejects empty FEN', () => {
    expect(() => new Chess('')).toThrow();
  });

  it('rejects garbage FEN', () => {
    expect(() => new Chess('not valid')).toThrow();
  });

  it('rejects FEN with impossible position (9 squares in a rank)', () => {
    expect(() => new Chess('rnbqkbnrr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toThrow();
  });

  it('accepts valid starting position', () => {
    const c = new Chess();
    expect(c.fen()).toContain('rnbqkbnr');
  });

  it('accepts FEN with only kings', () => {
    const c = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(c.turn()).toBe('w');
  });

  it('handles load() returning false for invalid FEN', () => {
    const c = new Chess();
    let loaded = true;
    try {
      c.load('garbage');
    } catch {
      loaded = false;
    }
    expect(loaded).toBe(false);
  });

  it('survives rapid successive loads', () => {
    const c = new Chess();
    const fens = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
    ];
    for (let i = 0; i < 1000; i++) {
      c.load(fens[i % fens.length]);
    }
    expect(c.fen()).toBeDefined();
  });
});

describe('FEN round-trip (fenToGrid -> gridToFEN -> chess.js)', () => {
  const testFENs = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
    '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  ];

  testFENs.forEach((fen, i) => {
    it(`round-trips FEN #${i}: piece placement survives`, () => {
      const grid = fenToGrid(fen);
      expect(grid).not.toBeNull();

      const rebuilt = gridToFEN(grid!, 'w', 'KQkq');
      const origPieces = fen.split(' ')[0];
      const rebuiltPieces = rebuilt.split(' ')[0];
      expect(rebuiltPieces).toBe(origPieces);
    });
  });
});

describe('Puzzle preparePuzzle resilience', () => {
  let preparePuzzle: any;

  beforeEach(async () => {
    const mod = await import('../src/puzzleSystem');
    preparePuzzle = mod.preparePuzzle;
  });

  it('rejects puzzle with no FEN', () => {
    const result = preparePuzzle({ id: 'bad1', fen: '', moves: ['e2e4', 'e7e5'], rating: 1000, themes: [] });
    expect(result).toBeNull();
  });

  it('rejects puzzle with no moves', () => {
    const result = preparePuzzle({ id: 'bad2', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [], rating: 1000, themes: [] });
    expect(result).toBeNull();
  });

  it('rejects puzzle with only 1 move', () => {
    const result = preparePuzzle({ id: 'bad3', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: ['e2e4'], rating: 1000, themes: [] });
    expect(result).toBeNull();
  });

  it('rejects puzzle with invalid FEN', () => {
    const result = preparePuzzle({ id: 'bad4', fen: 'totally broken', moves: ['e2e4', 'e7e5'], rating: 1000, themes: [] });
    expect(result).toBeNull();
  });

  it('rejects puzzle with invalid setup move', () => {
    const result = preparePuzzle({ id: 'bad5', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: ['z9z9', 'e7e5'], rating: 1000, themes: [] });
    expect(result).toBeNull();
  });
});

describe('Save data FEN tamper resilience', () => {
  let ChessEngine: any;

  beforeEach(async () => {
    const mod = await import('../src/chessEngine');
    ChessEngine = mod.ChessEngine;
  });

  it('chessEngine.loadFEN wraps errors and returns false', () => {
    const engine = new ChessEngine();
    expect(engine.loadFEN('garbage fen')).toBe(false);
    expect(engine.loadFEN('')).toBe(false);
    expect(engine.loadFEN('<script>alert(1)</script>')).toBe(false);
  });

  it('chessEngine.loadFEN accepts valid FEN', () => {
    const engine = new ChessEngine();
    expect(engine.loadFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(true);
  });
});
