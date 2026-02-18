// =============================================================================
// Multiplayer UI Controller
// Wires HTML elements ↔ MultiplayerClient ↔ GameController
// Open Tables lobby — create / browse / join tables
// =============================================================================

import { multiplayer } from './multiplayerClient';
import type {
  GameFoundMsg, OpponentMoveMsg, MoveAckMsg, GameOverMsg,
  DrawOfferMsg, ServerErrorMsg, TableCreatedMsg, TablesListMsg, TableInfo,
  PieceBank,
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

// Open-tables panel (below board, newspaper-style)
const otPanel      = document.getElementById('open-tables-panel')   as HTMLElement;
const otCreateBtn  = document.getElementById('ot-create-btn')       as HTMLButtonElement;
const otNameInput  = document.getElementById('ot-name-input')       as HTMLInputElement;
const otTableList  = document.getElementById('ot-table-list')       as HTMLElement;
const mpQuickBtn   = document.getElementById('mp-quick-btn')        as HTMLButtonElement;
const otGuestBtn   = document.getElementById('ot-guest-btn')        as HTMLButtonElement;
const mpGuestBtn   = document.getElementById('mp-guest-btn')        as HTMLButtonElement;
const otLobbyView  = document.getElementById('ot-lobby-view')       as HTMLElement;
const otHostingView = document.getElementById('ot-hosting-view')    as HTMLElement;
const otCancelBtn  = document.getElementById('ot-cancel-btn')       as HTMLButtonElement;

// Piece bank overlay
const mpPieceBank  = document.getElementById('mp-piece-bank')       as HTMLElement;

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------

let serverUrl = 'http://localhost:3001';
let currentTables: TableInfo[] = [];
let refreshInterval: ReturnType<typeof setInterval> | null = null;
let otPanelVisible = false;

// Multiplayer piece banks — each player gets a separate bank for fair play
let myPieceBank:  PieceBank = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
let oppPieceBank: PieceBank = { P: 0, N: 0, B: 0, R: 0, Q: 0 };

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

type StatusType = 'success' | 'error' | 'info';

const STATUS_STYLES: Record<StatusType, { color: string; bg: string }> = {
  success: { color: '#4CAF50', bg: 'rgba(76,175,80,0.1)' },
  error:   { color: '#f44336', bg: 'rgba(244,67,54,0.1)' },
  info:    { color: 'var(--sidebar-text-muted, #666)', bg: 'rgba(0,0,0,0.05)' },
};

function showStatus(msg: string, type: StatusType = 'info') {
  const style = STATUS_STYLES[type];
  mpStatus.style.display = 'block';
  mpStatus.textContent = msg;
  mpStatus.style.color = style.color;
  mpStatus.style.background = style.bg;
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
// OPEN TABLES PANEL (below board, newspaper-style)
// ---------------------------------------------------------------------------

function toggleOpenTablesPanel() {
  otPanelVisible = !otPanelVisible;
  if (otPanel) otPanel.style.display = otPanelVisible ? 'block' : 'none';

  if (otPanelVisible) {
    // Connect and request tables
    if (!multiplayer.connected) {
      multiplayer.connect(serverUrl);
    }
    let listAttempts = 0;
    const tryList = () => {
      if (multiplayer.connected) {
        multiplayer.listTables();
        startRefresh();
      } else if (++listAttempts < 15) {
        setTimeout(tryList, 200);
      } else {
        showStatus('Could not connect to server', 'error');
      }
    };
    tryList();

    // Sync name from options panel if available
    if (mpPlayerName?.value && otNameInput && !otNameInput.value) {
      otNameInput.value = mpPlayerName.value;
    }
  } else {
    if (!multiplayer.inGame && !multiplayer.hostingTable) {
      stopRefresh();
    }
  }
}

/** Show the lobby view (name input + table list) in the OT panel */
function showOtLobbyView() {
  if (otLobbyView) otLobbyView.style.display = '';
  if (otHostingView) otHostingView.style.display = 'none';
  if (otCreateBtn) otCreateBtn.style.display = '';
}

/** Show the hosting/waiting view in the OT panel */
function showOtHostingView() {
  if (otLobbyView) otLobbyView.style.display = 'none';
  if (otHostingView) otHostingView.style.display = '';
  if (otCreateBtn) otCreateBtn.style.display = 'none';
}

/** Handle cancel from the OT panel */
function handleOtCancelClick() {
  multiplayer.leaveTable();
  showLobby();
  hideStatus();
  showOtLobbyView();
  // Refresh tables now
  multiplayer.listTables();
}

function renderOpenTablesList(tables: TableInfo[]) {
  if (!otTableList) return;

  if (tables.length === 0) {
    otTableList.innerHTML = '<div class="ot-empty">No open tables — create one!</div>';
    return;
  }

  otTableList.innerHTML = tables.map(t => {
    const age = Math.floor((Date.now() - t.createdAt) / 1000);
    const ageStr = age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`;
    return `<div class="ot-row">
      <span class="ot-host">${escapeHtml(t.hostName)}</span>
      <span class="ot-elo">${t.hostElo}</span>
      <span class="ot-age">${ageStr}</span>
      <button class="ot-join" data-table-id="${t.tableId}">Join</button>
    </div>`;
  }).join('');

  // Wire join buttons
  otTableList.querySelectorAll('.ot-join').forEach(btn => {
    btn.addEventListener('click', () => {
      const tableId = (btn as HTMLElement).dataset.tableId!;
      handleOtJoinClick(tableId);
    });
  });
}

function handleOtCreateClick() {
  const name = getPlayerName();
  if (!name) return;

  if (!multiplayer.connected) {
    multiplayer.connect(serverUrl);
  }

  // Show connecting feedback
  if (otCreateBtn) otCreateBtn.textContent = 'Connecting...';

  let attempts = 0;
  const MAX_ATTEMPTS = 15; // 15 * 200ms = 3 seconds
  const tryCreate = () => {
    if (multiplayer.connected) {
      const elo = Game.getState().elo;
      multiplayer.createTable(name, elo, buildPieceBank());
      if (otCreateBtn) otCreateBtn.textContent = '+ Create';
    } else if (++attempts < MAX_ATTEMPTS) {
      setTimeout(tryCreate, 200);
    } else {
      // Timeout — show error
      if (otCreateBtn) otCreateBtn.textContent = '+ Create';
      showStatus('Could not connect to server', 'error');
    }
  };
  tryCreate();
}

function handleOtJoinClick(tableId: string) {
  const name = getPlayerName();
  if (!name) return;

  if (!multiplayer.connected) {
    multiplayer.connect(serverUrl);
  }

  let attempts = 0;
  const MAX_ATTEMPTS = 15;
  const tryJoin = () => {
    if (multiplayer.connected) {
      const elo = Game.getState().elo;
      multiplayer.joinTable(tableId, name, elo, buildPieceBank());
    } else if (++attempts < MAX_ATTEMPTS) {
      setTimeout(tryJoin, 200);
    } else {
      showStatus('Could not connect to server', 'error');
    }
  };
  tryJoin();
}

/** Generate a fun guest name */
function generateGuestName(): string {
  const adjectives = ['Swift', 'Bold', 'Clever', 'Noble', 'Silent', 'Brave', 'Lucky', 'Crafty', 'Fierce', 'Wise'];
  const nouns = ['Pawn', 'Knight', 'Bishop', 'Rook', 'King', 'Queen', 'Castle', 'Dragon', 'Phoenix', 'Falcon'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

/** Guest button handler — fill name and create table */
function handleGuestClick() {
  const guestName = generateGuestName();
  if (otNameInput) otNameInput.value = guestName;
  if (mpPlayerName) mpPlayerName.value = guestName;
  // Auto-create a table as guest
  handleOtCreateClick();
}

/** Get player name from either input */
function getPlayerName(): string {
  const otName = otNameInput?.value.trim();
  const mpName = mpPlayerName?.value.trim();
  const name = otName || mpName || '';
  if (!name) {
    if (otNameInput) {
      otNameInput.focus();
      otNameInput.style.outline = `2px solid ${STATUS_STYLES.error.color}`;
      setTimeout(() => { if (otNameInput) otNameInput.style.outline = ''; }, 1500);
    }
    return '';
  }
  // Sync both inputs
  if (mpPlayerName && !mpPlayerName.value) mpPlayerName.value = name;
  if (otNameInput && !otNameInput.value) otNameInput.value = name;
  return name;
}

// ---------------------------------------------------------------------------
// MULTIPLAYER PIECE BANK
// ---------------------------------------------------------------------------

function initPieceBanks() {
  myPieceBank = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
  oppPieceBank = { P: 0, N: 0, B: 0, R: 0, Q: 0 };

  // In multiplayer, each player starts with a fair copy of their single-player inventory
  // capped to prevent abuse. Both players see only their own bank.
  const inv = Game.getPieceInventory();
  // Cap each piece type for fairness
  const CAP = { P: 4, N: 2, B: 2, R: 2, Q: 1 };
  myPieceBank = {
    P: Math.min(inv.P, CAP.P),
    N: Math.min(inv.N, CAP.N),
    B: Math.min(inv.B, CAP.B),
    R: Math.min(inv.R, CAP.R),
    Q: Math.min(inv.Q, CAP.Q),
  };
}

function renderPieceBank() {
  if (!mpPieceBank) return;

  if (!multiplayer.inGame) {
    mpPieceBank.classList.remove('active');
    return;
  }

  const pieces: [string, keyof PieceBank, string][] = [
    ['♟', 'P', 'Pawn'], ['♞', 'N', 'Knight'], ['♝', 'B', 'Bishop'],
    ['♜', 'R', 'Rook'], ['♛', 'Q', 'Queen'],
  ];

  const total = myPieceBank.P + myPieceBank.N + myPieceBank.B + myPieceBank.R + myPieceBank.Q;
  if (total === 0) {
    mpPieceBank.classList.remove('active');
    return;
  }

  mpPieceBank.classList.add('active');
  mpPieceBank.innerHTML = pieces
    .filter(([, key]) => myPieceBank[key] > 0)
    .map(([sym, key, title]) =>
      `<div class="mp-bank-item" title="${title}: ${myPieceBank[key]}">` +
      `<span class="mp-bank-piece">${sym}</span>` +
      (myPieceBank[key] > 1 ? `<span class="mp-bank-count">×${myPieceBank[key]}</span>` : '') +
      `</div>`
    ).join('');
}

/** Build a capped piece bank from player's inventory for fair MP */
function buildPieceBank(): PieceBank {
  const inv = Game.getPieceInventory();
  const CAP = { P: 4, N: 2, B: 2, R: 2, Q: 1 };
  return {
    P: Math.min(inv.P, CAP.P),
    N: Math.min(inv.N, CAP.N),
    B: Math.min(inv.B, CAP.B),
    R: Math.min(inv.R, CAP.R),
    Q: Math.min(inv.Q, CAP.Q),
  };
}

// ---------------------------------------------------------------------------
// EVENT HANDLERS
// ---------------------------------------------------------------------------

function handleCreateClick() {
  const name = mpPlayerName.value.trim();
  if (!name) {
    showStatus('Enter your name first', 'error');
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
      multiplayer.createTable(name, elo, buildPieceBank());
    } else if (++createAttempts < 15) {
      setTimeout(tryCreate, 200);
    }
  };

  let createAttempts = 0;

  // Give socket 3s to connect
  setTimeout(() => {
    if (!multiplayer.connected) {
      showStatus('Could not connect to server', 'error');
      showOffline();
    }
  }, 3000);

  tryCreate();
}

function handleJoinClick(tableId: string) {
  const name = mpPlayerName.value.trim();
  if (!name) {
    showStatus('Enter your name first', 'error');
    mpPlayerName.focus();
    return;
  }

  hideStatus();

  // Connect if not already
  if (!multiplayer.connected) {
    multiplayer.connect(serverUrl);
  }

  let joinAttempts = 0;
  const tryJoin = () => {
    if (multiplayer.connected) {
      const elo = Game.getState().elo;
      multiplayer.joinTable(tableId, name, elo, buildPieceBank());
    } else if (++joinAttempts < 15) {
      setTimeout(tryJoin, 200);
    }
  };

  setTimeout(() => {
    if (!multiplayer.connected) {
      showStatus('Could not connect to server', 'error');
      showOffline();
    }
  }, 3000);

  tryJoin();
}

function handleCancelHostClick() {
  multiplayer.leaveTable();
  showLobby();
  hideStatus();
  showOtLobbyView();
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
  showStatus('Draw offer sent...', 'info');
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
  showOtLobbyView();
  if (multiplayer.inGame) {
    showStatus('Disconnected — trying to reconnect...', 'error');
  } else {
    showOffline();
    showStatus('Disconnected from server', 'error');
  }
}

function onTableCreated(_msg: TableCreatedMsg) {
  showHosting();
  showStatus('Table created — waiting for opponent...', 'success');
  // Also show hosting state in the Open Tables panel
  showOtHostingView();
}

function onTablesList(msg: TablesListMsg) {
  renderTableList(msg.tables);
  renderOpenTablesList(msg.tables);
}

function onGameFound(msg: GameFoundMsg) {
  console.log('[MP UI] Game found!', msg);
  showIngame();
  hideStatus();
  showOtLobbyView(); // Reset OT panel back to lobby view

  mpOpponentName.textContent = msg.opponent.name;
  mpOpponentElo.textContent = `ELO: ${msg.opponent.elo}`;

  // Initialize piece banks from server data (or local fallback)
  if (msg.myPieceBank) {
    myPieceBank = { ...msg.myPieceBank };
  } else {
    initPieceBanks();
  }
  if (msg.opponentPieceBank) {
    oppPieceBank = { ...msg.opponentPieceBank };
  }
  renderPieceBank();

  // Hide open tables panel when game starts
  if (otPanel) otPanel.style.display = 'none';
  otPanelVisible = false;

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

  // Clear piece bank display
  myPieceBank = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
  oppPieceBank = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
  renderPieceBank();

  const resultText = msg.result === 'draw' ? 'Draw' :
    msg.winner ? `${msg.winner} wins` : msg.result + ' wins';
  showStatus(`${resultText} — ${msg.reason}`, msg.result === 'draw' ? 'info' : 'success');
}

function onDrawOffer(msg: DrawOfferMsg) {
  drawOfferFrom.textContent = `${msg.from} offers a draw`;
  drawOfferOverlay.style.display = 'flex';
}

function onDrawDeclined() {
  showStatus('Draw declined', 'error');
  setTimeout(hideStatus, 3000);
}

function onError(msg: ServerErrorMsg) {
  console.warn('[MP UI] Server error:', msg.code, msg.message);
  showStatus(msg.message, 'error');

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

  // Button handlers (options panel)
  mpCreateBtn.addEventListener('click', handleCreateClick);
  mpCancelHostBtn?.addEventListener('click', handleCancelHostClick);
  mpResignBtn.addEventListener('click', handleResignClick);
  mpDrawBtn.addEventListener('click', handleDrawClick);

  // MP quick button on board overlay → toggle open tables
  mpQuickBtn?.addEventListener('click', toggleOpenTablesPanel);

  // Open tables panel create button
  otCreateBtn?.addEventListener('click', handleOtCreateClick);

  // Open tables panel cancel button
  otCancelBtn?.addEventListener('click', handleOtCancelClick);

  // Guest buttons — auto-generate name and create table
  otGuestBtn?.addEventListener('click', handleGuestClick);
  mpGuestBtn?.addEventListener('click', handleGuestClick);

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
