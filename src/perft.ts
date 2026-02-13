/**
 * Perft (Performance Test) — move generation correctness & speed benchmark.
 *
 * Two implementations:
 *   1. JS perft using chess.js  (baseline)
 *   2. Rust/WASM perft via GameState.perft()  (fast path)
 *
 * Standard positions with known node counts are used to validate both engines.
 */

import { Chess } from 'chess.js';

// ─── Known perft positions ────────────────────────────────────────────────
export interface PerftPosition {
  name: string;
  fen: string;
  /** depth → expected node count */
  expected: Record<number, number>;
}

export const PERFT_POSITIONS: PerftPosition[] = [
  {
    name: 'Starting Position',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    expected: {
      1: 20,
      2: 400,
      3: 8_902,
      4: 197_281,
      5: 4_865_609,
      6: 119_060_324,
    },
  },
  {
    name: 'Kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    expected: {
      1: 48,
      2: 2_039,
      3: 97_862,
      4: 4_085_603,
      5: 193_690_690,
    },
  },
  {
    name: 'Position 3',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    expected: {
      1: 14,
      2: 191,
      3: 2_812,
      4: 43_238,
      5: 674_624,
      6: 11_030_083,
    },
  },
  {
    name: 'Position 4',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    expected: {
      1: 6,
      2: 264,
      3: 9_467,
      4: 422_333,
      5: 15_833_292,
    },
  },
  {
    name: 'Position 5 (Edwards)',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    expected: {
      1: 44,
      2: 1_486,
      3: 62_379,
      4: 2_103_487,
      5: 89_941_194,
    },
  },
  {
    name: 'Position 6 (Kiwipete mirror)',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    expected: {
      1: 46,
      2: 2_079,
      3: 89_890,
      4: 3_894_594,
      5: 164_075_551,
    },
  },
];

// ─── JS Perft (chess.js) ─────────────────────────────────────────────────
/**
 * Recursive perft using chess.js.
 * Returns the total number of leaf nodes at `depth` plies.
 */
export function jsPerft(game: Chess, depth: number): number {
  if (depth === 0) return 1;

  const moves = game.moves({ verbose: true });
  if (depth === 1) return moves.length;          // leaf-node optimisation

  let nodes = 0;
  for (const move of moves) {
    game.move(move);
    nodes += jsPerft(game, depth - 1);
    game.undo();
  }
  return nodes;
}

/**
 * Perft divide using chess.js — shows node count per root move.
 */
export function jsPerftDivide(
  game: Chess,
  depth: number,
): { move: string; nodes: number }[] {
  const results: { move: string; nodes: number }[] = [];
  const moves = game.moves({ verbose: true });
  for (const move of moves) {
    game.move(move);
    const nodes = depth <= 1 ? 1 : jsPerft(game, depth - 1);
    results.push({ move: move.san, nodes });
    game.undo();
  }
  return results;
}

// ─── Benchmark runner ─────────────────────────────────────────────────────
export interface PerftResult {
  position: string;
  fen: string;
  depth: number;
  expected: number;
  jsNodes: number;
  jsTimeMs: number;
  jsNps: number;
  jsCorrect: boolean;
  wasmNodes?: number;
  wasmTimeMs?: number;
  wasmNps?: number;
  wasmCorrect?: boolean;
  speedup?: number;
}

/**
 * Run JS perft for a single position/depth.
 */
export function runJsPerft(pos: PerftPosition, depth: number): PerftResult {
  const game = new Chess(pos.fen);
  const t0 = performance.now();
  const nodes = jsPerft(game, depth);
  const elapsed = performance.now() - t0;
  const expected = pos.expected[depth] ?? -1;

  return {
    position: pos.name,
    fen: pos.fen,
    depth,
    expected,
    jsNodes: nodes,
    jsTimeMs: Math.round(elapsed * 100) / 100,
    jsNps: elapsed > 0 ? Math.round(nodes / (elapsed / 1000)) : 0,
    jsCorrect: nodes === expected,
  };
}
