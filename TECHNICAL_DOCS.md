# Sideways Chess Side Scroller - Technical Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Core Modules](#core-modules)
5. [Move Generation System](#move-generation-system)
6. [Game State Management](#game-state-management)
7. [AI System](#ai-system)
8. [How It All Works Together](#how-it-all-works-together)

---

## Project Overview

This is a modular, TypeScript-based chess game built with Vite and HTML5 Canvas. The design philosophy prioritizes:

- **Modularity**: Each piece type has its own move generation file
- **Maintainability**: Small, focused modules that do one thing well
- **Extensibility**: Easy to add new features without breaking existing code
- **AI Scalability**: Architecture supports difficulty scaling from beginner to grandmaster level

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        main.ts                               │
│  (Entry point, rendering, user input, game loop)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    moveGenerator.ts                          │
│  (Aggregates all piece move modules)                        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ pawnMoves   │      │ knightMoves │      │ bishopMoves │
└─────────────┘      └─────────────┘      └─────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ rookMoves   │      │ queenMoves  │      │ kingMoves   │
└─────────────┘      └─────────────┘      └─────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ castlingState   │
                    └─────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      AI System                               │
├─────────────────┬─────────────────┬─────────────────────────┤
│ aiDecision.ts   │ boardEvaluator  │ (future: minimax, etc)  │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## File Structure

```
version 1/
├── index.html          # HTML entry point with canvas and sidebar
├── package.json        # NPM dependencies (Vite, TypeScript)
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite bundler configuration
├── GAME_PLAN.md        # Game design document
├── CODE_ROADMAP.md     # Development roadmap
├── TECHNICAL_DOCS.md   # This file
└── src/
    ├── main.ts             # Entry point, rendering, game loop
    ├── moveGenerator.ts    # Aggregates all move generators
    ├── pawnMoves.ts        # Pawn movement logic
    ├── knightMoves.ts      # Knight movement logic
    ├── bishopMoves.ts      # Bishop movement logic
    ├── rookMoves.ts        # Rook movement logic
    ├── queenMoves.ts       # Queen movement logic
    ├── kingMoves.ts        # King movement logic + castling
    ├── castlingState.ts    # Castling rights tracking
    ├── boardEvaluator.ts   # Board position scoring
    └── aiDecision.ts       # AI move selection
```

---

## Core Modules

### main.ts - The Heart of the Game

**Purpose**: Entry point that ties everything together.

**Key Components**:

```typescript
// Board representation: 8x8 grid where each cell is Piece | null
const board: (Piece | null)[][] = [];

// Piece interface
interface Piece {
  type: PieceType;    // 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'
  color: PieceColor;  // 'white' | 'black'
}
```

**Responsibilities**:
1. Initialize the board with starting positions
2. Render the board and pieces using Canvas
3. Handle mouse clicks for piece selection and movement
4. Track game state (current turn, en passant, castling rights)
5. Update the sidebar with stats
6. Execute moves (including special moves like castling, en passant, promotion)

**Key Functions**:
- `initBoard()` - Sets up the initial chess position
- `drawBoard()` - Renders the 8x8 grid with alternating colors
- `drawPiece()` - Renders a piece as a colored circle with letter
- `drawPieces()` - Iterates board and draws all pieces
- `render()` - Master render function (board + pieces + UI)
- `handleClick()` - Processes user clicks for selection/movement

---

### moveGenerator.ts - The Move Aggregator

**Purpose**: Central hub that collects moves from all piece modules.

**Key Export**:

```typescript
interface Move {
  from: { row: number; col: number };
  to: { row: number; col: number };
  piece: Piece;
  captured?: Piece;
  promotion?: 'Q' | 'R' | 'B' | 'N';
  castling?: 'kingSide' | 'queenSide';
}

function generateMoves(
  board: (Piece | null)[][],
  color: 'white' | 'black',
  enPassantTarget?: { row: number; col: number },
  castlingRights?: CastlingRights
): Move[]
```

**How It Works**:
1. Calls each piece's move generator
2. Combines all moves into a single array
3. Passes special state (en passant, castling) to relevant generators

---

## Move Generation System

Each piece has its own module following the same pattern:

### pawnMoves.ts - Most Complex Piece

**Pawn Rules Implemented**:
1. **Forward Move**: One square forward (if empty)
2. **Double Move**: Two squares from starting position (if both empty)
3. **Diagonal Capture**: Capture enemy pieces diagonally
4. **En Passant**: Special capture after enemy pawn double-moves
5. **Promotion**: Transform to Q/R/B/N when reaching last rank

**Algorithm**:
```
For each pawn of given color:
  1. Calculate forward direction (-1 for white, +1 for black)
  2. Check forward square - add move if empty
  3. If on starting row and forward empty, check double move
  4. Check diagonal squares for enemy pieces (captures)
  5. Check if en passant target matches diagonal squares
  6. If destination is last rank, generate 4 promotion moves (Q/R/B/N)
```

### knightMoves.ts - The Jumper

**Knight Rules**:
- Moves in L-shape: 2 squares in one direction, 1 square perpendicular
- Can jump over pieces
- 8 possible destinations from any square

**Algorithm**:
```
Offsets: [(-2,-1), (-2,+1), (-1,-2), (-1,+2), 
          (+1,-2), (+1,+2), (+2,-1), (+2,+1)]

For each knight:
  For each offset:
    Calculate destination
    If in bounds AND (empty OR enemy piece):
      Add move
```

### bishopMoves.ts - Diagonal Slider

**Bishop Rules**:
- Moves diagonally any number of squares
- Blocked by pieces

**Algorithm**:
```
Directions: [(-1,-1), (-1,+1), (+1,-1), (+1,+1)]

For each bishop:
  For each direction:
    Start from bishop position
    While in bounds:
      If empty: add move, continue
      If enemy: add capture move, stop
      If friendly: stop
```

### rookMoves.ts - Straight Slider

**Rook Rules**:
- Moves horizontally/vertically any number of squares
- Blocked by pieces

**Algorithm**:
```
Directions: [(-1,0), (+1,0), (0,-1), (0,+1)]

For each rook:
  For each direction:
    (Same sliding logic as bishop)
```

### queenMoves.ts - Combined Slider

**Queen Rules**:
- Combines rook + bishop movement
- 8 directions total

**Algorithm**:
```
Directions: All 8 directions (4 straight + 4 diagonal)
(Same sliding logic)
```

### kingMoves.ts - The Monarch

**King Rules**:
1. Moves one square in any direction
2. Castling (king-side and queen-side)

**Castling Conditions**:
- King and rook haven't moved (tracked by castlingRights)
- Squares between king and rook are empty
- King not in check (not yet implemented)
- King doesn't pass through check (not yet implemented)

**Algorithm**:
```
For king of given color:
  // Normal moves
  For each of 8 directions:
    If destination in bounds AND (empty OR enemy):
      Add move
  
  // Castling
  If king on starting square (e1 or e8):
    If kingside rights AND f,g squares empty:
      Add castling move (king to g-file)
    If queenside rights AND b,c,d squares empty:
      Add castling move (king to c-file)
```

---

## Game State Management

### castlingState.ts - Rights Tracking

**Purpose**: Track whether each player can still castle.

```typescript
interface CastlingRights {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}
```

**When Rights Are Lost**:
- King moves: lose both castling rights
- Rook moves: lose that side's castling right

### State Variables in main.ts

```typescript
// Whose turn it is
let currentTurn: PieceColor = 'white';

// En passant target square (set after pawn double-move)
let enPassantTarget: { row: number; col: number } | null = null;

// Castling availability
let castlingRights: CastlingRights = createInitialCastlingRights();

// Currently selected square
let selectedSquare: { row: number; col: number } | null = null;
```

---

## AI System

### boardEvaluator.ts - Position Scoring

**Purpose**: Assign a numerical score to a board position.

**Current Implementation** (Simple Material Count):
```typescript
Piece Values:
  King   = 0  (infinite really, but not counted)
  Queen  = 9
  Rook   = 5
  Bishop = 3
  Knight = 3
  Pawn   = 1

Score = (Your pieces) - (Enemy pieces)
```

**Future Enhancements**:
- Piece-square tables (position bonuses)
- Pawn structure evaluation
- King safety
- Mobility (number of legal moves)
- Control of center

### aiDecision.ts - Move Selection

**Purpose**: Choose the best move for the AI.

**Current Implementation**: Random move selection (placeholder)

**Future Implementation** (Minimax with Alpha-Beta):
```
function minimax(board, depth, alpha, beta, maximizing):
  if depth == 0 or game over:
    return evaluateBoard(board)
  
  if maximizing:
    maxEval = -infinity
    for each move:
      make move
      eval = minimax(board, depth-1, alpha, beta, false)
      undo move
      maxEval = max(maxEval, eval)
      alpha = max(alpha, eval)
      if beta <= alpha: break  // Pruning
    return maxEval
  else:
    minEval = +infinity
    for each move:
      make move
      eval = minimax(board, depth-1, alpha, beta, true)
      undo move
      minEval = min(minEval, eval)
      beta = min(beta, eval)
      if beta <= alpha: break  // Pruning
    return minEval
```

**Difficulty Scaling by ELO**:
- ELO 400-800: Depth 1, add random mistakes
- ELO 800-1200: Depth 2, occasional mistakes
- ELO 1200-1600: Depth 3, rare mistakes
- ELO 1600-2000: Depth 4, no mistakes
- ELO 2000-2400: Depth 5, positional bonuses
- ELO 2400+: Depth 6+, advanced evaluation

---

## How It All Works Together

### Game Flow

```
1. INITIALIZATION
   main.ts calls initBoard()
   → Creates 8x8 grid
   → Places pieces in starting positions
   → Sets currentTurn = 'white'
   → Calls render()

2. PLAYER CLICKS PIECE
   handleClick() fires
   → Converts pixel coordinates to board coordinates
   → If clicking own piece: selectedSquare = { row, col }
   → Calls render() (highlights selected square)

3. PLAYER CLICKS DESTINATION
   handleClick() fires again
   → Detects selectedSquare is set
   → Validates move (currently basic: not capturing own piece)
   → Executes special move logic:
      - En passant: remove captured pawn
      - Castling: move rook too
      - Promotion: replace pawn with queen
   → Updates board array
   → Updates castlingRights
   → Updates enPassantTarget
   → Switches currentTurn
   → Calls render()

4. AI TURN (when implemented)
   → generateMoves(board, 'black', enPassantTarget, castlingRights)
   → chooseAIMove() selects best move
   → Execute move (same logic as player)
   → Switch turn back to player

5. RENDER CYCLE
   render() called
   → drawBoard(): fills 64 squares
   → drawPieces(): draws circles with letters
   → drawTurnIndicator(): shows whose turn
   → updateSidebar(): updates ELO, wins, etc.
```

### Data Flow for Move Generation

```
generateMoves(board, color, enPassant, castling)
    │
    ├──► generatePawnMoves(board, color, enPassant)
    │        └──► returns Move[]
    │
    ├──► generateKnightMoves(board, color)
    │        └──► returns Move[]
    │
    ├──► generateBishopMoves(board, color)
    │        └──► returns Move[]
    │
    ├──► generateRookMoves(board, color)
    │        └──► returns Move[]
    │
    ├──► generateQueenMoves(board, color)
    │        └──► returns Move[]
    │
    └──► generateKingMoves(board, color, castling)
             └──► returns Move[]
    
    All combined into single Move[] array
```

---

## Extending the System

### Adding a New Piece Type

1. Create `src/newPieceMoves.ts`
2. Export `generateNewPieceMoves(board, color): Move[]`
3. Import in `moveGenerator.ts`
4. Add to `generateMoves()` function
5. Add piece type to `PieceType` union in `main.ts`

### Improving AI

1. Enhance `boardEvaluator.ts` with positional scoring
2. Implement minimax in `aiDecision.ts`
3. Add alpha-beta pruning for speed
4. Create difficulty settings based on search depth

### Adding Game Features

- **Check/Checkmate Detection**: Filter moves that leave king in check
- **Stalemate**: No legal moves but not in check
- **Draw Conditions**: 50-move rule, threefold repetition
- **Save/Load**: Serialize board state to JSON

---

## Performance Considerations

1. **Move Generation**: O(n) where n = number of pieces × average moves
2. **Minimax**: O(b^d) where b = branching factor (~35), d = depth
3. **Alpha-Beta**: Reduces to O(b^(d/2)) with good move ordering

**Optimizations to Consider**:
- Bitboards for faster move generation
- Transposition tables for caching positions
- Iterative deepening for time-limited search
- Move ordering (captures first, killer moves)

---

## Glossary

- **Pseudo-legal move**: A move that follows piece rules but might leave king in check
- **Legal move**: A pseudo-legal move that doesn't leave king in check
- **En passant**: Special pawn capture available immediately after enemy pawn double-moves
- **Castling**: Special king+rook move (king moves 2 squares toward rook)
- **Promotion**: Pawn reaching last rank becomes Q/R/B/N
- **ELO**: Rating system for measuring player/AI skill
- **Minimax**: Algorithm for finding optimal move in two-player games
- **Alpha-beta pruning**: Optimization that skips branches that can't affect the result

---

*Last updated: January 20, 2026*
