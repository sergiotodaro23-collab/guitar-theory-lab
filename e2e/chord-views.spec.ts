import { expect, test, type Page } from '@playwright/test';
import { chooseLook, reveal } from './studio';

/** P1-14: one view per chord of the progression, shared by Harmony, Arpeggios and Jam. */

const names = (page: Page) => page.$$eval('.fretboard .marker .marker-label', (els) => [...new Set(els.map((e) => e.textContent ?? ''))].sort());
const DM7 = ['A', 'C', 'D', 'F'];
const C_MAJOR = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const CMAJ7 = ['B', 'C', 'E', 'G'];

async function setup(page: Page, look: 'Studio' | 'Semplificata') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await chooseLook(page, look);
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await reveal(page, page.getByTestId('template'));
  await page.getByTestId('template').selectOption('ii-v-i');
  await reveal(page, page.getByRole('group', { name: 'Etichette' }));
  await page.getByRole('group', { name: 'Etichette' }).getByRole('button', { name: 'Nome' }).click();
  if (look === 'Semplificata') await page.getByRole('tab', { name: 'Per accordo' }).click();
}

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: ii–V–I — Dm7 arpeggio, G7 mixolydian, Cmaj7 arpeggio with guide tones`, async ({ page }) => {
    await setup(page, look);
    // Dm7: only its arpeggio.
    await reveal(page, page.getByTestId('view-chip-0'));
    await page.getByTestId('view-chip-0').click();
    await reveal(page, page.getByTestId('view-customize'));
    await page.getByTestId('view-customize').click();
    await reveal(page, page.getByRole('group', { name: 'Cosa mostrare' }));
    await page.getByRole('group', { name: 'Cosa mostrare' }).getByRole('button', { name: 'Solo arpeggio' }).click();
    await expect.poll(() => names(page)).toEqual(DM7);
    // G7: the suggested G mixolydian, every function.
    await reveal(page, page.getByTestId('view-chip-1'));
    await page.getByTestId('view-chip-1').click();
    await reveal(page, page.getByTestId('view-customize'));
    await page.getByTestId('view-customize').click();
    await reveal(page, page.getByTestId('view-scale'));
    await expect(page.getByTestId('view-scale')).toHaveValue('mixolydian');
    await reveal(page, page.getByTestId('view-tonic'));
    await expect(page.getByTestId('view-tonic')).toHaveValue('G');
    await expect.poll(() => names(page)).toEqual(C_MAJOR);
    // Cmaj7: arpeggio, guide tones in focus (E and B bright, C and G dimmed).
    await reveal(page, page.getByTestId('view-chip-2'));
    await page.getByTestId('view-chip-2').click();
    await reveal(page, page.getByTestId('view-customize'));
    await page.getByTestId('view-customize').click();
    await reveal(page, page.getByRole('group', { name: 'Cosa mostrare' }));
    await page.getByRole('group', { name: 'Cosa mostrare' }).getByRole('button', { name: 'Solo arpeggio' }).click();
    await reveal(page, page.getByTestId('view-focus'));
    await page.getByTestId('view-focus').selectOption('guide');
    await expect.poll(() => names(page)).toEqual(CMAJ7);
    const dim = await page.$$eval('.fretboard .marker.is-dim .marker-label', (els) => [...new Set(els.map((e) => e.textContent))].sort());
    expect(dim).toEqual(['C', 'G']);

    // Manual choice from the progression strip shows each chord's view.
    await reveal(page, page.getByTestId('view-chip-0'));
    await page.getByTestId('view-chip-0').click();
    await expect.poll(() => names(page)).toEqual(DM7);

    // Automatic changes while playing: the board follows the chord.
    await page.getByTestId('bpm').fill('200');
    await page.getByTestId('play').click();
    await expect(page.getByTestId('current-chord')).toHaveText('G7', { timeout: 5000 });
    await expect.poll(() => names(page)).toEqual(C_MAJOR);
    await expect(page.getByTestId('current-chord')).toHaveText('Cmaj7', { timeout: 5000 });
    await expect.poll(() => names(page)).toEqual(CMAJ7);
    await expect(page.getByTestId('current-chord')).toHaveText('Dm7', { timeout: 8000 });
    await expect.poll(() => names(page)).toEqual(DM7);
    await page.getByTestId('stop').click();
  });
}

test('views are saved, shared with Jam Studio, and can be switched off at once', async ({ page }) => {
  await setup(page, 'Studio');
  await reveal(page, page.getByTestId('view-chip-0'));
  await page.getByTestId('view-chip-0').click();
  await reveal(page, page.getByTestId('view-customize'));
  await page.getByTestId('view-customize').click();
  await reveal(page, page.getByRole('group', { name: 'Cosa mostrare' }));
  await page.getByRole('group', { name: 'Cosa mostrare' }).getByRole('button', { name: 'Solo arpeggio' }).click();
  await expect.poll(() => names(page)).toEqual(DM7);
  // An arpeggio overlay: G7 drawn as pips over the Dm7 view, listed in the legend.
  await reveal(page, page.getByTestId('view-add-arpeggio'));
  await page.getByTestId('view-add-arpeggio').click();
  await reveal(page, page.getByTestId('view-arp-0'));
  await expect(page.getByTestId('view-arp-0')).toHaveValue('G7');
  await reveal(page, page.getByTestId('legend-layer'));
  await expect(page.getByTestId('legend-layer')).toContainText('Arpeggio G7');
  // Its G and B join the Dm7 arpeggio (D and F are shared).
  const withOverlay = ['A', 'B', 'C', 'D', 'F', 'G'];
  await expect.poll(() => names(page)).toEqual(withOverlay);

  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await reveal(page, page.getByTestId('view-chip-0'));
  await expect(page.getByTestId('view-chip-0')).toHaveClass(/has-view/);
  await expect.poll(() => names(page)).toEqual(withOverlay);

  // Jam Studio reads the same view for the same chord.
  await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
  await reveal(page, page.getByRole('group', { name: 'Etichette' }));
  await page.getByRole('group', { name: 'Etichette' }).getByRole('button', { name: 'Nome' }).click();
  await expect.poll(() => names(page)).toEqual(withOverlay);

  // One switch turns every view off: the general scale comes back.
  await reveal(page, page.getByRole('checkbox', { name: 'Cambia la tastiera con l’accordo' }));
  await page.getByRole('checkbox', { name: 'Cambia la tastiera con l’accordo' }).first().uncheck();
  await expect.poll(() => names(page)).toEqual(C_MAJOR);
});

test('a free stretch of frets, a chosen overlay colour, and the exercise that follows each chord', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await chooseLook(page, 'Studio');
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await reveal(page, page.getByTestId('template'));
  await page.getByTestId('template').selectOption('ii-v-i');
  // G7 on frets 12–15 only.
  await reveal(page, page.getByTestId('view-chip-1'));
  await page.getByTestId('view-chip-1').click();
  await reveal(page, page.getByTestId('view-customize'));
  await page.getByTestId('view-customize').click();
  await reveal(page, page.getByRole('group', { name: 'Forma della vista' }));
  await page.getByRole('group', { name: 'Forma della vista' }).getByRole('button', { name: 'Tasti' }).click();
  await reveal(page, page.getByTestId('view-range-low'));
  await page.getByTestId('view-range-low').selectOption('12');
  await reveal(page, page.getByTestId('view-range-high'));
  await page.getByTestId('view-range-high').selectOption('15');
  const frets = await page.locator('.fretboard .marker').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-fret'))));
  expect(frets.length).toBeGreaterThan(10);
  expect(frets.filter((f) => f < 12 || f > 15)).toEqual([]);
  // An overlay in rose.
  await reveal(page, page.getByTestId('view-add-arpeggio'));
  await page.getByTestId('view-add-arpeggio').click();
  await reveal(page, page.getByTestId('view-arp-color-0'));
  await page.getByTestId('view-arp-color-0').selectOption('rose');
  await reveal(page, page.getByTestId('legend'));
  await expect(page.locator('[data-testid="legend-layer"].layer-rose')).toHaveCount(1);
  expect(await page.locator('.fretboard .pip.layer-rose').count()).toBeGreaterThan(0);

  // Play: during G7 the exercise stays in frets 12–15; Dm7 (no view) plays the general exercise elsewhere.
  await reveal(page, page.getByRole('checkbox', { name: 'L’esercizio segue la vista di ogni accordo' }));
  await expect(page.getByRole('checkbox', { name: 'L’esercizio segue la vista di ogni accordo' })).toBeChecked();
  await reveal(page, page.getByRole('checkbox', { name: 'Evidenzia le note a tempo' }));
  await page.getByRole('checkbox', { name: 'Evidenzia le note a tempo' }).check();
  await page.getByTestId('bpm').fill('240');
  await page.getByTestId('play').click();
  await expect.poll(async () => page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'note' && e.tick >= 1920 && e.tick < 3840).length), { timeout: 8000 }).toBeGreaterThan(4);
  await page.getByTestId('stop').click();
  const g7 = await page.evaluate(() => (window.__gtl?.debug.scheduled ?? []).filter((e) => e.kind === 'note' && e.tick >= 1920 && e.tick < 3840).map((e) => e.midi as number));
  expect(g7.every((m) => [0, 2, 4, 5, 7, 9, 11].includes(m % 12))).toBe(true);
  // Frets 12–15: every pitch is between E3+12… on the neck that is MIDI 52 to 79.
  expect(Math.min(...g7)).toBeGreaterThanOrEqual(52);
  expect(errors).toEqual([]);
});
