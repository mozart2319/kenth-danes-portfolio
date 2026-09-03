// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Certifications section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#certifications').scrollIntoViewIfNeeded();
  });

  test('renders 8 certification cards', async ({ page }) => {
    await expect(page.locator('.cert-card')).toHaveCount(8);
  });

  test('all cert thumbnails load without broken images', async ({ page }) => {
    const thumbs = page.locator('.cert-thumb img');
    await expect(thumbs).toHaveCount(8);
    for (const img of await thumbs.all()) {
      await img.evaluate((el) => {
        if (el.complete && el.naturalWidth === 0) throw new Error('Broken image: ' + el.src);
      });
    }
  });

  test('each cert has issuer, title and meta', async ({ page }) => {
    for (const card of await page.locator('.cert-card').all()) {
      await expect(card.locator('.cert-logo')).not.toBeEmpty();
      await expect(card.locator('h3')).not.toBeEmpty();
      await expect(card.locator('.cert-meta')).not.toBeEmpty();
    }
  });
});
