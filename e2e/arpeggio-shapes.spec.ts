import { expect, test, type Page } from '@playwright/test';

/** Arpeggios Lab, P1-12c: shapes along the neck decided by the engine (D-27). */

const open = async (page: Page, look: 'Studio' | 'Semplificata') => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?debug=1');
  await page.getByTestId('appearance').getByRole('button', { name: look, exact: true }).click();
  await page.getByRole('button', { name: 'Arpeggios Lab', exact: true }).click();
  return errors;
};
const markers = (page: Page) => page.locator('.marker').evaluateAll((els) => els.map((e) => ({
  string: Number(e.getAttribute('data-string')), fret: Number(e.getAttribute('data-fret')), label: e.getAttribute('data-label') ?? '',
})));
const notes = (page: Page) => page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'note' && e.midi !== undefined).map((e) => ({ tick: e.tick, midi: e.midi as number })));
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Pitch class of a chord symbol's third: minor in m, m7, m7b5, dim; major otherwise. */
function thirdOf(symbol: string): number {
  const m = /^([A-G])([#b]?)(.*)$/.exec(symbol);
  if (!m) return -1;
  const root = (PC[m[1] as string] ?? 0) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const minor = /^(m(?!aj)|dim)/.test(m[3] ?? '');
  return (root + (minor ? 3 : 4) + 12) % 12;
}
const shape = (page: Page, name: string) => page.getByRole('group', { name: 'Forma dell’arpeggio sul manico' }).getByRole('button', { name, exact: true }).click();

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: three octaves of Cmaj7 along the neck, fingered, and what plays climbs three octaves`, async ({ page }) => {
    const errors = await open(page, look);
    await shape(page, 'Ottave');
    await page.getByRole('group', { name: 'Numero di ottave' }).getByRole('button', { name: '3', exact: true }).click();
    await expect(page.getByTestId('arp-route')).toContainText('25 note');
    const drawn = await markers(page);
    expect(drawn).toHaveLength(13);
    const frets = drawn.map((m) => m.fret);
    expect(Math.max(...frets) - Math.min(...frets)).toBeGreaterThan(8);
    // Fingers from the engine, 1 to 4 on every note.
    await page.getByRole('group', { name: 'Etichette' }).first().getByRole('button', { name: 'Dito' }).click();
    for (const m of await markers(page)) expect(['1', '2', '3', '4']).toContain(m.label);

    await page.getByTestId('bpm').fill('240');
    await page.getByTestId('play').click();
    await expect.poll(async () => (await notes(page)).length, { timeout: 8000 }).toBeGreaterThan(14);
    await page.getByTestId('stop').click();
    const played = (await notes(page)).sort((a, b) => a.tick - b.tick).map((n) => n.midi);
    expect(played[12]! - played[0]!).toBe(36);
    expect(played.slice(0, 13)).toEqual([...played.slice(0, 13)].sort((a, b) => a - b));
    expect(errors).toEqual([]);
  });
}

test('a shape the hand cannot play is refused, not drawn', async ({ page }) => {
  const errors = await open(page, 'Studio');
  await page.getByTestId('arp-symbol').fill('G');
  await shape(page, 'Ottave');
  await page.getByTestId('arp-low').fill('15');
  const three = page.getByRole('group', { name: 'Numero di ottave' }).getByRole('button', { name: '3', exact: true });
  await expect(three).toBeDisabled();
  await page.getByTestId('arp-low').fill('3');
  await expect(three).toBeEnabled();
  await three.click();
  await expect(page.getByTestId('arp-route')).toContainText('note');
  expect(errors).toEqual([]);
});

test('sweep across five strings and string skipping keep their rules on the board', async ({ page }) => {
  const errors = await open(page, 'Semplificata');
  await page.getByTestId('arp-symbol').fill('A');
  await shape(page, 'Sweep');
  await page.getByTestId('arp-low').fill('12');
  const sweep = await markers(page);
  expect(sweep).toHaveLength(6);
  expect(sweep.filter((m) => m.string !== 5).map((m) => m.string).sort()).toEqual([1, 2, 3, 4]);
  await shape(page, 'Salto di corda');
  const skip = await markers(page);
  const strings = [...new Set(skip.map((m) => m.string))];
  expect(strings.length).toBe(3);
  expect(new Set(strings.map((s) => s % 2)).size).toBe(1);
  expect(errors).toEqual([]);
});

test('on the way down another route: more places drawn, same pitches', async ({ page }) => {
  const errors = await open(page, 'Studio');
  await shape(page, 'Ottave');
  const before = (await markers(page)).length;
  await page.getByRole('group', { name: 'Percorso di ritorno' }).getByRole('button', { name: 'Strada diversa' }).click();
  expect((await markers(page)).length).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('over the progression with CAGED shapes, each change lands on the third', async ({ page }) => {
  const errors = await open(page, 'Studio');
  await page.getByRole('button', { name: 'La progressione' }).click();
  await shape(page, 'CAGED');
  await page.getByRole('group', { name: 'Collegamento tra arpeggi' }).getByRole('button', { name: 'Arriva su un grado' }).click();
  await page.getByTestId('arp-target').selectOption({ label: 'Terza' });
  await page.getByTestId('bpm').fill('240');
  await page.getByTestId('play').click();
  // The default progression has four chords of one bar: wait for the second change.
  await expect.poll(async () => (await notes(page)).filter((n) => n.tick >= 2 * 1920).length, { timeout: 10000 }).toBeGreaterThan(0);
  await page.getByTestId('stop').click();
  const symbols = await page.locator('[data-testid^="chip-"]').evaluateAll((els) => els.map((e) => e.firstChild?.textContent ?? ''));
  expect(symbols.length).toBeGreaterThan(1);
  const changes = await page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'chord').map((e) => ({ tick: e.tick, chord: e.chord as number })));
  const played = await notes(page);
  // After the first chord, every change starts on the chord's third.
  const later = changes.filter((c) => c.tick > 0 && played.some((n) => n.tick === c.tick));
  expect(later.length).toBeGreaterThan(0);
  for (const change of later) {
    const midi = played.find((n) => n.tick === change.tick)?.midi as number;
    expect(midi % 12, symbols[change.chord]).toBe(thirdOf(symbols[change.chord] ?? ''));
  }
  expect(errors).toEqual([]);
});
