export interface OpeningMove {
    san: string;        // Standard Algebraic Notation (e.g., "e4")
    weight: number;     // Probability weight (higher = more likely)
    name?: string;      // Opening name if this move enters it
}

// Key is FEN string (simplified, just piece placement + turn)
export const OPENING_BOOK: Record<string, OpeningMove[]> = {
    // ==========================================================================
    // STARTING POSITION
    // ==========================================================================
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1": [
        { san: "e4", weight: 50, name: "King's Pawn Opening" },
        { san: "d4", weight: 35, name: "Queen's Pawn Opening" },
        { san: "Nf3", weight: 10, name: "Reti Opening" },
        { san: "c4", weight: 5, name: "English Opening" },
        { san: "g3", weight: 2, name: "King's Fianchetto" },
        { san: "b3", weight: 2, name: "Larsen's Opening" },
        { san: "f4", weight: 1, name: "Bird's Opening" }
    ],

    // ==========================================================================
    // 1. e4 RESPONSES
    // ==========================================================================
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1": [
        { san: "e5", weight: 35, name: "Open Game" },
        { san: "c5", weight: 30, name: "Sicilian Defense" },
        { san: "e6", weight: 15, name: "French Defense" },
        { san: "c6", weight: 10, name: "Caro-Kann Defense" },
        { san: "d5", weight: 5, name: "Scandinavian Defense" },
        { san: "d6", weight: 3, name: "Pirc Defense" },
        { san: "Nf6", weight: 2, name: "Alekhine's Defense" }
    ],

    // ==========================================================================
    // 1. d4 RESPONSES
    // ==========================================================================
    "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1": [
        { san: "d5", weight: 35, name: "Closed Game" },
        { san: "Nf6", weight: 35, name: "Indian Defense" },
        { san: "f5", weight: 8, name: "Dutch Defense" },
        { san: "e6", weight: 8, name: "Queen's Pawn Game" },
        { san: "d6", weight: 5, name: "Old Indian Defense" },
        { san: "c5", weight: 5, name: "Benoni Defense" },
        { san: "g6", weight: 4, name: "Modern Defense" }
    ],

    // ==========================================================================
    // 1. c4 ENGLISH OPENING RESPONSES
    // ==========================================================================
    "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1": [
        { san: "e5", weight: 35, name: "English: Reversed Sicilian" },
        { san: "c5", weight: 30, name: "English: Symmetrical" },
        { san: "Nf6", weight: 20, name: "English: Anglo-Indian" },
        { san: "e6", weight: 10, name: "English: Agincourt Defense" },
        { san: "g6", weight: 5, name: "English: King's Fianchetto" }
    ],

    // ==========================================================================
    // 1. Nf3 RETI OPENING RESPONSES
    // ==========================================================================
    "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1": [
        { san: "d5", weight: 40, name: "Reti: Classical" },
        { san: "Nf6", weight: 35, name: "Reti: King's Indian Attack" },
        { san: "c5", weight: 15, name: "Reti: Sicilian Invitation" },
        { san: "g6", weight: 10, name: "Reti: King's Fianchetto" }
    ],

    // ==========================================================================
    // OPEN GAME: 1. e4 e5
    // ==========================================================================
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": [
        { san: "Nf3", weight: 70, name: "King's Knight Opening" },
        { san: "Nc3", weight: 10, name: "Vienna Game" },
        { san: "Bc4", weight: 8, name: "Bishop's Opening" },
        { san: "f4", weight: 7, name: "King's Gambit" },
        { san: "d4", weight: 5, name: "Center Game" }
    ],

    // 1. e4 e5 2. Nf3
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2": [
        { san: "Nc6", weight: 70, name: "Two Knights Defense" },
        { san: "Nf6", weight: 20, name: "Petrov Defense" },
        { san: "d6", weight: 5, name: "Philidor Defense" },
        { san: "f5", weight: 5, name: "Latvian Gambit" }
    ],

    // 1. e4 e5 2. Nf3 Nc6
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3": [
        { san: "Bb5", weight: 50, name: "Ruy Lopez" },
        { san: "Bc4", weight: 30, name: "Italian Game" },
        { san: "d4", weight: 10, name: "Scotch Game" },
        { san: "Nc3", weight: 7, name: "Four Knights Game" },
        { san: "c3", weight: 3, name: "Ponziani Opening" }
    ],

    // ==========================================================================
    // RUY LOPEZ: 1. e4 e5 2. Nf3 Nc6 3. Bb5
    // ==========================================================================
    "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3": [
        { san: "a6", weight: 60, name: "Ruy Lopez: Morphy Defense" },
        { san: "Nf6", weight: 25, name: "Ruy Lopez: Berlin Defense" },
        { san: "d6", weight: 10, name: "Ruy Lopez: Steinitz Defense" },
        { san: "Bc5", weight: 5, name: "Ruy Lopez: Classical Defense" }
    ],

    // Ruy Lopez Morphy Defense: 3...a6 4. Ba4
    "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4": [
        { san: "Ba4", weight: 90, name: "Ruy Lopez: Morphy Defense" },
        { san: "Bxc6", weight: 10, name: "Ruy Lopez: Exchange Variation" }
    ],

    // ==========================================================================
    // ITALIAN GAME: 1. e4 e5 2. Nf3 Nc6 3. Bc4
    // ==========================================================================
    "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3": [
        { san: "Bc5", weight: 50, name: "Italian: Giuoco Piano" },
        { san: "Nf6", weight: 40, name: "Italian: Two Knights Defense" },
        { san: "Be7", weight: 10, name: "Italian: Hungarian Defense" }
    ],

    // Giuoco Piano: 3...Bc5
    "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4": [
        { san: "c3", weight: 50, name: "Italian: Giuoco Piano" },
        { san: "d3", weight: 30, name: "Italian: Giuoco Pianissimo" },
        { san: "b4", weight: 20, name: "Italian: Evans Gambit" }
    ],

    // ==========================================================================
    // SICILIAN DEFENSE: 1. e4 c5
    // ==========================================================================
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": [
        { san: "Nf3", weight: 70, name: "Sicilian: Open" },
        { san: "Nc3", weight: 15, name: "Sicilian: Closed" },
        { san: "c3", weight: 10, name: "Sicilian: Alapin" },
        { san: "d4", weight: 5, name: "Sicilian: Smith-Morra Gambit" }
    ],

    // Sicilian Open: 2. Nf3
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2": [
        { san: "d6", weight: 40, name: "Sicilian: Najdorf/Dragon Setup" },
        { san: "Nc6", weight: 35, name: "Sicilian: Classical" },
        { san: "e6", weight: 20, name: "Sicilian: Scheveningen/Kan" },
        { san: "g6", weight: 5, name: "Sicilian: Accelerated Dragon" }
    ],

    // Sicilian: 2. Nf3 d6 3. d4
    "rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3": [
        { san: "d4", weight: 90, name: "Sicilian: Open" },
        { san: "Bb5+", weight: 10, name: "Sicilian: Moscow Variation" }
    ],

    // Sicilian Open: 3. d4 cxd4 4. Nxd4
    "rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4": [
        { san: "Nxd4", weight: 100, name: "Sicilian: Open" }
    ],

    // Sicilian Najdorf Setup: 4. Nxd4 Nf6 5. Nc3
    "rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5": [
        { san: "Nc3", weight: 100, name: "Sicilian: Main Line" }
    ],

    // Sicilian Najdorf: 5. Nc3 a6
    "rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5": [
        { san: "a6", weight: 50, name: "Sicilian Najdorf" },
        { san: "e6", weight: 25, name: "Sicilian Scheveningen" },
        { san: "g6", weight: 15, name: "Sicilian Dragon" },
        { san: "Nc6", weight: 10, name: "Sicilian Classical" }
    ],

    // ==========================================================================
    // FRENCH DEFENSE: 1. e4 e6
    // ==========================================================================
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": [
        { san: "d4", weight: 90, name: "French Defense" },
        { san: "d3", weight: 10, name: "French: King's Indian Attack" }
    ],

    // French: 2. d4 d5
    "rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2": [
        { san: "d5", weight: 100, name: "French Defense" }
    ],

    // French: 3. Nc3/Nd2
    "rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3": [
        { san: "Nc3", weight: 50, name: "French: Classical" },
        { san: "Nd2", weight: 30, name: "French: Tarrasch" },
        { san: "e5", weight: 15, name: "French: Advance" },
        { san: "exd5", weight: 5, name: "French: Exchange" }
    ],

    // French Classical: 3. Nc3
    "rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq - 1 3": [
        { san: "Nf6", weight: 50, name: "French: Classical" },
        { san: "Bb4", weight: 40, name: "French: Winawer" },
        { san: "dxe4", weight: 10, name: "French: Rubinstein" }
    ],

    // ==========================================================================
    // CARO-KANN DEFENSE: 1. e4 c6
    // ==========================================================================
    "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": [
        { san: "d4", weight: 90, name: "Caro-Kann Defense" },
        { san: "Nc3", weight: 10, name: "Caro-Kann: Two Knights" }
    ],

    // Caro-Kann: 2. d4 d5
    "rnbqkbnr/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2": [
        { san: "d5", weight: 100, name: "Caro-Kann Defense" }
    ],

    // Caro-Kann: 3. Nc3/Nd2/e5/exd5
    "rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3": [
        { san: "Nc3", weight: 35, name: "Caro-Kann: Classical" },
        { san: "e5", weight: 30, name: "Caro-Kann: Advance" },
        { san: "exd5", weight: 25, name: "Caro-Kann: Exchange" },
        { san: "Nd2", weight: 10, name: "Caro-Kann: Modern" }
    ],

    // ==========================================================================
    // SCANDINAVIAN DEFENSE: 1. e4 d5
    // ==========================================================================
    "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": [
        { san: "exd5", weight: 90, name: "Scandinavian Defense" },
        { san: "Nc3", weight: 10, name: "Scandinavian: Modern" }
    ],

    // Scandinavian: 2. exd5 Qxd5
    "rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2": [
        { san: "Qxd5", weight: 70, name: "Scandinavian: Main Line" },
        { san: "Nf6", weight: 30, name: "Scandinavian: Modern" }
    ],

    // ==========================================================================
    // QUEEN'S GAMBIT: 1. d4 d5 2. c4
    // ==========================================================================
    "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2": [
        { san: "c4", weight: 80, name: "Queen's Gambit" },
        { san: "Nf3", weight: 15, name: "London System" },
        { san: "Bf4", weight: 5, name: "London System" }
    ],

    // Queen's Gambit: 2. c4
    "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2": [
        { san: "e6", weight: 40, name: "Queen's Gambit Declined" },
        { san: "c6", weight: 30, name: "Slav Defense" },
        { san: "dxc4", weight: 20, name: "Queen's Gambit Accepted" },
        { san: "Nf6", weight: 10, name: "QGD: Marshall Defense" }
    ],

    // QGD: 2...e6 3. Nc3
    "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3": [
        { san: "Nc3", weight: 70, name: "Queen's Gambit Declined" },
        { san: "Nf3", weight: 30, name: "QGD: Exchange" }
    ],

    // Slav: 2...c6 3. Nf3
    "rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3": [
        { san: "Nf3", weight: 60, name: "Slav Defense" },
        { san: "Nc3", weight: 30, name: "Slav: Main Line" },
        { san: "cxd5", weight: 10, name: "Slav: Exchange" }
    ],

    // ==========================================================================
    // INDIAN DEFENSES: 1. d4 Nf6
    // ==========================================================================
    "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2": [
        { san: "c4", weight: 70, name: "Indian Defense" },
        { san: "Nf3", weight: 20, name: "Indian: Classical" },
        { san: "Bf4", weight: 10, name: "London System" }
    ],

    // Indian: 2. c4
    "rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2": [
        { san: "g6", weight: 35, name: "King's Indian Defense" },
        { san: "e6", weight: 35, name: "Nimzo/Queen's Indian" },
        { san: "c5", weight: 15, name: "Benoni Defense" },
        { san: "e5", weight: 10, name: "Budapest Gambit" },
        { san: "d6", weight: 5, name: "Old Indian Defense" }
    ],

    // King's Indian: 2...g6 3. Nc3
    "rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3": [
        { san: "Nc3", weight: 70, name: "King's Indian Defense" },
        { san: "Nf3", weight: 30, name: "King's Indian: Fianchetto" }
    ],

    // KID: 3. Nc3 Bg7
    "rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3": [
        { san: "Bg7", weight: 100, name: "King's Indian Defense" }
    ],

    // KID: 4. e4 d6
    "rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4": [
        { san: "e4", weight: 70, name: "King's Indian: Classical" },
        { san: "Nf3", weight: 20, name: "King's Indian: Fianchetto" },
        { san: "g3", weight: 10, name: "King's Indian: Fianchetto" }
    ],

    // Nimzo-Indian: 2...e6 3. Nc3 Bb4
    "rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3": [
        { san: "Nc3", weight: 60, name: "Nimzo-Indian" },
        { san: "Nf3", weight: 30, name: "Queen's Indian" },
        { san: "g3", weight: 10, name: "Catalan Opening" }
    ],

    // Nimzo-Indian: 3. Nc3 Bb4
    "rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3": [
        { san: "Bb4", weight: 70, name: "Nimzo-Indian Defense" },
        { san: "b6", weight: 20, name: "Queen's Indian Defense" },
        { san: "d5", weight: 10, name: "QGD" }
    ],

    // ==========================================================================
    // LONDON SYSTEM: 1. d4 d5 2. Bf4 / Nf3
    // ==========================================================================
    "rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2": [
        { san: "Nf6", weight: 50, name: "London System" },
        { san: "c5", weight: 30, name: "London System" },
        { san: "e6", weight: 20, name: "London System" }
    ],

    // ==========================================================================
    // PETROV DEFENSE: 1. e4 e5 2. Nf3 Nf6
    // ==========================================================================
    "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3": [
        { san: "Nxe5", weight: 70, name: "Petrov Defense" },
        { san: "Nc3", weight: 20, name: "Petrov: Three Knights" },
        { san: "d4", weight: 10, name: "Petrov: Steinitz Attack" }
    ],

    // ==========================================================================
    // KING'S GAMBIT: 1. e4 e5 2. f4
    // ==========================================================================
    "rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq - 0 2": [
        { san: "exf4", weight: 70, name: "King's Gambit Accepted" },
        { san: "Bc5", weight: 20, name: "King's Gambit Declined" },
        { san: "d5", weight: 10, name: "Falkbeer Counter-Gambit" }
    ],

    // ==========================================================================
    // VIENNA GAME: 1. e4 e5 2. Nc3
    // ==========================================================================
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2": [
        { san: "Nf6", weight: 60, name: "Vienna Game" },
        { san: "Nc6", weight: 30, name: "Vienna Game" },
        { san: "Bc5", weight: 10, name: "Vienna Game" }
    ],

    // ==========================================================================
    // SCOTCH GAME: 1. e4 e5 2. Nf3 Nc6 3. d4
    // ==========================================================================
    "r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3": [
        { san: "exd4", weight: 90, name: "Scotch Game" },
        { san: "Nf6", weight: 10, name: "Scotch: Classical" }
    ]
};

