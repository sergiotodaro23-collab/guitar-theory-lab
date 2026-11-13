/**
 * Measurements of the Neural Amp Modeler engine in the built app (D-51).
 * Headless Chromium, a WAV as microphone, synthetic models in the NAM
 * formats (src/app/namFixtures.ts: same architectures and sizes as real
 * captures, seeded weights). Run after `npm run build`:  node tools/perf/nam.mjs
 * Numbers depend on the machine; compare runs on the same one. Nothing here
 * measures a real guitar, a real audio interface or a real capture.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const PORT = 4181;
const SR = 48000;
mkdirSync('test-results/perf', { recursive: true });
await build({ entryPoints: ['src/app/namFixtures.ts'], bundle: true, format: 'esm', platform: 'node', outfile: 'test-results/perf/namFixtures.mjs', logLevel: 'silent' });
const fx = await import(new URL('../../test-results/perf/namFixtures.mjs', import.meta.url));
const MODELS = [
  { id: 'linear', label: 'Linear (1 presa)', json: fx.linearNam(0.5, { name: 'Lineare' }) },
  { id: 'a1-standard', label: `A1 WaveNet standard (${fx.A1_STANDARD_WEIGHTS} pesi)`, json: fx.waveNetA1Nam({ name: 'A1 standard' }) },
  { id: 'a2', label: `A2 SlimmableContainer (${fx.A2_WEIGHTS[8]} pesi)`, json: fx.slimmableA2Nam({ name: 'A2' }) },
];

// A two-second A2 with harmonics as the microphone.
const wavFile = resolve('test-results/perf/nam-mic.wav');
{
  const n = SR * 2;
  const data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 2, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i += 1) {
    let v = 0;
    for (let h = 1; h <= 5; h += 1) v += Math.sin((2 * Math.PI * 110 * h * i) / SR) / h;
    data.writeInt16LE(Math.round((v * 0.25 * 32767) / 1.5), 44 + i * 2);
  }
  writeFileSync(wavFile, data);
}

const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const round = (v, d = 3) => (Number.isFinite(v) ? +v.toFixed(d) : null);
const out = { date: new Date().toISOString(), node: process.version, sampleRate: SR, models: {} };

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
try {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wavFile}`] });
  out.chromium = browser.version();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${PORT}/?debug=1`, { waitUntil: 'load' });

  /** Resident memory of the renderer processes, MiB (Linux only). */
  const rendererRss = async () => {
    try {
      const cdp = await browser.newBrowserCDPSession();
      const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
      await cdp.detach();
      let kb = 0;
      for (const p of processInfo.filter((x) => x.type === 'renderer')) {
        const m = /VmRSS:\s+(\d+) kB/.exec(readFileSync(`/proc/${p.id}/status`, 'utf8'));
        if (m) kb += Number(m[1]);
      }
      return kb / 1024;
    } catch { return Number.NaN; }
  };

  /**
   * Continuity of the live output over a few seconds, from Chrome's
   * AudioContext.playbackStats: how many times and for how long the device
   * had to play silence because the audio thread did not deliver in time.
   */
  const capacity = (seconds) => page.evaluate(async (s) => {
    const ctx = window.__gtl.engine.audioOut().ctx;
    const read = () => (ctx.playbackStats ? ctx.playbackStats.toJSON() : null);
    const a = read();
    if (!a) return null;
    await new Promise((r) => setTimeout(r, s * 1000));
    const b = read();
    return { seconds: (b.totalDuration ?? 0) - (a.totalDuration ?? 0), underrunEvents: (b.underrunEvents ?? 0) - (a.underrunEvents ?? 0), underrunSeconds: (b.underrunDuration ?? 0) - (a.underrunDuration ?? 0), keys: Object.keys(b) };
  }, seconds);
  const fmt = (c) => (c ? { seconds: round(c.seconds, 2), underrunEvents: c.underrunEvents, underrunMs: round(c.underrunSeconds * 1000, 1) } : null);
  const rig = () => page.evaluate(() => window.__gtl.live.rigState());

  // 1. Offline: cost per block and added latency (no audio device involved).
  out.latencySamples = await page.evaluate((sr) => window.__gtl.namTools.latency(sr), SR);
  out.rssBeforeMiB = round(await rendererRss(), 1);
  for (const m of MODELS) {
    const runs = [];
    for (let i = 0; i < 5; i += 1) runs.push(await page.evaluate(([json, sr]) => window.__gtl.namTools.bench(json, sr, 2), [m.json, SR]));
    out.models[m.id] = {
      label: m.label,
      fileKiB: round(m.json.length / 1024, 0),
      offline: { realtimeFactor: round(median(runs.map((r) => r.realtimeFactor))), microsPerBlock: round(median(runs.map((r) => r.microsPerBlock)), 0), budgetMicros: round((128 / SR) * 1e6, 0), runs: runs.length },
    };
  }

  // 2. Live: the rig on the listening branch, internal DSP first.
  await page.getByTestId('rack-expand').click().catch(() => {});
  await page.getByTestId('iface-power').click();
  await page.getByTestId('iface-monitor').click();
  await page.waitForTimeout(1500);
  out.live = { contextSampleRate: await page.evaluate(() => window.__gtl.engine.audioOut().ctx.sampleRate), dsp: fmt(await capacity(5)) };
  await page.getByTestId('amp-engine-nam').click();

  for (const m of MODELS) {
    const rss0 = await rendererRss();
    const loaded = await page.evaluate(async ([json, name]) => {
      const t0 = performance.now();
      const ok = await window.__gtl.namTools.host.load(json, name, window.__gtl.engine.audioOut().ctx);
      return { ok, totalMs: performance.now() - t0, status: window.__gtl.nam() };
    }, [m.json, `${m.id}.nam`]);
    await page.waitForTimeout(600);
    const state = await rig();
    const entry = out.models[m.id];
    entry.load = { ok: loaded.ok, engineParseMs: round(loaded.status.measure?.loadMs ?? Number.NaN, 1), totalMs: round(loaded.totalMs, 0), ampEngine: state?.ampEngine, namFed: state?.namFed };
    entry.live = fmt(await capacity(5));
    entry.rendererRssDeltaMiB = round((await rendererRss()) - rss0, 1);
    // Bypass and back, under signal: does the audio thread fall behind?
    const watch = capacity(3);
    await page.getByTestId('amp-bypass').click();
    await page.waitForTimeout(700);
    await page.getByTestId('amp-bypass').click();
    entry.bypassToggle = fmt(await watch);
  }

  // 3. Swapping one full-size model for another while listening.
  {
    const watch = capacity(4);
    const swap = await page.evaluate(async ([json]) => {
      const t0 = performance.now();
      const ok = await window.__gtl.namTools.host.load(json, 'swap.nam', window.__gtl.engine.audioOut().ctx);
      return { ok, totalMs: performance.now() - t0, engineParseMs: window.__gtl.nam().measure?.loadMs };
    }, [MODELS[1].json]);
    out.swapA2toA1 = { ok: swap.ok, totalMs: round(swap.totalMs, 0), engineParseMs: round(swap.engineParseMs, 1), capacity: fmt(await watch) };
  }
  // 4. Model selected, listening off: the model is not fed.
  await page.getByTestId('iface-monitor').click();
  await page.waitForTimeout(800);
  out.listeningOff = { namFed: (await rig())?.namFed, capacity: fmt(await capacity(4)) };
  out.rssAfterMiB = round(await rendererRss(), 1);
  await browser.close();
} finally {
  server.kill();
}
writeFileSync('test-results/perf/nam.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
