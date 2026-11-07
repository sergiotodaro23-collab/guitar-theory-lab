import { expect, test, type Page } from '@playwright/test';

/** Click / Accenti: 16 steps, separate from the meter, heard by the scheduler. */

const open = async (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await expect(page.getByTestId('play')).toBeVisible();
  return errors;
};
const step = (page: Page, i: number) => page.getByTestId(`accent-${i}`);
const clicks = (page: Page) => page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.step !== undefined).map((e) => ({ step: e.step, level: e.level })));

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: the grid follows the meter until edited, and the edit is what plays`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors = await open(page);
    await page.getByTestId('appearance').getByRole('button', { name: look, exact: true }).click();
    await page.getByTestId('accent-toggle').click();
    const grid = page.getByTestId('accent-grid');
    await expect(grid.getByRole('button', { name: /^Passo/ })).toHaveCount(16);

    // 4/4 in quarters: four active steps, accent on one.
    await expect(grid).toHaveAttribute('data-steps', '4');
    await expect(step(page, 0)).toHaveAttribute('data-level', '3');
    await expect(step(page, 1)).toHaveAttribute('data-level', '2');
    await expect(step(page, 4)).toBeDisabled();
    // Sixteenths fill all 16; 6/8 in eighths gives six, pulse on 1 and 4.
    await page.getByLabel('Suddivisione del click').first().selectOption('4');
    await expect(grid).toHaveAttribute('data-steps', '16');
    await expect(step(page, 15)).toBeEnabled();
    await page.getByLabel('Suddivisione del click').first().selectOption('1');
    await page.getByTestId('meter').first().selectOption('6/8');
    await expect(grid).toHaveAttribute('data-steps', '6');
    await expect(step(page, 3)).toHaveAttribute('data-level', '2');
    await expect(step(page, 1)).toHaveAttribute('data-level', '1');
    await page.getByTestId('meter').first().selectOption('4/4');

    // Edit: step 2 (normal) → accent → silent. The pattern is now personal.
    await step(page, 1).click();
    await expect(step(page, 1)).toHaveAttribute('aria-label', 'Passo 2: accento');
    await step(page, 1).click();
    await expect(step(page, 1)).toHaveAttribute('data-level', '0');
    await expect(page.getByTestId('accent-source')).toHaveText('Pattern personale');
    // Keyboard: up raises, down lowers, right moves on.
    await step(page, 2).focus();
    await page.keyboard.press('ArrowUp');
    await expect(step(page, 2)).toHaveAttribute('data-level', '3');
    await page.keyboard.press('ArrowRight');
    await expect(step(page, 3)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(step(page, 3)).toHaveAttribute('data-level', '1');

    // What the scheduler hands to the audio follows the pattern.
    await page.getByTestId('click-sound').selectOption('wood');
    await page.getByTestId('bpm').fill('240');
    await page.getByTestId('play').click();
    await expect.poll(async () => (await clicks(page)).length, { timeout: 5000 }).toBeGreaterThan(8);
    await page.getByTestId('stop').click();
    const heard = await clicks(page);
    for (const click of heard) expect(click.level).toBe([3, 0, 3, 1][click.step ?? 0]);

    // Back to the meter.
    await page.getByRole('button', { name: 'Riporta alla metrica' }).click();
    await expect(step(page, 1)).toHaveAttribute('data-level', '2');
    await expect(page.getByTestId('accent-source')).toHaveText('Dalla metrica');
    expect(errors).toEqual([]);
  });
}

test('on a phone the 16 steps sit in two rows of eight, all visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByTestId('time-more-toggle').click();
  await page.getByTestId('accent-toggle').click();
  const first = await step(page, 0).boundingBox();
  const eighth = await step(page, 7).boundingBox();
  const ninth = await step(page, 8).boundingBox();
  expect(Math.round(first?.y ?? 0)).toBe(Math.round(eighth?.y ?? 1));
  expect(ninth?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + 20);
  for (const i of [0, 15]) await expect(step(page, i)).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

// Fonts are not bundled: a wider system font can push the key to a second
// row. The panel must still open inside the window and keep its place when
// the pattern turns personal (the failure seen on the CI runner).
for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: with a wide system font the panel stays in the window`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    await page.addStyleTag({ content: "*, :root { font-family: 'DejaVu Sans', 'Verdana', sans-serif !important; --display: 'DejaVu Sans', 'Verdana', sans-serif; --plate-font: 'DejaVu Sans', 'Verdana', sans-serif; }" });
    await page.getByTestId('appearance').getByRole('button', { name: look, exact: true }).click();
    const key = await page.getByTestId('accent-toggle').boundingBox();
    await page.getByTestId('accent-toggle').click();
    for (const i of [0, 3, 15]) await expect(step(page, i)).toBeInViewport({ ratio: 1 });
    const before = await step(page, 1).boundingBox();
    await step(page, 1).click();
    await step(page, 1).click();
    await expect(step(page, 1)).toHaveAttribute('data-level', '0');
    expect(await step(page, 1).boundingBox()).toEqual(before);
    expect((await page.getByTestId('accent-toggle').boundingBox())?.width).toBe(key?.width);
  });
}
