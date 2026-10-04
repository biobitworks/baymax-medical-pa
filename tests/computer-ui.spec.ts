import { expect, test, type Page } from '@playwright/test';

async function computer(page: Page, enabled = true, timedOut = false, takeOver = true, otherOwner = false) {
  const actions: Record<string, unknown>[] = [];
  let running = false;
  let controlOwner: 'baymax' | 'user' = otherOwner ? 'user' : 'baymax';
  let isOwner = false;
  let session: { id: string; title: string; url: string; status: string } | undefined;
  let fileText = 'Hello from the workspace';
  const receipts: Record<string, unknown>[] = [];
  await page.route('**/conversations', r => r.fulfill({ json: [] }));
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
    if (path.endsWith('/control')) {
      const owner = request.postDataJSON().owner;
      expect(['user', 'baymax']).toContain(owner);
      controlOwner = owner; isOwner = owner === 'user';
      return route.fulfill({ json: { owner: controlOwner, isOwner, expiresAt: isOwner ? Date.now() + 300000 : undefined } });
    }
    if (path.endsWith('/status')) return route.fulfill({ json: { enabled: true, control: { owner: controlOwner, isOwner, expiresAt: isOwner ? Date.now() + 300000 : undefined }, terminal: { state: running ? 'running' : 'stopped' }, browser: { configured: true, session }, receipts } });
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
  if (enabled && takeOver) await page.getByRole('button', { name: 'Take over', exact: true }).click();
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
  await page.screenshot({ path: testInfo.outputPath('computer-desktop.png'), fullPage: true, scale: 'css' });
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
  await page.getByText('Browser controls', { exact: true }).click();
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


test('watch the computer, take over without starting terminal, and return control', async ({ page }, testInfo) => {
  const actions = await computer(page, true, false, false);
  await expect(page.getByText('Baymax has control', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Explore the web' })).toBeDisabled();
  await expect(page.locator('.computer-frame')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('computer-welcome-desktop.png'), fullPage: true, scale: 'css' });
  await page.getByRole('button', { name: 'Take over', exact: true }).click();
  await expect(page.getByText('You have control', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeEnabled();
  expect(actions.filter(action => action.action === 'start')).toHaveLength(0);
  await page.getByRole('button', { name: 'Return control', exact: true }).click();
  await expect(page.getByText('Baymax has control', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'Terminal' }).click();
  await expect(page.getByRole('button', { name: 'Start computer' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Run command' })).toBeDisabled();
  await page.getByRole('tab', { name: 'Browser' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.computer-frame')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('computer-welcome-mobile.png'), fullPage: true, scale: 'css' });
});

test('another session holding control stays read only', async ({ page }) => {
  await computer(page, true, false, false, true);
  await expect(page.getByText('Another session has control', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take over', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Return control', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeDisabled();
});

test('lease renewal requires recent activity and stops while the mobile computer is hidden', async ({ page }) => {
  await page.clock.install();
  const renewals: unknown[] = [];
  let polls = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/computer/status') polls++;
    if (new URL(request.url()).pathname === '/computer/control' && request.postDataJSON()?.renew) renewals.push(request.postDataJSON());
  });
  await computer(page);
  await page.clock.runFor(1000);
  await page.getByLabel('Browser address').click();
  await page.getByLabel('Browser address').fill('https://example.com/first-activity');
  await page.clock.runFor(60000);
  await expect.poll(() => renewals.length).toBe(1);
  expect(renewals[0]).toEqual({ owner: 'user', renew: true });
  await page.clock.fastForward(300000);
  expect(renewals).toHaveLength(1);
  await page.getByLabel('Browser address').click();
  await page.getByLabel('Browser address').fill('https://example.com/draft');
  await page.clock.runFor(60000);
  await expect.poll(() => renewals.length).toBe(2);
  await expect(page.getByLabel('Browser address')).toHaveValue('https://example.com/draft');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('group', { name: 'Workspace view' }).getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Baymax computer' })).not.toBeVisible();
  const hiddenPolls = polls;
  await page.clock.runFor(60000);
  expect(polls).toBe(hiddenPolls);
  expect(renewals).toHaveLength(2);
});

test('unfinished or failed handoff blocks mutations and allows explicit retry', async ({ page }) => {
  await computer(page, true, false, false);
  let transitioning = true;
  let settled = false;
  await page.route('**/computer/status', route => route.fulfill({ json: {
    enabled: true, control: { owner: 'user', isOwner: true, transitioning, error: !transitioning && !settled ? 'Browser handoff failed. Try again.' : undefined },
    terminal: { state: 'stopped' }, browser: { configured: true }, receipts: [],
  } }));
  await page.getByRole('tab', { name: 'Terminal' }).click();
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await expect(page.getByText('Finishing handoff…', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start computer' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Take over', exact: true })).toBeDisabled();
  transitioning = false;
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await expect(page.getByRole('alert')).toContainText('Browser handoff failed');
  await expect(page.getByRole('button', { name: 'Start computer' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Return control' })).toHaveCount(0);
  settled = true;
  await page.getByRole('button', { name: 'Take over', exact: true }).click();
  await expect(page.getByText('You have control', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start computer' })).toBeEnabled();
});

test('chat draft survives switching mobile workspace views and desktop shows both panes', async ({ page }) => {
  await computer(page, true, false, false);
  await page.setViewportSize({ width: 390, height: 844 });
  const switcher = page.getByRole('group', { name: 'Workspace view' });
  await switcher.getByRole('button', { name: 'Chat', exact: true }).click();
  const composer = page.getByPlaceholder('Tell Baymax what you need…');
  await composer.fill('Keep this draft while I check the computer');
  await switcher.getByRole('button', { name: 'Computer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Baymax computer' })).toBeVisible();
  await switcher.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(composer).toHaveValue('Keep this draft while I check the computer');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(composer).toBeVisible();
  await expect(page.getByRole('region', { name: 'Baymax computer' })).toBeVisible();
});
