import { expect, test } from '@playwright/test';
import { chooseLook } from './studio';

/** P1-11b: modal interchange — the analysis, the chord's own scale, and views that start from it. */

const names = (page: import('@playwright/test').Page) => page.$$eval('.fretboard .marker .marker-label', (els) => [...new Set(els.map((e) => e.textContent ?? ''))].sort());

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: I–IV–iv–I in C — the iv is borrowed, and the board can follow each chord's scale`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await chooseLook(page, look);
    await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
    await page.getByTestId('template').selectOption('interchange-iv');
    await expect(page.getByTestId('analysis-0')).toHaveAttribute('data-kind', 'diatonic');
    await expect(page.getByTestId('analysis-2')).toHaveAttribute('data-kind', 'borrowed');
    await expect(page.getByTestId('analysis-2')).toContainText('iv7');
    await expect(page.getByTestId('analysis-2')).toContainText('F dorica');

    await page.getByRole('group', { name: 'Etichette' }).getByRole('button', { name: 'Nome' }).click();
    await page.getByTestId('chip-2').click();
    // Until the switch: C major, with Fm7's Ab and Eb drawn as tones outside the scale; then F dorian alone.
    await expect.poll(() => names(page)).toEqual(['A', 'Ab', 'B', 'C', 'D', 'E', 'Eb', 'F', 'G']);
    await page.getByRole('checkbox', { name: /Scala di ogni accordo dall’analisi/ }).check();
    await expect.poll(() => names(page)).toEqual(['Ab', 'Bb', 'C', 'D', 'Eb', 'F', 'G']);

    // A new view for Fm7 starts from the same proposal.
    if (look === 'Semplificata') await page.getByRole('tab', { name: 'Per accordo' }).click();
    await page.getByTestId('view-chip-2').click();
    await page.getByTestId('view-customize').click();
    await expect(page.getByTestId('view-scale')).toHaveValue('dorian');
    await expect(page.getByTestId('view-tonic')).toHaveValue('F');
    expect(errors).toEqual([]);
  });
}

test('the backdoor progression: bVI and bVII7 borrowed from aeolian; the key can be changed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await page.getByTestId('template').selectOption('interchange-backdoor');
  await expect(page.getByTestId('analysis-1')).toContainText('bVImaj7');
  await expect(page.getByTestId('analysis-2')).toContainText('bVII7');
  await expect(page.getByTestId('analysis-2')).toHaveAttribute('data-kind', 'borrowed');
  // Read in C aeolian, the same chords are at home.
  await page.getByTestId('analysis-mode').selectOption('aeolian');
  await expect(page.getByTestId('analysis-1')).toHaveAttribute('data-kind', 'diatonic');
});
