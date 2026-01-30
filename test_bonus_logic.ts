
// Mock types
type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
interface PromotedPiece { type: string; earnedAtElo: number; gameNumber: number; }

// Mock Piece Values
function getPieceValue(type: string): number {
    switch (type) {
        case 'P': return 1;
        case 'N': return 3;
        case 'B': return 3;
        case 'R': return 5;
        case 'Q': return 9;
        case 'K': return 100;
        default: return 0;
    }
}

// COPIED LOGIC from gameController.ts
function getAIBonusPieces(elo: number, playerPieces: PromotedPiece[]): PieceType[] {
    const bonusPieces: PieceType[] = [];

    // Calculate player's bonus material value
    let playerMaterialValue = 0;
    for (const p of playerPieces) {
        playerMaterialValue += getPieceValue(p.type);
    }

    // Calculate base AI material value based on ELO
    let aiMaterialValue = 0;

    // ELO Scaling (Base difficulty) - Continuous ramping
    // User Request: "NEEDS TO INCREASE AS ELO GROWS"
    // Formula: For every 50 ELO above 3000, add ~3 points of material (Knight/Bishop value)
    if (elo >= 3000) {
        const eloDiff = elo - 3000;
        const extraValue = Math.floor(eloDiff / 50) * 3;
        aiMaterialValue += extraValue;
        console.log('[Test] High ELO Bonus:', extraValue, 'points for', eloDiff, 'ELO above 3000');
    }

    // Compensation: Match player's bonus value
    if (playerMaterialValue > 2) {
        const valueNeededToMatch = Math.max(0, playerMaterialValue - 2);
        aiMaterialValue += valueNeededToMatch;
    }

    // Cap max value
    aiMaterialValue = Math.min(130, aiMaterialValue);

    console.log('[Test] Total AI Material Value:', aiMaterialValue);

    // Convert aiMaterialValue into pieces
    let remainingValue = aiMaterialValue;
    let loopCount = 0;

    // 1. Add Queens
    loopCount = 0;
    while (remainingValue >= 9 && loopCount < 100) {
        bonusPieces.push('Q');
        remainingValue -= 9;
        loopCount++;
    }

    // 2. Add Rooks
    loopCount = 0;
    while (remainingValue >= 5 && loopCount < 100) {
        bonusPieces.push('R');
        remainingValue -= 5;
        loopCount++;
    }

    // 3. Add Bishops/Knights
    loopCount = 0;
    while (remainingValue >= 3 && loopCount < 100) {
        // Deterministic for test (Alternate B/N)
        // Actually source uses Math.random(). Let's mock it or just push N for consistency?
        // Source: if (Math.random() > 0.5) ...
        // Note: Test output might vary slightly but count is key.
        bonusPieces.push('N');
        remainingValue -= 3;
        loopCount++;
    }

    return bonusPieces;
}

// EXECUTE TEST
console.log('--- Testing ELO 3000 (Should get bonus now) ---');
console.log('Result:', getAIBonusPieces(3000, []));

console.log('--- Testing ELO 3050 ---');
console.log('Result:', getAIBonusPieces(3050, []));

console.log('--- Testing ELO 3500 ---');
console.log('Result:', getAIBonusPieces(3500, []));

console.log('--- Testing ELO 4000 ---');
console.log('Result:', getAIBonusPieces(4000, []));
