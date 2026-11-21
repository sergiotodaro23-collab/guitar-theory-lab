import { expect, test } from '@playwright/test';
import { reveal } from './studio';

/** M5: ready-made sequences, groups that alternate direction, chromatic approaches, reaching the sequencer. */

const midis = (page: import('@playwright/test').Page) => page.evaluate(() =>
  (window.__gtl?.engine.tracksNow?.().exercise?.events ?? []).map((e) => (e.payload as { midi: number }).midi));

test('groups of 4 alternating up and down, then a chromatic approach', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  const kind = page.getByRole('group', { name: 'Tipo di esercizio' });
  await reveal(page, kind);
  await kind.getByRole('button', { name: 'Sequenza' }).click();
  await page.getByLabel('Modello di sequenza', { exact: true }).selectOption({ label: 'Gruppi di 4' });
  await expect(page.getByTestId('custom-pattern')).toHaveValue('1 2 3 4');
  const written = await midis(page);
  // Each group of four rises by step from the next degree.
  expect(written[1]).toBeGreaterThan(written[0] as number);
  expect(written[3]).toBeGreaterThan(written[2] as number);
  await page.getByRole('group', { name: 'Direzione di ogni gruppo' }).getByRole('button', { name: 'Alterna' }).click();
  const alternate = await midis(page);
  // The second group now falls: it starts on the highest of its four notes.
  expect(alternate[4]).toBeGreaterThan(alternate[5] as number);
  expect(alternate[5]).toBeGreaterThan(alternate[6] as number);
  await page.getByTestId('custom-pattern').fill('3c 3 2 1');
  await expect(page.getByTestId('custom-pattern')).not.toHaveAttribute('aria-invalid', 'true');
  const chromatic = await midis(page);
  expect((chromatic[1] as number) - (chromatic[0] as number)).toBe(1);
  expect(errors).toEqual([]);
});
