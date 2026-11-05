import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?debug=1');
  await expect(page.getByTestId('play')).toBeVisible();
  return errors;
};
const mode = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? NaN;
const wait = (page: Page, ms: number) => page.waitForTimeout(ms);
const debug = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__gtl?.debug)) as NonNullable<Window['__gtl']>['debug']);
const peakLevel = (page: Page, ms: number) => page.evaluate(async (duration) => {
  let peak = 0;
  const end = performance.now() + duration;
  while (performance.now() < end) {
    peak = Math.max(peak, window.__gtl?.engine.outputLevel() ?? 0);
    await new Promise((r) => setTimeout(r, 10));
  }
  return peak;
}, ms);

test('starts with no errors and shows a real C major position', async ({ page }) => {
  const errors = await open(page);
  await expect(page).toHaveTitle('Guitar Theory Lab');
  await expect(page.getByTestId('scale-spelling')).toHaveText(/C\s+D\s+E\s+F\s+G\s+A\s+B/);
  expect(await page.locator('.marker').count()).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('metronome produces sound and the screen follows the audio clock', async ({ page }) => {
  await open(page);
  await page.getByTestId('bpm').fill('120');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');
  const peak = await peakLevel(page, 1500);
  expect(peak).toBeGreaterThan(0.01);
  await wait(page, 6000);
  const log = await debug(page);
  const beats = log.scheduled.filter((e) => e.kind === 'bar' || e.kind === 'beat');
  expect(beats.length).toBeGreaterThanOrEqual(14);
  beats.slice(1).forEach((b, i) => expect(b.time - (beats[i]?.time ?? 0)).toBeCloseTo(0.5, 6));
  const lags = log.shown.filter((s) => s.kind === 'beat').map((s) => s.time - s.scheduled);
  const notes = log.shown.filter((s) => s.kind === 'note').map((s) => s.time - s.scheduled);
  console.log(`SYNC beats n=${lags.length} median=${(median(lags) * 1000).toFixed(1)}ms max=${(Math.max(...lags) * 1000).toFixed(1)}ms; notes n=${notes.length} median=${(median(notes) * 1000).toFixed(1)}ms max=${(Math.max(...notes) * 1000).toFixed(1)}ms; peak=${peak.toFixed(3)}`);
  expect(median(lags)).toBeLessThan(0.05);
  expect(Math.max(...lags)).toBeLessThan(0.15);
  expect(Math.min(...lags)).toBeGreaterThanOrEqual(-0.001);
});

test('clicks actually leave the audio graph at their scheduled times', async ({ page }) => {
  await open(page);
  await page.getByRole('checkbox', { name: 'Evidenzia le note a tempo' }).uncheck();
  await page.getByTestId('bpm').fill('120');
  await page.getByTestId('play').click();
  const onsets = await page.evaluate(async () => {
    const found: number[] = [];
    const end = performance.now() + 5000;
    while (performance.now() < end) {
      const snap = window.__gtl?.engine.outputSnapshot();
      if (snap) {
        const start = snap.endTime - snap.samples.length / snap.sampleRate;
        snap.samples.forEach((value, i) => {
          if (Math.abs(value) < 0.02) return;
          const time = start + i / snap.sampleRate;
          const last = found[found.length - 1];
          if (last === undefined || time - last > 0.2) found.push(time);
        });
      }
      await new Promise((r) => setTimeout(r, 15));
    }
    return found;
  });
  const log = await debug(page);
  const scheduled = log.scheduled.filter((e) => e.kind === 'bar' || e.kind === 'beat').map((e) => e.time);
  const errors = onsets.map((t) => Math.min(...scheduled.map((s) => Math.abs(t - s))));
  console.log(`SYNC audio onsets n=${onsets.length} median=${(median(errors) * 1000).toFixed(1)}ms max=${(Math.max(...errors) * 1000).toFixed(1)}ms`);
  expect(onsets.length).toBeGreaterThanOrEqual(8);
  expect(Math.max(...errors)).toBeLessThan(0.02);
});

test('exercise highlight walks the textbook thirds in order', async ({ page }) => {
  await open(page);
  await page.getByTestId('bpm').fill('200');
  await page.getByTestId('play').click();
  await wait(page, 3000);
  const log = await debug(page);
  const notes = log.scheduled.filter((e) => e.kind === 'note');
  expect(notes.slice(0, 8).map((n) => n.note)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  const shown = log.shown.filter((s) => s.kind === 'note').map((s) => s.value);
  for (let i = 1; i < shown.length; i += 1) expect(shown[i]).toBe((shown[i - 1] ?? 0) + 1);
  await expect(page.locator('.active-note')).toBeVisible();
  await page.getByTestId('stop').click();
  await expect(page.locator('.active-note')).toHaveCount(0);
});

test('BPM, scale changes, pause and resume keep the grid intact', async ({ page }) => {
  await open(page);
  await page.getByTestId('bpm').fill('120');
  await page.getByTestId('play').click();
  await wait(page, 1500);
  await page.getByTestId('bpm').fill('180');
  await page.getByTestId('tonic').selectOption('G');
  await wait(page, 1500);
  await page.getByTestId('play').click();
  await expect(page.getByTestId('play')).toHaveText('Riprendi');
  const paused = await page.getByTestId('beat-lights').getAttribute('data-beat');
  await wait(page, 700);
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-beat', paused as string);
  await page.getByTestId('play').click();
  await wait(page, 1500);
  const log = await debug(page);
  const beats = log.scheduled.filter((e) => e.kind === 'bar' || e.kind === 'beat');
  const ticks = beats.map((b) => b.tick);
  // Before the pause events past the pause were cancelled; resuming may reschedule them.
  const resumed = ticks.findIndex((t, i) => i > 0 && t <= (ticks[i - 1] ?? 0));
  const clean = resumed === -1 ? ticks : ticks.slice(resumed);
  clean.slice(1).forEach((t, i) => expect(t - (clean[i] ?? 0)).toBe(480));
  const gaps = beats.slice(1).map((b, i) => Number((b.time - (beats[i]?.time ?? 0)).toFixed(4)));
  expect(gaps).toContain(0.5);
  expect(gaps.some((g) => Math.abs(g - 1 / 3) < 0.001)).toBe(true);
});

test('harmonic context switch: the same note changes function, physically unchanged', async ({ page }) => {
  await open(page);
  await mode(page, 'Harmony Lab');
  await page.getByTestId('template').selectOption('ii-v-i');
  const e = page.locator('.marker[data-string="2"][data-fret="14"], .marker[data-string="3"][data-fret="9"], .marker[data-string="1"][data-fret="7"]').first();
  await e.click();
  const inspector = page.getByTestId('inspector');
  await expect(inspector).toContainText('E');
  await expect(inspector.locator('.fn-item').nth(0)).toContainText('9');
  await expect(inspector.locator('.fn-item').nth(0)).toContainText('Dm7');
  await expect(inspector.locator('.fn-item').nth(1)).toContainText('13');
  await expect(inspector.locator('.fn-item').nth(2)).toContainText('3');
  await expect(inspector.locator('.fn-item').nth(2)).toContainText('Cmaj7');
});

test('automatic chord changes land on the shared grid, with labels updating', async ({ page }) => {
  await open(page);
  await mode(page, 'Harmony Lab');
  await page.getByTestId('template').selectOption('ii-v-i');
  await page.getByTestId('bars-per-chord').selectOption('1');
  await page.getByTestId('bpm').fill('240');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('current-chord')).toHaveText('G7', { timeout: 3000 });
  await expect(page.getByTestId('current-chord')).toHaveText('Cmaj7', { timeout: 3000 });
  await expect(page.getByTestId('current-chord')).toHaveText('Dm7', { timeout: 3000 });
  const log = await debug(page);
  const chords = log.scheduled.filter((s) => s.kind === 'chord');
  const bars = new Set(log.scheduled.filter((s) => s.kind === 'bar').map((s) => s.tick));
  for (const c of chords) expect(bars.has(c.tick)).toBe(true);
  const lags = log.shown.filter((s) => s.kind === 'chord' && s.tick > 0).map((s) => s.time - s.scheduled);
  expect(lags.length).toBeGreaterThanOrEqual(2);
  console.log(`SYNC chords n=${lags.length} max=${(Math.max(...lags) * 1000).toFixed(1)}ms`);
  expect(Math.max(...lags)).toBeLessThan(0.15);
});

test('manual chord change waits for the next beat', async ({ page }) => {
  await open(page);
  await mode(page, 'Harmony Lab');
  await page.getByTestId('template').selectOption('ii-v-i');
  await page.getByRole('button', { name: 'Manuale', exact: true }).click();
  await page.getByTestId('bpm').fill('60');
  await page.getByTestId('play').click();
  await wait(page, 1300);
  await expect(page.getByTestId('current-chord')).toHaveText('Dm7');
  await page.getByTestId('next-chord').click();
  await expect(page.getByTestId('current-chord')).toHaveText('G7', { timeout: 1500 });
  await wait(page, 1500);
  await expect(page.getByTestId('current-chord')).toHaveText('G7');
  const log = await debug(page);
  expect(log.scheduled.filter((s) => s.kind === 'chord').every((s) => s.tick % 480 === 0)).toBe(true);
});

test('focus modes change what is drawn', async ({ page }) => {
  await open(page);
  await mode(page, 'Harmony Lab');
  await page.getByTestId('template').selectOption('ii-v-i');
  await page.getByRole('button', { name: 'Guide tones', exact: true }).click();
  expect(await page.locator('.marker.is-guide').count()).toBeGreaterThan(0);
  expect(await page.locator('.arrow').count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Note comuni', exact: true }).click();
  await expect(page.locator('.marker[data-label="b3›b7"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Chord-tone target', exact: true }).click();
  await expect(page.locator('.target-now').first()).toBeVisible();
  await page.getByRole('button', { name: 'Risoluzione', exact: true }).click();
  expect(await page.locator('.arrow').count()).toBeGreaterThan(0);
});

test('jam studio: build, transpose, accompany, and hide aids', async ({ page }) => {
  await open(page);
  await mode(page, 'Jam Studio');
  await page.getByTestId('template').selectOption('blues');
  await expect(page.locator('.builder-row')).toHaveCount(9);
  await page.getByTestId('add-chord').click();
  await expect(page.locator('.builder-row')).toHaveCount(10);
  await page.getByTestId('dup-0').click();
  await expect(page.locator('.builder-row')).toHaveCount(11);
  await page.getByTestId('del-0').click();
  await page.getByTestId('del-9').click();
  await expect(page.locator('.builder-row')).toHaveCount(9);
  await expect(page.getByTestId('chip-0')).toContainText('C7');
  await page.getByTestId('transpose-up').click();
  await expect(page.getByTestId('chip-0')).toContainText('Db7');
  await page.getByTestId('transpose-down').click();
  await page.getByTestId('quality-0').selectOption('m7');
  await expect(page.getByTestId('chip-0')).toContainText('Cm7');

  await page.getByRole('checkbox', { name: 'Evidenzia le note a tempo' }).uncheck();
  await page.getByLabel('Volume Click').fill('0');
  await page.getByTestId('bpm').fill('140');
  await page.getByTestId('play').click();
  expect(await peakLevel(page, 1500)).toBeGreaterThan(0.01);
  const log = await debug(page);
  expect(log.scheduled.some((s) => s.kind === 'comp')).toBe(true);

  // Editing during playback must not interrupt it.
  await page.getByTestId('quality-1').selectOption('maj7');
  await page.getByTestId('bpm').fill('150');
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');

  await page.getByRole('checkbox', { name: 'Mostra gli aiuti visivi' }).uncheck();
  await expect(page.locator('.marker')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Mostra gli aiuti visivi' }).check();
  expect(await page.locator('.marker').count()).toBeGreaterThan(0);
});

test('a non-looping progression stops at its end', async ({ page }) => {
  await open(page);
  await mode(page, 'Jam Studio');
  await page.getByTestId('template').selectOption('ii-v-i');
  await page.getByTestId('bars-per-chord').selectOption('1');
  await page.getByRole('checkbox', { name: 'Ripeti in loop' }).uncheck();
  await page.getByTestId('bpm').fill('280');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'stopped', { timeout: 6000 });
});

test('presets and session survive a reload', async ({ page }) => {
  await open(page);
  await page.getByTestId('tonic').selectOption('Eb');
  await page.getByTestId('scale').selectOption('dorian');
  await page.getByTestId('interval').selectOption('6');
  await page.getByTestId('bpm').fill('93');
  await page.getByTestId('preset-name').fill('Seste dorico');
  await page.getByTestId('preset-save').click();
  await expect(page.getByTestId('preset-status')).toHaveText('Salvato: Seste dorico');

  await page.getByTestId('tonic').selectOption('A');
  await page.getByTestId('bpm').fill('120');
  await wait(page, 400);
  await page.reload();
  await expect(page.getByTestId('tonic')).toHaveValue('A');
  await expect(page.getByTestId('bpm')).toHaveValue('120');

  const saved = page.getByTestId('preset-load').locator('option', { hasText: 'Tuo: Seste dorico' });
  await page.getByTestId('preset-load').selectOption(await saved.getAttribute('value') as string);
  await expect(page.getByTestId('tonic')).toHaveValue('Eb');
  await expect(page.getByTestId('bpm')).toHaveValue('93');
  await expect(page.getByTestId('scale-spelling')).toHaveText(/Eb\s+F\s+Gb\s+Ab\s+Bb\s+C\s+Db/);

  await page.getByRole('button', { name: 'Elimina Seste dorico' }).click();
  await expect(page.getByTestId('saved-list')).toHaveCount(0);
});

test('built-in presets load, including one that changes mode', async ({ page }) => {
  await open(page);
  await page.getByTestId('preset-load').selectOption('blues-a');
  await expect(page.getByTestId('builder')).toBeVisible();
  await expect(page.getByTestId('chip-0')).toContainText('A7');
  await page.getByTestId('preset-load').selectOption('fourths-dorian');
  await expect(page.getByTestId('overlay-spelling')).toContainText('D (1)');
});

test('layout holds at phone width with no page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  // The default position starts at fret 7: it must be in view, not scrolled off.
  await expect.poll(() => page.locator('.fretboard-scroll').evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  for (const name of ['Fretboard Lab', 'Harmony Lab', 'Jam Studio']) {
    await mode(page, name);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, name).toBeLessThanOrEqual(0);
  }
});

test('the single-file build plays from disk with no server', async ({ page }) => {
  const { resolve } = await import('node:path');
  const { execSync } = await import('node:child_process');
  execSync('node scripts/build-single.mjs');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`file://${resolve('dist/guitar-theory-lab.html')}?debug=1`);
  await page.getByTestId('play').click();
  expect(await peakLevel(page, 1000)).toBeGreaterThan(0.01);
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');
  const family = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('700 20px "Chakra Petch"');
  });
  expect(family).toBe(true);
  expect(errors).toEqual([]);
});
