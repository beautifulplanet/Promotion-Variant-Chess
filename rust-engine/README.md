# Chess Engine (Rust + WASM)

High-performance bitboard-based chess engine compiled to WebAssembly.

## Prerequisites

1. **Rust** - Install from https://rustup.rs/
2. **wasm-pack** - Install with: `cargo install wasm-pack`

## Building

```powershell
cd rust-engine
.\build.ps1
```

Or manually:
```powershell
wasm-pack build --target web --out-dir ../public/wasm
```

## Output

The build creates files in `../public/wasm/`:
- `chess_engine.js` - JavaScript bindings
- `chess_engine_bg.wasm` - WebAssembly binary
- `chess_engine.d.ts` - TypeScript definitions

## Usage in TypeScript

```typescript
import init, { ping, new_game, to_fen } from './wasm/chess_engine.js';

async function main() {
  // Initialize WASM module
  await init();
  
  // Test connection
  console.log(ping()); // "🦀 Rust Chess Engine v0.1.0 - Ready!"
  
  // Create starting position
  const position = new_game();
  console.log(to_fen(position)); // Standard starting FEN
}
```

## Architecture

```
src/
├── lib.rs        # WASM entry point & public API
├── types.rs      # Piece, Square, Color, Move types
├── bitboard.rs   # 64-bit board representation & operations
├── position.rs   # Full game state (pieces, castling, en passant)
├── movegen.rs    # Legal move generation
├── attacks.rs    # Attack/defend square lookups
├── magic.rs      # Magic bitboard tables for sliding pieces
├── eval.rs       # Static position evaluation (material, PST, mobility)
├── search.rs     # Alpha-beta with TT, NMP, LMR, killer moves, quiescence
├── tt.rs         # Transposition table (Zobrist-indexed)
└── zobrist.rs    # Zobrist hashing for position fingerprints
```

## Search Features

- **Alpha-beta pruning** with iterative deepening
- **Transposition table** — Zobrist-hashed position cache
- **Null-move pruning** — Skip a move to get fast cutoffs
- **Late move reductions** — Search unlikely moves at reduced depth
- **Killer move heuristic** — Remember refutation moves per ply
- **Quiescence search** — Resolve captures to avoid horizon effect
- **Move ordering** — TT move → captures (MVV-LVA) → killers → quiet moves

## Performance

Bitboards enable:
- O(1) piece lookup
- Parallel move generation via bit operations
- Magic bitboard tables for O(1) sliding piece attacks
- ~100x faster than array-based boards
