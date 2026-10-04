import { expect, test, type Page } from '@playwright/test';

async function openApp(page: Page) {
  await page.route('**/care-state', route => route.fulfill({
    json: { state: null, revision: 0 },
  }));
  await page.route('**/health/preferences', route => route.fulfill({
    json: { name: 'Test', onboarded: true, goals: { steps: 5000, activeMinutes: 20 }, notifications: 'off' },
  }));
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Talk', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Message Baymax' })).toBeVisible();
}
async function controlled(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    }
  });
}

test('standalone manifest has working mobile icons', async ({ page, request }) => {
  await page.goto('/');
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestUrl).toBeTruthy();
  const response = await request.get(manifestUrl!);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('/');
  expect(manifest.start_url).toBe('/');
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
});

test('offline navigation shows reconnect screen and reconnect returns to the app', async ({ page, context }) => {
  await openApp(page);
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A little care, when you reconnect.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Talk', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Message Baymax' })).toBeVisible();
});

test('worker does not cache API or travel responses or hide failed requests', async ({ page, context }) => {
  await openApp(page);
  await controlled(page);
  const sensitive = ['/api/profile?patient=test', '/travel?city=test'];
  const sensitiveRoute = /\/(?:api\/|travel\?)/;
  await page.route(sensitiveRoute, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ syntheticProfile: 'test-only' }) }));
  await page.evaluate(async paths => {
    for (const path of paths) await fetch(path);
  }, sensitive);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(r => r.url)))).flat();
  });
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.every(url => !url.includes('/api/') && !url.includes('/travel'))).toBe(true);
  await page.unroute(sensitiveRoute);
  await context.setOffline(true);
  for (const path of sensitive) {
    expect(await page.evaluate(async path => {
      try { await fetch(path); return 'succeeded'; } catch { return 'failed'; }
    }, path)).toBe('failed');
  }
});

test('install control uses browser prompt and hides after installation', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => { document.documentElement.dataset.installPrompt = 'shown'; },
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    window.dispatchEvent(event);
  });
  const banner = await page.getByRole('complementary', { name: 'Install Baymax on your device' }).boundingBox();
  const composer = await page.getByRole('textbox', { name: 'Message Baymax' }).boundingBox();
  expect(banner!.y + banner!.height).toBeLessThan(composer!.y);
  await page.getByRole('button', { name: 'Install Baymax', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-install-prompt', 'shown');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByRole('button', { name: 'Install Baymax', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('iPhone users see manual installation instructions', async ({ browser }) => {
  const context = await browser.newContext({ ...({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' }), baseURL: 'http://localhost:4178' });
  const page = await context.newPage();
  await openApp(page);
  await page.getByRole('button', { name: 'Install Baymax', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Install Baymax' })).toBeVisible();
  await expect(page.getByText(/Add to Home Screen/)).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Install Baymax' })).toHaveCount(0);
  await context.close();
});

test('a rejected install prompt gives a recovery message', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => { throw new Error('browser rejected prompt'); }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  await page.getByRole('button', { name: 'Install Baymax', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Installation couldn’t open.' })).toBeVisible();
});

test('notification replay serves the static demo and completes all three simulated actions', async ({ page }) => {
  const response = await page.goto('/demo/notifications.html?record=1');
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Small steps. Big Baymax energy.' })).toBeVisible();
  for (const [kind, cta, success] of [
    ['meds', 'Mark as taken', 'Medication checked off.'],
    ['refill', 'Prepare refill request', 'Your refill request is ready.'],
    ['exercise', 'Start my walk', 'Your walk has started.'],
  ]) {
    await page.evaluate(kind => {
      (window as unknown as { baymaxNotificationDemo: { showNotification(kind: string): void } }).baymaxNotificationDemo.showNotification(kind);
    }, kind);
    await page.locator(`[data-open="${kind}"]`).click();
    await page.getByRole('button', { name: cta, exact: true }).click();
    await expect(page.locator('#result')).toContainText(success);
    await page.getByRole('button', { name: 'Reminders', exact: true }).click();
  }
});
