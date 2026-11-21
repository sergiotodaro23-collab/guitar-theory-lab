/**
 * Jam Studio's drum step sequencer, Simple level: ten kit pieces, 16 steps of
 * a sixteenth note, each step off, on, accented or ghosted. Four patterns A–D
 * and a fill; the bar after a fill opens with a crash (J3). Patterns become a timeline track like everything else: same clock,
 * same swing, pattern changes at the next bar line. Pure, no DOM.
 */
import { PPQ, ticksPerBar, type DrumPayload, type Meter, type Track, type TrackEvent } from '../timeline';

export type DrumVoice = 'kick' | 'snare' | 'cross' | 'hat' | 'pedal' | 'open' | 'ride' | 'crash' | 'clap' | 'tom';
export const DRUM_VOICES: readonly { readonly voice: DrumVoice; readonly label: string }[] = [
  { voice: 'kick', label: 'Cassa' },
  { voice: 'snare', label: 'Rullante' },
  { voice: 'cross', label: 'Cross-stick' },
  { voice: 'hat', label: 'Hi-hat chiuso' },
  { voice: 'pedal', label: 'Hi-hat a pedale' },
  { voice: 'open', label: 'Hi-hat aperto' },
  { voice: 'ride', label: 'Ride' },
  { voice: 'crash', label: 'Crash' },
  { voice: 'clap', label: 'Battimani' },
  { voice: 'tom', label: 'Tom' },
];

/** 0 off, 1 on, 2 accent, 3 ghost (a soft note between the hits: the groove's glue). */
export type DrumStep = 0 | 1 | 2 | 3;
/** Steps in one bar of the grid: sixteenths of a 4/4 bar. */
export const DRUM_STEPS = 16;

/**
 * Advanced level (J3): a pattern of 16, 32 or 64 steps (one, two or four
 * bars), and for each step a level (percent of the step's velocity) and a
 * chance of playing (percent). Both are optional: a Simple pattern has none.
 */
export const PATTERN_LENGTHS = [16, 32, 64] as const;
export type PatternLength = (typeof PATTERN_LENGTHS)[number];
export const STEP_LEVELS = [100, 85, 70, 55, 40] as const;
export const STEP_CHANCES = [100, 75, 50, 25] as const;
type StepValues = Partial<Record<DrumVoice, readonly number[]>>;
export type DrumPattern = Readonly<Record<DrumVoice, readonly DrumStep[]>> & {
  readonly levels?: StepValues;
  readonly chances?: StepValues;
};
export const PATTERN_NAMES = ['A', 'B', 'C', 'D'] as const;

export interface DrumKit {
  readonly patterns: readonly [DrumPattern, DrumPattern, DrumPattern, DrumPattern];
  readonly fill: DrumPattern;
}

/** Steps from a readable string: "x" on, "X" accent, "g" ghost, anything else off. */
export const steps = (text: string): readonly DrumStep[] =>
  Array.from({ length: DRUM_STEPS }, (_, i) => (text[i] === 'X' ? 2 : text[i] === 'x' ? 1 : text[i] === 'g' ? 3 : 0));

export const pattern = (rows: Partial<Record<DrumVoice, string>>): DrumPattern => ({
  kick: steps(rows.kick ?? ''), snare: steps(rows.snare ?? ''), cross: steps(rows.cross ?? ''),
  hat: steps(rows.hat ?? ''), pedal: steps(rows.pedal ?? ''), open: steps(rows.open ?? ''),
  ride: steps(rows.ride ?? ''), crash: steps(rows.crash ?? ''), clap: steps(rows.clap ?? ''), tom: steps(rows.tom ?? ''),
});

