# Code Audit: Sideways Chess Side Scroller

**Audit Date:** January 20, 2026  
**Files Reviewed:** 6 source files (main.ts, chessEngine.ts, levelSystem.ts, saveSystem.ts, gameState.ts, types.ts)

---

## 📁 Current File Structure

```
src/
├── main.ts          (567 lines) - Entry point, rendering, game loop
├── chessEngine.ts   (421 lines) - Chess.js wrapper, minimax AI
├── levelSystem.ts   (~70 lines) - 19-level ELO progression
├── saveSystem.ts    (141 lines) - localStorage persistence
├── gameState.ts     (~30 lines) - ELO calculation only
├── types.ts         (~12 lines) - Shared type definitions
└── legacy/          (archived old code)
```

---

## 🔴 CRITICAL ISSUES

### 1. **Hardcoded Debug Code in Production** (main.ts:38-41)
```typescript
// PROBLEM: This clears ALL save data on every page load!
localStorage.removeItem('sideways-chess-save');
let saveData = loadGame();
```
**Risk:** Player progress is destroyed every refresh  
**Fix:** Remove debug code, use proper save/load flow

### 2. **AI Depth Performance Issues** (levelSystem.ts + main.ts)
```typescript
// levelSystem.ts defines aiDepth up to 6 for high levels
{ level: 18, name: 'Transcendent', aiDepth: 6, aiRandomness: 0 },
{ level: 19, name: 'Beyond', aiDepth: 6, aiRandomness: 0 },

// BUT main.ts ignores this and caps at 3:
const depth = Math.min(Math.ceil(level.level / 6), 3);
```
**Risk:** Inconsistent behavior, level system not respected  
**Fix:** Use `level.aiDepth` directly OR remove from LevelInfo

### 3. **Type Safety Hole** (saveSystem.ts:58-63)
```typescript
const data = JSON.parse(saved) as SaveData;
// No validation - trusts localStorage completely
```
**Risk:** Corrupted/malicious localStorage data crashes game  
**Fix:** Add schema validation with runtime checks

---

## 🟡 EFFICIENCY ISSUES

### 4. **Redundant Board Lookups** (main.ts)
```typescript
// board is fetched multiple times per frame
const board = engine.getBoard();  // Called in drawPieces
const board = engine.getBoard();  // Called in handleClick
```
**Impact:** Minor - getBoard() recreates 8x8 array each call  
**Fix:** Cache board reference, only update after moves

### 5. **Expensive Render Loop** (main.ts:drawInfiniteRibbon)
```typescript
// Draws 12 full boards (6 up + 6 down) every frame
for (let ext = 1; ext <= 6; ext++) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      // That's 6 * 64 = 384 tiles above + 384 below = 768 tiles per frame
```
**Impact:** ~800 fillRect calls per frame  
**Fix:** Pre-render infinite boards to offscreen canvas

### 6. **Synchronous AI Blocking** (main.ts:makeAIMove)
```typescript
setTimeout(makeAIMove, 300);  // UI freezes during minimax
```
**Impact:** UI hangs for high depths (depth 3 = ~1-2 seconds)  
**Fix:** Use Web Worker for AI computation

### 7. **Minimax Move Generation Overhead** (chessEngine.ts:383)
```typescript
const moves = this.chess.moves({ verbose: true });
// Generated fresh at EVERY minimax node - expensive!
```
**Impact:** Major for depth 3+ (thousands of allocations)  
**Fix:** Use incremental move generation or cache

---

## 🟢 CODE QUALITY ISSUES

### 8. **Dead Code - levelSystem.aiDepth unused**
```typescript
// levelSystem.ts defines aiDepth and aiRandomness per level
// But main.ts calculates its own formula ignoring these
```
**Fix:** Either use the level system values or remove them

### 9. **Magic Numbers Throughout**
```typescript
// main.ts
const TILE_SIZE = 70;      // OK - has name
const TILT_ANGLE = 3 * Math.PI / 180;  // OK
setTimeout(makeAIMove, 300);  // Magic! Why 300ms?
setTimeout(() => ..., 1500);  // Magic! Why 1500ms?
setTimeout(() => ..., 3000);  // Magic! Why 3000ms?

// Blunder formula has magic numbers
const blunderChance = Math.max(0, 0.4 - level.level * 0.025);
```
**Fix:** Define as named constants with explanatory comments

