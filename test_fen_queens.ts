import { Chess } from 'chess.js';

const chess = new Chess();
chess.clear();

// FEN with 3 Black Queens on rank 8
// Standard: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR
// Modified: qqqqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR
console.log('--- Testing FEN with Extra Queens ---');
const fen = 'qqqqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

try {
    const success = chess.load(fen);
    console.log('Load Success:', success);
    console.log('FEN:', chess.fen());
} catch (e) {
    console.log('Load Failed:', e.message);
}

// Test validation
const valid = chess.validateFen(fen);
console.log('Validation:', valid);
