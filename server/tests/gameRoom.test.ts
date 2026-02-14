// =============================================================================
// Game Room — Tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom, type Player } from '../src/GameRoom.js';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'socket-white',
    name: 'Alice',
    elo: 1200,
    token: 'token-white',
    connected: true,
    ...overrides,
  };
}

describe('GameRoom', () => {
  let white: Player;
  let black: Player;
  let room: GameRoom;

  beforeEach(() => {
    white = makePlayer({ id: 'socket-white', name: 'Alice', token: 'token-white' });
    black = makePlayer({ id: 'socket-black', name: 'Bob', token: 'token-black' });
    room = new GameRoom(white, black, { initial: 600, increment: 5 });
  });

  // ===========================================================================
  // CONSTRUCTION
  // ===========================================================================

  it('constructs with correct initial state', () => {
    expect(room.state).toBe('playing');
    expect(room.turn).toBe('w');
    expect(room.fen).toContain('rnbqkbnr');
    expect(room.whiteTimeMs).toBe(600_000);
    expect(room.blackTimeMs).toBe(600_000);
    expect(room.moveHistory).toEqual([]);
  });

  it('assigns unique room id', () => {
    const room2 = new GameRoom(makePlayer(), makePlayer({ id: 's2', token: 't2' }));
    expect(room.id).not.toBe(room2.id);
  });

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  it('getPlayerBySocketId returns correct info', () => {
    const info = room.getPlayerBySocketId('socket-white');
    expect(info?.color).toBe('w');
    expect(info?.player.name).toBe('Alice');

    const info2 = room.getPlayerBySocketId('socket-black');
    expect(info2?.color).toBe('b');
  });

  it('getPlayerBySocketId returns null for unknown', () => {
    expect(room.getPlayerBySocketId('unknown')).toBeNull();
  });

  it('getOpponent returns the other player', () => {
    expect(room.getOpponent('w').name).toBe('Bob');
    expect(room.getOpponent('b').name).toBe('Alice');
  });

  it('isPlayerTurn works', () => {
    expect(room.isPlayerTurn('socket-white')).toBe(true);
    expect(room.isPlayerTurn('socket-black')).toBe(false);
  });

  // ===========================================================================
  // MOVE EXECUTION
  // ===========================================================================

  it('accepts valid SAN move (e4)', () => {
    const result = room.makeMove('socket-white', 'e4');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.move).toBe('e4');
      expect(result.fen).toContain('4P3'); // e4 pawn in FEN
      expect(room.turn).toBe('b');
    }
  });

  it('accepts valid UCI move (e2e4)', () => {
    const result = room.makeMove('socket-white', 'e2e4');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.move).toBe('e4');
    }
  });

  it('rejects move from wrong player', () => {
    const result = room.makeMove('socket-black', 'e4');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Not your turn');
    }
  });

  it('rejects invalid move', () => {
    const result = room.makeMove('socket-white', 'e5');
    expect(result.ok).toBe(false);
  });

  it('rejects move from non-player', () => {
    const result = room.makeMove('socket-spectator', 'e4');
    expect(result.ok).toBe(false);
  });

  it('alternates turns after valid moves', () => {
    room.makeMove('socket-white', 'e4');
    room.makeMove('socket-black', 'e5');
    expect(room.turn).toBe('w');
    expect(room.moveHistory).toEqual(['e4', 'e5']);
  });

  it('clears draw offer after a move', () => {
    room.offerDraw('socket-white');
    expect(room.drawOfferedBy).toBe('w');
    room.makeMove('socket-white', 'e4');
    expect(room.drawOfferedBy).toBeNull();
  });

  // ===========================================================================
  // CHECKMATE DETECTION
  // ===========================================================================

  it('detects scholars mate', () => {
    room.makeMove('socket-white', 'e4');
    room.makeMove('socket-black', 'e5');
    room.makeMove('socket-white', 'Qh5');
    room.makeMove('socket-black', 'Nc6');
    room.makeMove('socket-white', 'Bc4');
    room.makeMove('socket-black', 'Nf6');
    const result = room.makeMove('socket-white', 'Qxf7#');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.gameOver?.result).toBe('white');
      expect(result.gameOver?.reason).toBe('checkmate');
      expect(room.state).toBe('finished');
    }
  });

  // ===========================================================================
  // RESIGN
  // ===========================================================================

  it('white resigns → black wins', () => {
    const result = room.resign('socket-white');
    expect(result).not.toBeNull();
    expect(result?.result).toBe('black');
    expect(result?.reason).toBe('resignation');
    expect(room.state).toBe('finished');
  });

  it('black resigns → white wins', () => {
    const result = room.resign('socket-black');
    expect(result?.result).toBe('white');
  });

  it('resign after game over returns null', () => {
    room.resign('socket-white');
    expect(room.resign('socket-black')).toBeNull();
  });

  // ===========================================================================
  // DRAW NEGOTIATION
  // ===========================================================================

  it('draw flow: offer → accept', () => {
    const color = room.offerDraw('socket-white');
    expect(color).toBe('w');

    const result = room.acceptDraw('socket-black');
    expect(result).not.toBeNull();
    expect(result?.result).toBe('draw');
    expect(result?.reason).toBe('agreed_draw');
    expect(room.state).toBe('finished');
  });

  it('draw flow: offer → decline', () => {
    room.offerDraw('socket-white');
    expect(room.declineDraw('socket-black')).toBe(true);
    expect(room.drawOfferedBy).toBeNull();
    expect(room.state).toBe('playing');
  });

  it('cannot accept your own draw offer', () => {
    room.offerDraw('socket-white');
    expect(room.acceptDraw('socket-white')).toBeNull();
  });

  it('cannot decline your own draw offer', () => {
    room.offerDraw('socket-white');
    expect(room.declineDraw('socket-white')).toBe(false);
  });

  it('cannot accept draw when none offered', () => {
    expect(room.acceptDraw('socket-black')).toBeNull();
  });

  // ===========================================================================
  // DISCONNECTION / RECONNECTION
  // ===========================================================================

  it('handleDisconnect marks player disconnected', () => {
    room.handleDisconnect('socket-white');
    expect(room.white.connected).toBe(false);
    expect(room.white.disconnectedAt).toBeDefined();
  });

  it('handleReconnect with valid token', () => {
    room.handleDisconnect('socket-white');
    const player = room.handleReconnect('token-white', 'new-socket');
    expect(player).not.toBeNull();
    expect(player?.id).toBe('new-socket');
    expect(player?.connected).toBe(true);
    expect(room.white.id).toBe('new-socket');
  });

  it('handleReconnect with invalid token returns null', () => {
    expect(room.handleReconnect('bad-token', 'new-socket')).toBeNull();
  });

  it('checkDisconnectTimeout returns null when no one disconnected', () => {
    expect(room.checkDisconnectTimeout()).toBeNull();
  });

  it('checkDisconnectTimeout returns result after grace period', () => {
    room.handleDisconnect('socket-white');
    // Simulate time passed beyond grace period
    room.white.disconnectedAt = Date.now() - GameRoom.DISCONNECT_GRACE_MS - 1000;
    const result = room.checkDisconnectTimeout();
    expect(result).not.toBeNull();
    expect(result?.result).toBe('black');
    expect(result?.reason).toBe('abandonment');
  });

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  it('toJSON produces correct structure', () => {
    const json = room.toJSON();
    expect(json.id).toBe(room.id);
    expect(json.fen).toContain('rnbqkbnr');
    expect(json.turn).toBe('w');
    expect(json.state).toBe('playing');
    expect(json.white.name).toBe('Alice');
    expect(json.black.name).toBe('Bob');
    expect(json.whiteTimeMs).toBe(600_000);
    expect(json.blackTimeMs).toBe(600_000);
    expect(json.moveHistory).toEqual([]);
    expect(json.timeControl).toEqual({ initial: 600, increment: 5 });
  });
});
