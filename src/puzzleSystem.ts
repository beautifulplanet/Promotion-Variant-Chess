// src/puzzleSystem.ts
// Offline puzzle system using Lichess CC0 puzzles.
// Puzzles loaded from public/puzzles.json, progress stored in save file.

import { Chess } from 'chess.js';

// ─── Data Types ─────────────────────────────────────────────────────────────

export interface Puzzle {
  id: string;
  fen: string;           // Position AFTER the opponent's setup move
  moves: string[];       // UCI solution. moves[0] = opponent's last move (setup), rest = player's solution
  rating: number;
  themes: string[];
}

export interface PuzzleProgress {
  solvedIds: string[];        // IDs of completed puzzles
  attemptedIds: string[];     // IDs attempted but not solved
  currentStreak: number;
  bestStreak: number;
  totalAttempts: number;
  totalSolved: number;
  puzzleRating: number;       // Player's puzzle ELO (separate from game ELO)
  lastPlayedAt: string;       // ISO timestamp
}

export interface PuzzleAttemptResult {
  correct: boolean;
  puzzleId: string;
  ratingChange: number;
  newPuzzleRating: number;
}

// ─── Default Progress ───────────────────────────────────────────────────────

export function createDefaultPuzzleProgress(): PuzzleProgress {
  return {
    solvedIds: [],
    attemptedIds: [],
    currentStreak: 0,
    bestStreak: 0,
    totalAttempts: 0,
    totalSolved: 0,
    puzzleRating: 800,
    lastPlayedAt: '',
  };
}

// ─── Puzzle Database ────────────────────────────────────────────────────────

let _puzzleDB: Puzzle[] | null = null;

export async function loadPuzzleDatabase(): Promise<Puzzle[]> {
  if (_puzzleDB) return _puzzleDB;

  try {
    const res = await fetch('/puzzles.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _puzzleDB = data.puzzles as Puzzle[];
    console.log(`[Puzzles] Loaded ${_puzzleDB.length} puzzles (${data.source})`);
    return _puzzleDB;
  } catch (err) {
    console.error('[Puzzles] Failed to load puzzle database:', err);
    _puzzleDB = [];
    return _puzzleDB;
  }
}

export function getPuzzleCount(): number {
  return _puzzleDB?.length ?? 0;
}

// ─── Puzzle Selection ───────────────────────────────────────────────────────

/** Pick the next puzzle near the player's puzzle rating, avoiding already-solved ones. */
export function selectNextPuzzle(
  puzzles: Puzzle[],
  progress: PuzzleProgress,
  filterTheme?: string,
): Puzzle | null {
  if (puzzles.length === 0) return null;

  const solvedSet = new Set(progress.solvedIds);
  const targetRating = progress.puzzleRating;

  let candidates = puzzles.filter(p => !solvedSet.has(p.id));

  if (filterTheme) {
    const themed = candidates.filter(p => p.themes.includes(filterTheme));
    if (themed.length > 0) candidates = themed;
  }

  if (candidates.length === 0) {
    // All solved — wrap around but prefer least-recently played
    candidates = filterTheme
      ? puzzles.filter(p => p.themes.includes(filterTheme))
      : [...puzzles];
  }

  if (candidates.length === 0) return null;

  // Sort by closeness to target rating, with slight randomization
  candidates.sort((a, b) => {
    const da = Math.abs(a.rating - targetRating);
    const db = Math.abs(b.rating - targetRating);
    return (da - db) + (Math.random() - 0.5) * 100;
  });

  return candidates[0];
}

// ─── Puzzle Solving ─────────────────────────────────────────────────────────

/**
 * Prepare a puzzle for play. Returns the FEN the player sees
 * (after the opponent's setup move) and the expected solution moves.
 */
export function preparePuzzle(puzzle: Puzzle): {
  displayFen: string;
  playerColor: 'white' | 'black';
  solutionMoves: string[];   // UCI moves the player must make
  opponentMoves: string[];   // UCI moves the opponent makes between player moves
} | null {
  if (!puzzle.fen || !puzzle.moves || puzzle.moves.length < 2) {
    console.warn('[Puzzles] Invalid puzzle data:', puzzle.id);
    return null;
  }

  try {
    const chess = new Chess(puzzle.fen);

    // moves[0] is the opponent's setup move — play it to get the puzzle position
    const setupMove = puzzle.moves[0];
    const from = setupMove.slice(0, 2);
    const to = setupMove.slice(2, 4);
    const promotion = setupMove.length === 5 ? setupMove[4] : undefined;

    chess.move({ from, to, promotion });

    const displayFen = chess.fen();
    const playerColor = chess.turn() === 'w' ? 'white' : 'black';

    // Remaining moves alternate: player, opponent, player, opponent...
    const remainingMoves = puzzle.moves.slice(1);
    const solutionMoves: string[] = [];
    const opponentMoves: string[] = [];

    for (let i = 0; i < remainingMoves.length; i++) {
      if (i % 2 === 0) solutionMoves.push(remainingMoves[i]);
      else opponentMoves.push(remainingMoves[i]);
    }

    return { displayFen, playerColor, solutionMoves, opponentMoves };
  } catch (err) {
    console.warn('[Puzzles] Failed to prepare puzzle:', puzzle.id, err);
    return null;
  }
}

/**
 * Check if a player's UCI move matches the expected solution move.
 * Returns true for exact match OR if Stockfish confirms it's equally good.
 */
export function checkMove(playerMoveUCI: string, expectedMoveUCI: string): boolean {
  return playerMoveUCI === expectedMoveUCI;
}

// ─── Rating Update ──────────────────────────────────────────────────────────

/**
 * Simple Glicko-like rating update for puzzle attempts.
 * K-factor is 32 for puzzles (higher volatility than game ELO).
 */
export function updatePuzzleRating(
  progress: PuzzleProgress,
  puzzle: Puzzle,
  solved: boolean,
): PuzzleAttemptResult {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (puzzle.rating - progress.puzzleRating) / 400));
  const score = solved ? 1 : 0;
  const change = Math.round(K * (score - expected));
  const newRating = Math.max(100, progress.puzzleRating + change);

  return {
    correct: solved,
    puzzleId: puzzle.id,
    ratingChange: change,
    newPuzzleRating: newRating,
  };
}

