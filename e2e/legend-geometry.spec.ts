import { expect, test } from '@playwright/test';
import { chooseLook, openTab } from './studio';

/** N2 · the legend draws the neck's own glyphs; N3 · a colour chosen there is applied to the neck and kept after reload. */

test('the legend swatch is the same shape the neck draws, by role', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('play')).toBeVisible();
  // A scale alone: the tonic is a square, the other scale notes are circles, on the neck and in the legend.
  await expect(page.locator('.v57-board .fretboard .role-root .shape').first()).toHaveAttribute('data-glyph', 'square');
  await expect(page.locator('.v57-board .fretboard .role-scale .shape').first()).toHaveAttribute('data-glyph', 'circle');
  await openTab(page, 'Legenda e visualizzazione', 'Legenda');
  const legend = page.getByTestId('notebook-legend').getByTestId('legend');
  await expect(legend.locator('[data-kind="root"] svg.legend-glyph')).toHaveAttribute('data-glyph', 'square');
  await expect(legend.locator('[data-kind="root"]')).toContainText('quadrato');
  await expect(legend.locator('[data-kind="scale"] svg.legend-glyph')).toHaveAttribute('data-glyph', 'circle');
  // Over a chord: the chord's root is a square, its guide tones ringed circles.
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await openTab(page, 'Legenda e visualizzazione', 'Legenda');
  await expect(legend.locator('[data-kind="chord-root"] svg.legend-glyph')).toHaveAttribute('data-glyph', 'square');
  await expect(legend.locator('[data-kind="guide"]')).toBeVisible();
  const rootsOnNeck = await page.locator('.v57-board .fretboard .role-chord-tone .shape[data-glyph="square"]').count();
  expect(rootsOnNeck).toBeGreaterThan(0);
});

test('a marker colour picked in the legend page paints the neck and the legend, and survives a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('play')).toBeVisible();
  await openTab(page, 'Legenda e visualizzazione', 'Legenda');
  const fill = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).fill);
  const before = await fill('.v57-board .fretboard .role-root .shape');
  await page.getByTestId('marker-color-root').fill('#2050c0');
  await expect.poll(() => fill('.v57-board .fretboard .role-root .shape')).toBe('rgb(32, 80, 192)');
  expect(before).not.toBe('rgb(32, 80, 192)');
  await expect.poll(() => fill('[data-testid="notebook-legend"] [data-kind="root"] .shape')).toBe('rgb(32, 80, 192)');
  // A dark fill brings light ink for the label.
  await expect.poll(() => page.locator('.v57-board .fretboard .role-root .marker-label').first().evaluate((el) => getComputedStyle(el).fill)).toBe('rgb(251, 247, 236)');
  // The session is saved a moment after the last change.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('gtl.session') ?? '')).toContain('#2050c0');
  await page.reload();
  await expect(page.getByTestId('play')).toBeVisible();
  await expect.poll(() => fill('.v57-board .fretboard .role-root .shape')).toBe('rgb(32, 80, 192)');
  // The Simple look takes the same choice.
  await chooseLook(page, 'Semplificata');
  await expect.poll(() => fill('.fretboard .role-root .shape')).toBe('rgb(32, 80, 192)');
  await chooseLook(page, 'Studio');
  await openTab(page, 'Legenda e visualizzazione', 'Legenda');
  await page.getByTestId('marker-colors-reset').click();
  await expect.poll(() => fill('.v57-board .fretboard .role-root .shape')).toBe(before);
});
