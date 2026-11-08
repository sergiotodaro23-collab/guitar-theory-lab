import { expect, test, type Page } from '@playwright/test';
import { fakeMic, wav } from './liveHelpers';
import { openDevice } from './studio';

/**
 * Guitar Rig (D-42): amp head, cabinet IR and pedals in one drawer, wired to
 * the real Web Audio chain on the guitar's listening branch. The microphone
 * is a WAV (an A2 with harmonics): the whole chain runs, it is not a guitar.
 */

test.use(fakeMic(wav('rig-a2.wav', 110, 2)));

const open = async (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openDevice(page, 'amp');
  return errors;
};
const rigState = (page: Page) => page.evaluate(() => window.__gtl?.live?.rigState() ?? null);
/** Output peak after the 20 ms parameter glides settle. */
const out = (page: Page) => page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 300));
  let peak = 0;
  for (let i = 0; i < 30; i += 1) {
    peak = Math.max(peak, window.__gtl?.engine.outputLevel() ?? 0);
    await new Promise((r) => setTimeout(r, 25));
  }
  return peak;
});
const listen = async (page: Page) => {
  await page.getByTestId('rig-input').click();
  await expect(page.getByTestId('rig-monitor')).toBeEnabled();
  await page.getByTestId('rig-monitor').click();
  await expect(page.getByTestId('rig-monitor')).toHaveAttribute('aria-pressed', 'true');
};

