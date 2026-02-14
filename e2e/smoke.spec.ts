// =============================================================================
// E2E Test — Smoke test: app loads, canvas renders, sidebar interactive
// Run: npx playwright test
// =============================================================================

import { test, expect } from '@playwright/test';

test.describe('Chess Chronicle — Smoke Tests', () => {

  test('app loads with title, canvas, and sidebar', async ({ page }) => {
    await page.goto('/');

    // Title renders
    await expect(page).toHaveTitle('The Chess Chronicle');

    // Newspaper header visible
    const header = page.locator('h1', { hasText: 'The Chess Chronicle' });
    await expect(header).toBeVisible();

    // Game canvas is present and has non-zero dimensions
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    // Sidebar controls exist
    await expect(page.locator('#sidebar-turn')).toBeVisible();
    await expect(page.locator('#undo-btn')).toBeVisible();
  });

  test('canvas responds to click (piece selection)', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Click roughly where a white pawn should be (bottom-left area of the board)
    // The exact coordinates depend on board layout, but clicking the canvas
    // should not crash the app
    await canvas.click({ position: { x: box!.width * 0.2, y: box!.height * 0.75 } });

    // App should still be functional after click — canvas still visible, no crash
    await expect(canvas).toBeVisible();

    // The turn indicator should still show (game didn't crash)
    await expect(page.locator('#sidebar-turn')).toBeVisible();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForTimeout(2000); // Let the app fully initialize

    // Filter out known non-critical warnings (e.g., service worker, font loading)
    const critical = errors.filter(e =>
      !e.includes('service-worker') &&
      !e.includes('manifest') &&
      !e.includes('favicon')
    );

    expect(critical).toHaveLength(0);
  });

  test('newspaper articles load', async ({ page }) => {
    await page.goto('/');

    // Wait for article headlines to populate (they start as "Loading...")
    const headline = page.locator('#article-1-headline');
    await expect(headline).toBeVisible();

    // After initialization, the headline should have real content
    await expect(headline).not.toHaveText('Loading...', { timeout: 5000 });
  });

});
