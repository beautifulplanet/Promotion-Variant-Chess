// src/learningAI.ts
// Self-learning AI for Promotion Variant Chess
// Uses reinforcement learning through self-play to improve

import type { Move } from './chessEngine';
import type { PieceType, Piece } from './types';
import { BALANCE } from './constants';

// =============================================================================
// LEARNED WEIGHTS - These get adjusted through training
// =============================================================================

interface LearnedWeights {
  // Piece values (start with standard, learn adjustments)
  pieceValues: {
    P: number;
    N: number;
    B: number;
    R: number;
    Q: number;
    K: number;
  };
  
  // Position bonuses per piece type (8x8 grids, flattened)
  // Positive = good square, negative = bad square
  positionBonus: {
    P: number[];
    N: number[];
    B: number[];
    R: number[];
    Q: number[];
    K: number[];
  };
  
  // Strategic weights
  centerControlBonus: number;
  developmentBonus: number;
  kingSafetyWeight: number;
  pawnStructureWeight: number;
  pieceActivityWeight: number;
  
  // Multi-queen game specific
  queenCoordinationBonus: number;
  multiQueenDefenseWeight: number;
  
  // Training stats
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  generation: number;
}

// Default starting weights
const DEFAULT_WEIGHTS: LearnedWeights = {
  pieceValues: { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 },
  positionBonus: {
    P: [
      0,  0,  0,  0,  0,  0,  0,  0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5,  5, 10, 25, 25, 10,  5,  5,
      0,  0,  0, 20, 20,  0,  0,  0,
      5, -5,-10,  0,  0,-10, -5,  5,
      5, 10, 10,-20,-20, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0
    ],
    N: [
      -50,-40,-30,-30,-30,-30,-40,-50,
      -40,-20,  0,  0,  0,  0,-20,-40,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  5, 15, 20, 20, 15,  5,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  5, 10, 15, 15, 10,  5,-30,
      -40,-20,  0,  5,  5,  0,-20,-40,
      -50,-40,-30,-30,-30,-30,-40,-50
    ],
    B: [
      -20,-10,-10,-10,-10,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5, 10, 10,  5,  0,-10,
      -10,  5,  5, 10, 10,  5,  5,-10,
      -10,  0, 10, 10, 10, 10,  0,-10,
      -10, 10, 10, 10, 10, 10, 10,-10,
      -10,  5,  0,  0,  0,  0,  5,-10,
      -20,-10,-10,-10,-10,-10,-10,-20
    ],
    R: [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0
    ],
    Q: [
      -20,-10,-10, -5, -5,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5,  5,  5,  5,  0,-10,
      -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
      -10,  5,  5,  5,  5,  5,  0,-10,
      -10,  0,  5,  0,  0,  0,  0,-10,
      -20,-10,-10, -5, -5,-10,-10,-20
    ],
    K: [
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20,
      -10,-20,-20,-20,-20,-20,-20,-10,
      20, 20,  0,  0,  0,  0, 20, 20,
      20, 30, 10,  0,  0, 10, 30, 20
    ],
  },
  centerControlBonus: 10,
  developmentBonus: 15,
  kingSafetyWeight: 25,
  pawnStructureWeight: 10,
  pieceActivityWeight: 5,
  queenCoordinationBonus: 20,
  multiQueenDefenseWeight: 15,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  generation: 1,
};

// =============================================================================
// STORAGE
// =============================================================================

const STORAGE_KEY = 'learning_ai_weights';

function loadWeights(): LearnedWeights {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults in case of new fields
      return { ...DEFAULT_WEIGHTS, ...parsed };
    }
  } catch (e) {
    console.warn('[LearningAI] Failed to load weights:', e);
  }
  return { ...DEFAULT_WEIGHTS };
}

function saveWeights(weights: LearnedWeights): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  } catch (e) {
    console.warn('[LearningAI] Failed to save weights:', e);
  }
}

// =============================================================================
// LEARNING AI CLASS
// =============================================================================

export class LearningAI {
  private weights: LearnedWeights;
  private moveHistory: Array<{ fen: string; move: Move; evaluation: number }> = [];
  
  constructor() {
    try {
      this.weights = loadWeights();
      console.log(`[LearningAI] Loaded Gen ${this.weights.generation}, ${this.weights.gamesPlayed} games played`);
    } catch (e) {
      console.error('[LearningAI] Failed to initialize, using defaults:', e);
      this.weights = { ...DEFAULT_WEIGHTS };
    }
  }
  
