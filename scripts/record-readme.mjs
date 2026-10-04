import { chromium } from '@playwright/test';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { mockReadmeData } from './fixtures/readme-demo.mjs';

const base = process.env.BAYMAX_DEMO_URL || 'http://localhost:5173';
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Record against a local frontend');
const output = fileURLToPath(new URL('../docs/media/', import.meta.url));
const previews = process.env.BAYMAX_CAPTURE_PREVIEWS;
await mkdir(output, { recursive: true });
if (previews) await mkdir(previews, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const reports = [];
const selected = new Set(process.argv.slice(2));

async function record(name, mobile, story, { clipSelector, viewportHeight = 940 } = {}) {
  if (selected.size && !selected.has(name)) return;
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: viewportHeight }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mockReadmeData(page);
  await page.goto(base);
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening), Jordan/ }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const frames = [];
  const interval = 160;
  let clip;
  if (clipSelector) {
    await page.locator(clipSelector).scrollIntoViewIfNeeded();
    clip = await page.locator(clipSelector).boundingBox();
  }
  const frame = async () => {
    const png = await page.screenshot({ ...(clip ? { clip } : {}), animations: 'allow' });
    frames.push(await sharp(png).resize({ width: mobile ? 390 : clip ? 960 : 1024 }).png().toBuffer());
  };
  const hold = async milliseconds => {
    for (let i = 0; i < Math.ceil(milliseconds / interval); i++) {
      const start = Date.now();
      await frame();
      await page.waitForTimeout(Math.max(0, interval - (Date.now() - start)));
    }
  };
  const click = async locator => {
    await locator.scrollIntoViewIfNeeded();
    await hold(320);
    await locator.click();
    await hold(800);
  };
  const go = async name => {
    const nav = mobile ? page.getByRole('navigation', { name: 'Main navigation' }) : page.locator('.sidebar');
    await click(nav.getByRole('button', { name, exact: true }));
  };
  await story({ page, hold, click, go });
  assert.deepEqual(errors, [], `${name}: no browser runtime errors`);
  assert.deepEqual((await page.getByRole('alert').allTextContents()).filter(text => text.trim()), [], `${name}: no visible error alerts`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: no horizontal overflow`);
  await context.close();
  await sharp(frames, { join: { animated: true } }).gif({ loop: 0, delay: frames.map(() => interval), colours: 128, effort: 4, dither: 0.5 }).toFile(`${output}${name}.gif`);
  const info = await sharp(`${output}${name}.gif`, { animated: true }).metadata();
  assert(info.pages > 1 && info.loop === 0, `${name}: valid looping animation`);
  assert.equal(info.delay.reduce((a, b) => a + b, 0), frames.length * interval, `${name}: playback retains the recorded timing`);
  if (previews) {
    const indexes = [0, Math.floor(frames.length / 3), Math.floor(frames.length * 2 / 3), frames.length - 1];
    await sharp(await Promise.all(indexes.map(i => sharp(frames[i]).resize({ width: mobile ? 292 : 512 }).png().toBuffer())), { join: { across: 2, shim: 12, background: '#e9e5df' } }).png().toFile(`${previews}/${name}.png`);
  }
  reports.push({ name, width: info.width, height: info.pageHeight, frames: info.pages, durationMs: info.delay.reduce((a, b) => a + b, 0) });
  console.log(`Recorded ${name}: ${info.pages} frames`);
}

try {
  await record('care-plan', false, async ({ page, hold, click, go }) => {
    await hold(1200);
    await click(page.getByRole('button', { name: 'Good', exact: true }));
    await click(page.getByRole('button', { name: 'Save check-in', exact: true }));
    await page.getByRole('button', { name: 'Checked in', exact: true }).waitFor();
    await click(page.getByRole('button', { name: 'Add one glass of water', exact: true }));
    assert.match(await page.locator('.water-reading .reading-value').innerText(), /^4/);
    await go('Plan');
    await hold(800);
    await click(page.getByRole('button', { name: 'Take a 10-minute walk', exact: true }));
    await hold(1600);
    await go('Today');
    await hold(1000);
  });
  await record('prescription-preview', false, async ({ page, hold, click, go }) => {
    await page.locator('.sidebar').getByRole('button', { name: 'Talk', exact: true }).click();
    await hold(1000);
    await click(page.getByRole('button', { name: 'More ways I can help', exact: false }));
    await click(page.getByRole('button', { name: 'Browse medicines', exact: true }));
    await page.locator('.transcript').hover();
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(200);
    await page.locator('.rx-options-grid').scrollIntoViewIfNeeded();
    await hold(2400);
    const grid = await page.locator('.rx-options-grid').boundingBox();
    const viewport = await page.locator('.transcript').boundingBox();
    if (previews) await page.screenshot({ path: `${previews}/prescription-options.png` });
    assert(grid.y >= viewport.y - 1 && grid.y + grid.height <= viewport.y + viewport.height + 1, 'Pharmacy images and prices fit (within subpixel rounding)');
    await click(page.locator('.rx-pharmacy').filter({ hasText: 'Travel Well Pharmacy' }));
    await click(page.getByRole('button', { name: 'Add one pack', exact: true }));
    await click(page.getByRole('button', { name: 'Review demo order', exact: true }));
    await hold(1000);
    await click(page.getByRole('checkbox', { name: 'I understand this is a demo and no medication will be purchased.' }));
    await click(page.getByRole('button', { name: 'Confirm demo order', exact: true }));
    await page.getByRole('heading', { name: 'Your demo order is ready.' }).waitFor();
    await hold(1800);
  });
  await record('doctor-email', false, async ({ page, hold, click, go }) => {
    await page.locator('.sidebar').getByRole('button', { name: 'Doctor brief', exact: true }).click();
    await hold(1200);
    await page.getByLabel('Doctor’s email address').fill('doctor@example.org');
    await hold(1000);
    await page.getByLabel('Email subject').fill('Jordan Mercer — follow-up before travel');
    await hold(800);
    await click(page.getByRole('button', { name: 'Review email', exact: true }));
    await hold(1600);
    await click(page.getByRole('checkbox', { name: /I reviewed the recipient/ }));
    await page.getByRole('link', { name: 'Open email app', exact: true }).waitFor();
    await hold(1800); // Stop at the approved preview; never launch mail or send.
  });
  await record('mobile-care', true, async ({ page, hold, click, go }) => {
    await hold(1200);
    await click(page.getByRole('button', { name: 'Good', exact: true }));
    await click(page.getByRole('button', { name: 'Save check-in', exact: true }));
    await click(page.getByRole('button', { name: 'Add one glass of water', exact: true }));
    await hold(800);
    await go('Activity');
    await page.getByRole('heading', { name: '4 minutes to go.' }).waitFor();
    await hold(1600);
    await go('Talk');
    await hold(1800);
  });
  await record('baymax-animation', false, async ({ hold }) => { await hold(6400); }, { clipSelector: '.daily-checkin' });
  if (previews) await writeFile(`${previews}/recordings.json`, JSON.stringify(reports, null, 2) + '\n');
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
