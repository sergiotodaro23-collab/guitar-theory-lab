import { expect, test } from '@playwright/test';

/** A3: in Arpeggios Lab a note of the arpeggio carries the outline triangle, and the legend names it. */
test('Arpeggios Lab: the arpeggio mark is drawn on the arpeggio notes and listed in the legend', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  const lab = page.getByTestId('studio-rail').getByRole('button', { name: 'Arpeggios Lab', exact: true });
  await lab.click();
  await expect(page.locator('.v57-board .fretboard .arp-mark').first()).toBeAttached();
  const marks = await page.locator('.v57-board .fretboard .arp-mark').count();
  const markers = await page.locator('.v57-board .fretboard .marker').count();
  expect(marks).toBeGreaterThan(0);
  expect(marks).toBeLessThanOrEqual(markers);
  await page.getByTestId('notebook').getByRole('tab', { name: 'Legenda e visualizzazione', exact: true }).click();
  const entry = page.getByTestId('notebook-legend').locator('[data-kind="arpeggio"]');
  await expect(entry).toContainText("Nota dell'arpeggio");
  await expect(entry).toContainText('triangolo a contorno');
  await expect(entry.locator('svg.legend-glyph .arp-mark')).toHaveCount(1);
});
