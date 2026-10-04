import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('a new worker waits for consent before reloading the active session', async ({ page }) => {
  let version = 1;
  const root = resolve('dist');
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname;
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + '/')) { res.writeHead(404).end(); return; }
    try {
      const content = await readFile(file);
      const mime = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : file.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      res.end(path === '/sw.js' ? Buffer.concat([content, Buffer.from(`\n// test release ${version}`)]) : content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  try {
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.getByRole('button', { name: /Let’s take care of you/ }).click();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
      document.documentElement.dataset.sessionMarker = 'keep';
    });
    version = 2;
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    await expect(page.getByRole('button', { name: 'Update now' })).toBeVisible();
    await expect(page.getByText(/clears your current session/)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-session-marker', 'keep');
    await expect(page.getByRole('dialog', { name: 'Welcome to Baymax' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Later', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Update now' })).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-session-marker', 'keep');
    await page.reload();
    await page.getByRole('button', { name: /Let’s take care of you/ }).click();
    await expect(page.getByRole('button', { name: 'Update now' })).toBeVisible();
    await page.getByRole('button', { name: 'Update now' }).click();
    await expect(page.getByRole('dialog', { name: 'Welcome to Baymax' })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-session-marker', 'keep');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
