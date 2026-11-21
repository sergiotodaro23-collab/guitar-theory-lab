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

test('changing the key moves the advanced exercise: summary, board and playback follow, and come back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await reveal(page, page.getByTestId('open-editor'));
  await page.getByTestId('open-editor').click();
  const editor = page.getByTestId('routine-editor');
  await editor.getByLabel('Parti da un modello').selectOption({ label: 'ii–V–I in Do arpeggiato, forma E: un accordo per fase' });
  await editor.getByTestId('routine-apply').click();
  await reveal(page, page.getByTestId('routine-summary'));
  await expect(page.getByTestId('routine-summary')).toContainText('Arpeggio Dm7');
  /** Pitch classes the sequencer will play, from the same tracks the engine schedules. */
  const played = () => page.evaluate(() => {
    const track = window.__gtl?.engine.tracksNow?.().exercise;
    return (track?.events ?? []).map((e) => (e.payload as { midi: number }).midi % 12);
  });
  const marks = () => page.locator('.v57-board .fretboard .marker').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? '').join('|'));
  const [inC, boardInC] = [await played(), await marks()];
  expect(inC.length).toBeGreaterThan(8);

  // C → D: a whole tone up.
  await reveal(page, page.getByTestId('tonic'));
  await page.getByTestId('tonic').selectOption('D');
  await reveal(page, page.getByTestId('routine-summary'));
  await expect(page.getByTestId('routine-summary')).toContainText('Arpeggio Em7');
  await expect(page.getByTestId('routine-summary')).not.toContainText('Dm7');
  expect(await played()).toEqual(inC.map((p) => (p + 2) % 12));
  expect(await marks()).not.toBe(boardInC);

  // D → Bb, then back to C: the exercise is where it started.
  await reveal(page, page.getByTestId('tonic'));
  await page.getByTestId('tonic').selectOption('Bb');
  expect(await played()).toEqual(inC.map((p) => (p + 10) % 12));
  await page.getByTestId('tonic').selectOption('C');
  await reveal(page, page.getByTestId('routine-summary'));
  await expect(page.getByTestId('routine-summary')).toContainText('Arpeggio Dm7');
  expect(await played()).toEqual(inC);
  expect(await marks()).toBe(boardInC);
});

test('relational transposition (M1): C → D moves A minor phases to B, a fixed phase stays', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await reveal(page, page.getByTestId('open-editor'));
  await page.getByTestId('open-editor').click();
  const editor = page.getByTestId('routine-editor');
  await editor.getByLabel('Parti da un modello').selectOption({ label: 'Rispetto alla tonalità: La minore naturale su, La minore melodica giù' });
  await editor.getByTestId('routine-apply').click();
  const summary = page.getByTestId('routine-summary');
  await reveal(page, summary);
  await expect(summary.locator('li').nth(0)).toContainText('A Minore naturale');
  await expect(summary.locator('li').nth(1)).toContainText('A Minore melodica');

  await reveal(page, page.getByTestId('tonic'));
  await page.getByTestId('tonic').selectOption('D');
  await reveal(page, summary);
  await expect(summary.locator('li').nth(0)).toContainText('B Minore naturale');
  await expect(summary.locator('li').nth(1)).toContainText('B Minore melodica');

  // Second phase made independent: the next key change leaves it on B.
  await reveal(page, page.getByTestId('open-editor'));
  await page.getByTestId('open-editor').click();
  await editor.getByRole('group', { name: 'Trasposizione della fase 2' }).getByRole('button', { name: 'Fissa' }).click();
  await editor.getByTestId('routine-apply').click();
  await reveal(page, page.getByTestId('tonic'));
  await page.getByTestId('tonic').selectOption('E');
  await reveal(page, summary);
  await expect(summary.locator('li').nth(0)).toContainText('C# Minore naturale');
  await expect(summary.locator('li').nth(1)).toContainText('B Minore melodica');
});
