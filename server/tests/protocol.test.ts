// =============================================================================
// Protocol — Zod Schema Validation Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  ClientMessageSchema, PROTOCOL_VERSION,
  JoinQueueSchema, MakeMoveSchema, ResignSchema,
  OfferDrawSchema, AcceptDrawSchema, DeclineDrawSchema,
  ReconnectSchema, LeaveQueueSchema,
} from '../src/protocol.js';

describe('Protocol Schemas', () => {
  describe('JoinQueueSchema', () => {
    it('accepts valid join_queue', () => {
      const result = JoinQueueSchema.safeParse({
        type: 'join_queue', v: 1,
        playerName: 'Alice', elo: 1200,
        timeControl: { initial: 600, increment: 5 },
      });
      expect(result.success).toBe(true);
    });

    it('accepts join_queue without optional fields', () => {
      const result = JoinQueueSchema.safeParse({
        type: 'join_queue', v: 1,
        playerName: 'Bob',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty playerName', () => {
      const result = JoinQueueSchema.safeParse({
        type: 'join_queue', v: 1, playerName: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects playerName > 20 chars', () => {
      const result = JoinQueueSchema.safeParse({
        type: 'join_queue', v: 1, playerName: 'A'.repeat(21),
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid protocol version', () => {
      const result = JoinQueueSchema.safeParse({
        type: 'join_queue', v: 99, playerName: 'Alice',
      });
      expect(result.success).toBe(false);
    });

    it('rejects elo > 4000', () => {
      const result = JoinQueueSchema.safeParse({
        type: 'join_queue', v: 1, playerName: 'Alice', elo: 5000,
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
    it('parses join_queue', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'join_queue', v: 1, playerName: 'Test',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.type).toBe('join_queue');
    });

    it('parses leave_queue', () => {
      const result = ClientMessageSchema.safeParse({ type: 'leave_queue', v: 1 });
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
        type: 'leave_queue', v: 1, extraStuff: true,
      });
      expect(result.success).toBe(true);
    });
  });
});