/** Starting kit: four everyday grooves and a tom fill, all in 4/4 sixteenths. */
export const DEFAULT_KIT: DrumKit = {
  patterns: [
    // A: straight rock, eighth hats.
    pattern({ kick: 'X.......x.x.....', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' }),
    // B: busier rock, open hat on the and of four.
    pattern({ kick: 'X.....x.x.x.....', snare: '....X.......X..x', hat: 'x.x.x.x.x.x.x...', open: '..............x.' }),
    // C: half time, snare on three.
    pattern({ kick: 'X.........x.....', snare: '........X.......', hat: 'x.x.x.x.x.x.x.x.' }),
    // D: four on the floor with claps.
    pattern({ kick: 'X...x...X...x...', clap: '....x.......x...', hat: '..x...x...x...x.', open: '..............x.' }),
  ],
  fill: pattern({ kick: 'X...............', snare: '....x.x.xxxx....', tom: '............XxXx', hat: 'x.x.............' }),
};

export const emptyPattern = (): DrumPattern => pattern({});

/** Sixteenth-note steps in one bar of this meter: 16 in 4/4, 12 in 3/4 and 6/8, 24 in 12/8. */
export const sixteenthsPerBar = (meter: Meter): number => ticksPerBar(meter) / (PPQ / 4);

/** Steps in the pattern: 16, 32 or 64. */
export const patternLength = (p: DrumPattern): number => p.kick.length;
export const patternBars = (p: DrumPattern): number => Math.max(1, Math.round(patternLength(p) / DRUM_STEPS));

/** Level (0–1) and chance (0–1) of a step; 1 where nothing is set. */
export const stepLevel = (p: DrumPattern, voice: DrumVoice, index: number): number => (p.levels?.[voice]?.[index] ?? 100) / 100;
export const stepChance = (p: DrumPattern, voice: DrumVoice, index: number): number => (p.chances?.[voice]?.[index] ?? 100) / 100;

const fit = <T>(row: readonly T[], length: number, empty: T): readonly T[] =>
  Array.from({ length }, (_, i) => (row.length ? (row[i % row.length] as T) : empty));

/**
 * A pattern stretched or cut to `length` steps. Growing repeats the bars it
 * has, as a drum machine copies the first bar into the new ones; shrinking
 * keeps the first bars.
 */
export function resizePattern(p: DrumPattern, length: PatternLength): DrumPattern {
  if (patternLength(p) === length) return p;
  const out = {} as Record<DrumVoice, readonly DrumStep[]>;
  const values = (src: StepValues | undefined): StepValues | undefined => {
    if (!src) return undefined;
    const res: Record<string, readonly number[]> = {};
    for (const [voice, row] of Object.entries(src)) if (row) res[voice] = fit(row.slice(0, patternLength(p)), length, 100);
    return res;
  };
  for (const { voice } of DRUM_VOICES) out[voice] = fit(p[voice], length, 0 as DrumStep);
  const levels = values(p.levels);
  const chances = values(p.chances);
  return { ...out, ...(levels ? { levels } : {}), ...(chances ? { chances } : {}) };
}

/** Set one step's level or chance (percent); 100 removes it. */
export function withStepValue(p: DrumPattern, kind: 'levels' | 'chances', voice: DrumVoice, index: number, value: number): DrumPattern {
  const row = (p[kind]?.[voice] ?? Array.from({ length: patternLength(p) }, () => 100)).slice();
  row[index] = value;
  return { ...p, [kind]: { ...p[kind], [voice]: row } };
}

/** The next value of a cycle such as STEP_LEVELS: 100 → 85 → … → 100. */
export const nextValue = (cycle: readonly number[], value: number): number => cycle[(cycle.indexOf(value) + 1) % cycle.length] ?? 100;

/**
 * A step's dice roll, 0–1: a hash of the seed, the kit piece, the bar of the
 * cycle and the step. Deterministic: the same jam plays the same variations,
 * and a test can predict them.
 */
export function chanceRoll(seed: number, voice: DrumVoice, bar: number, index: number): number {
  let h = (seed * 0x9e3779b1) ^ (bar * 0x85ebca6b) ^ (index * 0xc2b2ae35);
  for (let i = 0; i < voice.length; i += 1) h = Math.imul(h ^ voice.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

const hasChances = (p: DrumPattern): boolean => Object.values(p.chances ?? {}).some((row) => row?.some((v) => v < 100));

/**
 * The step a sixteenth of the bar plays. A bar longer than 16 steps (5/4,
 * 12/8) starts the pattern again after step 16; a shorter one ends early.
 */
export const stepAt = (sixteenth: number): number => sixteenth % DRUM_STEPS;

/** Velocity of a step: an accent is clearly louder than a normal hit, a ghost clearly softer. */
export const stepVelocity = (step: DrumStep): number => (step === 2 ? 1 : step === 1 ? 0.7 : step === 3 ? 0.3 : 0);

/** Cymbals keep time with a pulse: strongest on the beat, then the eighth, then the sixteenths. */
const TIMEKEEPERS: ReadonlySet<DrumVoice> = new Set(['hat', 'pedal', 'open', 'ride']);
export function pulseFactor(sixteenth: number): number {
  if (sixteenth % 4 === 0) return 1;
  if (sixteenth % 2 === 0) return 0.84;
  return 0.7;
}

/** The velocity a hit plays at: the step's level, shaped by the pulse for cymbals (accents stay full). */
export function hitVelocity(voice: DrumVoice, step: DrumStep, sixteenth: number): number {
  const base = stepVelocity(step);
  return TIMEKEEPERS.has(voice) && step === 1 ? base * pulseFactor(sixteenth) : base;
}

/** One bar of a pattern: its `patternBar`-th 16 steps; `cycleBar` and `seed` roll the chances. */
function barEvents(p: DrumPattern, meter: Meter, offset: number, patternBar = 0, cycleBar = 0, seed = 1): TrackEvent<DrumPayload>[] {
  const events: TrackEvent<DrumPayload>[] = [];
  const sixteenth = PPQ / 4;
  const from = (patternBar % patternBars(p)) * DRUM_STEPS;
  for (let i = 0; i < sixteenthsPerBar(meter); i += 1) {
    const index = from + stepAt(i);
    for (const { voice } of DRUM_VOICES) {
      const step = p[voice][index] ?? 0;
      if (step === 0) continue;
      const chance = stepChance(p, voice, index);
      if (chance < 1 && chanceRoll(seed, voice, cycleBar, index) >= chance) continue;
      events.push({ tick: offset + i * sixteenth, payload: { type: 'drum', voice, velocity: hitVelocity(voice, step, i) * stepLevel(p, voice, index) } });
    }
  }
  return events;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Bars before the drum track repeats: the fill cycle and the pattern length together, at least 8 when some step plays by chance. */
export function drumCycleBars(kit: DrumKit, active: number, fillEvery: number): number {
  const main = kit.patterns[active] ?? kit.patterns[0];
  const fills = fillEvery > 0 ? fillEvery : 1;
  const pb = patternBars(main);
  const base = (fills * pb) / gcd(fills, pb);
  return hasChances(main) || (fillEvery > 0 && hasChances(kit.fill)) ? base * Math.ceil(8 / base) : base;
}

/** Which bar of the cycle is the fill, and which step of the grid a bar's sixteenth plays (for the step light). */
export function drumPosition(kit: DrumKit, active: number, fillEvery: number, cycleBar: number, sixteenth: number): { step: number; fill: boolean } {
  const fill = fillEvery > 0 && cycleBar % fillEvery === fillEvery - 1;
  const main = kit.patterns[active] ?? kit.patterns[0];
  return { fill, step: fill ? stepAt(sixteenth) : (cycleBar % patternBars(main)) * DRUM_STEPS + stepAt(sixteenth) };
}

/**
 * The bar after a fill: a drummer closes the fill on the next downbeat with a
 * crash and the kick under it. Where the groove already crashes there, nothing
 * changes; a kit with nothing on the downbeat (ambient) is left alone too.
 */
export function landingBar(p: DrumPattern, patternBar = 0): DrumPattern {
  const at = (patternBar % patternBars(p)) * DRUM_STEPS;
  if ((p.crash[at] ?? 0) > 0) return p;
  const downbeat = DRUM_VOICES.some(({ voice }) => (p[voice][at] ?? 0) > 0);
  if (!downbeat) return p;
  const set = (row: readonly DrumStep[], step: DrumStep): readonly DrumStep[] => row.map((v, i) => (i === at ? step : v));
  // The landing always sounds: whatever chance the downbeat had is lifted there.
  const sure = (src: StepValues | undefined): StepValues | undefined =>
    src && Object.fromEntries(Object.entries(src).map(([voice, row]) => [voice, row?.map((v, i) => (i === at ? 100 : v))]));
  const chances = sure(p.chances);
  return { ...p, crash: set(p.crash, 2), kick: set(p.kick, Math.max(p.kick[at] ?? 0, 1) as DrumStep), ...(chances ? { chances } : {}) };
}

/**
 * The bar after a fill: a drummer closes the fill on the next downbeat with a
 * crash and the kick under it. Where the groove already crashes there, nothing
 * changes; a kit with nothing on the downbeat (ambient) is left alone too.
 */
export function landingBar(p: DrumPattern): DrumPattern {
  if ((p.crash[0] ?? 0) > 0) return p;
  const downbeat = DRUM_VOICES.some(({ voice }) => (p[voice][0] ?? 0) > 0);
  if (!downbeat) return p;
  const set = (row: readonly DrumStep[], step: DrumStep): readonly DrumStep[] => row.map((v, i) => (i === 0 ? step : v));
  return { ...p, crash: set(p.crash, 2), kick: set(p.kick, Math.max(p.kick[0] ?? 0, 1) as DrumStep) };
}

/**
 * The drum track: the chosen pattern, with the fill as the last bar of every
 * `fillEvery` bars (0 = never), and a crash landing on the bar after it (the
 * loop's first bar, so the very first bar of a jam opens with one as well).
 * Loops forever.
 */
export function drumTrack(kit: DrumKit, active: number, meter: Meter, fillEvery: number, seed = 1): Omit<Track<DrumPayload>, 'originTick'> {
  const bar = ticksPerBar(meter);
  const bars = drumCycleBars(kit, active, fillEvery);
  const main = kit.patterns[active] ?? kit.patterns[0];
  const events = Array.from({ length: bars }, (_, i) => {
    const { fill } = drumPosition(kit, active, fillEvery, i, 0);
    if (fill) return barEvents(kit.fill, meter, i * bar, 0, i, seed);
    const landing = fillEvery > 0 && i % fillEvery === 0;
    return barEvents(landing ? landingBar(main, i) : main, meter, i * bar, i, i, seed);
  }).flat();
  return { id: 'drums', lengthTicks: bar * bars, loop: true, events };
}

/** One press: off → on → accent → ghost → off. */
export const nextDrumStep = (step: DrumStep): DrumStep => ((step + 1) % 4) as DrumStep;

const sanitizeRow = (raw: unknown, length: number): readonly DrumStep[] | null =>
  Array.isArray(raw) && raw.length === length && raw.every((v) => v === 0 || v === 1 || v === 2 || v === 3) ? (raw as DrumStep[]) : null;

function sanitizeValues(raw: unknown, length: number, allowed: readonly number[]): StepValues | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const out: Record<string, readonly number[]> = {};
  for (const { voice } of DRUM_VOICES) {
    const row = r[voice];
    if (Array.isArray(row) && row.length === length && row.every((v) => allowed.includes(v as number))) out[voice] = row as number[];
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizePattern(raw: unknown, fallback: DrumPattern, lengths: readonly number[] = PATTERN_LENGTHS): DrumPattern {
  if (typeof raw !== 'object' || raw === null) return fallback;
  const r = raw as Record<string, unknown>;
  const kick = Array.isArray(r.kick) ? r.kick.length : DRUM_STEPS;
  const length = lengths.includes(kick) ? kick : DRUM_STEPS;
  const base = length === patternLength(fallback) ? fallback : resizePattern(fallback, length as PatternLength);
  const out = {} as Record<DrumVoice, readonly DrumStep[]>;
  // A kit saved before a voice existed gets that row empty, not someone else's groove.
  for (const { voice } of DRUM_VOICES) out[voice] = sanitizeRow(r[voice], length) ?? (voice in r ? base[voice] : fit([], length, 0 as DrumStep));
  const levels = sanitizeValues(r.levels, length, STEP_LEVELS);
  const chances = sanitizeValues(r.chances, length, STEP_CHANCES);
  return { ...out, ...(levels ? { levels } : {}), ...(chances ? { chances } : {}) };
}

export function sanitizeKit(raw: unknown): DrumKit {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_KIT;
  const r = raw as Record<string, unknown>;
  const list = Array.isArray(r.patterns) ? r.patterns : [];
  const [a, b, c, d] = DEFAULT_KIT.patterns;
  return {
    patterns: [sanitizePattern(list[0], a), sanitizePattern(list[1], b), sanitizePattern(list[2], c), sanitizePattern(list[3], d)],
    // The fill is always one bar.
    fill: sanitizePattern(r.fill, DEFAULT_KIT.fill, [DRUM_STEPS]),
  };
}
