/**
 * Light, reproducible performance measurements (P0-15). No external service:
 * headless Chromium on the built app plus a Node micro-benchmark of the pitch
 * analysis. Run after `npm run build`:  node tools/perf/perf.mjs
 * Numbers depend on the machine; compare runs on the same one.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const PORT = 4179;
const out = { date: new Date().toISOString(), node: process.version };

// 1. Pitch analysis cost per frame, each sensitivity mode (Node, single thread).
mkdirSync('test-results/perf', { recursive: true });
await build({ entryPoints: ['src/pitch/index.ts'], bundle: true, format: 'esm', platform: 'node', outfile: 'test-results/perf/pitch.mjs', logLevel: 'silent' });
const pitch = await import(new URL('../../test-results/perf/pitch.mjs', import.meta.url));
const SR = 48000;
const signal = new Float32Array(SR);
for (let i = 0; i < SR; i += 1) {
  let v = 0;
  for (let h = 1; h <= 5; h += 1) v += Math.sin((2 * Math.PI * 110 * h * i) / SR) / h;
  signal[i] = 0.2 * v;
}
out.yin = {};
for (const mode of pitch.SENSITIVITIES) {
  const p = pitch.SENSITIVITY[mode];
  const frame = signal.subarray(0, p.frame);
  const runs = 200;
  const t0 = performance.now();
  for (let i = 0; i < runs; i += 1) pitch.detectPitch(frame, SR, { threshold: p.yinThreshold });
  const perFrame = (performance.now() - t0) / runs;
  out.yin[mode] = { msPerFrame: +perFrame.toFixed(3), framesPerSecond: Math.round(1000 / p.hopMs), cpuShare: +((perFrame * 1000) / p.hopMs / 1000).toFixed(3) };
}

// 2. The app under load: Jam Studio with drums, bass, chords, an arrangement, overlays, at 160 BPM.
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
try {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/?debug=1`, { waitUntil: 'load' });
  out.load = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return { domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), loadMs: Math.round(nav.loadEventEnd), transferKiB: Math.round(performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) / 1024) };
  });
  out.load.wallMs = Date.now() - t0;
  await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
  await page.getByTestId('template').selectOption('ii-v-i');
  await page.getByTestId('jam-genre').selectOption('fusion');
  await page.getByTestId('arrangement-preset').selectOption('song');
  for (let i = 0; i < 3; i += 1) await page.getByTestId('view-chip-' + i).click().then(() => page.getByTestId('view-customize').click()).then(() => page.getByTestId('view-add-arpeggio').click()).catch(() => {});
  await page.getByTestId('bpm').fill('160');
  const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await page.getByTestId('play').click();
  const frames = await page.evaluate(() => new Promise((resolve) => {
    const times = [];
    let last = performance.now();
    const end = last + 8000;
    const tick = (now) => { times.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else resolve(times); };
    requestAnimationFrame(tick);
  }));
  const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const debug = await page.evaluate(() => {
    const d = window.__gtl?.debug;
    const lags = (d?.shown ?? []).map((s) => (s.time - s.scheduled) * 1000).filter((x) => x >= 0).sort((a, b) => a - b);
    return { events: d?.scheduled.length ?? 0, displayLagMs: { median: lags[Math.floor(lags.length / 2)] ?? null, p95: lags[Math.floor(lags.length * 0.95)] ?? null } };
  });
  await page.getByTestId('stop').click();
  const sorted = [...frames].sort((a, b) => a - b);
  out.playing = {
    seconds: 8,
    frames: frames.length,
    frameMs: { median: +sorted[Math.floor(sorted.length / 2)].toFixed(1), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), max: +sorted.at(-1).toFixed(1) },
    longFrames: frames.filter((f) => f > 50).length,
    cpuTaskSeconds: +(after.TaskDuration - before.TaskDuration).toFixed(2),
    scriptSeconds: +(after.ScriptDuration - before.ScriptDuration).toFixed(2),
    heapMiB: +(after.JSHeapUsedSize / 1048576).toFixed(1),
    domNodes: after.Nodes,
    ...debug,
  };
  await browser.close();
} finally {
  server.kill();
}
writeFileSync('test-results/perf/perf.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
