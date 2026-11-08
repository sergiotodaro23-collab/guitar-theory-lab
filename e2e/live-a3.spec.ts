import { expect, test } from '@playwright/test';
import { fakeMic, openInput, wavSequence } from './liveHelpers';
import { reveal } from './studio';

/** An A3 at 220 Hz is no open string in standard tuning: the tuner reads it chromatically. */

// Picked twice with a short rest: the second hearing has the first as context.
test.use(fakeMic(wavSequence('a3-twice.wav', [[220, 0.8], [0, 0.25], [220, 0.8], [0, 0.25]])));

test('a fretted A3: chromatic reading; once the note comes again the estimate settles in the scale shape', async ({ page }) => {
  await openInput(page, 'Studio');
  await reveal(page, page.getByTestId('tuner-string'));
  await expect(page.getByTestId('tuner-string')).toHaveText('A3 · cromatico', { timeout: 5000 });
  await reveal(page, page.getByTestId('tuner-advice'));
  await expect(page.getByTestId('tuner-advice')).toHaveText('Intonata');
  // The first hearing has no context (no full position, D-31); the loop repeats the note, and with that
  // context the shape's place wins: C major, CAGED E shape around frets 7–10, fourth string, fret 7.
  await reveal(page, page.getByTestId('live-likely'));
  await expect(page.getByTestId('live-likely')).toHaveAttribute('data-string', '2');
  await reveal(page, page.getByTestId('live-likely'));
  await expect(page.getByTestId('live-likely')).toHaveAttribute('data-fret', '7');
  await expect(page.locator('.live-possible')).toHaveCount(3);
});
