import { expect, test, type Page } from '@playwright/test';
import { fakeMic, openInput, wavSequence } from './liveHelpers';
import { reveal } from './studio';

/**
 * Owner report from a real-guitar session: the page moved whenever a note was
 * detected, and the guitar could not be heard. The microphone here is a WAV
 * of picked notes and silences (A2, E4, C4 with gaps), looping.
 */

test.use(fakeMic(wavSequence('picking.wav', [[110, 0.6], [0, 0.45], [329.63, 0.5], [0, 0.35], [261.63, 0.5], [0, 0.5]])));

const CRITICAL = [
  '.fretboard', '[data-testid="legend"]', '[data-testid="live-input"]', '[data-testid="live-note"]', '[data-testid="live-positions"]',
  '[data-testid="live-feedback"]', '[data-testid="tuner"]', '[data-testid="play"]', '[data-testid="lcd"]',
];
const boxes = (page: Page) => page.evaluate((selectors) => selectors.map((sel) => {
  const r = document.querySelector(sel)?.getBoundingClientRect();
  return r ? [Math.round(r.x * 2) / 2, Math.round(r.y * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2] : null;
}), CRITICAL);

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: notes coming and going do not move or resize anything`, async ({ page }) => {
    await openInput(page, look);
    // Let the first reading arrive, then watch for three seconds: notes, silences, new notes.
    await expect(page.getByTestId('live-note')).not.toHaveText('—', { timeout: 5000 });
    const reference = await boxes(page);
    // In Studio the legend lives on its own notebook page, not beside the input panels.
    expect(reference.every((b, i) => b !== null || (look === 'Studio' && CRITICAL[i] === '[data-testid="legend"]'))).toBe(true);
    const seen = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      await page.waitForTimeout(120);
      seen.add((await page.getByTestId('live-note').textContent()) ?? '');
      expect(await boxes(page), `frame ${i}`).toEqual(reference);
    }
    // The signal really changed during the watch: notes and silence both appeared.
    expect(seen.has('—')).toBe(true);
    expect([...seen].filter((n) => n !== '—').length).toBeGreaterThanOrEqual(2);
    // The page height did not change either.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
  });
}

test('the guitar reaches the output only when listening is switched on, at the mixer level', async ({ page }) => {
  await openInput(page, 'Studio');
  // Levels move with a 10–20 ms glide: settle first, then take the peak over about a second.
  const out = () => page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 250));
    let peak = 0;
    for (let i = 0; i < 30; i += 1) {
      peak = Math.max(peak, window.__gtl?.engine.outputLevel() ?? 0);
      await new Promise((r) => setTimeout(r, 30));
    }
    return peak;
  });
  // Off at start: the input is analysed but not heard.
  await reveal(page, page.getByTestId('monitor-toggle'));
  await expect(page.getByTestId('monitor-toggle')).toHaveAttribute('aria-pressed', 'false');
  await reveal(page, page.getByTestId('mixer-listen'));
  await expect(page.getByTestId('mixer-listen')).toHaveAttribute('aria-pressed', 'false');
  expect(await out()).toBeLessThan(0.002);
  // On from the mixer key: the guitar is in the output.
  await reveal(page, page.getByTestId('mixer-listen'));
  await page.getByTestId('mixer-listen').click();
  await reveal(page, page.getByTestId('monitor-toggle'));
  await expect(page.getByTestId('monitor-toggle')).toHaveAttribute('aria-pressed', 'true');
  expect(await out()).toBeGreaterThan(0.02);
  // The guitar fader at zero, then the master at zero: silent again.
  await reveal(page, page.getByTestId('fader-guitar'));
  await page.getByTestId('fader-guitar').fill('0');
  expect(await out()).toBeLessThan(0.002);
  await reveal(page, page.getByTestId('fader-guitar'));
  await page.getByTestId('fader-guitar').fill('0.8');
  expect(await out()).toBeGreaterThan(0.02);
  await reveal(page, page.getByTestId('fader-master'));
  await page.getByTestId('fader-master').fill('0');
  expect(await out()).toBeLessThan(0.002);
  await reveal(page, page.getByTestId('fader-master'));
  await page.getByTestId('fader-master').fill('0.85');
  // Stopping the input turns listening off; starting again keeps it off.
  await reveal(page, page.getByTestId('live-toggle'));
  await page.getByTestId('live-toggle').click();
  await reveal(page, page.getByTestId('live-toggle'));
  await page.getByTestId('live-toggle').click();
  await reveal(page, page.getByTestId('live-status'));
  await expect(page.getByTestId('live-status')).toHaveText('Ingresso attivo');
  await reveal(page, page.getByTestId('mixer-listen'));
  await expect(page.getByTestId('mixer-listen')).toHaveAttribute('aria-pressed', 'false');
  expect(await out()).toBeLessThan(0.002);
});
