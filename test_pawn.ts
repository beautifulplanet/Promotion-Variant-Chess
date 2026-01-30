import { Chess } from 'chess.js';

const chess = new Chess();
chess.clear();

// Try putting a white pawn on a1 (Rank 1)
try {
    const success = chess.put({ type: 'p', color: 'w' }, 'a1');
    console.log('Put Pawn on a1:', success ? 'Success' : 'Failed');
} catch (e) {
    console.log('Put Pawn on a1 threw:', e.message);
}

// Try loading FEN with pawn on rank 1
// 8/8/8/8/8/8/8/P7 w - - 0 1
try {
    chess.load('8/8/8/8/8/8/8/P7 w - - 0 1');
    console.log('Load FEN with Pawn on Rank 1: Success');
} catch (e) {
    console.log('Load FEN with Pawn on Rank 1 threw:', e.message);
}
