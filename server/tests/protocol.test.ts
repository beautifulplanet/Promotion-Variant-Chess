// =============================================================================
// Protocol — Zod Schema Validation Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  ClientMessageSchema, PROTOCOL_VERSION,
  CreateTableSchema, ListTablesSchema, JoinTableSchema, LeaveTableSchema,
  MakeMoveSchema, ResignSchema,
  OfferDrawSchema, AcceptDrawSchema, DeclineDrawSchema,
  ReconnectSchema,
} from '../src/protocol.js';

describe('Protocol Schemas', () => {
  describe('CreateTableSchema', () => {
    it('accepts valid create_table', () => {
      const result = CreateTableSchema.safeParse({
        type: 'create_table', v: 1,
        playerName: 'Alice', elo: 1200,
      });
      expect(result.success).toBe(true);
    });

    it('accepts create_table without optional elo', () => {
      const result = CreateTableSchema.safeParse({
        type: 'create_table', v: 1,
        playerName: 'Bob',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty playerName', () => {
      const result = CreateTableSchema.safeParse({
        type: 'create_table', v: 1, playerName: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects playerName > 20 chars', () => {
      const result = CreateTableSchema.safeParse({
        type: 'create_table', v: 1, playerName: 'A'.repeat(21),
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid protocol version', () => {
      const result = CreateTableSchema.safeParse({
        type: 'create_table', v: 99, playerName: 'Alice',
      });
      expect(result.success).toBe(false);
    });

    it('rejects elo > 4000', () => {
      const result = CreateTableSchema.safeParse({
        type: 'create_table', v: 1, playerName: 'Alice', elo: 5000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('JoinTableSchema', () => {
    it('accepts valid join_table', () => {
      const result = JoinTableSchema.safeParse({
        type: 'join_table', v: 1,
        tableId: 'abc-123',
        playerName: 'Charlie', elo: 1000,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing tableId', () => {
      const result = JoinTableSchema.safeParse({
        type: 'join_table', v: 1,
        playerName: 'Charlie',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('MakeMoveSchema', () => {
    it('accepts valid move', () => {
      const result = MakeMoveSchema.safeParse({
        type: 'make_move', v: 1,
        gameId: '550e8400-e29b-41d4-a716-446655440000',
        move: 'e2e4',
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID gameId', () => {
      const result = MakeMoveSchema.safeParse({
        type: 'make_move', v: 1,
        gameId: 'not-a-uuid',
        move: 'e4',
      });
      expect(result.success).toBe(false);
    });

    it('rejects move > 6 chars', () => {
      const result = MakeMoveSchema.safeParse({
        type: 'make_move', v: 1,
        gameId: '550e8400-e29b-41d4-a716-446655440000',
        move: 'e2e4e5e',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ClientMessageSchema (discriminated union)', () => {
    it('parses create_table', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'create_table', v: 1, playerName: 'Test',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.type).toBe('create_table');
    });

    it('parses list_tables', () => {
      const result = ClientMessageSchema.safeParse({ type: 'list_tables', v: 1 });
      expect(result.success).toBe(true);
    });

    it('parses leave_table', () => {
      const result = ClientMessageSchema.safeParse({ type: 'leave_table', v: 1 });
      expect(result.success).toBe(true);
    });

    it('parses resign', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'resign', v: 1,
        gameId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('parses reconnect', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'reconnect', v: 1,
        playerToken: 'tok-123',
        gameId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects unknown message type', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'unknown_thing', v: 1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects extra fields gracefully (Zod strips by default)', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'leave_table', v: 1, extraStuff: true,
      });
      expect(result.success).toBe(true);
    });
  });
});