### 10. **Inconsistent Error Handling**
```typescript
// chessEngine.ts - catches and returns fallback
} catch (e) {
  console.error('[Engine] getBestMove error:', e);
  return moves.length > 0 ? moves[0] : null;  // Silent fallback
}

// saveSystem.ts - catches and returns default
} catch (e) {
  console.error('Failed to load game:', e);
}
return createDefaultSave();  // Silent fallback

// main.ts - throws
if (!canvas) {
  throw new Error('Canvas element not found');  // Crashes app
}
```
**Fix:** Standardize error strategy (log + fallback OR throw + catch at boundary)

### 11. **No Input Validation on ELO**
```typescript
elo = Math.max(100, elo);  // Floor at 100... but no ceiling
// Nothing prevents elo = NaN, elo = Infinity, elo = negative huge
```
**Fix:** Add bounds checking: `Math.min(Math.max(100, elo), 10000)`

### 12. **Redundant Stats Tracking** (main.ts + saveSystem.ts)
```typescript
// main.ts maintains local variables
let elo = saveData.elo;
let gamesWon = saveData.gamesWon;

// Then handleGameEnd duplicates the work
gamesPlayed++;
gamesWon++;
// AND THEN calls updateStatsAfterGame which does the same thing!
```
**Fix:** Single source of truth - update saveData directly

---

## 🔵 SECURITY VULNERABILITIES