  /**
   * Evaluate a board position using learned weights
   */
  evaluate(board: (any | null)[][], isWhiteTurn: boolean): number {
    let score = 0;
    let whiteQueens = 0;
    let blackQueens = 0;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;
        
        const isWhite = piece.color === 'white';
        const type = piece.type as PieceType;
        const pieceValue = this.weights.pieceValues[type] || 0;
        
        // Position bonus (flip for black)
        const posIndex = isWhite ? row * 8 + col : (7 - row) * 8 + col;
        const posBonus = this.weights.positionBonus[type]?.[posIndex] || 0;
        
        const totalValue = pieceValue + posBonus;
        score += isWhite ? totalValue : -totalValue;
        
        // Count queens for coordination bonus
        if (type === 'Q') {
          if (isWhite) whiteQueens++;
          else blackQueens++;
        }
      }
    }
    
    // Multi-queen coordination bonus
    if (whiteQueens > 1) {
      score += this.weights.queenCoordinationBonus * (whiteQueens - 1);
    }
    if (blackQueens > 1) {
      score -= this.weights.queenCoordinationBonus * (blackQueens - 1);
    }
    
    // Return from perspective of current player
    return isWhiteTurn ? score : -score;
  }
  
  /**
   * Get best move using learned evaluation
   */
  getBestMove(
    board: (any | null)[][],
    legalMoves: Move[],
    isWhite: boolean,
    depth: number = 3,
    addNoise: boolean = false  // Add randomness for training diversity
  ): Move | null {
    if (legalMoves.length === 0) return null;
    
    let bestMove: Move | null = null;
    let bestScore = -Infinity;
    
    for (const move of legalMoves) {
      // Simulate move
      const newBoard = this.simulateMove(board, move);
      let score = -this.minimax(newBoard, depth - 1, -Infinity, Infinity, !isWhite);
      
      // Add small noise during training to create game variety
      if (addNoise) {
        score += (Math.random() - 0.5) * 20; // ±10 centipawns noise
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    return bestMove;
  }
  
  private minimax(
    board: (any | null)[][],
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
  ): number {
    if (depth === 0) {
      return this.evaluate(board, isMaximizing);
    }
    
    // Generate moves (simplified - real impl should use engine)
    const moves = this.generateSimpleMoves(board, isMaximizing);
    
    if (moves.length === 0) {
      // Check if king is in check = checkmate, otherwise stalemate
      return this.isKingInCheck(board, isMaximizing) ? -20000 : 0;
    }
    
    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of moves) {
        const newBoard = this.simulateMove(board, move);
        const score = this.minimax(newBoard, depth - 1, alpha, beta, false);
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const move of moves) {
        const newBoard = this.simulateMove(board, move);
        const score = this.minimax(newBoard, depth - 1, alpha, beta, true);
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return minScore;
    }
  }
  
  private simulateMove(board: (any | null)[][], move: Move): (any | null)[][] {
    const newBoard = board.map(row => [...row]);
    newBoard[move.to.row][move.to.col] = newBoard[move.from.row][move.from.col];
    newBoard[move.from.row][move.from.col] = null;
    
    // Handle promotion
    if (move.promotion && newBoard[move.to.row][move.to.col]) {
      newBoard[move.to.row][move.to.col] = {
        ...newBoard[move.to.row][move.to.col],
        type: move.promotion
      };
    }
    
    return newBoard;
  }
  
  private generateSimpleMoves(board: (any | null)[][], isWhite: boolean): Move[] {
    // Simplified move generation - captures and central moves preferred
    const pseudoLegalMoves: Move[] = [];
    const color = isWhite ? 'white' : 'black';
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece || piece.color !== color) continue;
        
        // Generate pseudo-legal moves based on piece type
        const pieceMoves = this.generatePieceMoves(board, row, col, piece);
        pseudoLegalMoves.push(...pieceMoves);
      }
    }
    
    // CRITICAL: Filter out moves that leave our king in check
    const legalMoves = pseudoLegalMoves.filter(move => {
      const newBoard = this.simulateMove(board, move);
      return !this.isKingInCheck(newBoard, isWhite);
    });
    
    // Sort: captures first, then center moves
    return legalMoves.sort((a, b) => {
      const aCapture = board[a.to.row][a.to.col] ? 1 : 0;
      const bCapture = board[b.to.row][b.to.col] ? 1 : 0;
      if (bCapture !== aCapture) return bCapture - aCapture;
      // Secondary: prefer center squares
      const centerScore = (r: number, c: number) => -Math.abs(3.5 - r) - Math.abs(3.5 - c);
      return centerScore(b.to.row, b.to.col) - centerScore(a.to.row, a.to.col);
    }).slice(0, 60); // Limit for speed but allow more options
  }
  
  private generatePieceMoves(board: (Piece | null)[][], row: number, col: number, piece: Piece): Move[] {
    const moves: Move[] = [];
    const directions: [number, number][] = [];
    const isWhite = piece.color === 'white';
    
    switch (piece.type) {
      case 'P':
        const dir = isWhite ? -1 : 1;
        const startRow = isWhite ? 6 : 1;
        const promoRow = isWhite ? 0 : 7;
        
        // Helper to add pawn move with promotion if needed
        const addPawnMove = (toRow: number, toCol: number) => {
          if (toRow === promoRow) {
            // Add promotion moves (Queen is almost always best, but include Knight for rare cases)
            moves.push({ from: { row, col }, to: { row: toRow, col: toCol }, piece, promotion: 'Q' as PieceType });
            moves.push({ from: { row, col }, to: { row: toRow, col: toCol }, piece, promotion: 'N' as PieceType });
          } else {
            moves.push({ from: { row, col }, to: { row: toRow, col: toCol }, piece });
          }
        };
        
        // Forward
        if (this.isEmpty(board, row + dir, col)) {
          addPawnMove(row + dir, col);
          if (row === startRow && this.isEmpty(board, row + 2 * dir, col)) {
            moves.push({ from: { row, col }, to: { row: row + 2 * dir, col }, piece });
          }
        }
        // Captures
        if (this.isEnemy(board, row + dir, col - 1, piece.color)) {
          addPawnMove(row + dir, col - 1);
        }
        if (this.isEnemy(board, row + dir, col + 1, piece.color)) {
          addPawnMove(row + dir, col + 1);
        }
        break;
        
      case 'N':
        const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of knightMoves) {
          if (this.canMoveTo(board, row + dr, col + dc, piece.color)) {
            moves.push({ from: { row, col }, to: { row: row + dr, col: col + dc }, piece });
          }
        }
        break;
        
      case 'B':
        directions.push([-1,-1], [-1,1], [1,-1], [1,1]);
        break;
        
      case 'R':
        directions.push([-1,0], [1,0], [0,-1], [0,1]);
        break;
        
      case 'Q':
        directions.push([-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]);
        break;
        
      case 'K':
        const kingMoves = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        for (const [dr, dc] of kingMoves) {
          if (this.canMoveTo(board, row + dr, col + dc, piece.color)) {
            moves.push({ from: { row, col }, to: { row: row + dr, col: col + dc }, piece });
          }
        }
        break;
    }
    
    // Sliding pieces
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (this.isEmpty(board, r, c)) {
          moves.push({ from: { row, col }, to: { row: r, col: c }, piece });
        } else if (this.isEnemy(board, r, c, piece.color)) {
          moves.push({ from: { row, col }, to: { row: r, col: c }, piece });
          break;
        } else {
          break;
        }
        r += dr;
        c += dc;
      }
    }
    
    return moves;
  }
  
  private isEmpty(board: (any | null)[][], row: number, col: number): boolean {
    return row >= 0 && row < 8 && col >= 0 && col < 8 && !board[row][col];
  }
  
  private isEnemy(board: (any | null)[][], row: number, col: number, color: string): boolean {
    if (row < 0 || row >= 8 || col < 0 || col >= 8) return false;
    const piece = board[row][col];
    return piece !== null && piece.color !== color;
  }
  
  private canMoveTo(board: (any | null)[][], row: number, col: number, color: string): boolean {
    return this.isEmpty(board, row, col) || this.isEnemy(board, row, col, color);
  }
  
  private isKingInCheck(board: (any | null)[][], isWhite: boolean): boolean {
    // Find king
    let kingRow = -1, kingCol = -1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'K' && (p.color === 'white') === isWhite) {
          kingRow = r;
          kingCol = c;
          break;
        }
      }
    }
    if (kingRow < 0) return true; // No king = already lost
    
    // Check if any enemy piece attacks king (simplified)
    const enemyColor = isWhite ? 'black' : 'white';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === enemyColor) {
          const moves = this.generatePieceMoves(board, r, c, p);
          if (moves.some(m => m.to.row === kingRow && m.to.col === kingCol)) {
            return true;
          }
        }
      }
    }
    return false;
  }
  
  /**
   * Learn from game result
   */
  learnFromGame(result: 'win' | 'loss' | 'draw', wasWhite: boolean): void {
    this.weights.gamesPlayed++;
    
    if (result === 'win') {
      this.weights.wins++;
      // Reinforce current weights slightly
      this.adjustWeights(0.01);
    } else if (result === 'loss') {
      this.weights.losses++;
      // Adjust weights away from current values
      this.adjustWeights(-0.01);
    } else {
      this.weights.draws++;
    }
    
    // Every 100 games, evolve to next generation
    if (this.weights.gamesPlayed % 100 === 0) {
      this.weights.generation++;
      console.log(`[LearningAI] Evolved to Gen ${this.weights.generation}!`);
      console.log(`[LearningAI] Win rate: ${(this.weights.wins / this.weights.gamesPlayed * 100).toFixed(1)}%`);
    }
    
    saveWeights(this.weights);
  }
  
  private adjustWeights(factor: number): void {
    // Adjust piece values slightly
    const noise = () => (Math.random() - 0.5) * 20 * factor;
    this.weights.pieceValues.P = Math.max(50, Math.min(150, this.weights.pieceValues.P + noise()));
    this.weights.pieceValues.N = Math.max(250, Math.min(400, this.weights.pieceValues.N + noise()));
    this.weights.pieceValues.B = Math.max(250, Math.min(400, this.weights.pieceValues.B + noise()));
    this.weights.pieceValues.R = Math.max(400, Math.min(600, this.weights.pieceValues.R + noise()));
    this.weights.pieceValues.Q = Math.max(800, Math.min(1100, this.weights.pieceValues.Q + noise()));
    
    // Adjust strategic weights
    this.weights.centerControlBonus += noise();
    this.weights.queenCoordinationBonus += noise();
    this.weights.kingSafetyWeight += noise();
  }
  
  /**
   * Get current stats
   */
  getStats(): { generation: number; gamesPlayed: number; winRate: number } {
    return {
      generation: this.weights.generation,
      gamesPlayed: this.weights.gamesPlayed,
      winRate: this.weights.gamesPlayed > 0 
        ? this.weights.wins / this.weights.gamesPlayed 
        : 0
    };
  }
  
  /**
   * Reset learning (start fresh)
   */
  reset(): void {
    this.weights = { ...DEFAULT_WEIGHTS };
    saveWeights(this.weights);
    console.log('[LearningAI] Reset to default weights');
  }
  
  /**
   * Export weights for sharing
   */
  exportWeights(): string {
    return JSON.stringify(this.weights, null, 2);
  }
  
  /**
   * Import weights
   */
  importWeights(json: string): boolean {
    try {
      const imported = JSON.parse(json);
      this.weights = { ...DEFAULT_WEIGHTS, ...imported };
      saveWeights(this.weights);
      console.log(`[LearningAI] Imported Gen ${this.weights.generation} weights`);
      return true;
    } catch (e) {
      console.error('[LearningAI] Failed to import weights:', e);
      return false;
    }
  }
}

