import { expect, test, type Page } from '@playwright/test';
import { fakeMic, wav } from './liveHelpers';
import { openRack } from './studio';

/**
 * Configurable pedal chain (Studio V6, D-49): order inside the PRE and POST
 * zones, adding and removing pedals, and what the graph really does with it.
 * The microphone is a WAV (an A2 with harmonics): the chain runs on a known
 * signal. It is not a guitar.
 */

test.use(fakeMic(wav('pedal-chain-a2.wav', 110, 2)));

const FACTORY = ['comp', 'fuzz', 'drive', 'amp', 'cab', 'eq', 'chorus', 'delay', 'reverb'];

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
const graphChain = async (page: Page) => (await rigState(page))?.chain ?? [];
const out = (page: Page) => page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 300));
  let peak = 0;
  for (let i = 0; i < 40; i += 1) {
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

test('the factory order is shown and is the order the graph is wired in', async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByTestId('chain-readout')).toContainText('Compressor (spento) → Fuzz (spento) → Overdrive (spento) → Ampli → Cabinet → EQ (spento)');
  await listen(page);
  await expect.poll(() => graphChain(page)).toEqual(FACTORY);
  expect(errors).toEqual([]);
});

test('move, remove, add back, restore: the graph follows every step and the settings survive', async ({ page }) => {
  await open(page);
  await listen(page);
  // Tune the fuzz first, so we can check its knobs survive leaving and re-entering the chain.
  await page.getByTestId('pedal-fuzz-fuzz').focus();
  await page.keyboard.press('End');
  await expect(page.getByTestId('pedal-fuzz-fuzz')).toHaveAttribute('aria-valuenow', '100');

  // Overdrive one place left: PRE becomes comp, drive, fuzz.
  await page.getByTestId('chain-left-drive').focus();
  await page.keyboard.press('Enter');
  const reordered = ['comp', 'drive', 'fuzz', 'amp', 'cab', 'eq', 'chorus', 'delay', 'reverb'];
  await expect.poll(() => graphChain(page)).toEqual(reordered);
  await expect(page.getByTestId('chain-readout')).toContainText('Compressor (spento) → Overdrive (spento) → Fuzz (spento) → Ampli');
  // The edge is held by the controls: the first pedal cannot move further left.
  await expect(page.getByTestId('chain-left-comp')).toBeDisabled();

  // Remove the fuzz: it leaves the signal and the readout, and the offer to add it appears.
  await page.getByTestId('chain-remove-fuzz').click();
  const removed = ['comp', 'drive', 'amp', 'cab', 'eq', 'chorus', 'delay', 'reverb'];
  await expect.poll(() => graphChain(page)).toEqual(removed);
  await expect(page.getByTestId('chain-add-fuzz')).toBeVisible();
  await expect(page.getByTestId('chain-readout')).not.toContainText('Fuzz');
  await expect(page.getByTestId('pedal-fuzz')).toHaveCount(0);

  // Add it back: at the end of its zone, and its knobs are where they were.
  await page.getByTestId('chain-add-fuzz').click();
  await expect.poll(() => graphChain(page)).toEqual(['comp', 'drive', 'fuzz', 'amp', 'cab', 'eq', 'chorus', 'delay', 'reverb']);
  await expect(page.getByTestId('pedal-fuzz-fuzz')).toHaveAttribute('aria-valuenow', '100');

  // Restore the factory chain: order and membership come back, the knobs stay.
  await page.getByTestId('chain-reset').click();
  await expect.poll(() => graphChain(page)).toEqual(FACTORY);
  await expect(page.getByTestId('chain-reset')).toBeDisabled();
  await expect(page.getByTestId('pedal-fuzz-fuzz')).toHaveAttribute('aria-valuenow', '100');
});

test('the order and the removal are saved: they come back after a reload', async ({ page }) => {
  await open(page);
  await page.getByTestId('chain-left-drive').click();
  await page.getByTestId('chain-remove-eq').click();
  await page.waitForTimeout(400);
  await page.reload();
  await openRack(page);
  await expect(page.getByTestId('chain-readout')).toContainText('Compressor (spento) → Overdrive (spento) → Fuzz (spento)');
  await expect(page.getByTestId('chain-readout')).not.toContainText('EQ');
  await expect(page.getByTestId('chain-add-eq')).toBeVisible();
  await page.getByTestId('chain-reset').click();
  await expect(page.getByTestId('chain-readout')).toContainText('Compressor (spento) → Fuzz (spento) → Overdrive (spento) → Ampli');
});

