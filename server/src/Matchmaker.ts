// =============================================================================
// Matchmaking — ELO-based queue with expanding window
// =============================================================================

import type { TimeControl } from './protocol.js';

export interface QueueEntry {
  socketId: string;
  playerName: string;
  elo: number;
  timeControl: TimeControl;
  joinedAt: number;
}

export interface MatchResult {
  player1: QueueEntry;
  player2: QueueEntry;
}

export class Matchmaker {
  private queue: QueueEntry[] = [];

  // ELO window expands over time
  private static readonly INITIAL_RANGE = 100;
  private static readonly EXPAND_INTERVAL_MS = 15_000; // every 15s
  private static readonly EXPAND_STEP = 100;           // widen by 100
  private static readonly MAX_RANGE = 500;
  private static readonly QUEUE_TIMEOUT_MS = 60_000;   // 60s max wait

  get length(): number {
    return this.queue.length;
  }

  /**
   * Add a player to the queue. Returns a match if one is found immediately.
   */
  addPlayer(entry: QueueEntry): MatchResult | null {
    // Don't double-add
    if (this.queue.some(e => e.socketId === entry.socketId)) {
      return null;
    }

    // Try to find a match for this player in the existing queue
    const match = this.findMatch(entry);
    if (match) {
      this.removePlayer(match.socketId);
      return { player1: match, player2: entry };
    }

    // No match — add to queue
    this.queue.push(entry);
    return null;
  }

  /**
   * Remove a player from the queue (e.g., cancelled, disconnected).
   */
  removePlayer(socketId: string): boolean {
    const idx = this.queue.findIndex(e => e.socketId === socketId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Check all queue entries for timeout.
   * Returns entries that have been waiting too long.
   */
  checkTimeouts(): QueueEntry[] {
    const now = Date.now();
    const timedOut: QueueEntry[] = [];

    this.queue = this.queue.filter(entry => {
      if (now - entry.joinedAt > Matchmaker.QUEUE_TIMEOUT_MS) {
        timedOut.push(entry);
        return false;
      }
      return true;
    });

    return timedOut;
  }

  /**
   * Periodically scan the queue for new matches (expanding ELO windows).
   * Returns any matches found.
   */
  scanForMatches(): MatchResult[] {
    const matches: MatchResult[] = [];
    const matched = new Set<string>();

    for (let i = 0; i < this.queue.length; i++) {
      if (matched.has(this.queue[i].socketId)) continue;

      for (let j = i + 1; j < this.queue.length; j++) {
        if (matched.has(this.queue[j].socketId)) continue;

        const a = this.queue[i];
        const b = this.queue[j];

        if (this.isCompatible(a, b)) {
          matches.push({ player1: a, player2: b });
          matched.add(a.socketId);
          matched.add(b.socketId);
          break;
        }
      }
    }

    // Remove matched players
    this.queue = this.queue.filter(e => !matched.has(e.socketId));

    return matches;
  }

  /**
   * Get queue position for a specific player (1-based).
   */
  getPosition(socketId: string): number {
    const idx = this.queue.findIndex(e => e.socketId === socketId);
    return idx >= 0 ? idx + 1 : -1;
  }

  /**
   * Find the best match for a new entry from the current queue.
   */
  private findMatch(entry: QueueEntry): QueueEntry | null {
    let bestMatch: QueueEntry | null = null;
    let bestDiff = Infinity;

    for (const candidate of this.queue) {
      if (!this.isCompatible(entry, candidate)) continue;

      const diff = Math.abs(entry.elo - candidate.elo);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMatch = candidate;
      }
    }

    return bestMatch;
  }

  /**
   * Check if two entries are compatible for a match.
   * Uses expanding ELO window based on wait time.
   */
  private isCompatible(a: QueueEntry, b: QueueEntry): boolean {
    // Must have compatible time controls
    if (a.timeControl.initial !== b.timeControl.initial ||
        a.timeControl.increment !== b.timeControl.increment) {
      return false;
    }

    // Calculate ELO range — expands over time
    const now = Date.now();
    const aWait = now - a.joinedAt;
    const bWait = now - b.joinedAt;
    const maxWait = Math.max(aWait, bWait);

    const expansions = Math.floor(maxWait / Matchmaker.EXPAND_INTERVAL_MS);
    const range = Math.min(
      Matchmaker.INITIAL_RANGE + expansions * Matchmaker.EXPAND_STEP,
      Matchmaker.MAX_RANGE,
    );

    const eloDiff = Math.abs(a.elo - b.elo);
    return eloDiff <= range;
  }
}