// Singleton instance
export const learningAI = new LearningAI();

// =============================================================================
// SELF-PLAY TRAINING
// =============================================================================

export interface TrainingConfig {
  gamesPerSession: number;
  depthWhite: number;
  depthBlack: number;
  onProgress?: (game: number, total: number) => void;
  onComplete?: (stats: { wins: number; losses: number; draws: number }) => void;
  onError?: (error: Error) => void;
}

/**
 * Run self-play training session
 * This trains the AI by playing against itself
 */
export async function runTrainingSession(config: TrainingConfig): Promise<void> {
  const { gamesPerSession, depthWhite, depthBlack, onProgress, onComplete, onError } = config;
  
  let whiteWins = 0, blackWins = 0, draws = 0;
  
  console.log(`[LearningAI] Starting training: ${gamesPerSession} games`);
  
  try {
    for (let game = 0; game < gamesPerSession; game++) {
      const result = await playTrainingGame(depthWhite, depthBlack);
      
      if (result === 'white') {
        whiteWins++;
        // White won - learn from both perspectives
        learningAI.learnFromGame('win', true);   // White learns from winning
        learningAI.learnFromGame('loss', false); // Black learns from losing
      } else if (result === 'black') {
        blackWins++;
        // Black won - learn from both perspectives
        learningAI.learnFromGame('loss', true);  // White learns from losing
        learningAI.learnFromGame('win', false);  // Black learns from winning
      } else {
        draws++;
        // Draw - both sides learn from draw
        learningAI.learnFromGame('draw', true);
        learningAI.learnFromGame('draw', false);
      }
      
      if (onProgress) {
        onProgress(game + 1, gamesPerSession);
      }
      
      // Yield to prevent blocking
      await new Promise(r => setTimeout(r, 0));
    }
    
    const decisiveGames = whiteWins + blackWins;
    console.log(`[LearningAI] Training complete! White:${whiteWins} Black:${blackWins} Draws:${draws}`);
    console.log(`[LearningAI] Decisive game rate: ${(decisiveGames / gamesPerSession * 100).toFixed(1)}%`);
    
    if (onComplete) {
      onComplete({ wins: whiteWins, losses: blackWins, draws });
    }
  } catch (error) {
    console.error('[LearningAI] Training error:', error);
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    } else {
      throw error;
    }
  }
}

