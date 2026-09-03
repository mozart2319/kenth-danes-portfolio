// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Projects section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#projects').scrollIntoViewIfNeeded();
  });

  test('renders 4 project cards', async ({ page }) => {
    await expect(page.locator('.project-card')).toHaveCount(4);
  });

  test('all project thumbnails load without broken images', async ({ page }) => {
    const thumbs = page.locator('.project-thumb img');
    await expect(thumbs).toHaveCount(4);
    for (const img of await thumbs.all()) {
      await img.evaluate((el) => {
        if (el.complete && el.naturalWidth === 0) throw new Error('Broken image: ' + el.src);
      });
    }
  });

  test('each project has title, description, tag and tools', async ({ page }) => {
    for (const card of await page.locator('.project-card').all()) {
      await expect(card.locator('h3')).not.toBeEmpty();
      await expect(card.locator('.project-tag')).not.toBeEmpty();
      await expect(card.locator('.project-tools li').first()).toBeVisible();
      await expect(card.locator('p')).not.toBeEmpty();
    }
  });
});