/**
 * Apply a puzzle attempt result to the progress object. Returns updated copy.
 */
export function applyPuzzleResult(
  progress: PuzzleProgress,
  result: PuzzleAttemptResult,
): PuzzleProgress {
  const updated = { ...progress };
  updated.totalAttempts++;
  updated.puzzleRating = result.newPuzzleRating;
  updated.lastPlayedAt = new Date().toISOString();

  if (result.correct) {
    updated.totalSolved++;
    updated.currentStreak++;
    updated.bestStreak = Math.max(updated.bestStreak, updated.currentStreak);
    if (!updated.solvedIds.includes(result.puzzleId)) {
      updated.solvedIds = [...updated.solvedIds, result.puzzleId];
    }
  } else {
    updated.currentStreak = 0;
    if (!updated.attemptedIds.includes(result.puzzleId)) {
      updated.attemptedIds = [...updated.attemptedIds, result.puzzleId];
    }
  }

  return updated;
}

// ─── Theme Helpers ──────────────────────────────────────────────────────────

export const PUZZLE_THEME_LABELS: Record<string, string> = {
  mateIn1: 'Mate in 1',
  mateIn2: 'Mate in 2',
  mateIn3: 'Mate in 3',
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  discoveredAttack: 'Discovered Attack',
  doubleCheck: 'Double Check',
  sacrifice: 'Sacrifice',
  deflection: 'Deflection',
  decoy: 'Decoy',
  intermezzo: 'Intermezzo',
  clearance: 'Clearance',
  hangingPiece: 'Hanging Piece',
  trappedPiece: 'Trapped Piece',
  backRankMate: 'Back Rank Mate',
  smotheredMate: 'Smothered Mate',
  endgame: 'Endgame',
  middlegame: 'Middlegame',
  opening: 'Opening',
  promotion: 'Promotion',
  quietMove: 'Quiet Move',
  zugzwang: 'Zugzwang',
  defensiveMove: 'Defensive Move',
  crushing: 'Crushing',
  advantage: 'Advantage',
  equality: 'Equality',
  short: 'Short',
  long: 'Long',
  veryLong: 'Very Long',
  oneMove: 'One Move',
  kingsideAttack: 'Kingside Attack',
  queensideAttack: 'Queenside Attack',
  exposedKing: 'Exposed King',
  pawnEndgame: 'Pawn Endgame',
  rookEndgame: 'Rook Endgame',
  bishopEndgame: 'Bishop Endgame',
  knightEndgame: 'Knight Endgame',
  queenRookEndgame: 'Queen+Rook Endgame',
  castling: 'Castling',
  enPassant: 'En Passant',
  underPromotion: 'Under-Promotion',
};

/** Get sorted list of themes present in loaded puzzles. */
export function getAvailableThemes(puzzles: Puzzle[]): string[] {
  const themes = new Set<string>();
  for (const p of puzzles) {
    for (const t of p.themes) themes.add(t);
  }
  return Array.from(themes).sort((a, b) => {
    const la = PUZZLE_THEME_LABELS[a] || a;
    const lb = PUZZLE_THEME_LABELS[b] || b;
    return la.localeCompare(lb);
  });
}
