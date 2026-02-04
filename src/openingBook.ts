export interface OpeningMove {
    san: string;        // Standard Algebraic Notation (e.g., "e4")
    weight: number;     // Probability weight (higher = more likely)
    name?: string;      // Opening name if this move enters it
}

// Key is FEN string (simplified, just piece placement + turn)
export const OPENING_BOOK: Record<string, OpeningMove[]> = {
    // STARTING POSITION
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1": [
        { san: "e4", weight: 50, name: "King's Pawn Opening" },
        { san: "d4", weight: 35, name: "Queen's Pawn Opening" },
        { san: "Nf3", weight: 10, name: "Reti Opening" },
        { san: "c4", weight: 5, name: "English Opening" }
    ],

    // 1. e4 RESPONSE
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1": [
        { san: "e5", weight: 40, name: "Open Game" },
        { san: "c5", weight: 35, name: "Sicilian Defense" },
        { san: "e6", weight: 15, name: "French Defense" },
        { san: "c6", weight: 10, name: "Caro-Kann Defense" }
    ],

    // 1. d4 RESPONSE
    "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1": [
        { san: "d5", weight: 40, name: "Closed Game" },
        { san: "Nf6", weight: 40, name: "Indian Defense" },
        { san: "f5", weight: 10, name: "Dutch Defense" }
    ],

    // RUY LOPEZ LINE (1. e4 e5 2. Nf3 Nc6 3. Bb5)
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": [
        { san: "Nf3", weight: 100 }
    ],
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2": [
        { san: "Nc6", weight: 90 },
        { san: "Nf6", weight: 10, name: "Petrov Defense" }
    ],
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3": [
        { san: "Bb5", weight: 80, name: "Ruy Lopez" },
        { san: "Bc4", weight: 20, name: "Italian Game" }
    ],

    // SICILIAN DEFENSE LINE (1. e4 c5 2. Nf3)
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": [
        { san: "Nf3", weight: 90 },
        { san: "Nc3", weight: 10, name: "Closed Sicilian" }
    ],

    // FRENCH DEFENSE (1. e4 e6 2. d4)
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": [
        { san: "d4", weight: 100 }
    ],
    "rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2": [
        { san: "d5", weight: 100 }
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
