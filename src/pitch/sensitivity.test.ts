import { describe, expect, it } from 'vitest';
import { midiToFrequency } from './notes';
import { analyseOffline, type DetectedNote, type Sensitivity } from './sensitivity';

const SR = 48000;

/** Plucked-string-like tone: five harmonics, a fast attack and a slow decay. */
function legato(midis: readonly number[], noteSeconds: number, options: { vibratoCents?: number; attackEvery?: boolean; noise?: number } = {}): Float32Array {
  const n = Math.round(midis.length * noteSeconds * SR);
  const out = new Float32Array(n + SR / 4);
  let phase = 0;
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i += 1) {
    const k = Math.floor(i / (noteSeconds * SR));
    const local = i - k * noteSeconds * SR;
    const t = i / SR;
    const vib = options.vibratoCents ? options.vibratoCents * Math.sin(2 * Math.PI * 5 * t) : 0;
    const f = midiToFrequency((midis[k] ?? 60) + vib / 100);
    phase += (2 * Math.PI * f) / SR;
    // Legato: only the first note is picked; later notes are hammered (a smaller bump), unless every note is picked.
    const picked = k === 0 || options.attackEvery;
    // A re-picked note is damped for its last 15 ms by the pick coming back to the string.
    const damp = options.attackEvery && local > (noteSeconds - 0.015) * SR ? 0.35 : 1;
    const env = damp * (picked ? 1 : 0.8) * Math.min(1, local / 96) * Math.exp(-local / SR / 0.9);
    let v = 0;
    for (let h = 1; h <= 5; h += 1) v += Math.sin(h * phase) / h;
    out[i] = 0.3 * env * v / 1.5 + (options.noise ?? 0) * random();
  }
  return out;
}

/** Recognised: an event with the note's pitch while it sounds (plus a frame of delay). Spurious: anything else. */
function score(events: readonly DetectedNote[], midis: readonly number[], noteSeconds: number) {
  const recognised = midis.filter((m, i) => events.some((e) => e.midi === m && e.time >= i * noteSeconds && e.time <= (i + 1) * noteSeconds + 0.08)).length;
  const spurious = events.filter((e) => {
    const candidates = [Math.floor(e.time / noteSeconds), Math.floor((e.time - 0.08) / noteSeconds)];
    return !candidates.some((k) => midis[k] === e.midi);
  }).length;
  return { recognised: recognised / midis.length, spurious: spurious / Math.max(1, events.length), events: events.length };
}

// Sixteenths at 120 BPM: 125 ms each, a two-octave run in A minor pentatonic and back.
const RUN = [45, 48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 67, 64, 62, 60, 57];
const SIXTEENTH = 0.125;

describe('sensitivity modes on synthetic legato sixteenths at 120 BPM', () => {
  const signal = legato(RUN, SIXTEENTH);
  const results = Object.fromEntries((['precise', 'balanced', 'fast'] as Sensitivity[]).map((m) => [m, score(analyseOffline(signal, SR, m), RUN, SIXTEENTH)]));

  it('Fast recognises at least 90% of the notes with under 5% spurious ones', () => {
    expect(results.fast?.recognised).toBeGreaterThanOrEqual(0.9);
    expect(results.fast?.spurious).toBeLessThan(0.05);
  });

  it('Fast is the quickest: it recognises at least as many as Balanced, and Balanced at least as many as Precise', () => {
    expect(results.fast?.recognised).toBeGreaterThanOrEqual(results.balanced?.recognised ?? 0);
    expect(results.balanced?.recognised).toBeGreaterThanOrEqual(results.precise?.recognised ?? 0);
  });

  it('records the measured numbers for the QA report', () => {
    console.log('SENSITIVITY', JSON.stringify(results));
    expect(Object.keys(results)).toHaveLength(3);
  });
});

describe('Precise on a held note with light vibrato', () => {
  it('reports one note and nothing spurious over two seconds', () => {
    const held = legato([57, 57, 57, 57], 0.5, { vibratoCents: 15 });
    const events = analyseOffline(held, SR, 'precise');
    expect(events.map((e) => e.midi)).toEqual([57]);
  });

  it('Fast hears a re-picked note as a new attack on the same pitch', () => {
    const picked = legato([57, 57, 57, 57], 0.25, { attackEvery: true });
    const events = analyseOffline(picked, SR, 'fast');
    expect(events.filter((e) => e.midi === 57).length).toBeGreaterThanOrEqual(3);
  });
});
