import { expect, test, type Page } from '@playwright/test';

/** Jam genres and the bass line: a ready band in one choice. */

const open = async (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await expect(page.getByTestId('play')).toBeVisible();
  return errors;
};
const bass = (page: Page) => page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'bass').map((e) => ({ tick: e.tick, midi: e.midi })));

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: a genre sets drums, bass, comping and swing; the bass follows the chords`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors = await open(page);
    await page.getByTestId('appearance').getByRole('button', { name: look, exact: true }).click();
    await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();

    await page.getByTestId('template').selectOption('ii-v-i');
    await page.getByTestId('jam-genre').selectOption('jazz');
    await expect(page.getByTestId('comp-pattern')).toHaveValue('charleston');
    await expect(page.getByTestId('bass-pattern').locator('option').first()).toHaveText('Walking in salita');
    if (look === 'Studio') await expect(page.getByTestId('knob-swing')).toHaveAttribute('aria-valuetext', '67%');
    await page.getByRole('button', { name: 'Usa 140 BPM' }).click();
    await expect(page.getByTestId('bpm')).toHaveValue('140');
    if (look === 'Semplificata') await page.getByRole('tab', { name: 'Batteria' }).click();
    // Jazz groove A: ride on 1, 2, and-of-2, 3, 4, and-of-4.
    await expect(page.getByTestId('drum-hat-0')).toHaveAttribute('data-step', '1');
    await expect(page.getByTestId('drum-hat-6')).toHaveAttribute('data-step', '1');
    await expect(page.getByTestId('drum-hat-2')).toHaveAttribute('data-step', '0');

    await page.getByTestId('bpm').fill('240');
    await page.getByTestId('play').click();
    await expect.poll(async () => (await bass(page)).length, { timeout: 6000 }).toBeGreaterThan(5);
    await page.getByTestId('stop').click();
    const line = await bass(page);
    // The first bar walks over the first chord of ii–V–I and ends a half step from the second chord's root.
    const bar = line.filter((n) => n.tick < 1920).map((n) => n.midi ?? 0);
    expect(bar).toHaveLength(4);
    const nextRoot = line.find((n) => n.tick === 1920)?.midi ?? 0;
    expect(Math.abs((bar[3] ?? 0) - nextRoot)).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('bass off: no bass notes; the Basso fader is in the mixer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
  await expect(page.getByTestId('fader-bass')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Suona il basso' }).uncheck();
  await page.getByTestId('play').click();
  await page.waitForTimeout(800);
  await page.getByTestId('stop').click();
  expect(await bass(page)).toEqual([]);
});

test('five mixer channels and the output meter fit inside the mixer, in both looks', async ({ page }) => {
  for (const [look, width, height] of [['Studio', 1440, 900], ['Studio', 1280, 800], ['Semplificata', 1440, 900], ['Studio', 768, 1024]] as const) {
    await page.setViewportSize({ width, height });
    await open(page);
    await page.getByTestId('appearance').getByRole('button', { name: look, exact: true }).click();
    const [mixer, meter, fader] = await page.evaluate(() => ['.ws-mixer, .cs-mixer', '.meter', '[data-testid="fader-drums"]']
      .map((sel) => document.querySelector(sel)?.getBoundingClientRect().right ?? Infinity));
    expect(meter, `${look} ${width}`).toBeLessThanOrEqual(mixer ?? 0);
    expect(fader, `${look} ${width}`).toBeLessThanOrEqual(mixer ?? 0);
  }
});
