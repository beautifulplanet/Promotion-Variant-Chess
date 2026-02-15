// src/saveSystem.ts
// Handles saving and loading game progress via file download/upload
// No more localStorage - player explicitly saves/loads

export interface SaveData {
  elo: number;
  gamesWon: number;
  gamesLost: number;
  gamesPlayed: number;
  highestElo: number;
  currentWinStreak: number;
  bestWinStreak: number;
  promotedPieces: PromotedPiece[];  // Pieces earned from promotions (LEGACY - kept for compatibility)
  pieceInventory: PieceInventory;  // NEW: Simple inventory of stored pieces
  totalPromotions: Record<string, number>;  // Count of each piece type promoted
  boardProfiles: BoardProfile[];  // Saved board arrangement profiles
  playerColor?: 'white' | 'black';  // NEW: Player's preferred color (defaults to 'white' for old saves)
  // Visual preferences
  pieceStyle3D?: string;   // 3D piece style preference
  pieceStyle2D?: string;   // 2D piece style preference
  boardStyle?: string;     // Board style preference
  // Current game state (for resuming mid-game)
  currentGameFEN?: string;  // FEN string of board position
  currentGameStarted?: boolean;  // Was a game in progress?
  // Custom board arrangement (from setup mode)
  customArrangement?: Array<{ row: number; col: number; type: string }>;  // Player's custom piece placement
  deployedFromInventory?: PieceInventory;  // Pieces deployed from inventory in setup mode
  // Move quality tracking (optional - defaults to zeros for old saves)
  moveQualityStats?: MoveQualityStats;
  // AI aggression setting (1-20, default 10)
  aiAggressionLevel?: number;
  saveVersion: number;  // For future compatibility
  savedAt: string;  // ISO timestamp
}

// Track move quality statistics
export interface MoveQualityStats {
  goodMoves: number;       // Moves rated as "good"
  bestMoves: number;       // Moves that matched engine's best
  inaccuracies: number;    // Minor mistakes
  mistakes: number;        // Significant errors
  blunders: number;        // Major errors
  totalMovesAnalyzed: number;  // Total moves with quality analysis
}

// Simple inventory tracking how many of each piece type player has stored
// Includes all pieces except King
export interface PieceInventory {
  P: number;  // Pawns
  N: number;  // Knights
  B: number;  // Bishops
  R: number;  // Rooks
  Q: number;  // Queens
}

// Board arrangement profile (saved setup)
export interface BoardProfile {
  name: string;
  arrangement: Array<{ row: number; col: number; type: string; isBonus?: boolean }>;
  createdAt: string;
}

export interface PromotedPiece {
  type: 'P' | 'N' | 'B' | 'R' | 'Q';  // All piece types except King
  earnedAtElo: number;
  gameNumber: number;
}

const SAVE_VERSION = 1;
const MIN_ELO = 100;
const MAX_ELO = 10000;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

function isValidNumber(value: unknown, min = -Infinity, max = Infinity): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && Number.isInteger(value) && value >= 0;
}

function isValidPromotedPiece(piece: unknown): piece is PromotedPiece {
  if (!piece || typeof piece !== 'object') return false;
  const p = piece as Record<string, unknown>;
  return (
    ['Q', 'R', 'B', 'N'].includes(p.type as string) &&
    isValidNumber(p.earnedAtElo, MIN_ELO, MAX_ELO) &&
    isPositiveInt(p.gameNumber)
  );
}

function isValidBoardProfile(profile: unknown): profile is BoardProfile {
  if (!profile || typeof profile !== 'object') return false;
  const p = profile as Record<string, unknown>;
  return (
    typeof p.name === 'string' &&
    p.name.length > 0 &&
    p.name.length <= 50 &&
    Array.isArray(p.arrangement) &&
    p.arrangement.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const i = item as Record<string, unknown>;
      return (
        typeof i.row === 'number' && i.row >= 0 && i.row <= 7 &&
        typeof i.col === 'number' && i.col >= 0 && i.col <= 7 &&
        typeof i.type === 'string' && ['K', 'Q', 'R', 'B', 'N', 'P'].includes(i.type) &&
        (i.isBonus === undefined || typeof i.isBonus === 'boolean')  // Optional isBonus field
      );
    })
  );
}

