// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Contact form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#contact').scrollIntoViewIfNeeded();
  });

  test('shows errors for empty required fields', async ({ page }) => {
    await page.locator('#meetingForm button[type="submit"]').click();

    await expect(page.locator('#err-name')).not.toBeEmpty();
    await expect(page.locator('#err-email')).not.toBeEmpty();
    await expect(page.locator('#err-topic')).not.toBeEmpty();
    await expect(page.locator('#err-message')).not.toBeEmpty();
    await expect(page.locator('#formNote')).toContainText('Please fix');
  });

  test('rejects an invalid email', async ({ page }) => {
    await page.locator('#name').fill('Jane Doe');
    await page.locator('#email').fill('not-an-email');
    await page.locator('#topic').selectOption({ label: 'Job Opportunity' });
    await page.locator('#message').fill('This is a valid meeting message.');
    await page.locator('#meetingForm button[type="submit"]').click();

    await expect(page.locator('#err-email')).toContainText('valid email');
  });

  test('rejects a too-short message', async ({ page }) => {
    await page.locator('#name').fill('Jane Doe');
    await page.locator('#email').fill('jane@example.com');
    await page.locator('#topic').selectOption({ label: 'Job Opportunity' });
    await page.locator('#message').fill('short');
    await page.locator('#meetingForm button[type="submit"]').click();

    await expect(page.locator('#err-message')).toContainText('10+ characters');
  });

  test('clears errors when fields are corrected', async ({ page }) => {
    await page.locator('#meetingForm button[type="submit"]').click();
    await expect(page.locator('#err-name')).not.toBeEmpty();

    await page.locator('#name').fill('Jane Doe');
    await page.locator('#email').fill('jane@example.com');
    await page.locator('#topic').selectOption({ label: 'Job Opportunity' });
    await page.locator('#message').fill('This is a valid meeting message.');
    await page.locator('#meetingForm button[type="submit"]').click();

    await expect(page.locator('#err-name')).toBeEmpty();
  });

  test('valid submission shows Netlify-unavailable fallback locally and re-enables button', async ({ page }) => {
    await page.locator('#name').fill('Jane Doe');
    await page.locator('#email').fill('jane@example.com');
    await page.locator('#topic').selectOption({ label: 'Job Opportunity' });
    await page.locator('#message').fill('This is a valid meeting message.');

    await page.locator('#meetingForm button[type="submit"]').click();

    // Locally there is no Netlify build, so fetch('/') fails -> graceful message expected.
    await expect(page.locator('#formNote')).toContainText('email me directly', { timeout: 10000 });
    await expect(page.locator('#meetingForm button[type="submit"]')).toBeEnabled();
  });
});
