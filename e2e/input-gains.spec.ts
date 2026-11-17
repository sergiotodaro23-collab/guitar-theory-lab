import { expect, test, type Page } from '@playwright/test';
import { fakeMic, wav } from './liveHelpers';
import { openRack } from './studio';

/**
 * Two input gains after the channel choice. Rig: the level into the guitar
 * rig. Detection: the level of the dry signal the analysis reads (tracking,
 * tuner, calibration, the input meter). Each must leave the other alone.
 * Chromium's fake microphone plays a WAV file: a synthetic signal, not a
 * guitar and not a real audio interface.
 */

test.use(fakeMic(wav('input-gains.wav', 110)));

const out = (page: Page) => page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 500));
  let peak = 0;
  for (let i = 0; i < 40; i += 1) {
    peak = Math.max(peak, window.__gtl?.engine.outputLevel() ?? 0);
    await new Promise((r) => setTimeout(r, 25));
  }
  return peak;
});
/** The input meter: it reads the detection branch. */
const detected = async (page: Page) => {
  await page.waitForTimeout(500);
  let peak = 0;
  for (let i = 0; i < 20; i += 1) {
    peak = Math.max(peak, Number(await page.getByRole('meter', { name: 'Livello d’ingresso', exact: true }).getAttribute('aria-valuenow')));
    await page.waitForTimeout(25);
  }
  return peak;
};

test('rig gain and detection gain are separate nodes: each changes its own branch only, and both start at 0 dB', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openRack(page);
  const [rig, detect] = [page.getByTestId('iface-gain-rig'), page.getByTestId('iface-gain')];
  await expect(rig).toHaveAttribute('aria-valuetext', '+0.0 dB');
  await expect(detect).toHaveAttribute('aria-valuetext', '+0.0 dB');
  await expect(rig).toHaveAccessibleName(/Gain del rig/);
  await expect(detect).toHaveAccessibleName(/Gain di rilevazione/);
  await page.getByTestId('iface-power').click();
  await expect(page.getByTestId('iface-monitor')).toBeEnabled();
  await page.getByTestId('iface-monitor').click();
  expect(await page.evaluate(() => window.__gtl?.live?.gains())).toEqual({ detection: 1, rig: 1, separate: true });
  await expect.poll(() => out(page)).toBeGreaterThan(0.01);
  const [sound, level] = [await out(page), await detected(page)];
  expect(level).toBeGreaterThan(0);

  // Detection to zero: the analysis hears nothing, the rig plays as before.
  await detect.focus();
  await page.keyboard.press('Home');
  await expect(detect).toHaveAttribute('aria-valuetext', '−∞ dB');
  await expect.poll(() => detected(page)).toBe(0);
  const soundWithoutDetection = await out(page);
  expect(soundWithoutDetection).toBeGreaterThan(sound * 0.8);
  expect(soundWithoutDetection).toBeLessThan(sound * 1.25);
  await expect(rig).toHaveAttribute('aria-valuetext', '+0.0 dB');

  // Detection back, rig to zero: the rig is silent, the analysis reads the level it read at first.
  await detect.dblclick();
  await expect(detect).toHaveAttribute('aria-valuetext', '+0.0 dB');
  await rig.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => out(page)).toBeLessThan(sound * 0.1);
  const levelWithoutRig = await detected(page);
  expect(Math.abs(levelWithoutRig - level)).toBeLessThanOrEqual(8);
  expect(await page.evaluate(() => window.__gtl?.live?.gains())).toEqual({ detection: 1, rig: 0, separate: true });

  // The monitor volume and the master are other controls: untouched by either knob.
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => (localStorage.getItem(k) ?? '').includes('"rigGain"')) ?? '') ?? '{}') as Record<string, unknown>);
  const flat = JSON.stringify(settings);
  expect(flat).toContain('"rigGain":0');
  expect(flat).toContain('"inputGain":1');
  expect(errors).toEqual([]);
});

test('the two gains are saved apart and restored; a saved setting from before the split gives the rig the gain it had', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openRack(page);
  await page.getByTestId('iface-gain-rig').focus();
  await page.keyboard.press('End');
  await page.getByTestId('iface-gain').focus();
  await page.keyboard.press('ArrowDown');
  const [rig, detect] = [await page.getByTestId('iface-gain-rig').getAttribute('aria-valuetext'), await page.getByTestId('iface-gain').getAttribute('aria-valuetext')];
  expect(rig).toBe('+12.0 dB');
  expect(detect).not.toBe(rig);
  // The session is saved a quarter of a second after the last change.
  await page.waitForTimeout(500);
  await page.reload();
  await openRack(page);
  await expect(page.getByTestId('iface-gain-rig')).toHaveAttribute('aria-valuetext', rig ?? '');
  await expect(page.getByTestId('iface-gain')).toHaveAttribute('aria-valuetext', detect ?? '');
  await expect(page.getByTestId('iface-gain-read')).toContainText('R +12.0 dB');
  // Settings written before the split have no rigGain: remove it and set the old single gain.
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => (localStorage.getItem(k) ?? '').includes('"rigGain"'));
    if (!key) throw new Error('settings not found');
    const text = (localStorage.getItem(key) ?? '').replace(/"rigGain":[^,}]+,?/, '').replace(/"inputGain":[^,}]+/, '"inputGain":2');
    localStorage.setItem(key, text);
  });
  await page.reload();
  await openRack(page);
  await expect(page.getByTestId('iface-gain')).toHaveAttribute('aria-valuetext', '+6.0 dB');
  await expect(page.getByTestId('iface-gain-rig')).toHaveAttribute('aria-valuetext', '+6.0 dB');
});