/**
 * Validate and sanitize save data from file
 * Returns null if data is unrecoverable, otherwise returns sanitized data
 */
function validateAndSanitizeSaveData(data: unknown): SaveData | null {
  if (!data || typeof data !== 'object') return null;

  // SECURITY: Reject prototype pollution attempts
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  const keys = Object.keys(data as object);
  if (keys.some(k => dangerousKeys.includes(k))) {
    console.warn('[Save] Rejected save with dangerous keys (prototype pollution attempt)');
    return null;
  }

  const d = data as Record<string, unknown>;
  const defaults = createDefaultSave();

  // ELO must be a valid number - reject completely invalid saves
  if (!isValidNumber(d.elo)) {
    console.warn('[Save] Invalid or missing ELO value');
    return null;
  }

  // Clamp ELO to valid range
  const elo = Math.min(MAX_ELO, Math.max(MIN_ELO, d.elo));

  // Validate and sanitize all fields with fallbacks
  const sanitized: SaveData = {
    elo,
    gamesWon: isPositiveInt(d.gamesWon) ? d.gamesWon : defaults.gamesWon,
    gamesLost: isPositiveInt(d.gamesLost) ? d.gamesLost : defaults.gamesLost,
    gamesPlayed: isPositiveInt(d.gamesPlayed) ? d.gamesPlayed : defaults.gamesPlayed,
    highestElo: isValidNumber(d.highestElo, MIN_ELO, MAX_ELO)
      ? Math.max(d.highestElo, elo)
      : Math.max(defaults.highestElo, elo),
    currentWinStreak: isPositiveInt(d.currentWinStreak) ? d.currentWinStreak : 0,
    bestWinStreak: isPositiveInt(d.bestWinStreak) ? d.bestWinStreak : 0,
    promotedPieces: Array.isArray(d.promotedPieces)
      ? d.promotedPieces.filter(isValidPromotedPiece)
      : [],
    pieceInventory: (d.pieceInventory && typeof d.pieceInventory === 'object')
      ? {
        P: isPositiveInt((d.pieceInventory as Record<string, unknown>).P) ? (d.pieceInventory as Record<string, number>).P : 0,
        N: isPositiveInt((d.pieceInventory as Record<string, unknown>).N) ? (d.pieceInventory as Record<string, number>).N : 0,
        B: isPositiveInt((d.pieceInventory as Record<string, unknown>).B) ? (d.pieceInventory as Record<string, number>).B : 0,
        R: isPositiveInt((d.pieceInventory as Record<string, unknown>).R) ? (d.pieceInventory as Record<string, number>).R : 0,
        Q: isPositiveInt((d.pieceInventory as Record<string, unknown>).Q) ? (d.pieceInventory as Record<string, number>).Q : 0,
      }
      : migratePromotedPiecesToInventory(d.promotedPieces),
    totalPromotions: (d.totalPromotions && typeof d.totalPromotions === 'object')
      ? {
        Q: isPositiveInt((d.totalPromotions as Record<string, unknown>).Q) ? (d.totalPromotions as Record<string, number>).Q : 0,
        R: isPositiveInt((d.totalPromotions as Record<string, unknown>).R) ? (d.totalPromotions as Record<string, number>).R : 0,
        B: isPositiveInt((d.totalPromotions as Record<string, unknown>).B) ? (d.totalPromotions as Record<string, number>).B : 0,
        N: isPositiveInt((d.totalPromotions as Record<string, unknown>).N) ? (d.totalPromotions as Record<string, number>).N : 0,
      }
      : defaults.totalPromotions,
    boardProfiles: Array.isArray(d.boardProfiles)
      ? (d.boardProfiles as unknown[]).filter(isValidBoardProfile) as BoardProfile[]
      : [],
    playerColor: (d.playerColor === 'white' || d.playerColor === 'black')
      ? d.playerColor
      : 'white',  // Default for old saves
    aiAggressionLevel: isValidNumber(d.aiAggressionLevel, 1, 20)
      ? Math.round(d.aiAggressionLevel as number)
      : 10,  // Default for old saves
    saveVersion: isPositiveInt(d.saveVersion) ? d.saveVersion : SAVE_VERSION,
    savedAt: typeof d.savedAt === 'string' ? d.savedAt : new Date().toISOString(),
  };

  // Ensure consistency: gamesPlayed >= gamesWon + gamesLost
  if (sanitized.gamesPlayed < sanitized.gamesWon + sanitized.gamesLost) {
    sanitized.gamesPlayed = sanitized.gamesWon + sanitized.gamesLost;
  }

  // Ensure bestWinStreak >= currentWinStreak
  if (sanitized.bestWinStreak < sanitized.currentWinStreak) {
    sanitized.bestWinStreak = sanitized.currentWinStreak;
  }

  return sanitized;
}

