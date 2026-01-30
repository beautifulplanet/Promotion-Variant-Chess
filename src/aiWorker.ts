// src/aiWorker.ts
// Web Worker for AI computation - runs minimax without blocking UI

import { Chess, Square, Move as ChessMove } from 'chess.js';

// =============================================================================
// TYPES
// =============================================================================

interface WorkerMessage {
  type: 'getBestMove';
  fen: string;
  depth: number;
  maximizing: boolean;
}

interface WorkerResponse {
  type: 'bestMove';
  move: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    promotion?: string;
  } | null;
  score: number;
  nodesSearched: number;
  timeMs: number;
}

// =============================================================================
// EVALUATION CONSTANTS
// =============================================================================

const PIECE_VALUES: Record<string, number> = {
  'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000
};

const PAWN_TABLE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0]
];

// =============================================================================
// CHESS ENGINE (Worker-local instance)
// =============================================================================

let chess = new Chess();
let nodesSearched = 0;

function squareToRowCol(square: string): { row: number; col: number } {
  const col = square.charCodeAt(0) - 97;
  const row = 8 - parseInt(square[1]);
  return { row, col };
}

function rowColToSquare(row: number, col: number): Square {
  const file = String.fromCharCode(97 + col);
  const rank = (8 - row).toString();
  return (file + rank) as Square;
}

function evaluate(): number {
  let score = 0;
  const board = chess.board();

  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -100000 : 100000;
  }
  if (chess.isStalemate() || chess.isDraw()) {
    return 0;
  }

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        let value = PIECE_VALUES[piece.type];

        if (piece.type === 'p') {
          const tableRow = piece.color === 'w' ? row : 7 - row;
          value += PAWN_TABLE[tableRow][col];
        }

        if ((row === 3 || row === 4) && (col === 3 || col === 4)) {
          value += 10;
        }

        score += piece.color === 'w' ? value : -value;
      }
    }
  }

  score += chess.turn() === 'w' ? 10 : -10;
  return score;
}

function getPieceValue(piece: string): number {
  return PIECE_VALUES[piece.toLowerCase()] || 0;
}

function minimax(depth: number, alpha: number, beta: number, maximizing: boolean): number {
  nodesSearched++;
  
  if (depth === 0 || chess.isGameOver()) {
    return evaluate();
  }

  const moves = chess.moves({ verbose: true });
  
  // Move ordering for better pruning
  moves.sort((a, b) => {
    const captureA = a.captured ? getPieceValue(a.captured) : 0;
    const captureB = b.captured ? getPieceValue(b.captured) : 0;
    return captureB - captureA;
  });

  if (maximizing) {
    let maxScore = -Infinity;
    for (const m of moves) {
      chess.move(m);
      const score = minimax(depth - 1, alpha, beta, false);
      chess.undo();
      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return maxScore;
  } else {
    let minScore = Infinity;
    for (const m of moves) {
      chess.move(m);
      const score = minimax(depth - 1, alpha, beta, true);
      chess.undo();
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return minScore;
  }
}

function getBestMove(fen: string, depth: number, maximizing: boolean): WorkerResponse {
  const startTime = performance.now();
  nodesSearched = 0;
  
  chess.load(fen);
  
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return {
      type: 'bestMove',
      move: null,
      score: 0,
      nodesSearched: 0,
      timeMs: performance.now() - startTime
    };
  }

  let bestMove: ChessMove | null = null;
  let bestScore = maximizing ? -Infinity : Infinity;

  // Move ordering at root
  moves.sort((a, b) => {
    const captureA = a.captured ? getPieceValue(a.captured) : 0;
    const captureB = b.captured ? getPieceValue(b.captured) : 0;
    return captureB - captureA;
  });

  for (const move of moves) {
    chess.move(move);
    const score = minimax(depth - 1, -Infinity, Infinity, !maximizing);
    chess.undo();

    if (maximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }

  const result: WorkerResponse = {
    type: 'bestMove',
    move: bestMove ? {
      from: squareToRowCol(bestMove.from),
      to: squareToRowCol(bestMove.to),
      promotion: bestMove.promotion?.toUpperCase()
    } : null,
    score: bestScore,
    nodesSearched,
    timeMs: performance.now() - startTime
  };

  return result;
}

// =============================================================================
// WORKER MESSAGE HANDLER
// =============================================================================

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { type, fen, depth, maximizing } = event.data;
  
  if (type === 'getBestMove') {
    const response = getBestMove(fen, depth, maximizing);
    self.postMessage(response);
  }
});

// Signal that worker is ready
self.postMessage({ type: 'ready' });
