import { Chess } from 'chess.js';

const chess = new Chess();
chess.clear();

// Test 1: PUT loop for Pawn on Rank 1 + King
console.log('--- Test 1: PUT ---');
try {
    chess.put({ type: 'k', color: 'w' }, 'e1');
    chess.put({ type: 'k', color: 'b' }, 'e8');
    const pSuccess = chess.put({ type: 'p', color: 'w' }, 'a1');
    console.log('Put Pawn on a1 success:', pSuccess);
    console.log('FEN after put:', chess.fen());
} catch (e) {
    console.log('Put Error:', e.message);
}

// Test 2: LOAD FEN with Pawn on Rank 1
console.log('--- Test 2: LOAD ---');
const fen = '4k3/8/8/8/8/8/8/P3K3 w - - 0 1';
try {
    const lSuccess = chess.load(fen);
    console.log('Load FEN success:', lSuccess); // Note: chess.load might return void or throw in newer versions
} catch (e) {
    console.log('Load Error:', e.message);
}