/**
 * Create default save data for new players
 */
// Migrate old promotedPieces array to new inventory format
function migratePromotedPiecesToInventory(promotedPieces: unknown): PieceInventory {
  const inventory: PieceInventory = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
  if (Array.isArray(promotedPieces)) {
    for (const piece of promotedPieces) {
      if (piece && typeof piece === 'object' && 'type' in piece) {
        const type = (piece as { type: string }).type;
        if (type in inventory) {
          inventory[type as keyof PieceInventory]++;
        }
      }
    }
  }
  console.log('[Save] Migrated old promotedPieces to inventory:', inventory);
  return inventory;
}

export function createDefaultSave(): SaveData {
  return {
    elo: 400,
    gamesWon: 0,
    gamesLost: 0,
    gamesPlayed: 0,
    highestElo: 400,
    currentWinStreak: 0,
    bestWinStreak: 0,
    promotedPieces: [],
    pieceInventory: { P: 0, N: 0, B: 0, R: 0, Q: 0 },
    totalPromotions: { Q: 0, R: 0, B: 0, N: 0 },
    boardProfiles: [],
    pieceStyle3D: 'staunton3d',
    pieceStyle2D: 'classic2d',
    boardStyle: 'classic',
    aiAggressionLevel: 10,
    saveVersion: SAVE_VERSION,
    savedAt: new Date().toISOString()
  };
}

/**
 * Download save data as a JSON file
 */
