import { expect, test } from '@playwright/test';
import { chooseLook, reveal } from './studio';

/** P3-08: the progression as a song — sections with their own groove, band and dynamics. */

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: a practice arrangement brings the band in section by section`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?debug=1');
    await chooseLook(page, look);
    await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
    await reveal(page, page.getByTestId('template'));
    await page.getByTestId('template').selectOption('ii-v-i');
    if (look === 'Semplificata') await page.getByRole('tab', { name: 'Arrangiamento' }).click();
    // Drums alone, then drums and bass, then the whole band.
    await reveal(page, page.getByTestId('arrangement-preset'));
    await page.getByTestId('arrangement-preset').selectOption('practice');
    await expect(page.getByTestId('arrangement-list').locator('> li')).toHaveCount(3);
    await reveal(page, page.getByTestId('arrangement-now'));
    await expect(page.getByTestId('arrangement-now')).toContainText('3 sezioni, 16 battute');

    await page.getByTestId('bpm').fill('240');
    await page.getByTestId('play').click();
    await reveal(page, page.getByTestId('arrangement-now'));
    await expect(page.getByTestId('arrangement-now')).toContainText('Ora: Intro');
    // ii–V–I is four bars: the intro (bars 1–4) has no bass, the verse (5–8) has no chords.
    await expect.poll(async () => page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.tick >= 8 * 1920).length), { timeout: 15000 }).toBeGreaterThan(5);
    await page.getByTestId('stop').click();
    const events = await page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).map((e) => ({ kind: e.kind, tick: e.tick })));
    const inBars = (kind: string, from: number, to: number) => events.filter((e) => e.kind === kind && e.tick >= from * 1920 && e.tick < to * 1920).length;
    expect(inBars('drum', 0, 4)).toBeGreaterThan(0);
    expect(inBars('bass', 0, 4)).toBe(0);
    expect(inBars('comp', 0, 4)).toBe(0);
    expect(inBars('bass', 4, 8)).toBeGreaterThan(0);
    expect(inBars('comp', 4, 8)).toBe(0);
    expect(inBars('comp', 8, 9)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('solo: one channel plays, the others fall silent', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
  await reveal(page, page.getByTestId('solo-channel'));
  await page.getByTestId('solo-channel').selectOption('drums');
  await page.getByTestId('play').click();
  const peak = async () => page.evaluate(async () => {
    let p = 0;
    const end = performance.now() + 900;
    while (performance.now() < end) { p = Math.max(p, window.__gtl?.engine.outputLevel() ?? 0); await new Promise((r) => setTimeout(r, 10)); }
    return p;
  });
  expect(await peak()).toBeGreaterThan(0.01);
  // With the bass switched off, soloing the bass leaves silence: every other channel is down.
  await reveal(page, page.getByRole('checkbox', { name: 'Suona il basso' }));
  await page.getByRole('checkbox', { name: 'Suona il basso' }).uncheck();
  await reveal(page, page.getByTestId('solo-channel'));
  await page.getByTestId('solo-channel').selectOption('bass');
  // Let the tails of the notes already sounding die away.
  await page.waitForTimeout(1200);
  expect(await peak()).toBeLessThan(0.01);
  await page.getByTestId('stop').click();
});

test('a section with its own chords: the chorus plays them, the display names them', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
  await reveal(page, page.getByTestId('template'));
  await page.getByTestId('template').selectOption('ii-v-i');
  await reveal(page, page.getByTestId('arrangement-preset'));
  await page.getByTestId('arrangement-preset').selectOption('practice');
  // Intro and verse on ii–V–I (four bars each), the chorus on its own two chords.
  await reveal(page, page.getByTestId('section-chords-0'));
  await page.getByTestId('section-chords-0').fill('Fmaj7 G7');
  await reveal(page, page.getByTestId('section-chords-0'));
  await page.getByTestId('section-chords-0').fill('');
  await reveal(page, page.getByTestId('section-chords-2'));
  await page.getByTestId('section-chords-2').fill('Fmaj7 G7');
  await reveal(page, page.getByTestId('arrangement-now'));
  await expect(page.getByTestId('arrangement-now')).toContainText('3 sezioni, 12 battute');
  await page.getByTestId('bpm').fill('240');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('current-chord')).toHaveText('Fmaj7', { timeout: 15000 });
  await page.getByTestId('stop').click();
  const changes = await page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'chord').map((e) => [e.tick / 1920, e.chord]));
  // ii–V–I is chords 0–2; the chorus chords come after them, at bar 8 and 9.
  expect(changes).toContainEqual([8, 3]);
  expect(errors).toEqual([]);
});
