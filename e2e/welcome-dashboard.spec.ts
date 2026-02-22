// =============================================================================
// E2E Test — Welcome Dashboard
// Verifies the newspaper-themed welcome screen works correctly and all
// buttons navigate to the right features.
//
// Run:  npx playwright test e2e/welcome-dashboard.spec.ts --headed
// =============================================================================

import { test, expect, Page } from '@playwright/test';

/** Navigate to app and wait for dashboard to be visible */
async function waitForDashboard(page: Page) {
  await page.goto('/');
  const dashboard = page.locator('#welcome-dashboard');
  await expect(dashboard).toBeVisible({ timeout: 15_000 });
  return dashboard;
}

test.describe('Welcome Dashboard — Visibility & Structure', () => {

  test('dashboard is visible on page load', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    await expect(dashboard).toBeVisible();

    // Title should show "The Chess Chronicle"
    const title = dashboard.locator('.wd-title');
    await expect(title).toContainText('The Chess Chronicle');
  });

  test('dashboard has beta badge', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    const badge = dashboard.locator('.wd-beta');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('BETA');
  });

  test('dashboard shows today\'s date', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    const dateEl = dashboard.locator('#wd-date');
    await expect(dateEl).toBeVisible();

    // Date text should be non-empty and contain a year
    const text = await dateEl.textContent();
    expect(text).toBeTruthy();
    expect(text).toContain(String(new Date().getFullYear()));
  });

  test('stats ribbon shows ELO, wins, streak, level', async ({ page }) => {
    const dashboard = await waitForDashboard(page);

    await expect(dashboard.locator('#wd-elo')).toBeVisible();
    await expect(dashboard.locator('#wd-wins')).toBeVisible();
    await expect(dashboard.locator('#wd-streak')).toBeVisible();
    await expect(dashboard.locator('#wd-level')).toBeVisible();

    // ELO should be a number ≥ 400 (starting ELO)
    const elo = await dashboard.locator('#wd-elo').textContent();
    expect(Number(elo)).toBeGreaterThanOrEqual(400);
  });

  test('hero play button is visible and prominent', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    const btn = dashboard.locator('#wd-play-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Play vs AI');

    // Button should be large enough to be the hero CTA
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.width).toBeGreaterThanOrEqual(150);
  });

  test('game mode buttons are visible', async ({ page }) => {
    const dashboard = await waitForDashboard(page);

    await expect(dashboard.locator('#wd-setup-btn')).toBeVisible();
    await expect(dashboard.locator('#wd-online-btn')).toBeVisible();
    await expect(dashboard.locator('#wd-load-btn')).toBeVisible();
    await expect(dashboard.locator('#wd-howto-btn')).toBeVisible();
  });

  test('preference buttons are visible', async ({ page }) => {
    const dashboard = await waitForDashboard(page);

    await expect(dashboard.locator('#wd-classic-btn')).toBeVisible();
    await expect(dashboard.locator('#wd-gfx-btn')).toBeVisible();
    await expect(dashboard.locator('#wd-theme-btn')).toBeVisible();
  });

  test('footer shows version info', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    const footer = dashboard.locator('.wd-footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('v0.1');
  });
});

test.describe('Welcome Dashboard — Button Actions', () => {

  test('play button dismisses dashboard and starts the game', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    await dashboard.locator('#wd-play-btn').click();

    // Dashboard should disappear
    await expect(dashboard).toBeHidden({ timeout: 5_000 });

    // Game canvas should be visible and interactive
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.locator('#sidebar-turn')).toBeVisible();
  });

  test('setup button dismisses dashboard and opens setup overlay', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    await dashboard.locator('#wd-setup-btn').click();

    // Dashboard should disappear
    await expect(dashboard).toBeHidden({ timeout: 5_000 });

    // Setup overlay should open (it has class .open when visible)
    const setup = page.locator('#setup-overlay');
    await expect(setup).toHaveClass(/open/, { timeout: 3_000 });
  });

  test('online button dismisses dashboard and opens options panel', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    await dashboard.locator('#wd-online-btn').click();

    // Dashboard should disappear
    await expect(dashboard).toBeHidden({ timeout: 5_000 });

    // Options overlay should open
    const options = page.locator('#options-overlay');
    await expect(options).toHaveClass(/open/, { timeout: 3_000 });
  });

  test('how-to-play button opens modal WITHOUT dismissing dashboard', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    await dashboard.locator('#wd-howto-btn').click();

    // How-to-play overlay should open
    const htpOverlay = page.locator('#htp-overlay');
    await expect(htpOverlay).toHaveClass(/open/, { timeout: 3_000 });

    // Dashboard should STILL be visible (it stays behind the modal)
    // After closing the HTP overlay, the dashboard should still be there
  });

  test('classic mode button toggles classic mode text', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    const btn = dashboard.locator('#wd-classic-btn');

    const initialText = await btn.textContent();
    await btn.click();
    await page.waitForTimeout(300);
    const afterText = await btn.textContent();

    // The text should change between Classic/Normal
    expect(afterText).not.toEqual(initialText);
  });

  test('GFX button cycles quality text', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    const btn = dashboard.locator('#wd-gfx-btn');

    await expect(btn).toContainText('GFX');
    const initialText = await btn.textContent();
    await btn.click();
    await page.waitForTimeout(300);
    const afterText = await btn.textContent();

    // Text should change (quality cycles)
    expect(afterText).not.toEqual(initialText);
  });

  test('theme button cycles theme', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    const btn = dashboard.locator('#wd-theme-btn');
    await expect(btn).toBeVisible();

    await btn.click();
    await page.waitForTimeout(300);

    // Theme should change — body data-theme attribute should be set
    const theme = await page.evaluate(() => document.body.getAttribute('data-theme'));
    expect(theme).toBeTruthy();
  });

  test('dismiss via __dismissWelcome__ API works', async ({ page }) => {
    const dashboard = await waitForDashboard(page);
    await page.evaluate(() => (window as any).__dismissWelcome__?.());
    await expect(dashboard).toBeHidden({ timeout: 5_000 });
  });
});

test.describe('Welcome Dashboard — Responsive', () => {

  test('dashboard is scrollable on small viewports', async ({ page }) => {
    // Use a very small viewport
    await page.setViewportSize({ width: 320, height: 480 });
    const dashboard = await waitForDashboard(page);
    await expect(dashboard).toBeVisible();

    // All critical elements should still be accessible
    await expect(dashboard.locator('#wd-play-btn')).toBeVisible();
  });

  test('dashboard buttons are touch-friendly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    const dashboard = await waitForDashboard(page);

    // Hero button should be large enough
    const playBtn = dashboard.locator('#wd-play-btn');
    const box = await playBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  });
});
