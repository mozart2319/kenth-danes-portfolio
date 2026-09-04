// @ts-check
const { test, expect } = require('@playwright/test');

const TEST_URL = 'https://script.google.com/macros/s/TEST_ID/exec';

async function fillValidForm(page) {
  await page.locator('#name').fill('Jane Doe');
  await page.locator('#email').fill('jane@example.com');
  await page.locator('#topic').selectOption({ label: 'Job Opportunity' });
  await page.locator('#message').fill('This is a valid meeting message.');
}

async function configureMockEndpoint(page, handler) {
  // Inject test config; make time-trap pass (>5s).
  await page.evaluate(
    ({ url }) => {
      window.__setMeetingFormConfig(url, 'test-token-123');
      const filled = document.getElementById('filledAt');
      if (filled) filled.value = String(Date.now() - 8000);
    },
    { url: TEST_URL }
  );
  await page.route('**/macros/s/**/exec', handler);
}

async function submitForm(page) {
  const btn = page.locator('#meetingForm button[type="submit"]');
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
}

test.describe('Contact form validation', () => {
  test.beforeEach(async ({ page }) => {
    // Block IP lookup in tests: deterministic, no external dependency.
    // Missing IP never blocks (server treats it as unknown, email limit applies).
    await page.route('https://api.ipify.org/**', (route) => route.abort('blockedbyclient'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#meetingForm').waitFor({ state: 'visible' });
    await page.locator('#contact').scrollIntoViewIfNeeded();
  });

  test('shows errors for empty required fields', async ({ page }) => {
    await submitForm(page);

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
    await submitForm(page);

    await expect(page.locator('#err-email')).toContainText('valid email');
  });

  test('rejects a too-short message', async ({ page }) => {
    await page.locator('#name').fill('Jane Doe');
    await page.locator('#email').fill('jane@example.com');
    await page.locator('#topic').selectOption({ label: 'Job Opportunity' });
    await page.locator('#message').fill('short');
    await submitForm(page);

    await expect(page.locator('#err-message')).toContainText('10+ characters');
  });

  test('clears errors when fields are corrected', async ({ page }) => {
    await submitForm(page);
    await expect(page.locator('#err-name')).not.toBeEmpty();

    await fillValidForm(page);
    await configureMockEndpoint(page, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await submitForm(page);

    await expect(page.locator('#err-name')).toBeEmpty();
  });

  test('honeypot submission fakes success without network and re-enables button', async ({ page }) => {
    await fillValidForm(page);
    await page.locator('#botField').fill('spam-bot');
    await submitForm(page);

    await expect(page.locator('#formNote')).toContainText('has been sent', { timeout: 5000 });
    await expect(page.locator('#meetingForm button[type="submit"]')).toBeEnabled();
  });

  test('unconfigured form shows setup fallback and re-enables button', async ({ page }) => {
    await page.evaluate(() => {
      window.__setMeetingFormConfig(
        'https://script.google.com/macros/s/REPLACE_WITH_APPS_SCRIPT_ID/exec',
        'REPLACE_WITH_FORM_TOKEN'
      );
    });
    await fillValidForm(page);
    await submitForm(page);

    await expect(page.locator('#formNote')).toContainText('not connected yet', { timeout: 5000 });
    await expect(page.locator('#meetingForm button[type="submit"]')).toBeEnabled();
  });

  test('valid submission via mocked Apps Script succeeds and re-enables button', async ({ page }) => {
    await fillValidForm(page);
    await configureMockEndpoint(page, async (route) => {
      const req = route.request();
      const body = JSON.parse(req.postData() || '{}');
      // No-captcha flow must send token + trap fields, never a recipient or captcha.
      if (!body.formToken || !body.filledAt || body.turnstileToken || body.to || body.recipient) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: 'missing security fields' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await submitForm(page);

    await expect(page.locator('#formNote')).toContainText('has been sent', { timeout: 10000 });
    await expect(page.locator('#meetingForm button[type="submit"]')).toBeEnabled();
  });

  test('daily limit surfaces direct-email warning and re-enables button', async ({ page }) => {
    await fillValidForm(page);
    await configureMockEndpoint(page, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'LIMIT_REACHED' }),
      });
    });

    await submitForm(page);

    await expect(page.locator('#formNote')).toContainText('Daily limit reached', { timeout: 10000 });
    await expect(page.locator('#formNote')).toContainText('email me directly', { timeout: 10000 });
    await expect(page.locator('#meetingForm button[type="submit"]')).toBeEnabled();
  });

  test('network failure shows Gmail fallback and re-enables button', async ({ page }) => {
    await fillValidForm(page);
    await page.evaluate(
      ({ url }) => {
        window.__setMeetingFormConfig(url, 'test-token-123');
        const filled = document.getElementById('filledAt');
        if (filled) filled.value = String(Date.now() - 8000);
      },
      { url: TEST_URL }
    );
    await page.route('**/macros/s/**/exec', async (route) => route.abort('failed'));

    await submitForm(page);

    await expect(page.locator('#formNote')).toContainText('email me directly', { timeout: 10000 });
    await expect(page.locator('#meetingForm button[type="submit"]')).toBeEnabled();
  });
});
