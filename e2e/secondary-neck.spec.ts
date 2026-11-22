import { expect, test } from '@playwright/test';

/** N4 · the secondary neck shows the next chord, or a chord picked from the progression; the pick is kept after reload. */
test('Harmony Lab: the secondary neck follows the next chord or a picked one', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('play')).toBeVisible();
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await page.getByTestId('notebook').getByRole('tab', { name: 'Tastiera secondaria', exact: true }).click();
  const pick = page.getByTestId('secondary-pick');
  await expect(pick).toHaveValue('next');
  const now = await page.getByTestId('next-now').textContent();
  const next = await page.getByTestId('next-chord').textContent();
  expect(next).not.toBe(now);
  // Pick the first chord of the progression: the preview stays on it.
  await pick.selectOption('0');
  await expect(page.getByTestId('next-chord')).toHaveText(now ?? '');
  await expect(page.getByTestId('next-fretboard').locator('.marker').first()).toBeAttached();
  await page.reload();
  await page.getByTestId('notebook').getByRole('tab', { name: 'Tastiera secondaria', exact: true }).click();
  await expect(page.getByTestId('secondary-pick')).toHaveValue('0');
  await page.getByTestId('secondary-pick').selectOption('next');
  await expect(page.getByTestId('next-chord')).toHaveText(next ?? '');
});
