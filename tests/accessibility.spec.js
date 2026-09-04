// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Accessibility checks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('all images have alt text', async ({ page }) => {
    const imgs = page.locator('img');
    const count = await imgs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const alt = await imgs.nth(i).getAttribute('alt');
      expect(alt, `img ${i} should have an alt attribute`).not.toBeNull();
    }
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    // Hidden time-trap input needs no label; honeypot has a wrapping label with for="botField".
    const inputs = page.locator('#meetingForm input[id]:not([type="hidden"]), #meetingForm select[id], #meetingForm textarea[id]');
    const n = await inputs.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const id = await inputs.nth(i).getAttribute('id');
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });

  test('lightbox has proper ARIA attributes', async ({ page }) => {
    const lightbox = page.locator('#projectLightbox');
    await expect(lightbox).toHaveAttribute('role', 'dialog');
    await expect(lightbox).toHaveAttribute('aria-modal', 'true');
    await expect(lightbox).toHaveAttribute('aria-label');
    await expect(lightbox.locator('.lightbox-close')).toHaveAttribute('aria-label');
  });

  test('interactive buttons have accessible labels', async ({ page }) => {
    await expect(page.locator('#navToggle')).toHaveAttribute('aria-label');
    await expect(page.locator('#backToTop')).toHaveAttribute('aria-label');
  });

  test('page has one main landmark and proper heading structure', async ({ page }) => {
    await expect(page.locator('main')).toHaveCount(1);
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThanOrEqual(1);
    const h2 = await page.locator('h2').count();
    expect(h2).toBeGreaterThan(0);
  });
});