/**
 * Get a book move for the current FEN
 */
export function getBookMove(fen: string): OpeningMove | null {
    // Simplify FEN to just position + side to move + castling + en passant
    // This avoids move number mismatches
    // Standard FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
    // We match EXACT strings from keys above for now.
    // Ideally we should strip the move counters.

    const possibleMoves = OPENING_BOOK[fen];
    if (!possibleMoves || possibleMoves.length === 0) return null;

    // Weighted random selection
    const totalWeight = possibleMoves.reduce((sum, move) => sum + move.weight, 0);
    let random = Math.random() * totalWeight;

    for (const move of possibleMoves) {
        random -= move.weight;
        if (random <= 0) return move;
    }

    return possibleMoves[0];
}

// =============================================================================
// OPENING NAME TRACKING
// =============================================================================

// Current opening name (persists until game reset)
let currentOpeningName: string | null = null;

/**
 * Update opening name based on current FEN
 * Call this after each move to check if we've entered a named opening
 */
export function updateOpeningName(fen: string): void {
    const possibleMoves = OPENING_BOOK[fen];
    if (!possibleMoves) return;

    // Check if any move from this position has a named opening
    for (const move of possibleMoves) {
        if (move.name) {
            currentOpeningName = move.name;
            console.log('[Opening] Now in:', move.name);
            return;
        }
    }
}

/**
 * Check if a specific move enters a named opening
 */
export function getOpeningNameForMove(fen: string, san: string): string | null {
    const possibleMoves = OPENING_BOOK[fen];
    if (!possibleMoves) return null;

    const move = possibleMoves.find(m => m.san === san);
    return move?.name || null;
}

/**
 * Get the current opening name
 */
export function getCurrentOpeningName(): string | null {
    return currentOpeningName;
}

/**
 * Reset opening tracking (call on new game)
 */
export function resetOpeningTracking(): void {
    currentOpeningName = null;
}

/**
 * Set opening name directly (e.g., when book move is selected)
 */
export function setCurrentOpeningName(name: string): void {
    currentOpeningName = name;
    console.log('[Opening] Set to:', name);
}

