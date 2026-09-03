// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Skills section', () => {
  test('renders all 6 skill cards with titles and icons', async ({ page }) => {
    await page.goto('/');
    await page.locator('#skills').scrollIntoViewIfNeeded();

    const cards = page.locator('.skill-card');
    await expect(cards).toHaveCount(6);

    const expected = [
      'Healthcare Records Handling',
      'HIPAA & Compliance Awareness',
      'Data Analytics',
      'Customer & Telecom Support',
      'Team Leadership',
      'Data Entry & QA',
    ];
    for (const title of expected) {
      await expect(cards.filter({ hasText: title })).toHaveCount(1);
    }
    await expect(page.locator('.skill-card .skill-icon')).toHaveCount(6);
  });
});
