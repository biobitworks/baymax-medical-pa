import { expect, test, type Page } from '@playwright/test';

async function computer(page: Page, enabled = true, timedOut = false) {
  const actions: Record<string, unknown>[] = [];
  let running = false;
  let session: { id: string; title: string; url: string; status: string } | undefined;
  let fileText = 'Hello from the workspace';
  const receipts: Record<string, unknown>[] = [];
  await page.route('**/care-state', r => r.fulfill({ json: { state: null, revision: 0 } }));
  await page.route('**/health/preferences', r => r.fulfill({ json: { name: 'Test', onboarded: true, goals: { steps: 5000, activeMinutes: 20 }, notifications: 'off' } }));
  await page.route('**/computer/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/session') && request.method() === 'DELETE') {
      expect(request.headers().authorization).toBe('Bearer test-capability');
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/session')) {
      expect(request.headers().authorization).toBe('Bearer private-test-key');
      return route.fulfill({ status: enabled ? 200 : 503, json: enabled ? { capability: 'test-capability', expiresAt: Date.now() + 3600000 } : { error: 'Computer is disabled. Configure BAYMAX_COMPUTER_ENABLED.' } });
    }
    expect(request.headers().authorization).toBe('Bearer test-capability');
    if (path.endsWith('/status')) return route.fulfill({ json: { enabled: true, terminal: { state: running ? 'running' : 'stopped' }, browser: { configured: true, session }, receipts } });
    if (path.endsWith('/screenshot')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1sAAAAASUVORK5CYII=', 'base64') });
    const action = request.postDataJSON();
    actions.push(action);
    if (action.action === 'start') { running = true; return route.fulfill({ json: { state: 'running' } }); }
    if (action.action === 'stop') { running = false; return route.fulfill({ json: { state: 'stopped' } }); }
    if (action.action === 'command') {
      const receipt = { id: 'receipt-1', command: action.command, cwd: '/workspace', stdout: 'hello\n', stderr: '', exitCode: timedOut ? null : 0, timedOut, interrupted: false, truncated: false, createdAt: new Date().toISOString() };
      receipts.push(receipt);
      if (timedOut) running = false;
      return route.fulfill({ json: receipt });
    }
    if (action.action === 'browse') { session = { id: 'browser-1', title: 'Example page', url: action.url, status: 'active' }; return route.fulfill({ json: session }); }
    if (action.action === 'browser-read') return route.fulfill({ json: { title: 'Example page', url: session?.url, text: 'Readable page content', truncated: false } });
    if (action.action === 'browser-close') { session = undefined; return route.fulfill({ json: {} }); }
    if (action.action === 'list') return route.fulfill({ json: { path: '/workspace', entries: [{ name: 'note.txt', path: '/workspace/note.txt', type: 'file', size: 24 }] } });
    if (action.action === 'read') return route.fulfill({ json: { path: action.path, text: fileText } });
    if (action.action === 'write') { fileText = action.text; return route.fulfill({ json: { path: action.path } }); }
    return route.fulfill({ json: {} });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: /^Computer$/ }).click();
  await page.getByLabel('Computer access key').fill('private-test-key');
  await page.getByRole('button', { name: 'Unlock computer' }).click();
  return actions;
}

test('unlock, run an isolated command, and lock without persisting credentials', async ({ page }, testInfo) => {
  const actions = await computer(page);
  await page.getByRole('tab', { name: 'Terminal' }).click();
  await page.getByRole('button', { name: 'Start computer' }).click();
  await page.getByLabel('Terminal command').fill('printf hello');
  await page.getByRole('button', { name: 'Run command' }).click();
  await expect(page.getByText('hello', { exact: true })).toBeVisible();
  expect(actions.find(a => a.action === 'command')).toMatchObject({ command: 'printf hello', cwd: '/workspace' });
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain('private-test-key');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('heading', { name: 'Baymax’s computer' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('computer-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Lock computer' }).click();
  await expect(page.getByLabel('Computer access key')).toBeVisible();
});

test('browse and save workspace files', async ({ page }) => {
  const actions = await computer(page);
  await page.getByRole('tab', { name: 'Files' }).click();
  await page.getByRole('button', { name: 'Start computer' }).click();
  await page.getByRole('button', { name: 'Open note.txt' }).click();
  await expect(page.getByLabel('File contents')).toHaveValue('Hello from the workspace');
  await page.getByLabel('File contents').fill('Saved text');
  await page.getByRole('button', { name: 'Save file' }).click();
  await expect(page.getByRole('region', { name: 'Baymax computer' }).getByRole('status')).toContainText('File saved');
  expect(actions.find(a => a.action === 'write')).toMatchObject({ path: '/workspace/note.txt', text: 'Saved text' });
});

test('disabled computer reports setup error and stays locked', async ({ page }) => {
  await computer(page, false);
  await expect(page.getByRole('alert')).toContainText('Computer is disabled');
  await expect(page.getByLabel('Computer access key')).toBeVisible();
});


test('browser controls use the shared session and authorized screenshot', async ({ page }) => {
  const actions = await computer(page);
  await page.getByLabel('Browser address').fill('https://example.com');
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  const screenshot = page.getByRole('button', { name: 'Browser screenshot, click to interact' });
  await expect(screenshot).toBeVisible();
  expect(await screenshot.locator('img').getAttribute('src')).toMatch(/^blob:/);
  const bounds = (await screenshot.boundingBox())!;
  await screenshot.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
  await page.getByLabel('Text to type').fill('Shared browser text');
  await page.getByRole('button', { name: 'Type text' }).click();
  await page.getByRole('button', { name: 'Read page' }).click();
  await expect(page.getByText('Readable page content')).toBeVisible();
  expect(actions.find(a => a.action === 'browser-input')).toMatchObject({ input: { type: 'click', x: expect.any(Number), y: expect.any(Number) } });
  expect(actions).toContainEqual({ action: 'browser-input', input: { type: 'type', text: 'Shared browser text' } });
  await page.getByRole('button', { name: 'Close browser' }).click();
  await expect(screenshot).not.toBeVisible();
});


test('timed-out commands reconcile stopped state without replaying', async ({ page }) => {
  const actions = await computer(page, true, true);
  await page.getByRole('tab', { name: 'Terminal' }).click();
  await page.getByRole('button', { name: 'Start computer' }).click();
  await page.getByLabel('Terminal command').fill('sleep 60');
  await page.getByRole('button', { name: 'Run command' }).click();
  await expect(page.getByText('Timed out', { exact: true })).toBeVisible();
  await expect(page.getByText('Terminal stopped', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start computer' })).toBeEnabled();
  expect(actions.filter(action => action.action === 'command')).toHaveLength(1);
});