export function downloadSave(data: SaveData): void {
  const saveData = {
    ...data,
    saveVersion: SAVE_VERSION,
    savedAt: new Date().toISOString()
  };

  const json = JSON.stringify(saveData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `sideways-chess-save-elo${data.elo}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('[Save] Downloaded save file');
}

/**
 * Load save data from a file (returns a Promise)
 */
export function loadSaveFromFile(): Promise<SaveData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none'; // Hide it
    document.body.appendChild(input); // Append to DOM to ensure events fire

    const cleanup = () => {
      document.body.removeChild(input);
    };

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate the data structure
        if (!data || typeof data !== 'object') {
          console.warn('[Save] Invalid save file (not an object)');
          cleanup();
          resolve(null);
          return;
        }

        // Comprehensive save validation
        const validatedData = validateAndSanitizeSaveData(data);
        if (!validatedData) {
          console.warn('[Save] Save file failed validation');
          cleanup();
          resolve(null);
          return;
        }

        console.log('[Save] Loaded save file - ELO:', validatedData.elo, 'Games:', validatedData.gamesPlayed);
        cleanup();
        resolve(validatedData);
      } catch (err) {
        console.error('[Save] Failed to parse save file:', err);
        cleanup();
        resolve(null);
      }
    };

    // Check for cancel (this is tricky in browsers, often doesn't fire, but good practice to try)
    input.oncancel = () => {
      cleanup();
      resolve(null);
    };

    input.click();
  });
}

/**
 * Record a promotion
 */
export function recordPromotion(
  data: SaveData,
  pieceType: 'Q' | 'R' | 'B' | 'N'
): SaveData {
  return {
    ...data,
    promotedPieces: [
      ...data.promotedPieces,
      {
        type: pieceType,
        earnedAtElo: data.elo,
        gameNumber: data.gamesPlayed
      }
    ],
    totalPromotions: {
      ...data.totalPromotions,
      [pieceType]: (data.totalPromotions[pieceType] || 0) + 1
    }
  };
}

/**
 * Update stats after a game
 * @param data - Current save data
 * @param newElo - New ELO after the game
 * @param playerWon - True if player won
 * @param isDraw - True if game was a draw
 */
export function updateStatsAfterGame(
  data: SaveData,
  newElo: number,
  playerWon: boolean,
  isDraw: boolean
): SaveData {
  const updated = { ...data };

  // Enforce ELO bounds (100-10000)
  updated.elo = Math.min(10000, Math.max(100, newElo));
  updated.highestElo = Math.min(10000, Math.max(updated.highestElo, newElo));
  updated.gamesPlayed++;

  if (playerWon) {
    updated.gamesWon++;
    updated.currentWinStreak++;
    updated.bestWinStreak = Math.max(updated.bestWinStreak, updated.currentWinStreak);
  } else if (!isDraw) {
    updated.gamesLost++;
    updated.currentWinStreak = 0;
  }
  // Draw doesn't affect win/loss count or streak

  return updated;
}

// =============================================================================
// BOARD PROFILE MANAGEMENT
// =============================================================================

const MAX_PROFILES = 10;  // Limit number of saved profiles

/**
 * Save current board arrangement as a profile
 */
export function saveBoardProfile(
  data: SaveData,
  name: string,
  arrangement: Array<{ row: number; col: number; type: string; isBonus?: boolean }>
): SaveData {
  // Validate name
  const cleanName = name.trim().slice(0, 50);
  if (!cleanName) {
    console.warn('[Save] Profile name cannot be empty');
    return data;
  }

  // Check if profile with same name exists - update it
  const existingIdx = data.boardProfiles.findIndex(p => p.name === cleanName);

  const newProfile: BoardProfile = {
    name: cleanName,
    arrangement: arrangement.map(p => ({ row: p.row, col: p.col, type: p.type, isBonus: p.isBonus || false })),
    createdAt: new Date().toISOString()
  };

  const updatedProfiles = [...data.boardProfiles];

  if (existingIdx >= 0) {
    // Update existing
    updatedProfiles[existingIdx] = newProfile;
    console.log('[Save] Updated board profile:', cleanName);
  } else {
    // Add new (limit total)
    if (updatedProfiles.length >= MAX_PROFILES) {
      console.warn('[Save] Max profiles reached, removing oldest');
      updatedProfiles.shift();  // Remove oldest
    }
    updatedProfiles.push(newProfile);
    console.log('[Save] Saved new board profile:', cleanName);
  }

  return {
    ...data,
    boardProfiles: updatedProfiles
  };
}

/**
 * Delete a board profile by name
 */
export function deleteBoardProfile(data: SaveData, name: string): SaveData {
  const filtered = data.boardProfiles.filter(p => p.name !== name);
  if (filtered.length === data.boardProfiles.length) {
    console.warn('[Save] Profile not found:', name);
    return data;
  }
  console.log('[Save] Deleted board profile:', name);
  return {
    ...data,
    boardProfiles: filtered
  };
}

/**
 * Get a board profile by name
 */
export function getBoardProfile(data: SaveData, name: string): BoardProfile | null {
  return data.boardProfiles.find(p => p.name === name) || null;
}

/**
 * Get all board profile names
 */
export function getBoardProfileNames(data: SaveData): string[] {
  return data.boardProfiles.map(p => p.name);
}
