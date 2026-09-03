// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Homepage load & SEO', () => {
  test('loads successfully with no console or page errors', async ({ page }) => {
    const errors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    const response = await page.goto('/');
    expect(response.status()).toBe(200);
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('has a title and meta description', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.trim().length).toBeGreaterThan(0);

    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
    expect(desc.length).toBeGreaterThan(50);
  });

  test.describe('SEO meta tags', () => {
    test('has Open Graph tags', async ({ page }) => {
      await page.goto('/');
      for (const prop of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image']) {
        const el = page.locator(`meta[property="${prop}"]`);
        await expect(el).toHaveCount(1, { timeout: 3000 });
        const content = await el.getAttribute('content');
        expect(content, `og:${prop} content should not be empty`).toBeTruthy();
      }
    });

    test('has Twitter Card tags', async ({ page }) => {
      await page.goto('/');
      for (const name of ['twitter:card', 'twitter:title', 'twitter:description']) {
        const el = page.locator(`meta[name="${name}"]`);
        await expect(el).toHaveCount(1, { timeout: 3000 });
        const content = await el.getAttribute('content');
        expect(content, `${name} content should not be empty`).toBeTruthy();
      }
    });

    test('has a canonical link', async ({ page }) => {
      await page.goto('/');
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1, { timeout: 3000 });
      const href = await canonical.getAttribute('href');
      expect(href).toBeTruthy();
    });

    test('has a robots meta tag', async ({ page }) => {
      await page.goto('/');
      const robots = page.locator('meta[name="robots"]');
      await expect(robots).toHaveCount(1, { timeout: 3000 });
    });

    test('has JSON-LD structured data for a person/organization', async ({ page }) => {
      await page.goto('/');
      const scripts = page.locator('script[type="application/ld+json"]');
      await expect(scripts).toHaveCount(1, { timeout: 3000 });
      const json = JSON.parse(await scripts.first().textContent());
      expect(json['@type']).toBeTruthy();
    });
  });
});
