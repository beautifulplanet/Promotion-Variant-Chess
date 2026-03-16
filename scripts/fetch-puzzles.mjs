#!/usr/bin/env node
// scripts/fetch-puzzles.mjs
// Downloads puzzles from the Lichess puzzle CSV database (CC0 public domain).
// Streams the zstd-compressed CSV, decompresses, and parses line-by-line
// using chunked processing to avoid memory issues with the ~2GB decompressed file.
//
// Run:  node --max-old-space-size=4096 scripts/fetch-puzzles.mjs

import { writeFileSync } from 'fs';

const CSV_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const OUTPUT = 'public/puzzles.json';

const BANDS = [
  { min: 400,  max: 800,  target: 300, collected: [], _seen: 0 },
  { min: 800,  max: 1100, target: 400, collected: [], _seen: 0 },
  { min: 1100, max: 1400, target: 500, collected: [], _seen: 0 },
  { min: 1400, max: 1700, target: 500, collected: [], _seen: 0 },
  { min: 1700, max: 2000, target: 400, collected: [], _seen: 0 },
  { min: 2000, max: 2400, target: 300, collected: [], _seen: 0 },
  { min: 2400, max: 3500, target: 100, collected: [], _seen: 0 },
];

const TOTAL_TARGET = BANDS.reduce((s, b) => s + b.target, 0);

function maybeCollect(puzzle) {
  const band = BANDS.find(b => puzzle.rating >= b.min && puzzle.rating < b.max);
  if (!band) return;

  if (band.collected.length < band.target) {
    band.collected.push(puzzle);
  } else {
    band._seen++;
    const j = Math.floor(Math.random() * band._seen);
    if (j < band.target) {
      band.collected[j] = puzzle;
    }
  }
}

function totalCollected() {
  return BANDS.reduce((s, b) => s + b.collected.length, 0);
}

// CSV: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
function parseLine(line) {
  const parts = line.split(',');
  if (parts.length < 8) return null;

  const id = parts[0];
  const fen = parts[1];
  const moves = parts[2];
  const rating = parseInt(parts[3], 10);
  const popularity = parseInt(parts[5], 10);
  const rd = parseInt(parts[4], 10);

  if (!id || !fen || !moves || isNaN(rating)) return null;
  if (popularity < 50) return null;   // skip unpopular
  if (rd > 150) return null;          // skip unreliable ratings

  return {
    id,
    fen,
    moves: moves.split(' '),
    rating,
    themes: parts[7].split(' ').filter(Boolean),
  };
}

async function main() {
  console.log(`Lichess Puzzle Fetcher (chunked stream approach)`);
  console.log(`Target: ${TOTAL_TARGET} puzzles across ${BANDS.length} rating bands\n`);

  const fzstd = await import('fzstd');

  console.log(`Downloading: ${CSV_URL}`);
  const response = await fetch(CSV_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentLength = response.headers.get('content-length');
  if (contentLength) console.log(`Download size: ${(parseInt(contentLength) / 1024 / 1024).toFixed(0)} MB\n`);

  // Download compressed data
  const chunks = [];
  let downloaded = 0;
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    downloaded += value.length;
    if (downloaded % (10 * 1024 * 1024) < value.length) {
      console.log(`  Downloaded: ${(downloaded / 1024 / 1024).toFixed(0)} MB...`);
    }
  }

  console.log(`\nDownload complete: ${(downloaded / 1024 / 1024).toFixed(1)} MB`);

  // Concat compressed chunks
  const compressed = new Uint8Array(downloaded);
  let offset = 0;
  for (const chunk of chunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }
  chunks.length = 0; // free memory

  console.log(`Decompressing...`);
  const decompressed = fzstd.decompress(compressed);
  console.log(`Decompressed: ${(decompressed.length / 1024 / 1024).toFixed(0)} MB`);

  // Process the decompressed bytes line-by-line WITHOUT creating one giant string.
  // Scan for newline bytes (0x0A) and decode each line individually.
  console.log(`Parsing puzzles...`);

  const NL = 0x0A;
  const decoder = new TextDecoder();
  let lineStart = 0;
  let linesParsed = 0;
  let skippedHeader = false;

  for (let i = 0; i < decompressed.length; i++) {
    if (decompressed[i] === NL) {
      if (!skippedHeader) {
        skippedHeader = true;
        lineStart = i + 1;
        continue;
      }

      // Decode just this line
      const lineBytes = decompressed.subarray(lineStart, i);
      lineStart = i + 1;

      if (lineBytes.length < 10) continue;
      const line = decoder.decode(lineBytes);

      const puzzle = parseLine(line);
      if (puzzle) {
        maybeCollect(puzzle);
        linesParsed++;
      }

      if (linesParsed % 500000 === 0) {
        console.log(`  Parsed ${linesParsed.toLocaleString()} eligible puzzles, collected ${totalCollected()}/${TOTAL_TARGET}`);
      }
    }
  }

  console.log(`\nParsed ${linesParsed.toLocaleString()} eligible puzzles from CSV`);

  const allPuzzles = BANDS.flatMap(b => b.collected);
  allPuzzles.sort((a, b) => a.rating - b.rating);

  console.log(`\nRating distribution:`);
  for (const band of BANDS) {
    console.log(`  ${band.min}-${band.max}: ${band.collected.length}/${band.target}`);
  }

  const output = {
    version: 1,
    source: 'lichess.org',
    license: 'CC0',
    generated: new Date().toISOString(),
    count: allPuzzles.length,
    puzzles: allPuzzles,
  };

  const json = JSON.stringify(output);
  const sizeMB = (Buffer.byteLength(json) / (1024 * 1024)).toFixed(2);
  console.log(`\nTotal: ${allPuzzles.length} puzzles, ${sizeMB} MB`);

  writeFileSync(OUTPUT, json);
  console.log(`Written to ${OUTPUT}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
