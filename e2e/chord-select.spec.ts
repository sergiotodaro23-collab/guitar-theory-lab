import { expect, test, type Page } from '@playwright/test';
import { chooseLook } from './studio';

/** Choosing chords while the transport runs (owner report, real-guitar session). */

const open = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await expect(page.getByTestId('play')).toBeVisible();
};
const chordEvents = (page: Page) => page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'chord').map((e) => e.chord));

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: manual changes — quick picks keep only the last, N N moves two chords`, async ({ page }) => {
    await open(page);
    await chooseLook(page, look);
    await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
    await page.getByRole('button', { name: 'Manuale', exact: true }).click();
    await page.getByTestId('bpm').fill('60');
    await page.getByTestId('play').click();
    await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');
    const strip = page.getByTestId('chord-strip');
    // The chip holds the symbol, then its length in a child span.
    const symbol = (i: number) => strip.getByTestId(`chip-${i}`).evaluate((el) => el.firstChild?.textContent ?? '');

    // Two picks inside the same beat: one change, to the second pick.
    await strip.getByTestId('chip-1').click();
    await strip.getByTestId('chip-2').click();
    await expect.poll(() => chordEvents(page), { timeout: 4000 }).toHaveLength(1);
    expect(await chordEvents(page)).toEqual([2]);
    await expect(page.getByTestId('current-chord')).toHaveText(await symbol(2));

    // N twice before the next beat: two chords on, wrapping round the progression.
    const count = await strip.locator('[data-testid^="chip-"]').count();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('n');
    await page.keyboard.press('n');
    const expected = (2 + 2) % count;
    await expect(page.getByTestId('current-chord')).toHaveText(await symbol(expected), { timeout: 4000 });
    await page.getByTestId('stop').click();
  });
}

test('automatic changes: while playing, chips explain why they wait instead of silently refusing', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  const hint = page.getByTestId('chord-strip-hint');
  await expect(hint).toHaveText('Scegli l’accordo da cui partire.');
  const before = await page.getByTestId('chord-strip').boundingBox();
  await page.getByTestId('play').click();
  await expect(page.getByTestId('chip-1')).toBeDisabled();
  await expect(hint).toContainText('passa a Cambio accordi: Manuale');
  // The hint line is reserved: the strip does not move when its text changes.
  expect(await page.getByTestId('chord-strip').boundingBox()).toEqual(before);
  // N while the progression drives does not move a hidden selection.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('chip-0')).toHaveAttribute('aria-current', 'true');
});
