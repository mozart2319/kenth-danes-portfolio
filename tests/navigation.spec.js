// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Navigation', () => {
  test('header nav links are present', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('.main-nav');
    for (const label of ['About', 'Skills', 'Projects', 'Certifications', 'Contact']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('nav links scroll to correct sections', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop-only test (mobile nav covered in navigation-mobile.spec.js)');
    await page.goto('/');
    const targets = {
      'About': '#about',
      'Skills': '#skills',
      'Projects': '#projects',
      'Certifications': '#certifications',
      'Contact': '#contact',
    };
    for (const [label, id] of Object.entries(targets)) {
      const link = page.locator('.main-nav').getByRole('link', { name: label, exact: true });
      await link.scrollIntoViewIfNeeded();
      await link.click();
      const inView = await page.locator(id).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0;
      });
      expect(inView, `section ${id} should be scrolled into view after clicking ${label}`).toBe(true);
    }
  });

  test('nav CTA links to contact', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('.nav-cta');
    await expect(cta).toHaveAttribute('href', '#contact');
  });

  test('logo links back to top', async ({ page }) => {
    await page.goto('/');
    await page.mouse.wheel(0, 1200);
    const logo = page.locator('.site-header .logo');
    await expect(logo).toHaveAttribute('href', '#top');
    await logo.click();
    await expect(page).toHaveURL(/#top/);
  });
});
