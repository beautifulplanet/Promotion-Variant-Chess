// =============================================================================
// Matchmaker — Tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { Matchmaker, type QueueEntry } from '../src/Matchmaker.js';

function makeEntry(overrides: Partial<QueueEntry> = {}): QueueEntry {
  return {
    socketId: 'socket-1',
    playerName: 'Player1',
    elo: 1200,
    timeControl: { initial: 600, increment: 0 },
    joinedAt: Date.now(),
    ...overrides,
  };
}

describe('Matchmaker', () => {
  let mm: Matchmaker;

  beforeEach(() => {
    mm = new Matchmaker();
  });

  it('starts empty', () => {
    expect(mm.length).toBe(0);
  });

  it('adds player to queue when no match', () => {
    const match = mm.addPlayer(makeEntry());
    expect(match).toBeNull();
    expect(mm.length).toBe(1);
  });

  it('matches two similar players immediately', () => {
    mm.addPlayer(makeEntry({ socketId: 'a', elo: 1200 }));
    const match = mm.addPlayer(makeEntry({ socketId: 'b', elo: 1250 }));

    expect(match).not.toBeNull();
    expect(mm.length).toBe(0);
    expect(match!.player1.socketId).toBe('a');
    expect(match!.player2.socketId).toBe('b');
  });

  it('does not match players with very different ELOs right away', () => {
    mm.addPlayer(makeEntry({ socketId: 'a', elo: 1200 }));
    const match = mm.addPlayer(makeEntry({ socketId: 'b', elo: 1600 }));

    expect(match).toBeNull();
    expect(mm.length).toBe(2);
  });

  it('does not match players with different time controls', () => {
    mm.addPlayer(makeEntry({ socketId: 'a', timeControl: { initial: 600, increment: 0 } }));
    const match = mm.addPlayer(makeEntry({
      socketId: 'b',
      timeControl: { initial: 180, increment: 2 },
    }));

    expect(match).toBeNull();
    expect(mm.length).toBe(2);
  });

  it('prevents double-adding same socketId', () => {
    mm.addPlayer(makeEntry({ socketId: 'a' }));
    const match = mm.addPlayer(makeEntry({ socketId: 'a' }));
    expect(match).toBeNull();
    expect(mm.length).toBe(1);
  });

  it('removePlayer works', () => {
    mm.addPlayer(makeEntry({ socketId: 'a' }));
    expect(mm.removePlayer('a')).toBe(true);
    expect(mm.length).toBe(0);
  });

  it('removePlayer returns false for unknown', () => {
    expect(mm.removePlayer('nonexistent')).toBe(false);
  });

  it('getPosition returns 1-based index', () => {
    mm.addPlayer(makeEntry({ socketId: 'a' }));
    mm.addPlayer(makeEntry({ socketId: 'b', elo: 800 }));
    expect(mm.getPosition('a')).toBe(1);
    expect(mm.getPosition('b')).toBe(2);
    expect(mm.getPosition('nonexistent')).toBe(-1);
  });

  it('scanForMatches finds pairs with expanding window', () => {
    // Two players 300 apart — initial window is 100, won't match at addPlayer time
    // because findMatch uses Date.now() and joinedAt is fresh
    mm.addPlayer(makeEntry({ socketId: 'a', elo: 1200 }));
    mm.addPlayer(makeEntry({ socketId: 'b', elo: 1500 }));
    expect(mm.length).toBe(2); // too far apart, no immediate match

    // Simulate time passing by backdating their joinedAt
    // @ts-expect-error — accessing private queue for testing
    for (const entry of mm['queue']) {
      entry.joinedAt = Date.now() - 35_000; // 35s → 2 expansions → range = 300
    }

    const matches = mm.scanForMatches();
    expect(matches.length).toBe(1);
    expect(mm.length).toBe(0);
  });

  it('checkTimeouts removes stale entries', () => {
    mm.addPlayer(makeEntry({ socketId: 'a' }));
    mm.addPlayer(makeEntry({ socketId: 'b', elo: 800 })); // different elo, won't match
    expect(mm.length).toBe(2);

    // Backdate 'a' to simulate timeout
    // @ts-expect-error — accessing private queue for testing
    mm['queue'].find((e: QueueEntry) => e.socketId === 'a')!.joinedAt = Date.now() - 70_000;

    const timedOut = mm.checkTimeouts();
    expect(timedOut.length).toBe(1);
    expect(timedOut[0].socketId).toBe('a');
    expect(mm.length).toBe(1);
  });

  it('matches closest ELO when multiple candidates', () => {
    // Use ELOs that are all >100 apart so no auto-matching occurs
    mm.addPlayer(makeEntry({ socketId: 'a', elo: 1000 }));
    mm.addPlayer(makeEntry({ socketId: 'b', elo: 1200 }));
    expect(mm.length).toBe(2); // 200 apart, no match

    mm.addPlayer(makeEntry({ socketId: 'c', elo: 1450 }));
    expect(mm.length).toBe(3); // 250 from b, 450 from a, no match

    // New player at 1220 — within 100 of b(1200, diff=20) only
    // a(1000, diff=220) is out of range, c(1450, diff=230) is out of range
    const match = mm.addPlayer(makeEntry({ socketId: 'd', elo: 1220 }));
    expect(match).not.toBeNull();
    expect(match!.player1.elo).toBe(1200);
    expect(match!.player2.elo).toBe(1220);
    expect(mm.length).toBe(2); // a and c remain
  });
});