test('a removed pedal is not heard, even switched on: the output matches the same chain with it switched off', async ({ page }) => {
  await open(page);
  await listen(page);
  // Overdrive on, amp and cabinet bypassed: its Level knob makes a clear difference.
  await page.getByTestId('amp-bypass').click();
  await page.getByTestId('pedal-drive-switch').click();
  await page.getByTestId('pedal-drive-level').focus();
  await page.keyboard.press('End');
  await expect.poll(async () => (await rigState(page))?.active).toEqual(['drive']);
  const driven = await out(page);

  // Removed from the chain while still switched on: nothing of it reaches the output.
  await page.getByTestId('chain-remove-drive').click();
  await expect.poll(async () => (await rigState(page))?.active).toEqual([]);
  const removedOn = await out(page);

  // The same chain with it switched off: the output must be the same level.
  await page.getByTestId('chain-add-drive').click();
  await page.getByTestId('pedal-drive-switch').click();
  await expect.poll(async () => (await rigState(page))?.active).toEqual([]);
  const offOnly = await out(page);
  expect(driven).toBeGreaterThan(0.01);
  expect(Math.abs(removedOn - offOnly) / Math.max(removedOn, offOnly, 1e-6)).toBeLessThan(0.15);
  expect(removedOn).toBeGreaterThan(0.01);
});

test('the added pedal is in the graph at the end of its zone; no pedal can be added twice', async ({ page }) => {
  await open(page);
  await listen(page);
  await page.getByTestId('chain-remove-comp').click();
  await expect.poll(() => graphChain(page)).toEqual(['fuzz', 'drive', 'amp', 'cab', 'eq', 'chorus', 'delay', 'reverb']);
  await page.getByTestId('chain-add-comp').click();
  await expect.poll(() => graphChain(page)).toEqual(['fuzz', 'drive', 'comp', 'amp', 'cab', 'eq', 'chorus', 'delay', 'reverb']);
  // Nothing is offered that is already in the chain.
  await expect(page.locator('[data-testid^="chain-add-"]')).toHaveCount(0);
  const chain = await graphChain(page);
  expect(new Set(chain).size).toBe(chain.length);
});

test('the seven starting sounds still load and still match; a reordered sound is no longer its starting sound', async ({ page }) => {
  await open(page);
  await listen(page);
  const preset = page.getByTestId('rig-preset');
  await preset.selectOption('rock');
  await expect(preset).toHaveValue('rock');
  await expect.poll(() => page.evaluate(() => window.__gtl?.live?.rigState()?.chain ?? [])).toEqual(FACTORY);
  await page.getByTestId('chain-left-drive').click();
  await expect(preset).toHaveValue('');
  await preset.selectOption('fuzz');
  await expect(preset).toHaveValue('fuzz');
  await expect.poll(() => graphChain(page)).toEqual(FACTORY);
  await preset.selectOption('ambient');
  await expect(preset).toHaveValue('ambient');
});

test('the audio follows the order: fuzz before overdrive sounds different from overdrive before fuzz, on the same signal', async ({ page }) => {
  await open(page);
  await listen(page);
  // Amp and cabinet bypassed: the two drives alone, both on, at a clear level.
  await page.getByTestId('amp-bypass').click();
  await page.getByTestId('pedal-fuzz-switch').click();
  await page.getByTestId('pedal-drive-switch').click();
  await page.getByTestId('pedal-fuzz-level').focus();
  await page.keyboard.press('End');
  await page.getByTestId('pedal-drive-level').focus();
  await page.keyboard.press('End');
  await expect.poll(async () => (await rigState(page))?.active).toEqual(['fuzz', 'drive']);
  const fuzzThenDrive = await out(page);

  await page.getByTestId('chain-left-drive').click();
  await expect.poll(() => graphChain(page)).toEqual(['comp', 'drive', 'fuzz', 'amp', 'cab', 'eq', 'chorus', 'delay', 'reverb']);
  const driveThenFuzz = await out(page);

  expect(fuzzThenDrive).toBeGreaterThan(0.01);
  expect(driveThenFuzz).toBeGreaterThan(0.01);
  // Two clipping stages in series do not sum the same way in either order: the levels differ measurably.
  expect(Math.abs(fuzzThenDrive - driveThenFuzz) / Math.max(fuzzThenDrive, driveThenFuzz)).toBeGreaterThan(0.05);
});
