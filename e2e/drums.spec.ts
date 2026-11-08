import { expect, test, type Page } from '@playwright/test';
import { chooseLook, reveal } from './studio';

/** Jam Studio drum step sequencer: 16 steps, patterns A–D, fill, on the shared clock. */

const open = async (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await expect(page.getByTestId('play')).toBeVisible();
  return errors;
};
const BAR = 480 * 4;
const hits = (page: Page, voice: string) => page.evaluate((v) => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'drum' && e.voice === v).map((e) => e.tick), voice);
const drumCount = (page: Page) => page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'drum').length);

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: pattern A plays on the beat, edits and pattern changes land on the next bar`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors = await open(page);
    await chooseLook(page, look);
    await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
    if (look === 'Semplificata') await page.getByRole('tab', { name: 'Batteria' }).click();

    // Pattern A on the grid: kick accent on 1, snare on 2 and 4 (steps 5 and 13).
    await reveal(page, page.getByTestId('drum-kick-0'));
    await expect(page.getByTestId('drum-kick-0')).toHaveAttribute('data-step', '2');
    await reveal(page, page.getByTestId('drum-snare-4'));
    await expect(page.getByTestId('drum-snare-4')).toHaveAttribute('data-step', '2');
    await reveal(page, page.getByTestId('drum-snare-12'));
    await expect(page.getByTestId('drum-snare-12')).toHaveAttribute('data-step', '2');
    await reveal(page, page.getByTestId('drum-fill-every'));
    await page.getByTestId('drum-fill-every').selectOption('0');

    await page.getByTestId('bpm').fill('200');
    await page.getByTestId('play').click();
    await expect.poll(() => drumCount(page), { timeout: 5000 }).toBeGreaterThan(20);
    // Snares fall on beats 2 and 4 of every bar.
    for (const tick of await hits(page, 'snare')) expect([BAR / 4, (BAR * 3) / 4]).toContain(tick % BAR);

    // Edit while playing: a clap on step 1. It is not heard before the next bar line.
    // Everything up to here is already in the audio queue and stays as it was.
    const queued = await page.evaluate(() => Math.max(...(window.__gtl?.debug.scheduled ?? []).map((e) => e.tick)));
    await reveal(page, page.getByTestId('drum-clap-0'));
    await page.getByTestId('drum-clap-0').click();
    await reveal(page, page.getByTestId('drum-clap-0'));
    await expect(page.getByTestId('drum-clap-0')).toHaveAttribute('data-step', '1');
    await expect.poll(async () => (await hits(page, 'clap')).length, { timeout: 5000 }).toBeGreaterThan(0);
    const firstClap = (await hits(page, 'clap'))[0] ?? 0;
    expect(firstClap % BAR).toBe(0);
    expect(firstClap).toBeGreaterThan(queued);

    // Pattern D: four on the floor; the edit view follows the pattern chosen.
    await reveal(page, page.getByRole('group', { name: 'Pattern in riproduzione' }));
    await page.getByRole('group', { name: 'Pattern in riproduzione' }).getByRole('button', { name: 'D', exact: true }).click();
    await reveal(page, page.getByTestId('drum-kick-4'));
    await expect(page.getByTestId('drum-kick-4')).toHaveAttribute('data-step', '1');
    await expect.poll(async () => (await hits(page, 'kick')).some((t) => t % BAR === BAR / 4), { timeout: 5000 }).toBe(true);

    // Off: no more drum events are scheduled.
    await reveal(page, page.getByRole('checkbox', { name: 'Suona la batteria' }));
    await page.getByRole('checkbox', { name: 'Suona la batteria' }).uncheck();
    const before = await drumCount(page);
    await page.waitForTimeout(800);
    expect(await drumCount(page)).toBe(before);
    await page.getByTestId('stop').click();
    expect(errors).toEqual([]);
  });
}

test('the fill takes the last bar of every N; steps cycle off, on, accent, ghost; keyboard moves', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
  await reveal(page, page.getByTestId('drum-fill-every'));
  await page.getByTestId('drum-fill-every').selectOption('2');
  await page.getByTestId('bpm').fill('280');
  await page.getByTestId('play').click();
  await expect.poll(async () => (await hits(page, 'tom')).length, { timeout: 8000 }).toBeGreaterThan(0);
  // Toms only in the fill, the second bar of each pair.
  for (const tick of await hits(page, 'tom')) expect(Math.floor(tick / BAR) % 2).toBe(1);
  await page.getByTestId('stop').click();

  const step = page.getByTestId('drum-tom-3');
  await step.click();
  await expect(step).toHaveAttribute('data-step', '1');
  await step.click();
  await expect(step).toHaveAttribute('data-step', '2');
  await step.click();
  await expect(step).toHaveAttribute('data-step', '3');
  await expect(step).toHaveAccessibleName('Tom, passo 4: nota fantasma');
  await step.click();
  await expect(step).toHaveAttribute('data-step', '0');
  await step.focus();
  await page.keyboard.press('ArrowUp');
  await reveal(page, page.getByTestId('drum-clap-3'));
  await expect(page.getByTestId('drum-clap-3')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await reveal(page, page.getByTestId('drum-clap-4'));
  await expect(page.getByTestId('drum-clap-4')).toBeFocused();
  // In 3/4 a bar has 12 sixteenths: the last four steps are disabled.
  await reveal(page, page.getByTestId('meter'));
  await page.getByTestId('meter').selectOption('3/4');
  await expect(page.getByTestId('drum-kick-12')).toBeDisabled();
  await reveal(page, page.getByTestId('drum-kick-11'));
  await expect(page.getByTestId('drum-kick-11')).toBeEnabled();
});

test('drums play only in Jam Studio', async ({ page }) => {
  await open(page);
  await page.getByTestId('play').click();
  await page.waitForTimeout(700);
  await page.getByTestId('stop').click();
  expect(await drumCount(page)).toBe(0);
});

test('on a phone the grid splits into two halves of 8, with no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
  await page.getByRole('tab', { name: 'Batteria' }).click();
  await reveal(page, page.getByTestId('drum-kick-0'));
  const first = await page.getByTestId('drum-kick-0').boundingBox();
  await reveal(page, page.getByTestId('drum-kick-8'));
  const ninth = await page.getByTestId('drum-kick-8').boundingBox();
  expect(Math.abs((first?.x ?? 0) - (ninth?.x ?? 99))).toBeLessThan(2);
  expect(ninth?.y ?? 0).toBeGreaterThan(first?.y ?? 0);
  expect(first?.width ?? 0).toBeGreaterThanOrEqual(24);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
