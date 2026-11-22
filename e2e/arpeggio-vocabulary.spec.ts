import { expect, test } from '@playwright/test';
import { chooseLook, loadPreset, reveal } from './studio';

/** AR2–AR4, AR7: patterns over the arpeggio shape, from the preset library and from the panel. */

const labels = (page: import('@playwright/test').Page) => page.$$eval('.fretboard .marker .marker-label', (els) => [...new Set(els.map((e) => e.textContent ?? ''))].sort());

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: triad pair and upper structure on Cmaj7#11`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await chooseLook(page, look);
    await page.getByRole('button', { name: 'Arpeggios Lab', exact: true }).click();
    await loadPreset(page, { id: 'ar-lydian-triad-pair' });
    await reveal(page, page.getByTestId('arp-pair'));
    await expect(page.getByTestId('arp-pair')).toContainText('C e D');
    // The pair of C lydian on I and II: C E G and D F# A, drawn as functions over Cmaj7#11.
    await expect.poll(() => labels(page)).toEqual(['#11', '1', '13', '3', '5', '9']);

    await reveal(page, page.getByTestId('arp-vocab-pattern'));
    await page.getByTestId('arp-vocab-pattern').selectOption('upper');
    await page.getByTestId('arp-upper').selectOption('II');
    await expect(page.getByTestId('arp-vocab')).toContainText('D su Cmaj7#11: 9 #11 13');
    await expect.poll(() => labels(page)).toEqual(['#11', '13', '9']);
    expect(errors).toEqual([]);
  });
}
