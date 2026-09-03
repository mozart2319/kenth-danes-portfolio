// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('About section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#about').scrollIntoViewIfNeeded();
  });

  test('renders the quick list (education, location, languages)', async ({ page }) => {
    const quickItems = page.locator('.quick-item');
    await expect(quickItems).toHaveCount(3);
    await expect(page.locator('#about')).toContainText('Education');
    await expect(page.locator('#about')).toContainText('Location');
    await expect(page.locator('#about')).toContainText('Languages');
  });

  test('renders 4 experience timeline entries with role/org/date', async ({ page }) => {
    const items = page.locator('.timeline li');
    await expect(items).toHaveCount(4);
    for (const item of await items.all()) {
      await expect(item.locator('.timeline-role')).not.toBeEmpty();
      await expect(item.locator('.timeline-org')).not.toBeEmpty();
      await expect(item.locator('.timeline-date')).not.toBeEmpty();
      await expect(item.locator('.timeline-desc')).not.toBeEmpty();
    }
  });
});
