import { expect, test } from '@playwright/test';
import { reveal } from './studio';

/** M4: the strings an exercise uses reach the sequencer. */

const strings = (page: import('@playwright/test').Page) => page.evaluate(() =>
  [...new Set((window.__gtl?.engine.tracksNow?.().exercise?.events ?? []).map((e) => (e.payload as { string: number }).string))].sort());

test('single exercise on 6-4-2, then strings ticked by hand', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  const select = page.getByLabel("Corde dell'esercizio", { exact: true });
  await reveal(page, select);
  expect(await strings(page)).toEqual([0, 1, 2, 3, 4, 5]);
  await select.selectOption({ label: 'Salto di corda: 6ª, 4ª, 2ª' });
  await expect(page.getByText('Salto di corda: le corde in mezzo non suonano.')).toBeVisible();
  // The default exercise is in thirds: only notes with a third on the same strings stay, all on 6, 4 or 2.
  let used = await strings(page);
  expect(used.length).toBeGreaterThan(1);
  expect(used.every((s) => [0, 2, 4].includes(s))).toBe(true);
  // Tick string 1 on: 6, 4, 2, 1.
  await page.getByRole('group', { name: "Scegli le corde dell'esercizio" }).getByRole('button', { name: 'Corda 1' }).click();
  used = await strings(page);
  expect(used).toContain(5);
  expect(used.every((s) => [0, 2, 4, 5].includes(s))).toBe(true);
  await select.selectOption({ label: 'Tutte le corde' });
  expect(await strings(page)).toEqual([0, 1, 2, 3, 4, 5]);
});

test('a phase of the advanced editor on the top three strings', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await reveal(page, page.getByTestId('open-editor'));
  await page.getByTestId('open-editor').click();
  const editor = page.getByTestId('routine-editor');
  await editor.getByLabel('Parti da un modello').selectOption({ label: 'Do maggiore: forma C su, forma G giù' });
  await editor.getByLabel('Corde della fase 1', { exact: true }).selectOption({ label: '1ª, 2ª, 3ª' });
  await editor.getByLabel('Corde della fase 2', { exact: true }).selectOption({ label: '1ª, 2ª, 3ª' });
  await editor.getByTestId('routine-apply').click();
  expect(await strings(page)).toEqual([3, 4, 5]);
});