async function playTrainingGame(depthWhite: number, depthBlack: number): Promise<'white' | 'black' | 'draw'> {
  // Initialize board
  let board = createStartingBoard();
  let isWhiteTurn = true;
  let moveCount = 0;
  const maxMoves = BALANCE.trainingMaxMoves; // Use constant for max moves
  const positionHistory: string[] = []; // Track positions for repetition detection
  
  while (moveCount < maxMoves) {
    const depth = isWhiteTurn ? depthWhite : depthBlack;
    const moves = learningAI['generateSimpleMoves'](board, isWhiteTurn);
    
    if (moves.length === 0) {
      // No moves - checkmate or stalemate
      if (learningAI['isKingInCheck'](board, isWhiteTurn)) {
        return isWhiteTurn ? 'black' : 'white'; // Checkmate
      }
      return 'draw'; // Stalemate
    }
    
    // Add noise to create game variety (both sides use same weights otherwise)
    const bestMove = learningAI.getBestMove(board, moves, isWhiteTurn, depth, true);
    if (!bestMove) return 'draw';
    
    board = learningAI['simulateMove'](board, bestMove);
    
    // Simple position hash for repetition detection
    const posHash = boardToHash(board);
    const repetitions = positionHistory.filter(h => h === posHash).length;
    if (repetitions >= 2) {
      return 'draw'; // Three-fold repetition
    }
    positionHistory.push(posHash);
    
    // Check for insufficient material (only kings left)
    const pieces = countPieces(board);
    if (pieces.total <= 2) {
      return 'draw'; // Only kings remain
    }
    
    isWhiteTurn = !isWhiteTurn;
    moveCount++;
  }
  
  return 'draw'; // Max moves reached
}

