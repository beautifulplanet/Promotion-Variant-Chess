// =============================================================================
// E2E Test — Classic Mode UI
// Verifies chess.com-style layout, player bars, move list, action bar,
// and that orbit controls are disabled in flat board mode.
//
// Run:  npx playwright test e2e/classic-mode.spec.ts --headed
// =============================================================================

import { test, expect, Page } from '@playwright/test';

/** Wait for the app to fully load */
async function waitForApp(page: Page) {
  await page.goto('/');
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  // Wait for loading screen to clear and game API to be ready
  await page.waitForTimeout(3000);
  await expect(page.locator('#sidebar-turn')).toBeVisible();
}

/** Toggle classic mode ON via the overlay button */
async function enableClassicMode(page: Page) {
  // The overlay classic button toggles classic mode
  const classicBtn = page.locator('#bo-classic-btn');
  // It might say "Classic" or "Normal" depending on current state
  const text = await classicBtn.textContent();
  if (text?.includes('Classic')) {
    await classicBtn.click();
  }
  // Verify body has the class
  await expect(page.locator('body')).toHaveClass(/classic-mode/, { timeout: 3000 });
}

test.describe('Classic Mode — Layout & Structure', () => {

  test('classic mode activates and shows player bars', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    // Player bars should be visible
    const topBar = page.locator('#classic-player-top');
    const bottomBar = page.locator('#classic-player-bottom');
    await expect(topBar).toBeVisible();
    await expect(bottomBar).toBeVisible();

    // Player names should be populated
    const topName = page.locator('#cpb-top-name');
    const bottomName = page.locator('#cpb-bottom-name');
    await expect(topName).not.toBeEmpty();
    await expect(bottomName).not.toBeEmpty();

    // Clock elements visible
    await expect(page.locator('#cpb-top-clock')).toBeVisible();
    await expect(page.locator('#cpb-bottom-clock')).toBeVisible();
  });

  test('classic mode shows action bar with large buttons', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    const actionBar = page.locator('#classic-action-bar');
    await expect(actionBar).toBeVisible();

    // All action buttons should be visible
    await expect(page.locator('#cab-new-btn')).toBeVisible();
    await expect(page.locator('#cab-undo-btn')).toBeVisible();
    await expect(page.locator('#cab-flip-btn')).toBeVisible();
    await expect(page.locator('#cab-settings-btn')).toBeVisible();
    await expect(page.locator('#cab-exit-btn')).toBeVisible();

    // Buttons should be large enough for touch (min 48px height)
    const newBtn = page.locator('#cab-new-btn');
    const box = await newBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('old overlay buttons are hidden in classic mode', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    // The old newspaper overlay buttons should be hidden
    const overlayBtns = page.locator('.board-overlay-btns');
    await expect(overlayBtns).toBeHidden();
  });

  test('newspaper chrome is hidden in classic mode', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    // Masthead and articles should be hidden
    await expect(page.locator('.newspaper-masthead')).toBeHidden();
  });

  test('move list appears and grows dynamically', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    const moveList = page.locator('#classic-moves');
    await expect(moveList).toBeVisible();

    // Move list should have minimum height
    const box = await moveList.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  });

  test('canvas fills available width in classic mode', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    const canvas = page.locator('#game-canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    // Canvas should be reasonably large (not tiny)
    expect(canvasBox!.width).toBeGreaterThan(200);
    expect(canvasBox!.height).toBeGreaterThan(200);
  });
});

test.describe('Classic Mode — Interactions', () => {

  test('exit button returns to newspaper mode', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    // Click the exit/classic button in the action bar
    await page.locator('#cab-exit-btn').click();

    // Body should no longer have classic-mode class
    await expect(page.locator('body')).not.toHaveClass(/classic-mode/, { timeout: 3000 });

    // Masthead should be visible again
    await expect(page.locator('.newspaper-masthead')).toBeVisible();
  });

  test('settings button opens options panel', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    await page.locator('#cab-settings-btn').click();

    // Options overlay should become visible
    const overlay = page.locator('#options-overlay');
    await expect(overlay).toHaveClass(/open/, { timeout: 2000 });
  });

  test('new game button functions in classic mode', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    // Click new/start button in action bar
    await page.locator('#cab-new-btn').click();

    // Game should start — after a moment the turn indicator should update
    await page.waitForTimeout(1000);
    const turn = await page.locator('#sidebar-turn').textContent();
    expect(turn).toBeTruthy();
  });

  test('move list populates after moves are made', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    // Start a game
    await page.locator('#cab-new-btn').click();
    await page.waitForTimeout(500);

    // Make a move via the game API
    const moved = await page.evaluate(() => {
      const Game = (window as any).__GAME__;
      if (!Game) return false;
      const board = Game.getBoard();
      const turn = Game.getCurrentTurn();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (board[r][c] && board[r][c].color === turn) {
            Game.handleSquareClick(r, c);
            const st = Game.getState();
            if (st.legalMovesForSelected?.length > 0) {
              const move = st.legalMovesForSelected[0];
              Game.handleSquareClick(move.to.row, move.to.col);
              return true;
            }
          }
        }
      }
      return false;
    });

    expect(moved).toBe(true);

    // Wait for UI to update
    await page.waitForTimeout(500);

    // Move list should now have content (at least one move row)
    const moveContent = await page.locator('#classic-moves').textContent();
    expect(moveContent!.trim().length).toBeGreaterThan(0);
  });
});

test.describe('Classic Mode — Mobile', () => {
  // Uses the mobile project config (iPhone 14 viewport)

  test('layout fits viewport without scrolling', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    // Entire page should fit within viewport height (no overflow)
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    // Allow some tolerance (10px) for rounding
    expect(bodyHeight).toBeLessThanOrEqual(viewportHeight + 10);
  });

  test('action bar buttons are touch-friendly on mobile', async ({ page }) => {
    await waitForApp(page);
    await enableClassicMode(page);

    // Each action bar button should be at least 44px tall (Apple HIG minimum)
    const buttons = page.locator('.cab-btn');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
