import { expect, test } from '@playwright/test';
import { fakeMic, openInput, wav } from './liveHelpers';
import { chooseLook, reveal } from './studio';

/**
 * Live Monitor 2.0 calibration with a WAV as the microphone: the procedure
 * runs end to end on a synthetic, steady A3. It proves the chain and the
 * bookkeeping (measured vs set by hand), not real-guitar values.
 */
test.use(fakeMic(wav('a3-calibration.wav', 220)));

test('a profile is created, measured step by step, kept after a reload, and can be reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openInput(page, 'Studio');
  await reveal(page, page.getByRole('group', { name: 'Sensibilità del Live Monitor' }));
  await page.getByRole('group', { name: 'Sensibilità del Live Monitor' }).getByRole('button', { name: 'Rapida' }).click();
  await reveal(page, page.getByTestId('profile-name'));
  await page.getByTestId('profile-name').fill('Strat ponte · scheda USB');
  await reveal(page, page.getByTestId('profile-create'));
  await page.getByTestId('profile-create').click();
  await reveal(page, page.getByTestId('live-profile'));
  await expect(page.getByTestId('live-profile')).toHaveValue(/.+/);

  // Step 1 on a steady note: the "noise" is the note itself, so the gate goes to its ceiling — and says it was measured.
  await reveal(page, page.getByTestId('calibrate-noise'));
  await page.getByTestId('calibrate-noise').click();
  await reveal(page, page.getByTestId('calibration-result'));
  await expect(page.getByTestId('calibration-result')).toContainText('RMS', { timeout: 8000 });
  await reveal(page, page.getByTestId('value-minrms'));
  await expect(page.getByTestId('value-minrms')).toContainText('misurato');
  // The gate would now hide the note: set it back by hand to see the next steps work.
  await reveal(page, page.getByTestId('profile-reset'));
  await page.getByTestId('profile-reset').click();
  await reveal(page, page.getByTestId('value-minrms'));
  await expect(page.getByTestId('value-minrms')).toContainText('impostato a mano');

  await reveal(page, page.getByTestId('calibrate-notes'));
  await page.getByTestId('calibrate-notes').click();
  await reveal(page, page.getByTestId('calibration-result'));
  await expect(page.getByTestId('calibration-result')).toContainText('affidabilità tipica', { timeout: 10000 });
  await reveal(page, page.getByTestId('calibration-values'));
  await expect(page.getByTestId('calibration-values')).toContainText('Gain');

  await reveal(page, page.getByTestId('calibrate-response'));
  await page.getByTestId('calibrate-response').click();
  await reveal(page, page.getByTestId('calibration-result'));
  await expect(page.getByTestId('calibration-result')).toContainText('consiglio', { timeout: 10000 });

  // A steady WAV cannot answer clicks: the latency stays as set, and the panel says so.
  await reveal(page, page.getByTestId('calibrate-latency'));
  await page.getByTestId('calibrate-latency').click();
  await reveal(page, page.getByTestId('calibration-result'));
  await expect(page.getByTestId('calibration-result')).toContainText(/Latenza misurata|non ho sentito abbastanza/i, { timeout: 10000 });

  await page.reload();
  await chooseLook(page, 'Studio');
  await reveal(page, page.getByTestId('live-profile'));
  await expect(page.getByTestId('live-profile').locator('option:checked')).toHaveText('Strat ponte · scheda USB');
  await reveal(page, page.getByTestId('calibration-values'));
  await expect(page.getByTestId('calibration-values')).toContainText('misurato');
  expect(errors).toEqual([]);
});
