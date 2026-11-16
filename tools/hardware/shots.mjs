/**
 * Screenshots of the rendered hardware for visual comparison (before/after a
 * change of the assets). Run after `npm run build`:
 *   node tools/hardware/shots.mjs <outDir> [label]
 * For every viewport writes <label>-<module>-<viewport>.png for each rack
 * module (device pixel ratio 2, states switched on so lamps and LEDs show),
 * <label>-rack-…, <label>-mixer-… and <label>-page-… (the whole Studio, ratio 1). Headless
 * Chromium on the built app.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'test-results/hardware';
const label = process.argv[3] ?? 'shot';
const PORT = 4183;
const VIEWPORTS = [[1440, 900], [1366, 768], [1280, 720], [1024, 768]];
const MODULES = ['input', 'amp', 'cab', 'pedals'];
mkdirSync(out, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
try {
  const browser = await chromium.launch();
  for (const [width, height] of VIEWPORTS) {
    const size = `${width}x${height}`;
    const wide = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await wide.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    await wide.screenshot({ path: join(out, `${label}-page-${size}.png`) });
    await wide.getByTestId('rack-expand').click({ timeout: 1500 }).catch(() => {});
    await wide.waitForTimeout(300);
    await wide.screenshot({ path: join(out, `${label}-page-rack-${size}.png`) });
    await wide.close();
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    await page.getByTestId('rack-expand').click({ timeout: 1500 }).catch(() => {});
    // Some states on: two knobs turned, two pedals lit.
    await page.getByTestId('amp-gain').focus();
    await page.keyboard.press('End');
    for (const id of ['comp', 'drive']) await page.getByTestId(`pedal-${id}-switch`).click({ timeout: 1500 }).catch(() => {});
    for (const id of MODULES) {
      const module = page.locator(`[data-module="${id}"]`);
      await module.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await module.screenshot({ path: join(out, `${label}-${id}-${size}.png`) });
    }
    // The pedal strip scrolled to its end, to see the last pedals.
    await page.locator('.v6-board').evaluate((b) => { b.scrollLeft = b.scrollWidth; });
    await page.waitForTimeout(200);
    await page.locator('.v6-board').screenshot({ path: join(out, `${label}-pedals-end-${size}.png`) });
    await page.getByTestId('rack').screenshot({ path: join(out, `${label}-rack-${size}.png`) });
    // The mixer, opened from its handle, with one mute and one solo lit.
    await page.getByTestId('device-mixer').click({ timeout: 1500 }).catch(() => {});
    await page.getByTestId('mute-click').click({ timeout: 1500 }).catch(() => {});
    await page.getByTestId('solo-bass').click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.getByTestId('v57-mixer').screenshot({ path: join(out, `${label}-mixer-${size}.png`) }).catch(() => {});
    await page.screenshot({ path: join(out, `${label}-page-mixer-${size}.png`) });
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
}
console.log('screenshots in', out);
