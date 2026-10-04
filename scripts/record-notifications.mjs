import { chromium } from '@playwright/test';
import { mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const base = process.env.BAYMAX_DEMO_URL || 'http://localhost:4181';
await mkdir('docs/media', { recursive: true });
const temp = '/tmp/baymax-notification-video';
await mkdir(temp, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 540, height: 1020 }, deviceScaleFactor: 1, recordVideo: { dir: temp, size: { width: 540, height: 1020 } } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(`${base}/demo/notifications.html?record=1`);
await page.locator('.phone').waitFor();
const pause = ms => page.waitForTimeout(ms);
await pause(900);
for (const kind of ['meds', 'refill', 'exercise']) {
  await page.evaluate(kind => window.baymaxNotificationDemo.showNotification(kind), kind);
  await pause(2400);
}
assert.equal(await page.locator('.notification').count(), 3);
const last = await page.locator('[data-open="exercise"]').boundingBox();
const phone = await page.locator('.phone').boundingBox();
assert(last.y + last.height < phone.y + phone.height - 35, 'All reminder actions must fit on the lock screen');
await page.screenshot({ path: 'docs/media/mobile-notifications.png' });
for (const [kind, cta, success] of [
  ['meds', 'Mark as taken', 'Medication checked off.'],
  ['refill', 'Prepare refill request', 'Your refill request is ready.'],
  ['exercise', 'Start my walk', 'Your walk has started.'],
]) {
  await page.locator(`[data-open="${kind}"]`).click();
  await pause(1600);
  await page.getByRole('button', { name: cta, exact: true }).click();
  assert((await page.locator('#result').innerText()).includes(success));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await pause(1900);
  await page.getByRole('button', { name: 'Reminders', exact: true }).click();
  await pause(600);
}
await pause(1200);
assert.deepEqual(errors, []);
const video = page.video();
await context.close();
const raw = await video.path();
await browser.close();
execFileSync('ffmpeg', ['-y', '-i', raw, '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'docs/media/mobile-notifications.mp4'], { stdio: 'pipe' });
execFileSync('ffmpeg', ['-y', '-i', raw, '-filter_complex', '[0:v]fps=8,scale=432:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', 'docs/media/mobile-notifications.gif'], { stdio: 'pipe' });
await rm(raw);
console.log('Recorded all 3 reminders and care actions; no page errors. MP4, GIF and poster saved in docs/media.');
