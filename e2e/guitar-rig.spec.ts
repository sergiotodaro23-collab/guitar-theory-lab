import { expect, test, type Page } from '@playwright/test';
import { fakeMic, wav } from './liveHelpers';
import { openDevice, openRack } from './studio';

/**
 * Guitar Rig (D-42) in the Studio V6 rack (D-43): input, amp head, cabinet IR
 * and pedals as modules of the right sidebar, wired to
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
  await openRack(page);
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
  await page.getByTestId('iface-power').click();
  await expect(page.getByTestId('iface-monitor')).toBeEnabled();
  await page.getByTestId('iface-monitor').click();
  await expect(page.getByTestId('iface-monitor')).toHaveAttribute('aria-pressed', 'true');
};

test('the rack holds input, amp, cabinet, pedalboard and routing; it folds to a spine, hides and comes back', async ({ page }) => {
  const errors = await open(page);
  const rack = page.getByTestId('rack');
  await expect(rack).toHaveAttribute('data-mode', 'expanded');
  for (const title of ['Scheda audio / Input', 'Amplificatore', 'Cabinet / IR', 'Pedaliera', 'Routing / Uscita']) await expect(rack.getByRole('region', { name: title })).toBeVisible();
  for (const id of ['comp', 'drive', 'chorus', 'delay', 'reverb']) await expect(rack.getByTestId(`pedal-${id}`)).toBeAttached();
  await expect(rack.getByTestId('rig-cab')).toBeVisible();
  // All six amp knobs sit inside the amp chassis.
  const chassis = await rack.locator('.v6-amp').boundingBox();
  if (!chassis) throw new Error('no amp chassis');
  for (const id of ['gain', 'bass', 'mid', 'treble', 'presence', 'out']) {
    const knob = await rack.getByTestId(`amp-${id}`).boundingBox();
    if (!knob) throw new Error(`no knob ${id}`);
    expect(knob.x, id).toBeGreaterThanOrEqual(chassis.x);
    expect(knob.x + knob.width, id).toBeLessThanOrEqual(chassis.x + chassis.width);
    expect(knob.y + knob.height, id).toBeLessThanOrEqual(chassis.y + chassis.height);
  }
  // Every rendered image of the rig is loaded.
  await expect.poll(() => rack.locator('img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  // A module folds to its title bar and keeps its on/off; the choice is saved.
  await page.getByTestId('rack-fold-amp').click();
  await expect(rack.getByTestId('amp-gain')).toHaveCount(0);
  await expect(rack.getByTestId('amp-power')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('rack').getByTestId('amp-gain')).toHaveCount(0);
  await page.getByTestId('rack-fold-amp').click();
  await expect(page.getByTestId('amp-gain')).toBeVisible();
  // Spine, hidden, back: the work column takes the room, the neck stays whole.
  const neckWidth = () => page.locator('.v57-board .fretboard').evaluate((el) => el.getBoundingClientRect().width);
  const full = await neckWidth();
  await page.getByTestId('rack-compact').click();
  await expect(page.getByTestId('rack')).toHaveAttribute('data-mode', 'compact');
  await expect.poll(neckWidth).toBeGreaterThan(full + 200);
  await page.getByTestId('rack').getByRole('button', { name: 'Pedaliera' }).click();
  await expect(page.getByTestId('rack')).toHaveAttribute('data-mode', 'expanded');
  await page.getByTestId('rack-hide').click();
  await expect(page.getByTestId('rack')).toHaveCount(0);
  await expect(page.getByTestId('rack-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByTestId('rack')).toHaveCount(0);
  await page.getByTestId('rack-toggle').click();
  await expect(page.getByTestId('rack')).toHaveAttribute('data-mode', 'expanded');
  await expect(page.locator('.v57-board .fretboard .fret')).toHaveCount(24);
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
  // The pedal strip scrolls sideways in the rack: bring the last pedal into view before dragging its knob.
  await page.getByTestId('pedal-reverb-mix').scrollIntoViewIfNeeded();
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
  await openRack(page);
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
  await page.getByTestId('device-close').click();
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
