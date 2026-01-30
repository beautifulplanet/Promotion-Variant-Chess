import { Chess } from 'chess.js';

const chess = new Chess();
chess.clear();

console.log('Testing Pawn on Rank 1 (a1)...');
try {
    // Rank 1 = index 7 in strict terms? row 7 col 0. 'a1'.
    // Setup dict: 
    // put returns boolean
    const success = chess.put({ type: 'p', color: 'w' }, 'a1');
    console.log('Result:', success);
} catch (e) {
    console.log('Error:', e.message);
}

// FEN
try {
    chess.load('8/8/8/8/8/8/8/P7 w - - 0 1');
    console.log('FEN Load: Success');
} catch (e) {
    console.log('FEN Load Error:', e.message);
}
