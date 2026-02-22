// =============================================================================
// AUTOMATED PLAYTEST AGENT
// Plays real games, stress-tests features, and reports bugs.
//
// Run:  npx playwright test e2e/playtest.spec.ts --headed   (watch it play)
// Run:  npx playwright test e2e/playtest.spec.ts            (headless)
//
// NOTE: Each Stockfish move takes ~3-5s. Tests are sized accordingly.
// =============================================================================

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForBoard(page: Page) {
  await page.goto('/');
  // Dismiss welcome dashboard first
  const dashboard = page.locator('#welcome-dashboard');
  await expect(dashboard).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => (window as any).__dismissWelcome__?.());
  await expect(dashboard).toBeHidden({ timeout: 5_000 });

  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(3000);
  await expect(page.locator('#sidebar-turn')).toBeVisible();
  return canvas;
}

async function hasGameAPI(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const G = (window as any).__GAME__;
    return !!(G && typeof G.handleSquareClick === 'function');
  });
}

/** Make a random legal move (synchronous player action only) */
async function makePlayerMove(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const Game = (window as any).__GAME__;
    if (!Game) return false;
    const st = Game.getState();
    if (st.gameOver) return false;

    const board = Game.getBoard();
    const turn = Game.getCurrentTurn();

    const pieces: { row: number; col: number }[] = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c] && board[r][c].color === turn)
          pieces.push({ row: r, col: c });

    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    for (const p of pieces) {
      Game.handleSquareClick(p.row, p.col);
      const after = Game.getState();
      if (after.legalMovesForSelected?.length > 0) {
        const moves = after.legalMovesForSelected;
        const move = moves[Math.floor(Math.random() * moves.length)];
        Game.handleSquareClick(move.to.row, move.to.col);
        if (Game.getState().pendingPromotion) {
          Game.completePromotion(['Q', 'R', 'B', 'N'][Math.floor(Math.random() * 4)] as any);
        }
        return true;
      }
    }
    return false;
  });
}

/** Wait for AI using Playwright's waitForFunction (non-blocking, robust) */
async function waitForAI(page: Page, timeoutMs = 30_000) {
  await page.waitForFunction(() => {
    const G = (window as any).__GAME__;
    if (!G) return true;
    const st = G.getState();
    if (st.gameOver) return true;
    return G.getCurrentTurn() === st.playerColor;
  }, undefined, { timeout: timeoutMs, polling: 500 }).catch(() => {
    // OK — AI may be slow; we'll check state next iteration
  });
}

/** Full turn: player move + AI response */
async function playOneTurn(page: Page): Promise<{ moved: boolean; gameOver: boolean }> {
  const preCheck = await page.evaluate(() => {
    const G = (window as any).__GAME__;
    return G ? { gameOver: G.getState().gameOver, turn: G.getCurrentTurn(), pc: G.getState().playerColor } : null;
  });
  if (!preCheck || preCheck.gameOver) return { moved: false, gameOver: true };
  // If it's not the player's turn, wait for AI first
  if (preCheck.turn !== preCheck.pc) {
    await waitForAI(page);
    const recheck = await page.evaluate(() => (window as any).__GAME__?.getState()?.gameOver ?? true);
    if (recheck) return { moved: false, gameOver: true };
  }

  const moved = await makePlayerMove(page);
  if (moved) await waitForAI(page);

  const gameOver = await page.evaluate(() => (window as any).__GAME__?.getState()?.gameOver ?? true);
  return { moved, gameOver };
}

/** Validate board invariants */
async function validateBoard(page: Page, label: string): Promise<string[]> {
  const bugs: string[] = [];
  const s = await page.evaluate(() => {
    const G = (window as any).__GAME__;
    if (!G) return null;
    const board = G.getBoard();
    let wK = 0, bK = 0, total = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) { total++; if (p.type === 'K') p.color === 'white' ? wK++ : bK++; }
      }
    return { wK, bK, total, go: G.getState().gameOver, mc: G.getMoveCount() };
  });
  if (!s) return bugs;
  if (!s.go) {
    if (s.wK !== 1) bugs.push(`${label}: White has ${s.wK} kings`);
    if (s.bK !== 1) bugs.push(`${label}: Black has ${s.bK} kings`);
  }
  if (s.total > 32) bugs.push(`${label}: ${s.total} pieces (max 32)`);
  return bugs;
}

// ---------------------------------------------------------------------------
// TESTS — each individually sized for Stockfish latency (~4s per half-move)
// ---------------------------------------------------------------------------

