# Chess Sound Effects

Place your custom sound files here. The game expects the following files:

## Required Sound Files

| Filename | Event | Suggested Duration |
|----------|-------|-------------------|
| `move.mp3` | Piece moves to empty square | 0.1-0.3s |
| `capture.mp3` | Piece captures another piece | 0.2-0.4s |
| `check.mp3` | King is in check | 0.2-0.5s |
| `castle.mp3` | Castling move | 0.3-0.5s |
| `game-start.mp3` | Game begins | 0.5-1.0s |
| `game-win.mp3` | Player wins | 1.0-2.0s |
| `game-lose.mp3` | Player loses | 0.5-1.5s |
| `game-draw.mp3` | Draw/stalemate | 0.5-1.0s |

## Supported Formats

- **MP3** (recommended) - Best browser compatibility
- **OGG** - Good quality, smaller files
- **WAV** - Lossless, but larger files

## Tips for Newspaper Theme

For the vintage newspaper aesthetic, consider:
- Old typewriter clicks for moves
- Paper rustling sounds
- Vintage bell/ding for check
- Jazz-era style fanfare for wins

## Default Fallback

If no sound files are present, the game will generate a basic click tone using Web Audio API.
