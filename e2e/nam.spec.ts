import { expect, test, type Page } from '@playwright/test';
import { fakeMic, wav } from './liveHelpers';
import { openRack } from './studio';
import { A1_STANDARD_WEIGHTS, linearNam, slimmableA2Nam, waveNetA1Nam } from '../src/app/namFixtures';

/**
 * Neural Amp Modeler in the amp stage (D-51). The engine is the real one
 * (neural-amp-modeler-wasm, WebAssembly in an AudioWorklet); the models are
 * synthetic files in the NAM formats with seeded weights (src/app/namFixtures.ts),
 * not captures of an amplifier; the microphone is a WAV. What is proved here
 * is that the engine loads and runs the models inside the rig, not how an
 * amp capture sounds with a guitar.
 */

test.use(fakeMic(wav('nam-a2.wav', 110, 2)));

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
const nam = (page: Page) => page.evaluate(() => window.__gtl?.nam?.() ?? null);
const out = (page: Page) => page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 400));
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
const load = (page: Page, name: string, text: string) => page.getByTestId('nam-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
const ready = (page: Page) => expect(page.getByTestId('nam-status')).toHaveAttribute('data-phase', 'ready', { timeout: 20_000 });

test('the amp starts on the internal DSP and the engine is not downloaded until a model is loaded', async ({ page }) => {
  const engineFiles: string[] = [];
  page.on('request', (r) => { if (/nam-engine|nam-worklet/.test(r.url())) engineFiles.push(r.url()); });
  const errors = await open(page);
  await expect(page.getByTestId('amp-tape')).toHaveText('DSP interno');
  await expect(page.getByTestId('amp-engine-internal')).toHaveAttribute('aria-checked', 'true');
  await listen(page);
  await expect.poll(async () => (await rigState(page))?.ampEngine).toBe('internal');
  // Asking for NAM without a model changes nothing in the sound path, and says so.
  await page.getByTestId('amp-engine-nam').click();
  await expect(page.getByTestId('nam-status')).toContainText('Nessun modello caricato: suona il DSP interno');
  await expect(page.getByTestId('amp-tape')).toHaveText('DSP interno · NAM senza modello');
  expect((await rigState(page))?.ampEngine).toBe('internal');
  expect(engineFiles).toEqual([]);
  expect(errors).toEqual([]);
});

test('a local A1 model: the engine confirms it, the amp stage runs it, and going back to the DSP restores the sound', async ({ page }) => {
  const errors = await open(page);
  await listen(page);
  await expect.poll(() => out(page)).toBeGreaterThan(0.01);
  const dsp = await out(page);

  await load(page, 'prova-a1.nam', waveNetA1Nam({ name: 'Prova A1' }));
  await ready(page);
  // Loading a model never touches the listening switch.
  await expect(page.getByTestId('iface-monitor')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await rigState(page))?.ampEngine).toBe('nam');
  await expect.poll(async () => (await rigState(page))?.namFed).toBe(true);
  await expect(page.getByTestId('nam-status')).toContainText('Modello attivo nello stadio amplificatore: Prova A1');
  await expect(page.getByTestId('amp-tape')).toHaveText('NAM · Prova A1');
  await expect(page.getByTestId('nam-facts')).toContainText(`A1 · WaveNet · ${A1_STANDARD_WEIGHTS.toLocaleString('it-IT')} pesi`);

  // What was measured on this machine is real and shown.
  const status = await nam(page);
  expect(status?.summary?.generation).toBe('A1');
  expect(status?.measure?.loadMs ?? 0).toBeGreaterThan(0);
  expect(status?.measure?.realtimeFactor ?? 0).toBeGreaterThan(0);
  expect(status?.measure?.realtimeFactor ?? 1).toBeLessThan(0.85);
  await expect(page.getByTestId('nam-measure')).toContainText('µs per blocco');

  // The chain keeps its order: PRE pedals, amp, cabinet, POST pedals.
  expect((await rigState(page))?.chain).toEqual(['comp', 'fuzz', 'drive', 'amp', 'cab', 'eq', 'chorus', 'delay', 'reverb']);
  const modelled = await out(page);
  expect(modelled).toBeGreaterThan(0.001);
  expect(Math.abs(modelled - dsp) / dsp).toBeGreaterThan(0.1);

  // Back to the internal DSP: the model stays loaded but is not fed, and the level is the DSP's again.
  await page.getByTestId('amp-engine-internal').click();
  await expect.poll(async () => (await rigState(page))?.ampEngine).toBe('internal');
  await expect.poll(async () => (await rigState(page))?.namFed).toBe(false);
  await expect(page.getByTestId('amp-tape')).toHaveText('DSP interno');
  const back = await out(page);
  expect(Math.abs(back - dsp) / dsp).toBeLessThan(0.15);
  expect(errors).toEqual([]);
});

test('the model really processes the signal: a one-tap model at half the gain gives half the level', async ({ page }) => {
  await open(page);
  await listen(page);
  await load(page, 'lineare-1.nam', linearNam(1));
  await ready(page);
  await expect.poll(async () => (await rigState(page))?.ampEngine).toBe('nam');
  const full = await out(page);
  await load(page, 'lineare-0.5.nam', linearNam(0.5));
  await expect(page.getByTestId('nam-facts')).toContainText('lineare-0.5.nam', { timeout: 20_000 });
  await expect.poll(async () => (await rigState(page))?.ampEngine).toBe('nam');
  const half = await out(page);
  expect(full).toBeGreaterThan(0.002);
  expect(half / full).toBeGreaterThan(0.42);
  expect(half / full).toBeLessThan(0.58);
});

