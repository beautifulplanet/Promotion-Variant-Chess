#!/usr/bin/env node
// scripts/fetch-puzzles.mjs
// Fetches curated puzzles from the Lichess API (individual puzzle endpoint)
// Run: node scripts/fetch-puzzles.mjs
// Lichess puzzle data is CC0 (public domain).

import { writeFileSync, existsSync, readFileSync } from 'fs';

const TARGET = 2500;
const CONCURRENCY = 3;      // parallel requests
const DELAY_MS = 350;        // between batches
const OUTPUT = 'public/puzzles.json';
const PROGRESS_FILE = 'scripts/.puzzle-progress.json';

// Lichess puzzle IDs are base62-ish (alphanumeric, 5 chars). We iterate ranges.
// Known valid prefixes from the database: 00xxx through zzzzz
function generatePuzzleIds(count) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const ids = [];
  // Sample from different ranges for rating diversity
  const prefixes = [
    '00s', '01a', '02b', '03c', '04d', '05e', '06f', '07g', '08h', '09i',
    '0Aa', '0Ba', '0Ca', '0Da', '0Ea', '0Fa', '0Ga', '0Ha', '0Ia', '0Ja',
    '0Ka', '0La', '0Ma', '0Na', '0Oa', '0Pa', '0Qa', '0Ra', '0Sa', '0Ta',
    '0Ua', '0Va', '0Wa', '0Xa', '0Ya', '0Za', '0aa', '0ba', '0ca', '0da',
    '0ea', '0fa', '0ga', '0ha', '0ia', '0ja', '0ka', '0la', '0ma', '0na',
    '0oa', '0pa', '0qa', '0ra', '0sa', '0ta', '0ua', '0va', '0wa', '0xa',
    '1Aa', '1Ba', '1Ca', '1Da', '1Ea', '1Fa', '1Ga', '1Ha', '1Ia', '1Ja',
    '1Ka', '1La', '1Ma', '1Na', '1Oa', '1Pa', '1Qa', '1Ra', '1Sa', '1Ta',
    '2Aa', '2Ba', '2Ca', '2Da', '2Ea', '2Fa', '2Ga', '2Ha', '2Ia', '2Ja',
    '3Aa', '3Ba', '3Ca', '3Da', '3Ea', '3Fa', '3Ga', '3Ha', '3Ia', '3Ja',
    '4Aa', '4Ba', '4Ca', '4Da', '4Ea', '4Fa', '4Ga', '4Ha', '4Ia', '4Ja',
    '5Aa', '5Ba', '5Ca', '5Da', '5Ea', '5Fa', '5Ga', '5Ha', '5Ia', '5Ja',
  ];

  for (const prefix of prefixes) {
    for (let i = 0; i < chars.length && ids.length < count * 2; i++) {
      for (let j = 0; j < chars.length && ids.length < count * 2; j++) {
        ids.push(prefix + chars[i] + chars[j]);
      }
    }
  }
  return ids.slice(0, count * 2); // generate extras since many will 404
}

async function fetchPuzzle(id) {
  try {
    const res = await fetch(`https://lichess.org/api/puzzle/${id}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.status === 429) return { rateLimit: true };
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.puzzle || !data.game) return null;
    const p = data.puzzle;
    return {
      id: p.id,
      fen: data.game.pgn ? undefined : p.fen, // we need FEN from game
      moves: p.solution,
      rating: p.rating,
      themes: p.themes,
      initialPly: p.initialPly,
    };
  } catch {
    return null;
  }
}

// Better approach: fetch with the game data to get proper FEN
async function fetchPuzzleWithFEN(id) {
  try {
    const res = await fetch(`https://lichess.org/api/puzzle/${id}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.status === 429) return { rateLimit: true };
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.puzzle) return null;
    const p = data.puzzle;

    // The puzzle object contains the FEN at the initial position
    // But we need the FEN after the setup move (initialPly)
    // The game.pgn has all moves. Let's extract what we need.
    // Actually the puzzle endpoint gives us all we need.

    // FEN is in the game node at the puzzle position
    // We need to reconstruct it. The simplest: use game.pgn + initialPly
    // OR just store the FEN from game data.

    // The response includes game.pgn and puzzle.initialPly
    // The FEN at puzzle start = apply initialPly moves to starting position
    // This is complex. Let's check if there's a fen field...

    // Looking at the response structure more carefully:
    // data.game.id, data.game.pgn, data.game.players
    // data.puzzle.id, data.puzzle.rating, data.puzzle.solution, data.puzzle.themes, data.puzzle.initialPly

    // We need to derive FEN. Let's try a different approach: just store the PGN and initialPly
    // Then in the client, replay the PGN to the puzzle position using chess.js.

    return {
      id: p.id,
      pgn: data.game.pgn,
      initialPly: p.initialPly,
      moves: p.solution,
      rating: p.rating,
      themes: p.themes,
    };
  } catch {
    return null;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  // Resume from progress if available
  let puzzles = [];
  let startIdx = 0;
  if (existsSync(PROGRESS_FILE)) {
    try {
      const progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
      puzzles = progress.puzzles || [];
      startIdx = progress.nextIdx || 0;
      console.log(`Resuming from ${puzzles.length} puzzles, index ${startIdx}`);
    } catch { /* fresh start */ }
  }

  const candidateIds = generatePuzzleIds(TARGET);
  console.log(`Generated ${candidateIds.length} candidate IDs`);
  console.log(`Target: ${TARGET} puzzles\n`);

  let rateLimitHits = 0;

  for (let i = startIdx; i < candidateIds.length && puzzles.length < TARGET; i += CONCURRENCY) {
    const batch = candidateIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(id => fetchPuzzleWithFEN(id)));

    for (const result of results) {
      if (!result) continue;
      if (result.rateLimit) {
        rateLimitHits++;
        if (rateLimitHits >= 3) {
          console.log('\nHit rate limit 3x, saving progress and exiting.');
          console.log('Re-run the script to resume.\n');
          writeFileSync(PROGRESS_FILE, JSON.stringify({ puzzles, nextIdx: i }));
          break;
        }
        console.log('Rate limited, waiting 65s...');
        await sleep(65000);
        i -= CONCURRENCY; // retry this batch
        continue;
      }
      puzzles.push(result);
    }

    if (rateLimitHits >= 3) break;

    if (puzzles.length % 25 === 0 && puzzles.length > 0) {
      console.log(`  ${puzzles.length}/${TARGET} puzzles (index ${i}/${candidateIds.length})`);
      // Save progress every 100
      if (puzzles.length % 100 === 0) {
        writeFileSync(PROGRESS_FILE, JSON.stringify({ puzzles, nextIdx: i + CONCURRENCY }));
      }
    }

    await sleep(DELAY_MS);
  }

  // Sort by rating for nice distribution
  puzzles.sort((a, b) => a.rating - b.rating);

  const output = {
    version: 1,
    source: 'lichess.org',
    license: 'CC0',
    generated: new Date().toISOString(),
    count: puzzles.length,
    puzzles,
  };

  const json = JSON.stringify(output);
  const sizeMB = (Buffer.byteLength(json) / (1024 * 1024)).toFixed(2);
  console.log(`\nTotal: ${puzzles.length} puzzles, ${sizeMB} MB`);

  writeFileSync(OUTPUT, json);
  console.log(`Written to ${OUTPUT}`);

  // Clean up progress file
  if (existsSync(PROGRESS_FILE)) {
    const { unlinkSync } = await import('fs');
    unlinkSync(PROGRESS_FILE);
  }
}

main().catch(console.error);
