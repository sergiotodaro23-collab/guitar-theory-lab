/**
 * Screenshots of the rack's amplifier for visual comparison (before/after a
 * change of the hardware assets). Run after `npm run build`:
 *   node tools/hardware/shots.mjs <outDir> [label]
 * Writes <label>-amp-<viewport>.png (the amp module, device pixel ratio 2)
 * and <label>-rack-<viewport>.png. Headless Chromium on the built app.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'test-results/hardware';
const label = process.argv[3] ?? 'shot';
const PORT = 4183;
const VIEWPORTS = [[1440, 900], [1280, 720], [1024, 768]];
mkdirSync(out, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
try {
  const browser = await chromium.launch();
  for (const [width, height] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    await page.getByTestId('rack-expand').click({ timeout: 1500 }).catch(() => {});
    const amp = page.locator('[data-module="amp"]');
    await amp.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await amp.screenshot({ path: join(out, `${label}-amp-${width}x${height}.png`) });
    // Knobs turned and the amp switched off, to see the states.
    await page.getByTestId('amp-gain').focus();
    await page.keyboard.press('End');
    await page.getByTestId('amp-bass').focus();
    await page.keyboard.press('Home');
    await page.waitForTimeout(150);
    await amp.screenshot({ path: join(out, `${label}-amp-turned-${width}x${height}.png`) });
    await page.getByTestId('amp-power').click();
    await page.waitForTimeout(150);
    await amp.screenshot({ path: join(out, `${label}-amp-off-${width}x${height}.png`) });
    await page.getByTestId('amp-power').click();
    await page.getByTestId('rack').screenshot({ path: join(out, `${label}-rack-${width}x${height}.png`) });
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
}
console.log('screenshots in', out);
