// =============================================================================
// Game Room — manages a single chess game between two players
// =============================================================================

import { Chess } from 'chess.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  Color, GameResult, GameEndReason, TimeControl, GameOver,
  OpponentMove, MoveAck, DrawOffer, DrawDeclined, ServerError,
  PROTOCOL_VERSION,
} from './protocol.js';

export interface Player {
  id: string;          // socket ID
  name: string;
  elo: number;
  token: string;       // for reconnection
  connected: boolean;
  disconnectedAt?: number;
}

export type RoomState = 'waiting' | 'playing' | 'finished';

export class GameRoom {
  readonly id: string;
  readonly createdAt: number;
  readonly timeControl: TimeControl;

  white: Player;
  black: Player;

  state: RoomState = 'playing';
  chess: Chess;

  whiteTimeMs: number;
  blackTimeMs: number;
  lastMoveTimestamp: number;

  moveHistory: string[] = [];
  drawOfferedBy: Color | null = null;

  // Grace period for reconnection (30 seconds)
  static readonly DISCONNECT_GRACE_MS = 30_000;

  constructor(
    white: Player,
    black: Player,
    timeControl: TimeControl = { initial: 600, increment: 0 },
  ) {
    this.id = uuidv4();
    this.createdAt = Date.now();
    this.timeControl = timeControl;

    this.white = white;
    this.black = black;

    this.chess = new Chess();
    this.whiteTimeMs = timeControl.initial * 1000;
    this.blackTimeMs = timeControl.initial * 1000;
    this.lastMoveTimestamp = Date.now();
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  get fen(): string {
    return this.chess.fen();
  }

  get turn(): Color {
    return this.chess.turn() as Color;
  }

  getPlayer(color: Color): Player {
    return color === 'w' ? this.white : this.black;
  }

  getPlayerBySocketId(socketId: string): { player: Player; color: Color } | null {
    if (this.white.id === socketId) return { player: this.white, color: 'w' };
    if (this.black.id === socketId) return { player: this.black, color: 'b' };
    return null;
  }

  getPlayerByToken(token: string): { player: Player; color: Color } | null {
    if (this.white.token === token) return { player: this.white, color: 'w' };
    if (this.black.token === token) return { player: this.black, color: 'b' };
    return null;
  }

  getOpponent(color: Color): Player {
    return color === 'w' ? this.black : this.white;
  }

  isPlayerTurn(socketId: string): boolean {
    const p = this.getPlayerBySocketId(socketId);
    if (!p) return false;
    return p.color === this.turn;
  }

  // ===========================================================================
  // MOVE EXECUTION (server-side validated)
  // ===========================================================================

  /**
   * Attempt a move. Returns move result or error.
   * Validates the move is legal using chess.js.
   * Updates clocks.
   */
  makeMove(socketId: string, moveStr: string): {
    ok: true; move: string; fen: string; whiteTime: number; blackTime: number;
    gameOver?: { result: GameResult; reason: GameEndReason };
  } | { ok: false; error: string } {
    if (this.state !== 'playing') {
      return { ok: false, error: 'Game is not in progress' };
    }

    const playerInfo = this.getPlayerBySocketId(socketId);
    if (!playerInfo) {
      return { ok: false, error: 'You are not in this game' };
    }
    if (playerInfo.color !== this.turn) {
      return { ok: false, error: 'Not your turn' };
    }

    // Update clock for the side that just moved
    const now = Date.now();
    const elapsed = now - this.lastMoveTimestamp;

    if (this.turn === 'w') {
      this.whiteTimeMs -= elapsed;
      if (this.whiteTimeMs <= 0) {
        this.whiteTimeMs = 0;
        this.state = 'finished';
        return {
          ok: true, move: '', fen: this.fen,
          whiteTime: 0, blackTime: this.blackTimeMs,
          gameOver: { result: 'black', reason: 'timeout' },
        };
      }
      this.whiteTimeMs += this.timeControl.increment * 1000;
    } else {
      this.blackTimeMs -= elapsed;
      if (this.blackTimeMs <= 0) {
        this.blackTimeMs = 0;
        this.state = 'finished';
        return {
          ok: true, move: '', fen: this.fen,
          whiteTime: this.whiteTimeMs, blackTime: 0,
          gameOver: { result: 'white', reason: 'timeout' },
        };
      }
      this.blackTimeMs += this.timeControl.increment * 1000;
    }

    // Validate and execute the move
    let result;
    try {
      // chess.js accepts SAN or { from, to } — try SAN first
      result = this.chess.move(moveStr);
    } catch {
      // Try UCI format: e2e4 → { from: 'e2', to: 'e4' }
      if (moveStr.length >= 4) {
        try {
          const from = moveStr.slice(0, 2);
          const to = moveStr.slice(2, 4);
          const promotion = moveStr.length >= 5 ? moveStr[4] : undefined;
          result = this.chess.move({ from, to, promotion });
        } catch {
          return { ok: false, error: `Invalid move: ${moveStr}` };
        }
      }
    }

    if (!result) {
      return { ok: false, error: `Illegal move: ${moveStr}` };
    }

    this.moveHistory.push(result.san);
    this.lastMoveTimestamp = now;
    this.drawOfferedBy = null; // Any move cancels pending draw offer

    // Check for game end
    const gameOver = this.checkGameEnd();

    return {
      ok: true,
      move: result.san,
      fen: this.fen,
      whiteTime: this.whiteTimeMs,
      blackTime: this.blackTimeMs,
      gameOver: gameOver ?? undefined,
    };
  }

  // ===========================================================================
  // GAME END DETECTION
  // ===========================================================================

  private checkGameEnd(): { result: GameResult; reason: GameEndReason } | null {
    if (this.chess.isCheckmate()) {
      this.state = 'finished';
      // The side whose turn it is has been checkmated
      const winner: GameResult = this.turn === 'w' ? 'black' : 'white';
      return { result: winner, reason: 'checkmate' };
    }
    if (this.chess.isStalemate()) {
      this.state = 'finished';
      return { result: 'draw', reason: 'stalemate' };
    }
    if (this.chess.isInsufficientMaterial()) {
      this.state = 'finished';
      return { result: 'draw', reason: 'insufficient_material' };
    }
    if (this.chess.isThreefoldRepetition()) {
      this.state = 'finished';
      return { result: 'draw', reason: 'threefold_repetition' };
    }
    if (this.chess.isDraw()) {
      this.state = 'finished';
      return { result: 'draw', reason: 'fifty_move' };
    }
    return null;
  }

  // ===========================================================================
  // RESIGN / DRAW
  // ===========================================================================

  resign(socketId: string): { result: GameResult; reason: GameEndReason } | null {
    const playerInfo = this.getPlayerBySocketId(socketId);
    if (!playerInfo || this.state !== 'playing') return null;

    this.state = 'finished';
    const winner: GameResult = playerInfo.color === 'w' ? 'black' : 'white';
    return { result: winner, reason: 'resignation' };
  }

  offerDraw(socketId: string): Color | null {
    const playerInfo = this.getPlayerBySocketId(socketId);
    if (!playerInfo || this.state !== 'playing') return null;

    this.drawOfferedBy = playerInfo.color;
    return playerInfo.color;
  }

  acceptDraw(socketId: string): { result: GameResult; reason: GameEndReason } | null {
    const playerInfo = this.getPlayerBySocketId(socketId);
    if (!playerInfo || this.state !== 'playing') return null;

    // Can only accept if the OTHER side offered
    if (this.drawOfferedBy === null || this.drawOfferedBy === playerInfo.color) return null;

    this.state = 'finished';
    return { result: 'draw', reason: 'agreed_draw' };
  }

  declineDraw(socketId: string): boolean {
    const playerInfo = this.getPlayerBySocketId(socketId);
    if (!playerInfo || this.state !== 'playing') return false;

    if (this.drawOfferedBy === null || this.drawOfferedBy === playerInfo.color) return false;

    this.drawOfferedBy = null;
    return true;
  }

  // ===========================================================================
  // DISCONNECTION / RECONNECTION
  // ===========================================================================

  handleDisconnect(socketId: string): void {
    const playerInfo = this.getPlayerBySocketId(socketId);
    if (!playerInfo) return;
    playerInfo.player.connected = false;
    playerInfo.player.disconnectedAt = Date.now();
  }

  handleReconnect(token: string, newSocketId: string): Player | null {
    const playerInfo = this.getPlayerByToken(token);
    if (!playerInfo) return null;

    playerInfo.player.id = newSocketId;
    playerInfo.player.connected = true;
    playerInfo.player.disconnectedAt = undefined;
    return playerInfo.player;
  }

  /**
   * Check if a disconnected player has exceeded the grace period.
   * Returns the color of the player who timed out, or null.
   */
  checkDisconnectTimeout(): { result: GameResult; reason: GameEndReason } | null {
    if (this.state !== 'playing') return null;

    const now = Date.now();
    for (const color of ['w', 'b'] as Color[]) {
      const player = this.getPlayer(color);
      if (!player.connected && player.disconnectedAt) {
        if (now - player.disconnectedAt > GameRoom.DISCONNECT_GRACE_MS) {
          this.state = 'finished';
          const winner: GameResult = color === 'w' ? 'black' : 'white';
          return { result: winner, reason: 'abandonment' };
        }
      }
    }
    return null;
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  toJSON() {
    return {
      id: this.id,
      fen: this.fen,
      turn: this.turn,
      state: this.state,
      white: { name: this.white.name, elo: this.white.elo, connected: this.white.connected },
      black: { name: this.black.name, elo: this.black.elo, connected: this.black.connected },
      whiteTimeMs: this.whiteTimeMs,
      blackTimeMs: this.blackTimeMs,
      moveHistory: this.moveHistory,
      timeControl: this.timeControl,
    };
  }
}
