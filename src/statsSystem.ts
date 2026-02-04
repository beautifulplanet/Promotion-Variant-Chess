// src/statsSystem.ts
// Career stats and win streak tracking

// =============================================================================
// TYPES
// =============================================================================

interface CareerStats {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    currentStreak: number;      // Positive = wins, negative = losses
    longestWinStreak: number;
    highestElo: number;
    lowestElo: number;
    totalPlayTime: number;      // In seconds
    firstGameDate: string | null;
    lastGameDate: string | null;
    // Per-ELO bracket stats
    bracketStats: {
        [bracket: string]: {
            games: number;
            wins: number;
        };
    };
}

// =============================================================================
// STATE
// =============================================================================

const STORAGE_KEY = 'chess-career-stats';
let stats: CareerStats = getDefaultStats();
let sessionStartTime: number | null = null;

function getDefaultStats(): CareerStats {
    return {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        currentStreak: 0,
        longestWinStreak: 0,
        highestElo: 400,
        lowestElo: 400,
        totalPlayTime: 0,
        firstGameDate: null,
        lastGameDate: null,
        bracketStats: {},
    };
}

// =============================================================================
// PERSISTENCE
// =============================================================================

function loadStats(): void {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            stats = { ...getDefaultStats(), ...JSON.parse(saved) };
            console.log('[Stats] Loaded career stats:', stats);
        }
    } catch (e) {
        console.error('[Stats] Failed to load:', e);
        stats = getDefaultStats();
    }
}

function saveStats(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
        console.error('[Stats] Failed to save:', e);
    }
}

// =============================================================================
// ELO BRACKET HELPERS
// =============================================================================

function getEloBracket(elo: number): string {
    if (elo < 600) return '400-599';
    if (elo < 800) return '600-799';
    if (elo < 1000) return '800-999';
    if (elo < 1200) return '1000-1199';
    if (elo < 1400) return '1200-1399';
    if (elo < 1600) return '1400-1599';
    if (elo < 1800) return '1600-1799';
    if (elo < 2000) return '1800-1999';
    if (elo < 2200) return '2000-2199';
    return '2200+';
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Initialize stats system
 */
export function init(): void {
    loadStats();
}

/**
 * Record a game result
 */
export function recordGame(result: 'win' | 'loss' | 'draw', elo: number): void {
    const now = new Date().toISOString();

    stats.totalGames++;
    stats.lastGameDate = now;
    if (!stats.firstGameDate) {
        stats.firstGameDate = now;
    }

    // Update ELO tracking
    if (elo > stats.highestElo) stats.highestElo = elo;
    if (elo < stats.lowestElo) stats.lowestElo = elo;

    // Update bracket stats
    const bracket = getEloBracket(elo);
    if (!stats.bracketStats[bracket]) {
        stats.bracketStats[bracket] = { games: 0, wins: 0 };
    }
    stats.bracketStats[bracket].games++;

    // Update result-specific stats
    switch (result) {
        case 'win':
            stats.wins++;
            stats.bracketStats[bracket].wins++;
            if (stats.currentStreak >= 0) {
                stats.currentStreak++;
            } else {
                stats.currentStreak = 1;
            }
            if (stats.currentStreak > stats.longestWinStreak) {
                stats.longestWinStreak = stats.currentStreak;
            }
            break;

        case 'loss':
            stats.losses++;
            if (stats.currentStreak <= 0) {
                stats.currentStreak--;
            } else {
                stats.currentStreak = -1;
            }
            break;

        case 'draw':
            stats.draws++;
            stats.currentStreak = 0;
            break;
    }

    saveStats();
    console.log('[Stats] Recorded', result, '- Streak:', stats.currentStreak);
}

/**
 * Start tracking play time for this session
 */
export function startSession(): void {
    sessionStartTime = Date.now();
}

/**
 * End session and save play time
 */
export function endSession(): void {
    if (sessionStartTime) {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        stats.totalPlayTime += elapsed;
        saveStats();
        sessionStartTime = null;
    }
}

/**
 * Get current win streak (positive = wins, negative = losses)
 */
export function getCurrentStreak(): number {
    return stats.currentStreak;
}

/**
 * Get win streak display string
 */
export function getStreakDisplay(): string {
    if (stats.currentStreak > 0) {
        return `🔥 ${stats.currentStreak}`;
    } else if (stats.currentStreak < 0) {
        return `❄️ ${Math.abs(stats.currentStreak)}`;
    }
    return '';
}

/**
 * Get all career stats
 */
export function getStats(): CareerStats {
    return { ...stats };
}

/**
 * Get win rate as percentage
 */
export function getWinRate(): number {
    if (stats.totalGames === 0) return 0;
    return Math.round((stats.wins / stats.totalGames) * 100);
}

/**
 * Get formatted play time string
 */
export function getPlayTimeDisplay(): string {
    let seconds = stats.totalPlayTime;

    // Add current session time if active
    if (sessionStartTime) {
        seconds += Math.floor((Date.now() - sessionStartTime) / 1000);
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Reset all stats (for testing)
 */
export function reset(): void {
    stats = getDefaultStats();
    saveStats();
    console.log('[Stats] Reset');
}

// Initialize on module load
init();
