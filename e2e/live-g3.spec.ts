import { expect, test } from '@playwright/test';
import { centsShown, fakeMic, openInput, wav } from './liveHelpers';

/** Tuner on a G3 twelve cents sharp as the microphone. */

test.use(fakeMic(wav('g3-sharp.wav', 196 * 2 ** (12 / 1200))));

test('the tuner shows +12 cents on the third string, and the reference A moves the reading', async ({ page }) => {
  await openInput(page, 'Studio');
  await expect(page.getByTestId('tuner-string')).toHaveText('3ª corda · G3', { timeout: 5000 });
  // Readings around the file's loop seam can jump for a frame: wait for the steady value.
  await expect.poll(async () => { const c = await centsShown(page); return c > 9 && c < 15; }).toBe(true);
  await expect(page.getByTestId('tuner-advice')).toHaveText('Crescente: allenta la corda');
  // With A = 442 Hz every target rises 7.85 cents: the same string now reads about +4.
  await page.getByTestId('tuner-a4').fill('442');
  await expect.poll(async () => { const c = await centsShown(page); return c > 1 && c < 7; }).toBe(true);
});