### 13. **localStorage Trust** (saveSystem.ts)
```typescript
const data = JSON.parse(saved) as SaveData;
// User can open DevTools and set:
// localStorage['sideways-chess-save'] = '{"elo":9999999}'
```
**Risk:** Trivial cheating via console  
**Mitigation:** Add checksum/hash validation (won't stop dedicated cheaters but adds friction)

### 14. **Potential Prototype Pollution** (saveSystem.ts)
```typescript
return {
  ...createDefaultSave(),
  ...data  // If data has __proto__ keys, could pollute
};
```
**Risk:** Low for localStorage-only, but bad pattern  
**Fix:** Use `Object.assign({}, createDefaultSave(), validated)` with explicit key copying

### 15. **No Rate Limiting on Saves**
```typescript
// Every game end immediately writes to localStorage
saveGame(updateStatsAfterGame(...));
```
**Risk:** Low for localStorage, but if moved to server = DoS potential  
**Fix:** Debounce saves, use requestIdleCallback

---

## 📊 CODE METRICS

| File | Lines | Functions | Complexity |
|------|-------|-----------|------------|
| main.ts | 567 | 15 | Medium-High |
| chessEngine.ts | 421 | 22 | High (minimax) |
| levelSystem.ts | 70 | 4 | Low |
| saveSystem.ts | 141 | 7 | Low |
| gameState.ts | 30 | 1 | Low |
| types.ts | 12 | 0 | Low |

**Total:** ~1,241 lines of TypeScript

---

## 🔧 RECOMMENDED REFACTORS (Priority Order)

### P0 - Must Fix Before Feature Work
1. Remove localStorage.removeItem debug line
2. Fix ELO bounds validation (prevent NaN/Infinity/negative)
3. Add save data schema validation

### P1 - Should Fix Soon
4. Standardize error handling strategy
5. Remove duplicate stats tracking (single source of truth)
6. Define timing constants (300ms, 1500ms, 3000ms delays)
7. Use level.aiDepth OR remove from LevelInfo

### P2 - Performance Optimization
8. Cache board reference in render loop
9. Pre-render infinite ribbon to offscreen canvas
10. Move minimax to Web Worker

### P3 - Nice to Have
11. Add save data checksum for cheat detection
12. Add comprehensive unit tests
13. Add visual loading indicator during AI thinking

---

## 📄 FULL SOURCE DUMP (For External Review)

### types.ts
```typescript
// src/types.ts
// Shared types for the chess game

export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
export type PieceColor = 'white' | 'black';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}
```

### gameState.ts
```typescript
// src/gameState.ts
// ELO calculation utility

export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  result: 'win' | 'loss' | 'draw',
  kFactor: number = 32
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  
  let actualScore: number;
  if (result === 'win') actualScore = 1;
  else if (result === 'loss') actualScore = 0;
  else actualScore = 0.5;
  
  return Math.round(kFactor * (actualScore - expectedScore));
}
```

### levelSystem.ts
```typescript
// src/levelSystem.ts
// Player level progression system

export interface LevelInfo {
  level: number;
  name: string;
  minElo: number;
  maxElo: number;
  aiDepth: number;       // NOTE: Currently ignored by main.ts
  aiRandomness: number;  // NOTE: Currently ignored by main.ts
}

export const LEVELS: LevelInfo[] = [
  { level: 1,  name: 'Beginner',        minElo: 100,  maxElo: 299,  aiDepth: 1, aiRandomness: 0.6 },
  { level: 2,  name: 'Novice',          minElo: 300,  maxElo: 499,  aiDepth: 1, aiRandomness: 0.5 },
  { level: 3,  name: 'Apprentice',      minElo: 500,  maxElo: 699,  aiDepth: 1, aiRandomness: 0.4 },
  { level: 4,  name: 'Student',         minElo: 700,  maxElo: 899,  aiDepth: 2, aiRandomness: 0.35 },
  { level: 5,  name: 'Amateur',         minElo: 900,  maxElo: 1099, aiDepth: 2, aiRandomness: 0.3 },
  { level: 6,  name: 'Club Player',     minElo: 1100, maxElo: 1299, aiDepth: 2, aiRandomness: 0.25 },
  { level: 7,  name: 'Tournament',      minElo: 1300, maxElo: 1499, aiDepth: 2, aiRandomness: 0.2 },
  { level: 8,  name: 'Expert',          minElo: 1500, maxElo: 1699, aiDepth: 3, aiRandomness: 0.15 },
  { level: 9,  name: 'Candidate Master',minElo: 1700, maxElo: 1899, aiDepth: 3, aiRandomness: 0.1 },
  { level: 10, name: 'Master',          minElo: 1900, maxElo: 2099, aiDepth: 3, aiRandomness: 0.05 },
  { level: 11, name: 'International',   minElo: 2100, maxElo: 2299, aiDepth: 3, aiRandomness: 0.02 },
  { level: 12, name: 'Grandmaster',     minElo: 2300, maxElo: 2499, aiDepth: 4, aiRandomness: 0.01 },
  { level: 13, name: 'Super GM',        minElo: 2500, maxElo: 2699, aiDepth: 4, aiRandomness: 0 },
  { level: 14, name: 'World Class',     minElo: 2700, maxElo: 2999, aiDepth: 4, aiRandomness: 0 },
  { level: 15, name: 'Legend',          minElo: 3000, maxElo: 3499, aiDepth: 5, aiRandomness: 0 },
  { level: 16, name: 'Immortal',        minElo: 3500, maxElo: 3999, aiDepth: 5, aiRandomness: 0 },
  { level: 17, name: 'Chess God',       minElo: 4000, maxElo: 4499, aiDepth: 5, aiRandomness: 0 },
  { level: 18, name: 'Transcendent',    minElo: 4500, maxElo: 4999, aiDepth: 6, aiRandomness: 0 },
  { level: 19, name: 'Beyond',          minElo: 5000, maxElo: 9999, aiDepth: 6, aiRandomness: 0 },
];

export function getLevelForElo(elo: number): LevelInfo {
  for (const level of LEVELS) {
    if (elo >= level.minElo && elo <= level.maxElo) {
      return level;
    }
  }
  return LEVELS[LEVELS.length - 1];
}

export function getLevelProgress(elo: number): number {
  const level = getLevelForElo(elo);
  const range = level.maxElo - level.minElo;
  const progress = elo - level.minElo;
  return Math.min(100, Math.max(0, (progress / range) * 100));
}

export function checkLevelChange(oldElo: number, newElo: number): 'up' | 'down' | null {
  const oldLevel = getLevelForElo(oldElo);
  const newLevel = getLevelForElo(newElo);
  if (newLevel.level > oldLevel.level) return 'up';
  if (newLevel.level < oldLevel.level) return 'down';
  return null;
}

export function getAISettingsForLevel(elo: number): { depth: number; randomness: number } {
  const level = getLevelForElo(elo);
  return { depth: level.aiDepth, randomness: level.aiRandomness };
}
```

### saveSystem.ts
```typescript
// src/saveSystem.ts
// Handles saving and loading game progress to localStorage

export interface SaveData {
  elo: number;
  gamesWon: number;
  gamesLost: number;
  gamesPlayed: number;
  highestElo: number;
  currentWinStreak: number;
  bestWinStreak: number;
  promotedPieces: PromotedPiece[];
  totalPromotions: Record<string, number>;
}

export interface PromotedPiece {
  type: 'Q' | 'R' | 'B' | 'N';
  earnedAtElo: number;
  gameNumber: number;
}

const SAVE_KEY = 'sideways-chess-save';

export function createDefaultSave(): SaveData {
  return {
    elo: 400,
    gamesWon: 0,
    gamesLost: 0,
    gamesPlayed: 0,
    highestElo: 400,
    currentWinStreak: 0,
    bestWinStreak: 0,
    promotedPieces: [],
    totalPromotions: { Q: 0, R: 0, B: 0, N: 0 }
  };
}

export function saveGame(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save game:', e);
  }
}

export function loadGame(): SaveData {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const data = JSON.parse(saved) as SaveData;
      // ISSUE: No validation - trusts localStorage completely
      return { ...createDefaultSave(), ...data };
    }
  } catch (e) {
    console.error('Failed to load game:', e);
  }
  return createDefaultSave();
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function recordPromotion(data: SaveData, pieceType: 'Q' | 'R' | 'B' | 'N'): SaveData {
  return {
    ...data,
    promotedPieces: [
      ...data.promotedPieces,
      { type: pieceType, earnedAtElo: data.elo, gameNumber: data.gamesPlayed }
    ],
    totalPromotions: {
      ...data.totalPromotions,
      [pieceType]: (data.totalPromotions[pieceType] || 0) + 1
    }
  };
}

export function updateStatsAfterGame(
  data: SaveData,
  newElo: number,
  playerWon: boolean,
  isDraw: boolean
): SaveData {
  const updated = { ...data };
  updated.elo = Math.max(100, newElo);
  updated.highestElo = Math.max(updated.highestElo, newElo);
  updated.gamesPlayed++;
  
  if (playerWon) {
    updated.gamesWon++;
    updated.currentWinStreak++;
    updated.bestWinStreak = Math.max(updated.bestWinStreak, updated.currentWinStreak);
  } else if (!isDraw) {
    updated.gamesLost++;
    updated.currentWinStreak = 0;
  }
  return updated;
}
```

### chessEngine.ts
```typescript
// src/chessEngine.ts
// Chess engine wrapper using chess.js library

import { Chess, Square, Move as ChessMove, PieceSymbol } from 'chess.js';
import type { Piece, PieceColor, PieceType } from './types';

export interface Move {
  from: { row: number; col: number };
  to: { row: number; col: number };
  piece: Piece;
  capture?: Piece;
  promotion?: PieceType;
  castling?: 'kingSide' | 'queenSide';
}

export function boardToFEN(
  board: (Piece | null)[][],
  currentTurn: PieceColor,
  castlingRights?: { whiteKingSide: boolean; whiteQueenSide: boolean; blackKingSide: boolean; blackQueenSide: boolean },
  enPassantTarget?: { row: number; col: number } | null
): string {
  let fen = '';
  for (let row = 0; row < 8; row++) {
    let emptyCount = 0;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        if (emptyCount > 0) { fen += emptyCount; emptyCount = 0; }
        let char = piece.type === 'N' ? 'N' : piece.type;
        fen += piece.color === 'white' ? char.toUpperCase() : char.toLowerCase();
      } else { emptyCount++; }
    }
    if (emptyCount > 0) fen += emptyCount;
    if (row < 7) fen += '/';
  }
  fen += ' ' + (currentTurn === 'white' ? 'w' : 'b');
  let castling = '';
  if (castlingRights) {
    if (castlingRights.whiteKingSide) castling += 'K';
    if (castlingRights.whiteQueenSide) castling += 'Q';
    if (castlingRights.blackKingSide) castling += 'k';
    if (castlingRights.blackQueenSide) castling += 'q';
  }
  fen += ' ' + (castling || '-');
  if (enPassantTarget) {
    const file = String.fromCharCode(97 + enPassantTarget.col);
    const rank = 8 - enPassantTarget.row;
    fen += ' ' + file + rank;
  } else { fen += ' -'; }
  fen += ' 0 1';
  return fen;
}

function squareToRowCol(square: Square): { row: number; col: number } {
  const col = square.charCodeAt(0) - 97;
  const row = 8 - parseInt(square[1]);
  return { row, col };
}

function rowColToSquare(row: number, col: number): Square {
  const file = String.fromCharCode(97 + col);
  const rank = (8 - row).toString();
  return (file + rank) as Square;
}

function chessJsPieceToOurs(piece: { type: PieceSymbol; color: 'w' | 'b' }): Piece {
  const typeMap: Record<PieceSymbol, PieceType> = {
    'p': 'P', 'n': 'N', 'b': 'B', 'r': 'R', 'q': 'Q', 'k': 'K'
  };
  return { type: typeMap[piece.type], color: piece.color === 'w' ? 'white' : 'black' };
}

export class ChessEngine {
  private chess: Chess;
  
  constructor() { this.chess = new Chess(); }
  
  loadPosition(
    board: (Piece | null)[][],
    currentTurn: PieceColor,
    castlingRights?: { whiteKingSide: boolean; whiteQueenSide: boolean; blackKingSide: boolean; blackQueenSide: boolean },
    enPassantTarget?: { row: number; col: number } | null
  ): void {
    const fen = boardToFEN(board, currentTurn, castlingRights, enPassantTarget);
    this.chess.load(fen);
  }
  
  getLegalMoves(): Move[] {
    const moves = this.chess.moves({ verbose: true });
    return moves.map(m => this.convertMove(m));
  }
  
  private convertMove(m: ChessMove): Move {
    const from = squareToRowCol(m.from as Square);
    const to = squareToRowCol(m.to as Square);
    const piece: Piece = { type: m.piece.toUpperCase() as PieceType, color: m.color === 'w' ? 'white' : 'black' };
    const move: Move = { from, to, piece };
    if (m.captured) move.capture = { type: m.captured.toUpperCase() as PieceType, color: m.color === 'w' ? 'black' : 'white' };
    if (m.promotion) move.promotion = m.promotion.toUpperCase() as PieceType;
    if (m.flags.includes('k')) move.castling = 'kingSide';
    else if (m.flags.includes('q')) move.castling = 'queenSide';
    return move;
  }
  
  isMoveLegal(from: { row: number; col: number }, to: { row: number; col: number }, promotion?: PieceType): boolean {
    const fromSquare = rowColToSquare(from.row, from.col);
    const toSquare = rowColToSquare(to.row, to.col);
    try {
      const moveObj: { from: Square; to: Square; promotion?: string } = { from: fromSquare, to: toSquare };
      if (promotion) moveObj.promotion = promotion.toLowerCase();
      const result = this.chess.move(moveObj);
      if (result) { this.chess.undo(); return true; }
      return false;
    } catch { return false; }
  }
  
  makeMove(from: { row: number; col: number }, to: { row: number; col: number }, promotion?: PieceType): ChessMove | null {
    const fromSquare = rowColToSquare(from.row, from.col);
    const toSquare = rowColToSquare(to.row, to.col);
    try {
      const moveObj: { from: Square; to: Square; promotion?: string } = { from: fromSquare, to: toSquare };
      if (promotion) moveObj.promotion = promotion.toLowerCase();
      return this.chess.move(moveObj);
    } catch { return null; }
  }
  
  undo(): void { this.chess.undo(); }
  isCheck(): boolean { return this.chess.isCheck(); }
  isCheckmate(): boolean { return this.chess.isCheckmate(); }
  isStalemate(): boolean { return this.chess.isStalemate(); }
  isDraw(): boolean { return this.chess.isDraw(); }
  isGameOver(): boolean { return this.chess.isGameOver(); }
  turn(): PieceColor { return this.chess.turn() === 'w' ? 'white' : 'black'; }
  fen(): string { return this.chess.fen(); }
  reset(): void { this.chess.reset(); }
  
  getBoard(): (Piece | null)[][] {
    const board: (Piece | null)[][] = [];
    const chessBoard = this.chess.board();
    for (let row = 0; row < 8; row++) {
      board[row] = [];
      for (let col = 0; col < 8; col++) {
        const square = chessBoard[row][col];
        board[row][col] = square ? chessJsPieceToOurs(square) : null;
      }
    }
    return board;
  }
  
  evaluate(): number {
    const pieceValues: Record<PieceType, number> = { 'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000 };
    const pawnTable = [
      [0,0,0,0,0,0,0,0], [50,50,50,50,50,50,50,50], [10,10,20,30,30,20,10,10],
      [5,5,10,25,25,10,5,5], [0,0,0,20,20,0,0,0], [5,-5,-10,0,0,-10,-5,5],
      [5,10,10,-20,-20,10,10,5], [0,0,0,0,0,0,0,0]
    ];
    
    let score = 0;
    const board = this.chess.board();
    
    if (this.chess.isCheckmate()) return this.chess.turn() === 'w' ? -100000 : 100000;
    if (this.chess.isStalemate() || this.chess.isDraw()) return 0;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          let value = pieceValues[piece.type.toUpperCase() as PieceType];
          if (piece.type === 'p') {
            const tableRow = piece.color === 'w' ? row : 7 - row;
            value += pawnTable[tableRow][col];
          }
          if ((row === 3 || row === 4) && (col === 3 || col === 4)) value += 10;
          score += piece.color === 'w' ? value : -value;
        }
      }
    }
    score += this.chess.turn() === 'w' ? 10 : -10;
    return score;
  }
  
  getBestMove(depth: number, maximizing: boolean): Move | null {
    try {
      const moves = this.getLegalMoves();
      if (moves.length === 0) return null;
      
      let bestMove: Move | null = null;
      let bestScore = maximizing ? -Infinity : Infinity;
      
      for (const move of moves) {
        const fromSquare = rowColToSquare(move.from.row, move.from.col);
        const toSquare = rowColToSquare(move.to.row, move.to.col);
        this.chess.move({ from: fromSquare, to: toSquare, promotion: move.promotion?.toLowerCase() });
        const score = this.minimax(depth - 1, -Infinity, Infinity, !maximizing);
        this.chess.undo();
        
        if (maximizing) {
          if (score > bestScore) { bestScore = score; bestMove = move; }
        } else {
          if (score < bestScore) { bestScore = score; bestMove = move; }
        }
      }
      return bestMove;
    } catch (e) {
      console.error('[Engine] getBestMove error:', e);
      const moves = this.getLegalMoves();
      return moves.length > 0 ? moves[0] : null;
    }
  }
  
  private minimax(depth: number, alpha: number, beta: number, maximizing: boolean): number {
    if (depth === 0 || this.chess.isGameOver()) return this.evaluate();
    
    const moves = this.chess.moves({ verbose: true });
    moves.sort((a, b) => {
      const captureA = a.captured ? this.getPieceValue(a.captured) : 0;
      const captureB = b.captured ? this.getPieceValue(b.captured) : 0;
      return captureB - captureA;
    });
    
    if (maximizing) {
      let maxScore = -Infinity;
      for (const m of moves) {
        this.chess.move(m);
        const score = this.minimax(depth - 1, alpha, beta, false);
        this.chess.undo();
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const m of moves) {
        this.chess.move(m);
        const score = this.minimax(depth - 1, alpha, beta, true);
        this.chess.undo();
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return minScore;
    }
  }
  
  private getPieceValue(piece: string): number {
    const values: Record<string, number> = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000 };
    return values[piece.toLowerCase()] || 0;
  }
}

export const engine = new ChessEngine();
```

### main.ts
```typescript
// src/main.ts - Entry Point (567 lines)
// WARNING: Contains debug code that clears localStorage on every load!

import type { PieceType, PieceColor, Piece } from './types';
export type { PieceType, PieceColor, Piece } from './types';

import { engine, type Move } from './chessEngine';
import { getLevelForElo, getLevelProgress, checkLevelChange } from './levelSystem';
import { loadGame, saveGame, updateStatsAfterGame } from './saveSystem';
import { calculateEloChange } from './gameState';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Could not get 2D context');

// Constants
const TILE_SIZE = 70;
const BOARD_SIZE = 8;
const BOARD_OFFSET_X = 170;
const BOARD_OFFSET_Y = 70;
const TILT_ANGLE = 3 * Math.PI / 180;
const LIGHT_SQUARE = '#f0d9b5';
const DARK_SQUARE = '#b58863';
const SELECTED_SQUARE = '#7fc97f';
const LEGAL_MOVE_HIGHLIGHT = 'rgba(100, 200, 100, 0.6)';
const INFINITE_LIGHT = '#d4c4a8';
const INFINITE_DARK = '#9a7b5a';
const VOID_COLOR = '#1a1a2e';

// ⚠️ DEBUG CODE - REMOVE IN PRODUCTION
localStorage.removeItem('sideways-chess-save');  // <-- THIS CLEARS SAVE EVERY REFRESH!
let saveData = loadGame();

let elo = saveData.elo;
let gamesWon = saveData.gamesWon;
let gamesLost = saveData.gamesLost;
let gamesPlayed = saveData.gamesPlayed;
let playerColor: PieceColor = 'white';
let gameOver = false;
let selectedSquare: { row: number; col: number } | null = null;
let legalMovesForSelected: Move[] = [];

// DOM refs (may be null)
const eloElem = document.getElementById('elo');
const gamesWonElem = document.getElementById('games-won');
const gamesLostElem = document.getElementById('games-lost');
const gamesPlayedElem = document.getElementById('games-played');
const sidebarTurnElem = document.getElementById('sidebar-turn');
const playerLevelElem = document.getElementById('player-level');
const levelNameElem = document.getElementById('level-name');
const eloProgressElem = document.getElementById('elo-progress');
const eloMinElem = document.getElementById('elo-min');
const eloMaxElem = document.getElementById('elo-max');
const levelNotificationElem = document.getElementById('level-notification');

function getAIElo(): number {
  const level = getLevelForElo(elo);
  return Math.floor((level.minElo + level.maxElo) / 2);
}

function updateSidebar(): void {
  const level = getLevelForElo(elo);
  const progress = getLevelProgress(elo);
  const currentTurn = engine.turn();
  if (eloElem) eloElem.textContent = String(elo);
  if (gamesWonElem) gamesWonElem.textContent = String(gamesWon);
  if (gamesLostElem) gamesLostElem.textContent = String(gamesLost);
  if (gamesPlayedElem) gamesPlayedElem.textContent = String(gamesPlayed);
  if (sidebarTurnElem) sidebarTurnElem.textContent = currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1);
  if (playerLevelElem) playerLevelElem.textContent = String(level.level);
  if (levelNameElem) levelNameElem.textContent = level.name;
  if (eloProgressElem) eloProgressElem.style.width = `${progress}%`;
  if (eloMinElem) eloMinElem.textContent = String(level.minElo);
  if (eloMaxElem) eloMaxElem.textContent = String(level.maxElo);
}

// ... (rendering functions: drawInfiniteRibbon, drawBoard, drawPiece, etc.)
// ... (input handling: handleClick)
// ... (AI: makeAIMove - NOTE: ignores level.aiDepth, uses own formula)
// ... (game logic: checkGameState, handleGameEnd, newGame)

// AI depth calculation (ISSUE: doesn't use levelSystem.aiDepth!)
function makeAIMove(): void {
  if (gameOver) return;
  const level = getLevelForElo(elo);
  const depth = Math.min(Math.ceil(level.level / 6), 3);  // Max depth 3
  const blunderChance = Math.max(0, 0.4 - level.level * 0.025);  // Magic numbers
  // ... minimax call
}

engine.reset();
render();
```

---

## ✅ SIGN-OFF

This codebase is **functional but needs cleanup** before adding major features like 3D rendering.

**Recommended next step:** Fix P0 issues (debug code, validation) then proceed with visual overhaul architecture.
