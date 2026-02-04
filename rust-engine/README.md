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
├── bitboard.rs   # 64-bit board representation
├── position.rs   # Full game state
└── types.rs      # Piece, Square, Move types
```

## Performance

Bitboards enable:
- O(1) piece lookup
- Parallel move generation via bit operations  
- ~100x faster than array-based boards
