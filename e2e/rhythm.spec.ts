import { expect, test } from '@playwright/test';
import { reveal } from './studio';

/** M3: note values, rests, articulation and separation bars reach the sequencer. */

const exerciseTicks = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const track = window.__gtl?.engine.tracksNow?.().exercise;
  return {
    ticks: (track?.events ?? []).map((e) => e.tick),
    durations: (track?.events ?? []).map((e) => (e.payload as { durationTicks: number }).durationTicks),
    length: track?.lengthTicks ?? 0,
  };
});

test('single exercise: triplets and staccato change when the notes fall and how long they sound', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  const values = page.getByLabel("Valori ritmici dell'esercizio");
  await reveal(page, values);
  await page.getByLabel("Ritmo dell'esercizio").selectOption({ label: 'Terzine di crome' });
  await expect(values).toHaveValue('8t 8t 8t');
  let t = await exerciseTicks(page);
  expect(t.ticks.slice(0, 4)).toEqual([0, 160, 320, 480]);
  await page.getByRole('group', { name: "Durata delle note dell'esercizio" }).getByRole('button', { name: 'Staccato' }).click();
  t = await exerciseTicks(page);
  expect(t.durations.slice(0, 2)).toEqual([80, 80]);
  // A typo is explained and the exercise keeps playing on notes per beat.
  await values.fill('8 x');
  await expect(page.getByText('«x» non è un valore')).toBeVisible();
  t = await exerciseTicks(page);
  expect(t.ticks.length).toBeGreaterThan(4);
});

test('advanced editor: dotted rhythm and a separation bar in a phase', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await reveal(page, page.getByTestId('open-editor'));
  await page.getByTestId('open-editor').click();
  const editor = page.getByTestId('routine-editor');
  await editor.getByLabel('Parti da un modello').selectOption({ label: 'Do maggiore: forma C su, forma G giù' });
  const before = await (async () => {
    await editor.getByTestId('routine-apply').click();
    return exerciseTicks(page);
  })();
  await page.getByTestId('open-editor').click();
  await editor.getByLabel('Ritmo della fase 1').selectOption({ label: 'Croma puntata e semicroma' });
  await editor.getByLabel('Battute di pausa dopo la fase 1').selectOption('1');
  await editor.getByTestId('routine-apply').click();
  const after = await exerciseTicks(page);
  expect(after.ticks.slice(0, 4)).toEqual([0, 360, 480, 840]);
  expect(after.length).toBeGreaterThan(before.length);
  expect(after.length % 1920).toBe(0);
});
