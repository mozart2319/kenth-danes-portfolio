// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Mobile navigation', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    await page.goto('/');
  });

  test('hamburger toggles the menu and updates aria-expanded', async ({ page }) => {
    const toggle = page.locator('#navToggle');
    const nav = page.locator('#mainNav');
    await expect(toggle).toBeVisible();
    await expect(nav).not.toHaveClass(/open/);

    await toggle.click();
    await expect(nav).toHaveClass(/open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.click();
    await expect(nav).not.toHaveClass(/open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('menu closes after clicking a nav link', async ({ page }) => {
    const nav = page.locator('#mainNav');
    await page.locator('#navToggle').click();
    await expect(nav).toHaveClass(/open/);

    await nav.getByRole('link', { name: 'Projects' }).click();
    await expect(nav).not.toHaveClass(/open/);
    await expect(page.locator('#projects')).toBeInViewport();
  });
});