test('an A2 model loads; a capture that includes its cabinet skips the rig cabinet, and the switch brings it back', async ({ page }) => {
  const errors = await open(page);
  await listen(page);
  await load(page, 'prova-a2.nam', slimmableA2Nam({ name: 'Prova A2', gearType: 'amp_cab' }));
  await ready(page);
  const status = await nam(page);
  expect(status?.summary?.generation).toBe('A2');
  expect(status?.summary?.submodels).toBe(2);
  expect(status?.info?.slimmable).toBe(true);
  // The metadata says amp and cabinet: the rig's own cabinet is out of the sound.
  await expect(page.getByTestId('nam-cab')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await rigState(page))?.active).toEqual(['amp']);
  await expect(page.getByTestId('cab-skipped')).toBeVisible();
  await page.getByTestId('nam-cab').click();
  await expect.poll(async () => (await rigState(page))?.active).toEqual(['amp', 'cab']);
  await expect(page.getByTestId('cab-skipped')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('bad files are refused with a reason, and a refused file leaves the loaded model playing', async ({ page }) => {
  await open(page);
  await listen(page);
  const error = page.getByTestId('nam-error');
  await load(page, 'testo.nam', 'questo non è un modello');
  await expect(error).toContainText('non è JSON');
  await expect(page.getByTestId('nam-status')).toHaveAttribute('data-phase', 'error');
  await load(page, 'ignoto.nam', JSON.stringify({ version: '0.5.4', architecture: 'Transformer', config: {}, weights: [1] }));
  await expect(error).toContainText('Architettura «Transformer» non supportata');
  await load(page, 'vecchio.nam', JSON.stringify({ ...JSON.parse(linearNam()), version: '0.3.0' }));
  await expect(error).toContainText('troppo vecchio');
  expect((await rigState(page))?.ampEngine).toBe('internal');

  await load(page, 'buono.nam', linearNam(0.5, { name: 'Buono' }));
  await ready(page);
  await expect(error).toHaveCount(0);
  // Passes the inspection, refused by the engine itself: the weights do not fit the architecture.
  const broken = JSON.parse(waveNetA1Nam()) as { weights: number[] };
  broken.weights = broken.weights.slice(0, 500);
  await load(page, 'pesi-sbagliati.nam', JSON.stringify(broken));
  await expect(error).toContainText('Il motore NAM ha rifiutato il modello', { timeout: 20_000 });
  await expect(error).toContainText('Resta caricato il modello precedente');
  await expect(page.getByTestId('nam-status')).toHaveAttribute('data-phase', 'ready');
  await expect(page.getByTestId('amp-tape')).toHaveText('NAM · Buono');
  expect((await rigState(page))?.ampEngine).toBe('nam');
});

test('listening off: the model is not fed; bypass and power keep working; removing the model returns to the DSP', async ({ page }) => {
  await open(page);
  await page.getByTestId('iface-power').click();
  await expect(page.getByTestId('iface-monitor')).toBeEnabled();
  await load(page, 'prova-a1.nam', waveNetA1Nam({ name: 'Prova A1' }));
  await ready(page);
  // The input runs but nobody listens: loading did not turn the listening on, and the model gets no signal.
  await expect(page.getByTestId('iface-monitor')).toHaveAttribute('aria-pressed', 'false');
  expect((await rigState(page))?.ampEngine).toBe('nam');
  expect((await rigState(page))?.namFed).toBe(false);
  await page.getByTestId('iface-monitor').click();
  await expect.poll(async () => (await rigState(page))?.namFed).toBe(true);
  const playing = await out(page);
  expect(playing).toBeGreaterThan(0.001);

  // Bypass: amp and cabinet out, the model no longer fed.
  await page.getByTestId('amp-bypass').click();
  await expect.poll(async () => (await rigState(page))?.active).toEqual([]);
  await expect.poll(async () => (await rigState(page))?.namFed).toBe(false);
  await page.getByTestId('amp-bypass').click();
  await expect.poll(async () => (await rigState(page))?.namFed).toBe(true);
  // Power off: silence from the amp stage.
  await page.getByTestId('amp-power').click();
  await expect.poll(() => out(page)).toBeLessThan(playing * 0.1);
  await page.getByTestId('amp-power').click();

  await page.getByTestId('nam-unload').click();
  await expect(page.getByTestId('nam-status')).toHaveAttribute('data-phase', 'empty');
  await expect.poll(async () => (await rigState(page))?.ampEngine).toBe('internal');
  await expect(page.getByTestId('amp-tape')).toHaveText('DSP interno · NAM senza modello');
});

test('the choice of NAM is saved, the model is not: after a reload the DSP plays and says so', async ({ page }) => {
  await open(page);
  await load(page, 'prova.nam', linearNam(0.5, { name: 'Prova' }));
  await ready(page);
  await expect(page.getByTestId('amp-engine-nam')).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(400);
  await page.reload();
  await openRack(page);
  await expect(page.getByTestId('amp-engine-nam')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('nam-status')).toContainText('Nessun modello caricato: suona il DSP interno');
  await expect(page.getByTestId('amp-tape')).toHaveText('DSP interno · NAM senza modello');
  const saved = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => `${k}=${v}`).join('\n'));
  expect(saved).not.toContain('receptive_field');
});

test('the engine adds no latency: an impulse through a one-tap model comes out at the same sample', async ({ page }) => {
  await open(page);
  const delay = await page.evaluate(() => window.__gtl?.namTools?.latency(48000) ?? Number.NaN);
  expect(delay).toBe(0);
});
