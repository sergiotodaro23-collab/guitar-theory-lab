import { expect, test, type Page } from '@playwright/test';

/** P1-14: one view per chord of the progression, shared by Harmony, Arpeggios and Jam. */

const names = (page: Page) => page.$$eval('.fretboard .marker .marker-label', (els) => [...new Set(els.map((e) => e.textContent ?? ''))].sort());
const DM7 = ['A', 'C', 'D', 'F'];
const C_MAJOR = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const CMAJ7 = ['B', 'C', 'E', 'G'];

async function setup(page: Page, look: 'Studio' | 'Semplificata') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByTestId('appearance').getByRole('button', { name: look, exact: true }).click();
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await page.getByTestId('template').selectOption('ii-v-i');
  await page.getByRole('group', { name: 'Etichette' }).getByRole('button', { name: 'Nome' }).click();
  if (look === 'Semplificata') await page.getByRole('tab', { name: 'Per accordo' }).click();
}

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: ii–V–I — Dm7 arpeggio, G7 mixolydian, Cmaj7 arpeggio with guide tones`, async ({ page }) => {
    await setup(page, look);
    // Dm7: only its arpeggio.
    await page.getByTestId('view-chip-0').click();
    await page.getByTestId('view-customize').click();
    await page.getByRole('group', { name: 'Cosa mostrare' }).getByRole('button', { name: 'Solo arpeggio' }).click();
    await expect.poll(() => names(page)).toEqual(DM7);
    // G7: the suggested G mixolydian, every function.
    await page.getByTestId('view-chip-1').click();
    await page.getByTestId('view-customize').click();
    await expect(page.getByTestId('view-scale')).toHaveValue('mixolydian');
    await expect(page.getByTestId('view-tonic')).toHaveValue('G');
    await expect.poll(() => names(page)).toEqual(C_MAJOR);
    // Cmaj7: arpeggio, guide tones in focus (E and B bright, C and G dimmed).
    await page.getByTestId('view-chip-2').click();
    await page.getByTestId('view-customize').click();
    await page.getByRole('group', { name: 'Cosa mostrare' }).getByRole('button', { name: 'Solo arpeggio' }).click();
    await page.getByTestId('view-focus').selectOption('guide');
    await expect.poll(() => names(page)).toEqual(CMAJ7);
    const dim = await page.$$eval('.fretboard .marker.is-dim .marker-label', (els) => [...new Set(els.map((e) => e.textContent))].sort());
    expect(dim).toEqual(['C', 'G']);

    // Manual choice from the progression strip shows each chord's view.
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
  await page.getByTestId('view-chip-0').click();
  await page.getByTestId('view-customize').click();
  await page.getByRole('group', { name: 'Cosa mostrare' }).getByRole('button', { name: 'Solo arpeggio' }).click();
  await expect.poll(() => names(page)).toEqual(DM7);
  // An arpeggio overlay: G7 drawn as pips over the Dm7 view, listed in the legend.
  await page.getByTestId('view-add-arpeggio').click();
  await expect(page.getByTestId('view-arp-0')).toHaveValue('G7');
  await expect(page.getByTestId('legend-layer')).toContainText('Arpeggio G7');
  // Its G and B join the Dm7 arpeggio (D and F are shared).
  const withOverlay = ['A', 'B', 'C', 'D', 'F', 'G'];
  await expect.poll(() => names(page)).toEqual(withOverlay);

  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await expect(page.getByTestId('view-chip-0')).toHaveClass(/has-view/);
  await expect.poll(() => names(page)).toEqual(withOverlay);

  // Jam Studio reads the same view for the same chord.
  await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
  await page.getByRole('group', { name: 'Etichette' }).getByRole('button', { name: 'Nome' }).click();
  await expect.poll(() => names(page)).toEqual(withOverlay);

  // One switch turns every view off: the general scale comes back.
  await page.getByRole('checkbox', { name: 'Cambia la tastiera con l’accordo' }).first().uncheck();
  await expect.poll(() => names(page)).toEqual(C_MAJOR);
});
