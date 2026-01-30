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
        
        if (typeof data.elo !== 'number' || isNaN(data.elo)) {
          console.warn('[Save] Invalid ELO in save file');
          resolve(null);
          return;
        }
        
        // Ensure all fields exist (for backwards compatibility)
        const validatedData: SaveData = {
          ...createDefaultSave(),
          ...data
        };
        
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
  
  updated.elo = Math.max(100, newElo); // Ensure ELO doesn't go below 100
  updated.highestElo = Math.max(updated.highestElo, newElo);
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
