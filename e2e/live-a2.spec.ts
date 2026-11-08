import { expect, test } from '@playwright/test';
import { centsShown, fakeMic, openInput, wav } from './liveHelpers';

/** Live Monitor and Tuner on a known signal: an A2 at 110 Hz as the microphone (see liveHelpers.ts). */

test.use(fakeMic(wav('a2.wav', 110)));

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: the tuner reads the fifth string in tune; the monitor shows A2 and where it can be`, async ({ page }) => {
    await openInput(page, look);
    await expect(page.getByTestId('tuner-string')).toHaveText('5ª corda · A2', { timeout: 5000 });
    await expect.poll(() => centsShown(page)).toBeLessThanOrEqual(2);
    expect(Math.abs(await centsShown(page))).toBeLessThanOrEqual(2);
    await expect(page.getByTestId('tuner-advice')).toHaveText('Intonata');
    await expect(page.getByTestId('live-note')).toHaveText('A2');
    await expect(page.getByTestId('live-frequency')).toHaveText(/^1(09|10)\.\d Hz$/);
    // A2 is playable in two places on 24 frets: fifth string open, sixth string fifth fret.
    await expect(page.getByTestId('live-positions')).toContainText('in 2 punti');
    await expect(page.locator('.live-possible, .live-likely')).toHaveCount(2);
    await expect(page.getByTestId('legend').locator('[data-kind^="live"]').first()).toBeVisible();
    // The samples reach the analysis through the capture worklet (D-38).
    await page.getByTestId('live-diagnostics').locator('summary').click();
    await expect(page.getByTestId('diag-analysis')).toContainText('AudioWorklet');
    // Never monitoring by itself.
    await expect(page.getByTestId('monitor-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('live-level')).not.toHaveAttribute('aria-valuenow', '0');
    await page.getByTestId('live-toggle').click();
    await expect(page.getByTestId('live-status')).toHaveText('Ingresso spento');
    await expect(page.getByTestId('live-note')).toHaveText('—');
  });
}

test('a refused microphone is explained, and nothing pretends to listen', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')), enumerateDevices: () => Promise.resolve([]) },
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByTestId('live-toggle').click();
  await expect(page.getByTestId('live-error')).toContainText('Permesso al microfono negato');
  await expect(page.getByTestId('live-status')).toHaveText('Errore');
  await expect(page.getByTestId('tuner-string')).toHaveText('—');
});
