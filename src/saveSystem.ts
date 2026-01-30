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
  promotedPieces: PromotedPiece[];  // Pieces earned from promotions
  totalPromotions: Record<string, number>;  // Count of each piece type promoted
  saveVersion: number;  // For future compatibility
  savedAt: string;  // ISO timestamp
}

export interface PromotedPiece {
  type: 'Q' | 'R' | 'B' | 'N';
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

/**
 * Validate and sanitize save data from file
 * Returns null if data is unrecoverable, otherwise returns sanitized data
 */
function validateAndSanitizeSaveData(data: unknown): SaveData | null {
  if (!data || typeof data !== 'object') return null;
  
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
    totalPromotions: (d.totalPromotions && typeof d.totalPromotions === 'object')
      ? {
          Q: isPositiveInt((d.totalPromotions as Record<string, unknown>).Q) ? (d.totalPromotions as Record<string, number>).Q : 0,
          R: isPositiveInt((d.totalPromotions as Record<string, unknown>).R) ? (d.totalPromotions as Record<string, number>).R : 0,
          B: isPositiveInt((d.totalPromotions as Record<string, unknown>).B) ? (d.totalPromotions as Record<string, number>).B : 0,
          N: isPositiveInt((d.totalPromotions as Record<string, unknown>).N) ? (d.totalPromotions as Record<string, number>).N : 0,
        }
      : defaults.totalPromotions,
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
    totalPromotions: { Q: 0, R: 0, B: 0, N: 0 },
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
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Validate the data structure
        if (!data || typeof data !== 'object') {
          console.warn('[Save] Invalid save file (not an object)');
          resolve(null);
          return;
        }
        
        // Comprehensive save validation
        const validatedData = validateAndSanitizeSaveData(data);
        if (!validatedData) {
          console.warn('[Save] Save file failed validation');
          resolve(null);
          return;
        }
        
        console.log('[Save] Loaded save file - ELO:', validatedData.elo, 'Games:', validatedData.gamesPlayed);
        resolve(validatedData);
      } catch (err) {
        console.error('[Save] Failed to parse save file:', err);
        resolve(null);
      }
    };
    
    input.oncancel = () => resolve(null);
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
