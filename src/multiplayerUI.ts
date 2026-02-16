// =============================================================================
// Multiplayer UI Controller
// Wires HTML elements ↔ MultiplayerClient ↔ GameController
// Open Tables lobby — create / browse / join tables
// =============================================================================

import { multiplayer } from './multiplayerClient';
import type {
  GameFoundMsg, OpponentMoveMsg, MoveAckMsg, GameOverMsg,
  DrawOfferMsg, ServerErrorMsg, TableCreatedMsg, TablesListMsg, TableInfo,
} from './multiplayerClient';
import * as Game from './gameController';

// ---------------------------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------------------------

const mpOffline   = document.getElementById('mp-offline')   as HTMLElement;
const mpLobby     = document.getElementById('mp-lobby')     as HTMLElement;
const mpHosting   = document.getElementById('mp-hosting')   as HTMLElement;
const mpIngame    = document.getElementById('mp-ingame')     as HTMLElement;
const mpStatus    = document.getElementById('mp-status')     as HTMLElement;

const mpCreateBtn = document.getElementById('mp-create-btn') as HTMLButtonElement;
const mpCancelHostBtn = document.getElementById('mp-cancel-host-btn') as HTMLButtonElement;
const mpResignBtn = document.getElementById('mp-resign-btn') as HTMLButtonElement;
const mpDrawBtn   = document.getElementById('mp-draw-btn')   as HTMLButtonElement;
const mpPlayerName = document.getElementById('mp-player-name') as HTMLInputElement;
const mpTableList = document.getElementById('mp-table-list')  as HTMLElement;
const mpOpponentName = document.getElementById('mp-opponent-name') as HTMLElement;
const mpOpponentElo  = document.getElementById('mp-opponent-elo')  as HTMLElement;

// Draw offer overlay
const drawOfferOverlay = document.getElementById('draw-offer-overlay') as HTMLElement;
const drawAcceptBtn    = document.getElementById('draw-accept-btn')    as HTMLButtonElement;
const drawDeclineBtn   = document.getElementById('draw-decline-btn')   as HTMLButtonElement;
const drawOfferFrom    = document.getElementById('draw-offer-from')    as HTMLElement;

// AI controls (to hide during multiplayer)
const aiControlsSection = document.getElementById('ai-controls-section') as HTMLElement;

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------

let serverUrl = 'http://localhost:3001';
let currentTables: TableInfo[] = [];
let refreshInterval: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// UI VISIBILITY
// ---------------------------------------------------------------------------

function showOffline() {
  mpOffline.style.display = 'block';
  if (mpLobby) mpLobby.style.display = 'none';
  if (mpHosting) mpHosting.style.display = 'none';
  mpIngame.style.display = 'none';
  if (aiControlsSection) aiControlsSection.style.display = '';
  stopRefresh();
}

function showLobby() {
  mpOffline.style.display = 'none';
  if (mpLobby) mpLobby.style.display = 'block';
  if (mpHosting) mpHosting.style.display = 'none';
  mpIngame.style.display = 'none';
  startRefresh();
}

function showHosting() {
  mpOffline.style.display = 'none';
  if (mpLobby) mpLobby.style.display = 'none';
  if (mpHosting) mpHosting.style.display = 'block';
  mpIngame.style.display = 'none';
}

function showIngame() {
  mpOffline.style.display = 'none';
  if (mpLobby) mpLobby.style.display = 'none';
  if (mpHosting) mpHosting.style.display = 'none';
  mpIngame.style.display = 'block';
  if (aiControlsSection) aiControlsSection.style.display = 'none';
  stopRefresh();
}

function showStatus(msg: string, color: string = '#666') {
  mpStatus.style.display = 'block';
  mpStatus.textContent = msg;
  mpStatus.style.color = color;
  mpStatus.style.background = color === '#4CAF50' ? 'rgba(76,175,80,0.1)' :
                               color === '#f44336' ? 'rgba(244,67,54,0.1)' : 'rgba(0,0,0,0.05)';
}

function hideStatus() {
  mpStatus.style.display = 'none';
}

// ---------------------------------------------------------------------------
// TABLE LIST
// ---------------------------------------------------------------------------

function startRefresh() {
  stopRefresh();
  // Refresh table list every 5 seconds while in lobby
  refreshInterval = setInterval(() => {
    if (multiplayer.connected) multiplayer.listTables();
  }, 5000);
}

function stopRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