test.describe('Playtest Agent', () => {

  // ---- Gameplay tests (slow: Stockfish) ------------------------------------

  test('Play 8 turns — validate state every move', async ({ page }) => {
    test.setTimeout(120_000);
    const pe: string[] = [];
    page.on('pageerror', err => pe.push(err.message));

    await waitForBoard(page);
    test.skip(!(await hasGameAPI(page)), 'No API');

    const bugs: string[] = [];
    let played = 0;

    for (let i = 0; i < 8; i++) {
      const { moved, gameOver } = await playOneTurn(page);
      if (moved) played++;
      if (gameOver) break;
      bugs.push(...await validateBoard(page, `turn ${i}`));
    }

    console.log(`[Playtest] Game: ${played} player turns`);
    if (bugs.length > 0) console.log('[Playtest] BUGS:\n' + bugs.join('\n'));
    expect(bugs).toHaveLength(0);
    expect(pe).toHaveLength(0);
  });

  test('Undo after 3 turns', async ({ page }) => {
    test.setTimeout(90_000);
    const pe: string[] = [];
    page.on('pageerror', err => pe.push(err.message));

    await waitForBoard(page);
    test.skip(!(await hasGameAPI(page)), 'No API');

    // Play 3 turns
    for (let i = 0; i < 3; i++) {
      const { gameOver } = await playOneTurn(page);
      if (gameOver) break;
    }

    // Undo everything
    await page.evaluate(() => {
      const G = (window as any).__GAME__;
      for (let i = 0; i < 20; i++) if (!G.undoMove()) break;
    });

    const bugs = await validateBoard(page, 'after undo');
    expect(bugs).toHaveLength(0);

    // Move count should be 0 (fully undone)
    const mc = await page.evaluate(() => (window as any).__GAME__.getMoveCount());
    expect(mc).toBe(0);

    await expect(page.locator('#game-canvas')).toBeVisible();
    expect(pe).toHaveLength(0);
  });

  test('New game + 2 turns × 3 games', async ({ page }) => {
    test.setTimeout(120_000);
    const pe: string[] = [];
    page.on('pageerror', err => pe.push(err.message));

    await waitForBoard(page);
    test.skip(!(await hasGameAPI(page)), 'No API');

    for (let g = 0; g < 3; g++) {
      if (g > 0) {
        await page.evaluate(() => (window as any).__GAME__.newGame());
        await page.waitForTimeout(500);
      }

      for (let i = 0; i < 2; i++) {
        const { gameOver } = await playOneTurn(page);
        if (gameOver) break;
      }

      const bugs = await validateBoard(page, `game ${g}`);
      expect(bugs).toHaveLength(0);
    }

    console.log('[Playtest] 3 games OK');
    expect(pe).toHaveLength(0);
  });

  test('PGN export after 3 turns', async ({ page }) => {
    test.setTimeout(90_000);

    await waitForBoard(page);
    test.skip(!(await hasGameAPI(page)), 'No API');

    for (let i = 0; i < 3; i++) {
      const { gameOver } = await playOneTurn(page);
      if (gameOver) break;
    }

    const pgn = await page.evaluate(() => (window as any).__GAME__.generatePGN());
    expect(pgn).toContain('[Event');
    expect(pgn).toMatch(/1\./);
    console.log('[Playtest] PGN:\n' + pgn);
  });

  // ---- Fast tests (no Stockfish needed) ------------------------------------

  test('UI buttons', async ({ page }) => {
    test.setTimeout(30_000);
    const pe: string[] = [];
    page.on('pageerror', err => pe.push(err.message));

    await waitForBoard(page);

    for (const sel of ['#undo-btn', '#flip-btn', '#new-game-btn', '#export-pgn-btn']) {
      const btn = page.locator(sel);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
        await expect(page.locator('#game-canvas')).toBeVisible();
      }
    }

    // Keyboard shortcut: ? overlay
    await page.keyboard.press('Shift+/');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('#game-canvas')).toBeVisible();

    expect(pe.filter(e => !e.includes('Clipboard'))).toHaveLength(0);
  });

  test('Rapid clicking stress test', async ({ page }) => {
    test.setTimeout(30_000);
    const pe: string[] = [];
    page.on('pageerror', err => pe.push(err.message));

    const canvas = await waitForBoard(page);
    const box = await canvas.boundingBox();
    if (!box) return;

    for (let i = 0; i < 40; i++) {
      await canvas.click({
        position: { x: Math.random() * box.width, y: Math.random() * box.height },
        force: true,
        timeout: 1000,
      }).catch(() => {});
    }

    const alive = await page.waitForTimeout(1000)
      .then(() => page.evaluate(() => true))
      .catch(() => false);

    expect(alive, 'PAGE CRASHED under rapid clicking!').toBe(true);
    if (pe.length > 0) console.log('[Playtest] RAPID CLICK ERRORS:\n' + pe.join('\n'));
    expect(pe).toHaveLength(0);
  });

  test('Mobile viewport', async ({ browser }) => {
    test.setTimeout(30_000);
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
    const page = await ctx.newPage();
    const pe: string[] = [];
    page.on('pageerror', err => pe.push(err.message));

    await page.goto('/');
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(3000);

    const box = await canvas.boundingBox();
    if (box) {
      for (let i = 0; i < 20; i++) {
        await canvas.tap({
          position: { x: Math.random() * box.width, y: Math.random() * box.height },
          force: true,
        }).catch(() => {});
        await page.waitForTimeout(200);
      }
    }

    await expect(canvas).toBeVisible();
    expect(pe.filter(e => !e.includes('Clipboard'))).toHaveLength(0);
    await ctx.close();
  });

  test('Console error audit', async ({ page }) => {
    test.setTimeout(15_000);
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await page.waitForTimeout(5000);

    const critical = errors.filter(e =>
      !e.includes('service-worker') && !e.includes('manifest') && !e.includes('favicon')
    );
    if (critical.length > 0) console.log('[Playtest] Console errors:\n' + critical.join('\n'));
    expect(critical).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // VISUAL CORRECTNESS TESTS — catch rendering/state glitches, not just crashes
  // --------------------------------------------------------------------------

  test('Flip board: orientation toggles correctly', async ({ page }) => {
    test.setTimeout(60_000);
    const pe: string[] = [];
    page.on('pageerror', err => pe.push(err.message));

    await waitForBoard(page);
    test.skip(!(await hasGameAPI(page)), 'No API');

    // Do everything in a single evaluate to avoid any cross-context issues
    const result = await page.evaluate(() => {
      const R = (window as any).__RENDERER__;
      const G = (window as any).__GAME__;
      if (!R || !R.toggleBoardFlip || !R.isViewFlipped || !R.getPlayerColor) {
        return { error: 'Missing renderer API', hasR: !!R, methods: R ? Object.keys(R).slice(0, 10) : [] };
      }

      const gameColor = G.getState().playerColor;
      const beforeFlipped = R.isViewFlipped();
      const beforeColor = R.getPlayerColor();

      // --- Flip once ---
      const flip1Result = R.toggleBoardFlip();
      const afterFlip1 = R.isViewFlipped();
      const afterColor1 = R.getPlayerColor();

      // --- Flip back ---
      const flip2Result = R.toggleBoardFlip();
      const afterFlip2 = R.isViewFlipped();
      const afterColor2 = R.getPlayerColor();

      return {
        gameColor,
        beforeFlipped, beforeColor,
        flip1Result, afterFlip1, afterColor1,
        flip2Result, afterFlip2, afterColor2,
      };
    });

    console.log('[Flip Test] Result:', JSON.stringify(result));

    if ('error' in result) {
      throw new Error(`Renderer API issue: ${JSON.stringify(result)}`);
    }

    expect(result.beforeFlipped, 'Initially not flipped').toBe(false);
    expect(result.beforeColor, 'Initial color matches game').toBe(result.gameColor);

    expect(result.afterFlip1, 'Flipped after first toggle').toBe(true);
    const expectedFlipColor = result.gameColor === 'white' ? 'black' : 'white';
    expect(result.afterColor1, 'Color inverted after flip').toBe(expectedFlipColor);

    expect(result.afterFlip2, 'Unflipped after second toggle').toBe(false);
    expect(result.afterColor2, 'Color restored after double flip').toBe(result.gameColor);

    await expect(page.locator('#game-canvas')).toBeVisible();
    expect(pe).toHaveLength(0);
  });

  test('Flip during gameplay: state stays consistent', async ({ page }) => {
    test.setTimeout(90_000);
    const pe: string[] = [];
    page.on('pageerror', err => pe.push(err.message));

    await waitForBoard(page);
    test.skip(!(await hasGameAPI(page)), 'No API');

    // Play 2 turns
    for (let i = 0; i < 2; i++) {
      const { gameOver } = await playOneTurn(page);
      if (gameOver) break;
    }

    // Flip mid-game and verify in a single evaluate
    const state = await page.evaluate(() => {
      const R = (window as any).__RENDERER__;
      const G = (window as any).__GAME__;
      const beforeFlip = R.isViewFlipped();
      R.toggleBoardFlip();
      return {
        beforeFlip,
        flipped: R.isViewFlipped(),
        rendererColor: R.getPlayerColor(),
        gameColor: G.getState().playerColor,
        moveCount: G.getMoveCount(),
      };
    });
    await page.waitForTimeout(200);

    // Verify board invariants still hold after flip
    const bugs = await validateBoard(page, 'post-flip mid-game');
    expect(bugs).toHaveLength(0);

    console.log('[Flip Gameplay] State:', JSON.stringify(state));
    expect(state.flipped, 'Should be flipped after toggle').toBe(!state.beforeFlip);
    const expected = state.gameColor === 'white' ? 'black' : 'white';
    expect(state.rendererColor).toBe(expected);

    // Play 2 more turns while flipped — should still work
    for (let i = 0; i < 2; i++) {
      const { gameOver } = await playOneTurn(page);
      if (gameOver) break;
    }

    const bugsAfter = await validateBoard(page, 'post-flip gameplay');
    expect(bugsAfter).toHaveLength(0);
    expect(pe).toHaveLength(0);
  });

  test('Turn indicator matches game state', async ({ page }) => {
    test.setTimeout(90_000);

    await waitForBoard(page);
    test.skip(!(await hasGameAPI(page)), 'No API');

    for (let i = 0; i < 3; i++) {
      // Check turn indicator BEFORE each player move
      const turnCheck = await page.evaluate(() => {
        const G = (window as any).__GAME__;
        const st = G.getState();
        return { turn: G.getCurrentTurn(), playerColor: st.playerColor, gameOver: st.gameOver };
      });

      if (turnCheck.gameOver) break;

      const turnText = await page.locator('#sidebar-turn').textContent();
      const turnLower = (turnText ?? '').toLowerCase();

      // The sidebar should mention whose turn it is
      if (turnCheck.turn === 'white') {
        expect(turnLower, `Turn ${i}: sidebar should say white`).toMatch(/white|your/i);
      } else {
        expect(turnLower, `Turn ${i}: sidebar should say black`).toMatch(/black|ai|thinking/i);
      }

      const { gameOver } = await playOneTurn(page);
      if (gameOver) break;
    }
  });

  test('Move changes board state', async ({ page }) => {
    test.setTimeout(60_000);

    await waitForBoard(page);
    test.skip(!(await hasGameAPI(page)), 'No API');

    // Snapshot board before move
    const boardBefore = await page.evaluate(() => {
      const G = (window as any).__GAME__;
      return JSON.stringify(G.getBoard());
    });

    const mc0 = await page.evaluate(() => (window as any).__GAME__.getMoveCount());

    const { moved } = await playOneTurn(page);
    if (!moved) return; // game was already over

    // Board must differ after a move
    const boardAfter = await page.evaluate(() => {
      const G = (window as any).__GAME__;
      return JSON.stringify(G.getBoard());
    });

    const mc1 = await page.evaluate(() => (window as any).__GAME__.getMoveCount());

    expect(boardAfter, 'Board should change after a move').not.toBe(boardBefore);
    expect(mc1, 'Move count should increase').toBeGreaterThan(mc0);
  });

  test('Undo restores exact board state', async ({ page }) => {
    test.setTimeout(90_000);

    await waitForBoard(page);
    test.skip(!(await hasGameAPI(page)), 'No API');

    // Snapshot starting board
    const startBoard = await page.evaluate(() => JSON.stringify((window as any).__GAME__.getBoard()));

    // Play 2 turns, then undo all
    for (let i = 0; i < 2; i++) {
      const { gameOver } = await playOneTurn(page);
      if (gameOver) break;
    }

    // Undo everything
    await page.evaluate(() => {
      const G = (window as any).__GAME__;
      for (let i = 0; i < 20; i++) if (!G.undoMove()) break;
    });
    await page.waitForTimeout(300);

    const undoneBoard = await page.evaluate(() => JSON.stringify((window as any).__GAME__.getBoard()));
    const mc = await page.evaluate(() => (window as any).__GAME__.getMoveCount());

    expect(undoneBoard, 'Board should match starting position after full undo').toBe(startBoard);
    expect(mc).toBe(0);
  });
});
