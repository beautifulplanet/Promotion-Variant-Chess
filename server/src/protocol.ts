// =============================================================================
// WebSocket Message Protocol v1
// JSON over WebSocket — all messages have { type, v, ... }
// =============================================================================

import { z } from 'zod';

export const PROTOCOL_VERSION = 1;

// =============================================================================
// SHARED TYPES
// =============================================================================

export type Color = 'w' | 'b';
export type GameResult = 'white' | 'black' | 'draw';
export type GameEndReason =
  | 'checkmate'
  | 'resignation'
  | 'timeout'
  | 'stalemate'
  | 'insufficient_material'
  | 'fifty_move'
  | 'threefold_repetition'
  | 'agreed_draw'
  | 'abandonment';

export type TimeControl = {
  initial: number;  // seconds
  increment: number; // seconds per move
};

// =============================================================================
// CLIENT → SERVER MESSAGES
// =============================================================================

export const JoinQueueSchema = z.object({
  type: z.literal('join_queue'),
  v: z.literal(PROTOCOL_VERSION),
  playerName: z.string().min(1).max(20),
  elo: z.number().int().min(0).max(4000).optional(),
  timeControl: z.object({
    initial: z.number().int().min(60).max(3600),
    increment: z.number().int().min(0).max(60),
  }).optional(),
});

export const LeaveQueueSchema = z.object({
  type: z.literal('leave_queue'),
  v: z.literal(PROTOCOL_VERSION),
});

export const MakeMoveSchema = z.object({
  type: z.literal('make_move'),
  v: z.literal(PROTOCOL_VERSION),
  gameId: z.string().uuid(),
  move: z.string().min(2).max(6),  // UCI or SAN
});

export const ResignSchema = z.object({
  type: z.literal('resign'),
  v: z.literal(PROTOCOL_VERSION),
  gameId: z.string().uuid(),
});

export const OfferDrawSchema = z.object({
  type: z.literal('offer_draw'),
  v: z.literal(PROTOCOL_VERSION),
  gameId: z.string().uuid(),
});

export const AcceptDrawSchema = z.object({
  type: z.literal('accept_draw'),
  v: z.literal(PROTOCOL_VERSION),
  gameId: z.string().uuid(),
});

export const DeclineDrawSchema = z.object({
  type: z.literal('decline_draw'),
  v: z.literal(PROTOCOL_VERSION),
  gameId: z.string().uuid(),
});

export const ReconnectSchema = z.object({
  type: z.literal('reconnect'),
  v: z.literal(PROTOCOL_VERSION),
  playerToken: z.string(),
  gameId: z.string().uuid(),
});

// Union of all client messages
export const ClientMessageSchema = z.discriminatedUnion('type', [
  JoinQueueSchema,
  LeaveQueueSchema,
  MakeMoveSchema,
  ResignSchema,
  OfferDrawSchema,
  AcceptDrawSchema,
  DeclineDrawSchema,
  ReconnectSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// =============================================================================
// SERVER → CLIENT MESSAGES
// =============================================================================

export type QueueStatus = {
  type: 'queue_status';
  v: typeof PROTOCOL_VERSION;
  position: number;
  estimatedWait: number; // seconds
};

export type GameFound = {
  type: 'game_found';
  v: typeof PROTOCOL_VERSION;
  gameId: string;
  color: Color;
  opponent: {
    name: string;
    elo: number;
  };
  timeControl: TimeControl;
  fen: string;
};

export type OpponentMove = {
  type: 'opponent_move';
  v: typeof PROTOCOL_VERSION;
  gameId: string;
  move: string;        // UCI notation
  fen: string;         // FEN after move
  whiteTime: number;   // remaining ms
  blackTime: number;   // remaining ms
};

export type MoveAck = {
  type: 'move_ack';
  v: typeof PROTOCOL_VERSION;
  gameId: string;
  move: string;
  fen: string;
  whiteTime: number;
  blackTime: number;
};

export type GameOver = {
  type: 'game_over';
  v: typeof PROTOCOL_VERSION;
  gameId: string;
  result: GameResult;
  reason: GameEndReason;
  winner?: string;
  eloChange?: number;
  newElo?: number;
};

export type DrawOffer = {
  type: 'draw_offer';
  v: typeof PROTOCOL_VERSION;
  gameId: string;
  from: string; // opponent name
};

export type DrawDeclined = {
  type: 'draw_declined';
  v: typeof PROTOCOL_VERSION;
  gameId: string;
};

export type ServerError = {
  type: 'error';
  v: typeof PROTOCOL_VERSION;
  code: string;
  message: string;
};

export type ServerMessage =
  | QueueStatus
  | GameFound
  | OpponentMove
  | MoveAck
  | GameOver
  | DrawOffer
  | DrawDeclined
  | ServerError;
