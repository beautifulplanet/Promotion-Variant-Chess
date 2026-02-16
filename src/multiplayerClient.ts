// =============================================================================
// Multiplayer Client — Socket.io connection to chess server
// Handles open tables, game messaging, and state sync
// =============================================================================

import { io, type Socket } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Types (mirrored from server protocol — kept minimal for client bundle)
// ---------------------------------------------------------------------------

export type Color = 'w' | 'b';
export type GameResult = 'white' | 'black' | 'draw';

export type TimeControl = {
  initial: number;   // seconds (0 = untimed)
  increment: number; // seconds per move
};

export interface TableInfo {
  tableId: string;
  hostName: string;
  hostElo: number;
  createdAt: number;
}

export interface ServerMessage {
  type: string;
  v: number;
  [key: string]: unknown;
}

export interface TableCreatedMsg {
  type: 'table_created';
  tableId: string;
}

export interface TablesListMsg {
  type: 'tables_list';
  tables: TableInfo[];
}

export interface GameFoundMsg {
  type: 'game_found';
  gameId: string;
  color: Color;
  opponent: { name: string; elo: number };
  timeControl: TimeControl;
  fen: string;
}

export interface OpponentMoveMsg {
  type: 'opponent_move';
  gameId: string;
  move: string;
  fen: string;
  whiteTime: number;
  blackTime: number;
}

export interface MoveAckMsg {
  type: 'move_ack';
  gameId: string;
  move: string;
  fen: string;
  whiteTime: number;
  blackTime: number;
}

export interface GameOverMsg {
  type: 'game_over';
  gameId: string;
  result: GameResult;
  reason: string;
  winner?: string;
  eloChange?: number;
  newElo?: number;
}

export interface DrawOfferMsg {
  type: 'draw_offer';
  gameId: string;
  from: string;
}

export interface ServerErrorMsg {
  type: 'error';
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Event Callbacks
// ---------------------------------------------------------------------------

export interface MultiplayerCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onTableCreated?: (msg: TableCreatedMsg) => void;
  onTablesList?: (msg: TablesListMsg) => void;
  onGameFound?: (msg: GameFoundMsg) => void;
  onOpponentMove?: (msg: OpponentMoveMsg) => void;
  onMoveAck?: (msg: MoveAckMsg) => void;
  onGameOver?: (msg: GameOverMsg) => void;
  onDrawOffer?: (msg: DrawOfferMsg) => void;
  onDrawDeclined?: () => void;
  onError?: (msg: ServerErrorMsg) => void;
}

// ---------------------------------------------------------------------------
// MultiplayerClient
// ---------------------------------------------------------------------------

const PROTOCOL_VERSION = 1;

export class MultiplayerClient {
  private socket: Socket | null = null;
  private callbacks: MultiplayerCallbacks = {};
  private _connected = false;
  private _hostingTable = false;
  private _inGame = false;
  private _gameId: string | null = null;
  private _myColor: Color | null = null;
  private _opponentName: string | null = null;
  private _opponentElo: number | null = null;
  private _playerToken: string | null = null;

  // =========================================================================
  // GETTERS
  // =========================================================================

  get connected(): boolean { return this._connected; }
  get hostingTable(): boolean { return this._hostingTable; }
  get inGame(): boolean { return this._inGame; }
  get gameId(): string | null { return this._gameId; }
  get myColor(): Color | null { return this._myColor; }
  get opponentName(): string | null { return this._opponentName; }
  get opponentElo(): number | null { return this._opponentElo; }

  // =========================================================================
  // CONNECTION
  // =========================================================================

  connect(serverUrl: string = 'http://localhost:3001') {
    if (this.socket?.connected) return;

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this._connected = true;
      this.callbacks.onConnected?.();
    });

    this.socket.on('disconnect', () => {
      this._connected = false;
      this.callbacks.onDisconnected?.();
    });

    this.socket.on('message', (msg: ServerMessage) => {
      this.handleMessage(msg);
    });
  }

  disconnect() {
    this._hostingTable = false;
    this._inGame = false;
    this._gameId = null;
    this.socket?.disconnect();
    this.socket = null;
    this._connected = false;
  }

  registerCallbacks(cb: MultiplayerCallbacks) {
    this.callbacks = cb;
  }

  // =========================================================================
  // TABLE ACTIONS
  // =========================================================================

  createTable(playerName: string, elo: number) {
    if (!this.socket?.connected) return;
    this._hostingTable = true;
    this.send({ type: 'create_table', playerName, elo });
  }

  listTables() {
    if (!this.socket?.connected) return;
    this.send({ type: 'list_tables' });
  }

  joinTable(tableId: string, playerName: string, elo: number) {
    if (!this.socket?.connected) return;
    this.send({ type: 'join_table', tableId, playerName, elo });
  }

  leaveTable() {
    if (!this.socket?.connected) return;
    this._hostingTable = false;
    this.send({ type: 'leave_table' });
  }

  // =========================================================================
  // GAME ACTIONS
  // =========================================================================

  sendMove(move: string) {
    if (!this._gameId || !this.socket?.connected) return;
    this.send({ type: 'make_move', gameId: this._gameId, move });
  }

  resign() {
    if (!this._gameId || !this.socket?.connected) return;
    this.send({ type: 'resign', gameId: this._gameId });
  }

  offerDraw() {
    if (!this._gameId || !this.socket?.connected) return;
    this.send({ type: 'offer_draw', gameId: this._gameId });
  }

  acceptDraw() {
    if (!this._gameId || !this.socket?.connected) return;
    this.send({ type: 'accept_draw', gameId: this._gameId });
  }

  declineDraw() {
    if (!this._gameId || !this.socket?.connected) return;
    this.send({ type: 'decline_draw', gameId: this._gameId });
  }

  // =========================================================================
  // MESSAGE HANDLING
  // =========================================================================

  private handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'table_created':
        this.callbacks.onTableCreated?.(msg as unknown as TableCreatedMsg);
        break;

      case 'tables_list':
        this.callbacks.onTablesList?.(msg as unknown as TablesListMsg);
        break;

      case 'game_found': {
        const gf = msg as unknown as GameFoundMsg;
        this._hostingTable = false;
        this._inGame = true;
        this._gameId = gf.gameId;
        this._myColor = gf.color;
        this._opponentName = gf.opponent.name;
        this._opponentElo = gf.opponent.elo;
        this.callbacks.onGameFound?.(gf);
        break;
      }

      case 'opponent_move':
        this.callbacks.onOpponentMove?.(msg as unknown as OpponentMoveMsg);
        break;

      case 'move_ack':
        this.callbacks.onMoveAck?.(msg as unknown as MoveAckMsg);
        break;

      case 'game_over': {
        const go = msg as unknown as GameOverMsg;
        this._inGame = false;
        this._gameId = null;
        this.callbacks.onGameOver?.(go);
        break;
      }

      case 'draw_offer':
        this.callbacks.onDrawOffer?.(msg as unknown as DrawOfferMsg);
        break;

      case 'draw_declined':
        this.callbacks.onDrawDeclined?.();
        break;

      case 'error':
        this.callbacks.onError?.(msg as unknown as ServerErrorMsg);
        break;
    }
  }

  // =========================================================================
  // SEND HELPER
  // =========================================================================

  private send(data: Record<string, unknown>) {
    this.socket?.emit('message', { ...data, v: PROTOCOL_VERSION });
  }
}

// Singleton instance
export const multiplayer = new MultiplayerClient();
