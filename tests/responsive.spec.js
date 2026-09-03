// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Responsive layout', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only layout tests');
    await page.goto('/');
  });

  test('no horizontal overflow on mobile', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('headings and key content are visible', async ({ page }) => {
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.locator('.hero-sub')).toBeVisible();
    await expect(page.locator('#skills .section-title')).toBeVisible();
  });

  test('hero stacks content vertically (single column)', async ({ page }) => {
    const textBox = await page.locator('.hero-text').boundingBox();
    const imageBox = await page.locator('.hero-image-wrapper').boundingBox();
    expect(textBox).toBeTruthy();
    expect(imageBox).toBeTruthy();
    // image is order:1 (top), text order:2 (below) on mobile
    expect(imageBox.y).toBeLessThan(textBox.y);
  });
});
