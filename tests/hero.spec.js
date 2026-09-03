// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Hero section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders name, eyebrow, sub and meta', async ({ page }) => {
    await expect(page.locator('.hero h1')).toContainText('Kenth Daniel Danes');
    await expect(page.locator('.hero .eyebrow')).toBeVisible();
    await expect(page.locator('.hero-sub')).toBeVisible();
    await expect(page.locator('.hero-meta li')).toHaveCount(3);
  });

  test('profile image loads without error', async ({ page }) => {
    const img = page.locator('.hero-image-frame img');
    await expect(img).toBeVisible();
    const hasContent = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
    expect(hasContent).toBe(true);
  });

  test('CTA buttons link correctly', async ({ page }) => {
    await expect(page.locator('.hero-actions .btn-primary')).toHaveAttribute('href', '#contact');
    await expect(page.locator('.hero-actions .btn-ghost')).toHaveAttribute('href', '#projects');
  });

  test('hero stats display', async ({ page }) => {
    await expect(page.locator('.hero-card-stats .stat')).toHaveCount(3);
    await expect(page.locator('.hero-card-stats')).toContainText('Certifications');
  });

  test('hero background elements present', async ({ page }) => {
    await expect(page.locator('.hero-bg')).toHaveCount(1);
  });
});
