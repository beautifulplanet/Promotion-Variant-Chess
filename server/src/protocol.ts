// =============================================================================
// WebSocket Message Protocol v1
// JSON over WebSocket — all messages have { type, v, ... }
// Open Tables model — players create/join tables, no matchmaking queue
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
  initial: number;  // seconds (0 = untimed)
  increment: number; // seconds per move
};

export interface TableInfo {
  tableId: string;
  hostName: string;
  hostElo: number;
  createdAt: number;
}

export interface PieceBank {
  P: number; N: number; B: number; R: number; Q: number;
}

const PieceBankSchema = z.object({
  P: z.number().int().min(0).max(4),
  N: z.number().int().min(0).max(2),
  B: z.number().int().min(0).max(2),
  R: z.number().int().min(0).max(2),
  Q: z.number().int().min(0).max(1),
}).optional();

// =============================================================================
// CLIENT → SERVER MESSAGES
// =============================================================================

export const CreateTableSchema = z.object({
  type: z.literal('create_table'),
  v: z.literal(PROTOCOL_VERSION),
  playerName: z.string().min(1).max(20),
  elo: z.number().int().min(0).max(4000).optional(),
  pieceBank: PieceBankSchema,
});

export const ListTablesSchema = z.object({
  type: z.literal('list_tables'),
  v: z.literal(PROTOCOL_VERSION),
});

export const JoinTableSchema = z.object({
  type: z.literal('join_table'),
  v: z.literal(PROTOCOL_VERSION),
  tableId: z.string(),
  playerName: z.string().min(1).max(20),
  elo: z.number().int().min(0).max(4000).optional(),
  pieceBank: PieceBankSchema,
});

export const LeaveTableSchema = z.object({
  type: z.literal('leave_table'),
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
  CreateTableSchema,
  ListTablesSchema,
  JoinTableSchema,
  LeaveTableSchema,
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

export type TablesList = {
  type: 'tables_list';
  v: typeof PROTOCOL_VERSION;
  tables: TableInfo[];
};

export type TableCreated = {
  type: 'table_created';
  v: typeof PROTOCOL_VERSION;
  tableId: string;
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
  myPieceBank?: PieceBank;
  opponentPieceBank?: PieceBank;
};

export type OpponentMove = {
  type: 'opponent_move';
  v: typeof PROTOCOL_VERSION;
  gameId: string;
  move: string;        // UCI notation
  fen: string;         // FEN after move
  whiteTime: number;   // remaining ms (0 for untimed)
  blackTime: number;   // remaining ms (0 for untimed)
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
  | TablesList
  | TableCreated
  | GameFound
  | OpponentMove
  | MoveAck
  | GameOver
  | DrawOffer
  | DrawDeclined
  | ServerError;
