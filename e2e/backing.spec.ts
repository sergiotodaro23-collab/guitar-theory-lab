import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/** P3-09: a local audio file plays in time with the jam (synthetic clicks, not music). */

function clickTrack(path: string, bpm: number, offset: number, seconds: number): string {
  const SR = 44100;
  const n = Math.round(SR * seconds);
  const data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 2, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  for (let beat = 0; offset + (beat * 60) / bpm < seconds; beat += 1) {
    const start = Math.round((offset + (beat * 60) / bpm) * SR);
    for (let i = 0; i < SR * 0.05 && start + i < n; i += 1) {
      data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 1000 * i) / SR) * Math.exp(-i / (SR * 0.01)) * 0.6 * 32767), 44 + (start + i) * 2);
    }
  }
  mkdirSync(resolve('test-results/audio'), { recursive: true });
  const file = resolve('test-results/audio', path);
  writeFileSync(file, data);
  return file;
}

test('a click track at 120 BPM with bar 1 at 0.5 s starts there, loops with the progression, and sounds', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await page.getByTestId('appearance').getByRole('button', { name: 'Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
  await page.getByTestId('backing-file').setInputFiles(clickTrack('backing-120.wav', 120, 0.5, 14));
  await expect(page.getByTestId('backing-status')).toContainText('backing-120.wav · 14.0 s');
  await page.getByTestId('backing-bpm').fill('120');
  await page.getByTestId('backing-offset').fill('0.5');
  await page.getByTestId('backing-use-bpm').click();
  await expect(page.getByTestId('bpm')).toHaveValue('120');
  await expect(page.getByTestId('backing-bpm-warning')).toHaveCount(0);
  // Only the backing: the band is muted.
  for (const channel of ['click', 'notes', 'comp', 'bass', 'drums']) await page.getByTestId(`mute-${channel}`).click();

  await page.getByTestId('play').click();
  await expect(page.getByTestId('backing-status')).toContainText('in riproduzione');
  const start = await page.evaluate(() => window.__gtl?.backing?.lastStart);
  expect(start?.offset).toBeCloseTo(0.5, 2);
  // The default progression is four bars: at 120 BPM, eight seconds from bar 1.
  expect(start?.loop?.start).toBeCloseTo(0.5, 3);
  expect(start?.loop?.end).toBeCloseTo(8.5, 3);
  const peak = await page.evaluate(async () => {
    let p = 0;
    const end = performance.now() + 1500;
    while (performance.now() < end) { p = Math.max(p, window.__gtl?.engine.outputLevel() ?? 0); await new Promise((r) => setTimeout(r, 10)); }
    return p;
  });
  expect(peak).toBeGreaterThan(0.01);

  // Pause stops it; play again starts it from where the transport is, not from the top.
  await page.getByTestId('play').click();
  await expect(page.getByTestId('backing-status')).not.toContainText('in riproduzione');
  await page.getByTestId('play').click();
  await expect.poll(async () => (await page.evaluate(() => window.__gtl?.backing?.lastStart?.offset)) ?? 0).toBeGreaterThan(1);
  await page.getByTestId('stop').click();

  // After a reload the file is still in this browser.
  await page.reload();
  await page.getByTestId('appearance').getByRole('button', { name: 'Studio', exact: true }).click();
  await expect(page.getByTestId('backing-status')).toContainText('backing-120.wav');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('backing-status')).toContainText('in riproduzione', { timeout: 5000 });
  await page.getByTestId('stop').click();
  expect(errors).toEqual([]);
});
