import { expect, test } from '@playwright/test';
import { fakeMic, openInput, wav } from './liveHelpers';

/** An A3 at 220 Hz is no open string in standard tuning: the tuner reads it chromatically. */

test.use(fakeMic(wav('a3.wav', 220)));

test('a fretted A3: chromatic reading, and the likely place comes from the scale shape on the neck', async ({ page }) => {
  await openInput(page, 'Studio');
  await expect(page.getByTestId('tuner-string')).toHaveText('A3 · cromatico', { timeout: 5000 });
  await expect(page.getByTestId('tuner-advice')).toHaveText('Intonata');
  // C major, CAGED E shape around frets 7–10: A3 sits there on the fourth string, fret 7.
  await expect(page.getByTestId('live-likely')).toHaveAttribute('data-string', '2');
  await expect(page.getByTestId('live-likely')).toHaveAttribute('data-fret', '7');
  await expect(page.locator('.live-possible')).toHaveCount(3);
});