function boardToHash(board: (any | null)[][]): string {
  let hash = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      hash += p ? (p.color[0] + p.type) : '--';
    }
  }
  return hash;
}

function countPieces(board: (any | null)[][]): { white: number; black: number; total: number } {
  let white = 0, black = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) {
        if (p.color === 'white') white++;
        else black++;
      }
    }
  }
  return { white, black, total: white + black };
}

function createStartingBoard(): (any | null)[][] {
  const board: (any | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Black pieces (row 0)
  board[0][0] = { type: 'R', color: 'black' };
  board[0][1] = { type: 'N', color: 'black' };
  board[0][2] = { type: 'B', color: 'black' };
  board[0][3] = { type: 'Q', color: 'black' };
  board[0][4] = { type: 'K', color: 'black' };
  board[0][5] = { type: 'B', color: 'black' };
  board[0][6] = { type: 'N', color: 'black' };
  board[0][7] = { type: 'R', color: 'black' };
  for (let c = 0; c < 8; c++) board[1][c] = { type: 'P', color: 'black' };
  
  // White pieces (row 7)
  board[7][0] = { type: 'R', color: 'white' };
  board[7][1] = { type: 'N', color: 'white' };
  board[7][2] = { type: 'B', color: 'white' };
  board[7][3] = { type: 'Q', color: 'white' };
  board[7][4] = { type: 'K', color: 'white' };
  board[7][5] = { type: 'B', color: 'white' };
  board[7][6] = { type: 'N', color: 'white' };
  board[7][7] = { type: 'R', color: 'white' };
  for (let c = 0; c < 8; c++) board[6][c] = { type: 'P', color: 'white' };
  
  return board;
}
