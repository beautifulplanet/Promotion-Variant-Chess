
import { Chess } from 'chess.js'; // Ensure module import works in node with type=module or use require if CommonJS
// To be safe with standard node without type=module in package.json, we might need dynamic import or require.
// But project seems to be ESM.

const chess = new Chess();
chess.clear();

// Valid FEN with extra material?
// White to move.
// Black has Queen on d7 (replacing pawn). Standard Queen on d8.
// rnbqkbnr/pppQpppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1
// Wait, if I replace d7 pawn with Queen.
// d7 is row 1, col 3.
// FEN row 1 (from top? No, FEN is rank 8 down to 1).
// Rank 8 (Row 0): rnbqkbnr
// Rank 7 (Row 1): pppQpppp (Queen at d7)
// Rank 6...

const fen = 'rnbqkbnr/pppQpppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

console.log('Testing FEN:', fen);
try {
    const success = chess.load(fen); // .load validation?
    // In older chess.js, load returned bool. In new, it throws or validates.
    console.log('Load result (legacy bool check):', success);
    console.log('Current FEN:', chess.fen());
} catch (e) {
    console.log('Load Threw:', e.message);
}
