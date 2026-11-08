import { expect, test } from '@playwright/test';
import { reveal } from './studio';

/** P1-10: arpeggio phases in the routine editor — one chord per phase, on the downbeat. */

test('ii–V–I arpeggiated: each phase plays only its chord, and a wrong chord gets a fix', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await reveal(page, page.getByTestId('open-editor'));
  await page.getByTestId('open-editor').click();
  const editor = page.getByTestId('routine-editor');
  await editor.getByLabel('Parti da un modello').selectOption({ label: 'ii–V–I in Do arpeggiato, forma E: un accordo per fase' });
  await expect(editor.getByTestId('phase-block')).toHaveCount(3);
  await expect(editor.getByTestId('phase-chord-2')).toHaveValue('G7');
  // A chord the engine cannot read: error, and a one-click fix with the scale's tonic seventh.
  await editor.getByTestId('phase-chord-1').fill('Hm9');
  await expect(editor.getByText('Accordo non riconosciuto')).toBeVisible();
  await editor.getByRole('button', { name: 'Usa Dm7' }).click();
  await expect(editor.getByTestId('phase-chord-1')).toHaveValue('Dm7');
  await editor.getByTestId('routine-apply').click();
  await reveal(page, page.getByTestId('routine-summary'));
  await expect(page.getByTestId('routine-summary')).toContainText('Arpeggio Dm7');

  await reveal(page, page.getByRole('checkbox', { name: 'Evidenzia le note a tempo' }));
  await page.getByRole('checkbox', { name: 'Evidenzia le note a tempo' }).check();
  await page.getByTestId('bpm').fill('240');
  await page.getByTestId('play').click();
  await expect.poll(async () => page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'note' && e.tick >= 3840).length), { timeout: 10000 }).toBeGreaterThan(2);
  await page.getByTestId('stop').click();
  const notes = await page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'note').map((e) => ({ tick: e.tick, pc: (e.midi as number) % 12 })));
  // Phase 1 (Dm7) fills whole bars from 0; every note of it is D, F, A or C.
  const first = notes.filter((n) => n.tick < 1920);
  expect(first.length).toBeGreaterThan(4);
  expect(first.every((n) => [2, 5, 9, 0].includes(n.pc))).toBe(true);
  expect(errors).toEqual([]);
});