test('one drawer holds amp, cabinet and pedalboard; it opens from the rail and closes', async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByTestId('device-drawer')).toHaveAttribute('data-device', 'amp');
  const drawer = page.getByTestId('device-drawer');
  await expect(drawer.getByRole('dialog', { name: 'Guitar Rig: amplificatore e pedaliera' })).toBeVisible();
  await expect(drawer.getByTestId('rig')).toBeVisible();
  for (const id of ['comp', 'drive', 'chorus', 'delay', 'reverb']) await expect(drawer.getByTestId(`pedal-${id}`)).toBeVisible();
  await expect(drawer.getByTestId('rig-cab')).toBeVisible();
  await expect(drawer.getByTestId('amp-gain')).toBeVisible();
  // Every rendered image of the rig is loaded.
  await expect.poll(() => drawer.locator('img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.getByTestId('device-amp').click();
  await expect(page.getByTestId('device-drawer')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('pedal controls: footswitch, LED, knobs by keyboard and drag; amp and cabinet controls; all saved', async ({ page }) => {
  await open(page);
  const drive = page.getByTestId('pedal-drive');
  await expect(drive).toHaveAttribute('data-on', '0');
  await expect(page.getByTestId('pedal-drive-led')).toHaveAttribute('data-on', '0');
  await page.getByTestId('pedal-drive-switch').click();
  await expect(page.getByTestId('pedal-drive-switch')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('pedal-drive-led')).toHaveAttribute('data-on', '1');
  await expect(page.getByTestId('pedal-drive-led')).toHaveAccessibleName('Overdrive acceso');
  const knob = page.getByTestId('pedal-delay-time');
  await knob.focus();
  await page.keyboard.press('End');
  await expect(knob).toHaveAttribute('aria-valuenow', '100');
  await page.keyboard.press('ArrowDown');
  await expect(knob).toHaveAttribute('aria-valuenow', '98');
  const box = await page.getByTestId('pedal-reverb-mix').boundingBox();
  if (!box) throw new Error('no knob');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 4 });
  await page.mouse.up();
  expect(Number(await page.getByTestId('pedal-reverb-mix').getAttribute('aria-valuenow'))).toBeGreaterThan(40);
  await page.getByTestId('amp-power').click();
  await expect(page.getByTestId('amp-power')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('amp-lamp')).toHaveAttribute('data-on', '0');
  await page.getByTestId('amp-power').click();
  await page.getByTestId('amp-treble').focus();
  await page.keyboard.press('Home');
  await page.getByTestId('rig-cab-model').selectOption('1x12');
  await page.getByTestId('rig-cab-switch').click();
  await expect(page.getByTestId('rig-cab-switch')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(400);
  await page.reload();
  await openDevice(page, 'amp');
  await expect(page.getByTestId('pedal-drive-switch')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('pedal-delay-time')).toHaveAttribute('aria-valuenow', '98');
  await expect(page.getByTestId('amp-treble')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByTestId('rig-cab-model')).toHaveValue('1x12');
  await expect(page.getByTestId('rig-cab-switch')).toHaveAttribute('aria-pressed', 'false');
});

test('the controls drive the real audio chain on the listening branch', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('rig-status')).toContainText('avvia l’ingresso');
  await listen(page);
  await expect(page.getByTestId('rig-status')).toContainText('Elaborazione attiva');
  // Default: amp and cabinet heard, pedals off.
  await expect.poll(async () => (await rigState(page))?.active).toEqual(['amp', 'cab']);
  const base = await out(page);
  expect(base).toBeGreaterThan(0.01);

  // Pedals join the chain when switched on, in their place.
  for (const id of ['comp', 'drive', 'chorus', 'delay', 'reverb']) await page.getByTestId(`pedal-${id}-switch`).click();
  await expect.poll(async () => (await rigState(page))?.active).toEqual(['comp', 'drive', 'chorus', 'delay', 'reverb', 'amp', 'cab']);
  expect((await rigState(page))?.chain).toEqual(['comp', 'drive', 'amp', 'cab', 'chorus', 'delay', 'reverb']);
  for (const id of ['comp', 'drive', 'chorus', 'delay', 'reverb']) await page.getByTestId(`pedal-${id}-switch`).click();
  await expect.poll(async () => (await rigState(page))?.active).toEqual(['amp', 'cab']);

  // Delay time and reverb decay reach the nodes.
  await page.getByTestId('pedal-delay-time').focus();
  await page.keyboard.press('End');
  await expect.poll(async () => (await rigState(page))?.delaySeconds ?? 0).toBeGreaterThan(0.95);
  await page.getByTestId('pedal-reverb-decay').focus();
  await page.keyboard.press('Home');
  await expect.poll(async () => (await rigState(page))?.reverbSeconds ?? 0).toBeCloseTo(0.5, 2);

  // Amp output at zero silences the rig; bypass passes the guitar around amp and cabinet.
  await page.getByTestId('amp-out').focus();
  await page.keyboard.press('Home');
  expect(await out(page)).toBeLessThan(0.002);
  await page.getByTestId('amp-bypass').click();
  await expect.poll(async () => (await rigState(page))?.active).toEqual([]);
  expect(await out(page)).toBeGreaterThan(0.01);
  await page.getByTestId('amp-bypass').click();
  // Power off: the amp is silent; the pitch analysis keeps the dry signal.
  await page.getByTestId('amp-out').focus();
  await page.keyboard.press('End');
  expect(await out(page)).toBeGreaterThan(0.01);
  await page.getByTestId('amp-power').click();
  expect(await out(page)).toBeLessThan(0.002);
  await openDevice(page, 'tuner');
  await page.getByTestId('tuner-footswitch').click();
  await expect(page.getByTestId('tuner-device-note')).toContainText('A', { timeout: 5000 });
  await openDevice(page, 'amp');
  await page.getByTestId('amp-power').click();
  expect(await out(page)).toBeGreaterThan(0.01);

  // The drive stage really carries the signal: with the amp bypassed (its preamp would even out
  // the level, as a real one does) the pedal's Level knob moves the output by about 26 dB.
  await page.getByTestId('amp-bypass').click();
  await page.getByTestId('pedal-drive-switch').click();
  await page.getByTestId('pedal-drive-level').focus();
  await page.keyboard.press('Home');
  const quiet = await out(page);
  await page.keyboard.press('End');
  const loud = await out(page);
  expect(loud).toBeGreaterThan(quiet * 5);
});
