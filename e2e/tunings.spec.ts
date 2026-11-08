import { expect, test } from '@playwright/test';
import { chooseLook } from './studio';

/** P1-05: the neck follows the tuning — presets, a custom tuning, and labels by interval. */

const markerAt = (page: import('@playwright/test').Page, string: number, fret: number) => page.locator(`.fretboard .marker[data-string="${string}"][data-fret="${fret}"]`);

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: Drop D and a custom tuning move the notes on the low string`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await chooseLook(page, look);
    if (look === 'Semplificata') await page.getByRole('tab', { name: 'Scale' }).click();
    await page.getByTestId('tonic').selectOption('D');
    await page.getByRole('group', { name: 'Etichette' }).first().getByRole('button', { name: 'Nome' }).click();
    // The whole neck, so every place is drawn.
    await page.getByRole('group', { name: 'Diteggiatura' }).getByRole('button', { name: 'Tutta la tastiera' }).click();
    // Standard tuning: the open sixth string is E, the second degree of D major.
    await expect(markerAt(page, 0, 0)).toHaveAttribute('data-label', 'E');
    await page.getByTestId('neck-tuning').selectOption('drop-d');
    await expect(markerAt(page, 0, 0)).toHaveAttribute('data-label', 'D');
    await expect(markerAt(page, 0, 2)).toHaveAttribute('data-label', 'E');
    // A custom tuning: the sixth string down to C.
    await page.getByTestId('neck-tuning').selectOption('custom');
    await page.getByTestId('tuning-string-6').selectOption({ label: 'C#2' });
    await expect(markerAt(page, 0, 0)).toHaveAttribute('data-label', 'C#');
    // Interval labels: from the tonic D, the open C# is a major seventh.
    await page.getByRole('group', { name: 'Etichette' }).first().getByRole('button', { name: 'Intervallo' }).click();
    await expect(markerAt(page, 0, 0)).toHaveAttribute('data-label', '7M');
    expect(errors).toEqual([]);
  });
}
