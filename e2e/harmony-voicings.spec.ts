import { expect, test } from '@playwright/test';
import { chooseLook, loadPreset, reveal } from './studio';

/** HA3–HA5 (D-67): engine voicings in Harmony Lab — the board draws the voicing the panel describes. */

const voicingFrets = (page: import('@playwright/test').Page) =>
  page.$$eval('.fretboard .in-voicing', (els) => els.map((e) => Number(e.getAttribute('data-fret'))).sort((a, b) => a - b));

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: harmonize C major in Drop 2 on strings 1–4, then load a ii–V–I preset`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await chooseLook(page, look);
    await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();

    await reveal(page, page.getByTestId('harmonize-kind'));
    await page.getByTestId('harmonize-kind').selectOption('seventh');
    await page.getByTestId('harmonize-apply').click();
    await page.getByTestId('voicing-type').selectOption('drop2');
    await page.getByTestId('voicing-set').selectOption('1-2-3-4');

    const current = page.getByTestId('voicing-current');
    await expect(current).toContainText(/^Cmaj7: x x \d+ \d+ \d+ \d+ · /);
    const text = (await current.textContent()) ?? '';
    const frets = (/^Cmaj7: x x (\d+) (\d+) (\d+) (\d+)/.exec(text) ?? []).slice(1).map(Number).sort((a, b) => a - b);
    // Four ringed notes on the neck, on the frets the panel names.
    await expect.poll(() => voicingFrets(page)).toEqual(frets);

    await loadPreset(page, { id: 'ha-251-drop2-f-2345' });
    await reveal(page, page.getByTestId('voicing-current'));
    await expect(page.getByTestId('voicing-current')).toContainText(/^Gm7: x \d+ \d+ \d+ \d+ x/);
    await expect(page.getByTestId('voicing-current')).toContainText('verso il prossimo');
    expect(errors).toEqual([]);
  });
}
