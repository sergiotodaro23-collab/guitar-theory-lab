import { expect, test } from '@playwright/test';
import { openTab } from './studio';

/** N5 · by default the Note views show the mode of the reference key on the chord in play; alternatives can be overlaid. */
test('Harmony Lab: the legend page names the mode on the chord in play and overlays a compatible scale', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('play')).toBeVisible();
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await openTab(page, 'Legenda e visualizzazione', 'Legenda');
  const panel = page.getByTestId('chord-scale');
  await expect(page.getByTestId('chord-scale-follow')).toBeChecked();
  // The default ii–V–I in C starts on Dm7: D dorian, a mode of C major.
  await expect(page.getByTestId('chord-scale-shown')).toContainText('Dm7 → D dorica');
  const current = panel.locator('[data-current="1"]');
  await expect(current).toHaveAttribute('data-scale', 'dorian');
  // Overlay an alternative: it becomes a scale layer, listed in the legend.
  await panel.getByRole('button', { name: /Sovrapponi D minore naturale/ }).click();
  await expect(panel.getByRole('button', { name: /Sovrapponi D minore naturale/ })).toBeDisabled();
  await expect(page.getByTestId('notebook-legend').getByTestId('legend-layer')).toContainText('D Minore naturale');
  // Turning the context off returns to the reference scale.
  await page.getByTestId('chord-scale-follow').uncheck();
  await expect(page.getByTestId('chord-scale-why')).toContainText('Scala di riferimento');
});
