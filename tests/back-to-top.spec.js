// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Back to top & header scroll state', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('back-to-top hidden at top, visible after scroll', async ({ page }) => {
    const btn = page.locator('#backToTop');
    await expect(btn).not.toHaveClass(/visible/);

    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(btn).toHaveClass(/visible/);
  });

  test('back-to-top returns to top and hides', async ({ page }) => {
    const btn = page.locator('#backToTop');
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(btn).toHaveClass(/visible/);

    await btn.click();
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(btn).not.toHaveClass(/visible/);
  });

  test('header gets scrolled class after scrolling and loses it at top', async ({ page }) => {
    const header = page.locator('.site-header');
    await expect(header).not.toHaveClass(/scrolled/);

    await page.evaluate(() => window.scrollTo(0, 300));
    await expect(header).toHaveClass(/scrolled/);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).not.toHaveClass(/scrolled/);
  });
});