function renderTableList(tables: TableInfo[]) {
  if (!mpTableList) return;
  currentTables = tables;

  if (tables.length === 0) {
    mpTableList.innerHTML = '<div class="mp-no-tables">No open tables — create one!</div>';
    return;
  }

  mpTableList.innerHTML = tables.map(t => {
    const age = Math.floor((Date.now() - t.createdAt) / 1000);
    const ageStr = age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`;
    return `<div class="mp-table-row">
      <span class="mp-table-host">${escapeHtml(t.hostName)}</span>
      <span class="mp-table-elo">${t.hostElo}</span>
      <span class="mp-table-age">${ageStr}</span>
      <button class="mp-join-btn" data-table-id="${t.tableId}">Join</button>
    </div>`;
  }).join('');

  // Wire join buttons
  mpTableList.querySelectorAll('.mp-join-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tableId = (btn as HTMLElement).dataset.tableId!;
      handleJoinClick(tableId);
    });
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// EVENT HANDLERS
// ---------------------------------------------------------------------------

function handleCreateClick() {
  const name = mpPlayerName.value.trim();
  if (!name) {
    showStatus('Enter your name first', '#f44336');
    mpPlayerName.focus();
    return;
  }

  hideStatus();

  // Connect if not already
  if (!multiplayer.connected) {
    multiplayer.connect(serverUrl);
  }

  const tryCreate = () => {
    if (multiplayer.connected) {
      const elo = Game.getState().elo;
      multiplayer.createTable(name, elo);
    } else {
      setTimeout(tryCreate, 200);
    }
  };

  // Give socket 2s to connect
  setTimeout(() => {
    if (!multiplayer.connected) {
      showStatus('Could not connect to server', '#f44336');
      showOffline();
    }
  }, 3000);

  tryCreate();
}

function handleJoinClick(tableId: string) {
  const name = mpPlayerName.value.trim();
  if (!name) {
    showStatus('Enter your name first', '#f44336');
    mpPlayerName.focus();
    return;
  }

  hideStatus();

  // Connect if not already
  if (!multiplayer.connected) {
    multiplayer.connect(serverUrl);
  }

  const tryJoin = () => {
    if (multiplayer.connected) {
      const elo = Game.getState().elo;
      multiplayer.joinTable(tableId, name, elo);
    } else {
      setTimeout(tryJoin, 200);
    }
  };

  setTimeout(() => {
    if (!multiplayer.connected) {
      showStatus('Could not connect to server', '#f44336');
      showOffline();
    }
  }, 3000);

  tryJoin();
}

function handleCancelHostClick() {
  multiplayer.leaveTable();
  showLobby();
  hideStatus();
  // Refresh tables now
  multiplayer.listTables();
}

function handleResignClick() {
  if (confirm('Are you sure you want to resign?')) {
    multiplayer.resign();
  }
}

function handleDrawClick() {
  multiplayer.offerDraw();
  showStatus('Draw offer sent...', '#666');
}

// ---------------------------------------------------------------------------
// SERVER MESSAGE CALLBACKS
// ---------------------------------------------------------------------------

function onConnected() {
  console.log('[MP UI] Connected to server');
  // Request table list on connect
  multiplayer.listTables();
}

function onDisconnected() {
  console.log('[MP UI] Disconnected');
  if (multiplayer.inGame) {
    showStatus('Disconnected — trying to reconnect...', '#f44336');
  } else {
    showOffline();
    showStatus('Disconnected from server', '#f44336');
  }
}

function onTableCreated(_msg: TableCreatedMsg) {
  showHosting();
  showStatus('Table created — waiting for opponent...', '#4CAF50');
}

function onTablesList(msg: TablesListMsg) {
  renderTableList(msg.tables);
}

function onGameFound(msg: GameFoundMsg) {
  console.log('[MP UI] Game found!', msg);
  showIngame();
  hideStatus();

  mpOpponentName.textContent = msg.opponent.name;
  mpOpponentElo.textContent = `ELO: ${msg.opponent.elo}`;

  // Start the game in the game controller
  Game.startMultiplayerGame(msg.color, msg.fen);
}

function onOpponentMove(msg: OpponentMoveMsg) {
  console.log('[MP UI] Opponent move:', msg.move);
  Game.applyRemoteMove(msg.move, msg.fen);
}

function onMoveAck(_msg: MoveAckMsg) {
  // Move accepted — no clock update needed (untimed)
}

function onGameOver(msg: GameOverMsg) {
  console.log('[MP UI] Game over:', msg);
  Game.endMultiplayerGame(msg.result, msg.reason, msg.eloChange, msg.newElo);
  showOffline();

  const resultText = msg.result === 'draw' ? 'Draw' :
    msg.winner ? `${msg.winner} wins` : msg.result + ' wins';
  showStatus(`${resultText} — ${msg.reason}`, msg.result === 'draw' ? '#666' : '#4CAF50');
}

function onDrawOffer(msg: DrawOfferMsg) {
  drawOfferFrom.textContent = `${msg.from} offers a draw`;
  drawOfferOverlay.style.display = 'flex';
}

function onDrawDeclined() {
  showStatus('Draw declined', '#f44336');
  setTimeout(hideStatus, 3000);
}

function onError(msg: ServerErrorMsg) {
  console.warn('[MP UI] Server error:', msg.code, msg.message);
  showStatus(msg.message, '#f44336');

  if (msg.code === 'TABLE_NOT_FOUND') {
    // Table was removed before we could join — refresh list
    multiplayer.listTables();
  }
}

// ---------------------------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------------------------

export function initMultiplayerUI() {
  // Check if elements exist (they may not in test environments)
  if (!mpCreateBtn) return;

  // Button handlers
  mpCreateBtn.addEventListener('click', handleCreateClick);
  mpCancelHostBtn?.addEventListener('click', handleCancelHostClick);
  mpResignBtn.addEventListener('click', handleResignClick);
  mpDrawBtn.addEventListener('click', handleDrawClick);

  // Draw offer overlay
  drawAcceptBtn?.addEventListener('click', () => {
    multiplayer.acceptDraw();
    drawOfferOverlay.style.display = 'none';
  });
  drawDeclineBtn?.addEventListener('click', () => {
    multiplayer.declineDraw();
    drawOfferOverlay.style.display = 'none';
  });

  // Register multiplayer callbacks
  multiplayer.registerCallbacks({
    onConnected,
    onDisconnected,
    onTableCreated,
    onTablesList,
    onGameFound,
    onOpponentMove,
    onMoveAck,
    onGameOver,
    onDrawOffer,
    onDrawDeclined,
    onError,
  });

  // Register the move callback with the game controller
  Game.registerCallbacks({
    onMultiplayerMove: (san: string) => {
      if (multiplayer.inGame) {
        multiplayer.sendMove(san);
      }
    },
  });

  // Auto-detect server URL for production
  // Vercel frontend → Fly.io backend
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    serverUrl = 'https://chess-server-falling-lake-2071.fly.dev';
  }

  console.log('[MP UI] Multiplayer UI initialized');
}
