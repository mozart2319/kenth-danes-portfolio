// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Project / cert lightbox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens project lightbox with correct image and caption', async ({ page }) => {
    const first = page.locator('.project-thumb[data-lightbox]').first();
    const caption = await first.getAttribute('data-lightbox-caption');
    await first.click();

    const lightbox = page.locator('#projectLightbox');
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator('.lightbox-img')).toHaveAttribute('src', await first.getAttribute('href'));
    await expect(lightbox.locator('.lightbox-caption')).toHaveText(caption);
  });

  test('locks body scroll while open', async ({ page }) => {
    await page.locator('.project-thumb[data-lightbox]').first().click();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('hidden');
  });

  test('closes via close button and restores scroll', async ({ page }) => {
    await page.locator('.project-thumb[data-lightbox]').first().click();
    await page.locator('.lightbox-close').click();
    await expect(page.locator('#projectLightbox')).not.toBeVisible();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('');
  });

  test('closes via backdrop click', async ({ page }) => {
    await page.locator('.project-thumb[data-lightbox]').first().click();
    await page.locator('.lightbox-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#projectLightbox')).not.toBeVisible();
  });

  test('closes via Escape key', async ({ page }) => {
    await page.locator('.project-thumb[data-lightbox]').first().click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#projectLightbox')).not.toBeVisible();
  });

  test('focus returns to the triggering thumbnail after close', async ({ page }) => {
    const first = page.locator('.project-thumb[data-lightbox]').first();
    await first.click();
    await page.keyboard.press('Escape');
    await expect(first).toBeFocused();
  });

  test('shows external link only for the project that has one (Melanie Sastado)', async ({ page }) => {
    // Melanie project card (4th) has data-lightbox-external
    const melanie = page.locator('.project-card').nth(3);
    const link = melanie.locator('[data-lightbox-external]');
    await expect(link).toHaveCount(1);

    // No other project thumb should have an external ref
    const others = page.locator('.project-thumb[data-lightbox]').nth(0);
    await expect(others).toHaveCount(1);
    const hasExternal = await others.getAttribute('data-lightbox-external');
    expect(hasExternal).toBeNull();

    // Open Melanie's -> link visible; others -> hidden
    await melanie.locator('[data-lightbox]').click();
    await expect(page.locator('.lightbox-link')).toHaveClass(/visible/);

    await page.keyboard.press('Escape');
    await page.locator('.project-thumb[data-lightbox]').first().click();
    await expect(page.locator('.lightbox-link')).not.toHaveClass(/visible/);
  });

  test('cert thumbnail opens lightbox', async ({ page }) => {
    const cert = page.locator('.cert-card[data-lightbox]').first();
    await cert.click();
    await expect(page.locator('#projectLightbox')).toBeVisible();
    await expect(page.locator('.lightbox-img')).toHaveAttribute('src', await cert.getAttribute('href'));
  });
});
