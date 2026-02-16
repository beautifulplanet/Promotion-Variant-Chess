// =============================================================================
// Table Manager — open tables that players can create and join
// Replaces the ELO-based matchmaking queue for early-stage deployment
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { TableInfo } from './protocol.js';

export interface OpenTable {
  tableId: string;
  hostSocketId: string;
  hostName: string;
  hostElo: number;
  createdAt: number;
}

export class TableManager {
  private tables = new Map<string, OpenTable>();   // tableId → OpenTable
  private playerTables = new Map<string, string>(); // socketId → tableId

  get length(): number {
    return this.tables.size;
  }

  /**
   * Create a new open table. Returns the table ID.
   * A player can only host one table at a time.
   */
  createTable(socketId: string, playerName: string, elo: number): OpenTable {
    // Remove any existing table by this player
    this.removePlayerTable(socketId);

    const table: OpenTable = {
      tableId: uuidv4(),
      hostSocketId: socketId,
      hostName: playerName,
      hostElo: elo,
      createdAt: Date.now(),
    };

    this.tables.set(table.tableId, table);
    this.playerTables.set(socketId, table.tableId);

    return table;
  }

  /**
   * Get a table by ID.
   */
  getTable(tableId: string): OpenTable | undefined {
    return this.tables.get(tableId);
  }

  /**
   * Remove a table (e.g., host cancelled or game started).
   */
  removeTable(tableId: string): boolean {
    const table = this.tables.get(tableId);
    if (!table) return false;

    this.playerTables.delete(table.hostSocketId);
    this.tables.delete(tableId);
    return true;
  }

  /**
   * Remove any table hosted by this socket (e.g., disconnect or cancel).
   */
  removePlayerTable(socketId: string): boolean {
    const tableId = this.playerTables.get(socketId);
    if (!tableId) return false;
    return this.removeTable(tableId);
  }

  /**
   * Get the table ID hosted by a socket.
   */
  getPlayerTableId(socketId: string): string | undefined {
    return this.playerTables.get(socketId);
  }

  /**
   * List all open tables as client-friendly info.
   */
  listTables(): TableInfo[] {
    const list: TableInfo[] = [];
    for (const table of this.tables.values()) {
      list.push({
        tableId: table.tableId,
        hostName: table.hostName,
        hostElo: table.hostElo,
        createdAt: table.createdAt,
      });
    }
    // Sort newest first
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }

  /**
   * Remove stale tables (older than maxAge ms). Returns removed tables.
   */
  removeStale(maxAgeMs: number = 10 * 60 * 1000): OpenTable[] {
    const now = Date.now();
    const stale: OpenTable[] = [];
    for (const table of this.tables.values()) {
      if (now - table.createdAt > maxAgeMs) {
        stale.push(table);
      }
    }
    for (const table of stale) {
      this.removeTable(table.tableId);
    }
    return stale;
  }
}
