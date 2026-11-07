/**
 * Jam Studio's drum step sequencer, Simple level: six kit pieces, 16 steps of
 * a sixteenth note, each step off, on or accented. Four patterns A–D and a
 * fill. Patterns become a timeline track like everything else: same clock,
 * same swing, pattern changes at the next bar line. Pure, no DOM.
 */
import { PPQ, ticksPerBar, type DrumPayload, type Meter, type Track, type TrackEvent } from '../timeline';

export type DrumVoice = 'kick' | 'snare' | 'hat' | 'open' | 'clap' | 'tom';
export const DRUM_VOICES: readonly { readonly voice: DrumVoice; readonly label: string }[] = [
  { voice: 'kick', label: 'Cassa' },
  { voice: 'snare', label: 'Rullante' },
  { voice: 'hat', label: 'Hi-hat chiuso' },
  { voice: 'open', label: 'Hi-hat aperto' },
  { voice: 'clap', label: 'Battimani' },
  { voice: 'tom', label: 'Tom' },
];

/** 0 off, 1 on, 2 accent. */
export type DrumStep = 0 | 1 | 2;
export const DRUM_STEPS = 16;
export type DrumPattern = Readonly<Record<DrumVoice, readonly DrumStep[]>>;
export const PATTERN_NAMES = ['A', 'B', 'C', 'D'] as const;

export interface DrumKit {
  readonly patterns: readonly [DrumPattern, DrumPattern, DrumPattern, DrumPattern];
  readonly fill: DrumPattern;
}

/** Steps from a readable string: "x" on, "X" accent, anything else off. */
export const steps = (text: string): readonly DrumStep[] =>
  Array.from({ length: DRUM_STEPS }, (_, i) => (text[i] === 'X' ? 2 : text[i] === 'x' ? 1 : 0));

export const pattern = (rows: Partial<Record<DrumVoice, string>>): DrumPattern => ({
  kick: steps(rows.kick ?? ''), snare: steps(rows.snare ?? ''), hat: steps(rows.hat ?? ''),
  open: steps(rows.open ?? ''), clap: steps(rows.clap ?? ''), tom: steps(rows.tom ?? ''),
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

/**
 * The step a sixteenth of the bar plays. A bar longer than 16 steps (5/4,
 * 12/8) starts the pattern again after step 16; a shorter one ends early.
 */
export const stepAt = (sixteenth: number): number => sixteenth % DRUM_STEPS;

/** Velocity of a step: an accent is clearly louder than a normal hit. */
export const stepVelocity = (step: DrumStep): number => (step === 2 ? 1 : step === 1 ? 0.7 : 0);

function barEvents(p: DrumPattern, meter: Meter, offset: number): TrackEvent<DrumPayload>[] {
  const events: TrackEvent<DrumPayload>[] = [];
  const sixteenth = PPQ / 4;
  for (let i = 0; i < sixteenthsPerBar(meter); i += 1) {
    for (const { voice } of DRUM_VOICES) {
      const step = p[voice][stepAt(i)] ?? 0;
      if (step > 0) events.push({ tick: offset + i * sixteenth, payload: { type: 'drum', voice, velocity: stepVelocity(step) } });
    }
  }
  return events;
}

/**
 * The drum track: the chosen pattern, with the fill as the last bar of every
 * `fillEvery` bars (0 = never). Loops forever.
 */
export function drumTrack(kit: DrumKit, active: number, meter: Meter, fillEvery: number): Omit<Track<DrumPayload>, 'originTick'> {
  const bar = ticksPerBar(meter);
  const bars = fillEvery > 0 ? fillEvery : 1;
  const main = kit.patterns[active] ?? kit.patterns[0];
  const events = Array.from({ length: bars }, (_, i) => barEvents(fillEvery > 0 && i === bars - 1 ? kit.fill : main, meter, i * bar)).flat();
  return { id: 'drums', lengthTicks: bar * bars, loop: true, events };
}

/** One press: off → on → accent → off. */
export const nextDrumStep = (step: DrumStep): DrumStep => ((step + 1) % 3) as DrumStep;

const sanitizeRow = (raw: unknown): readonly DrumStep[] | null =>
  Array.isArray(raw) && raw.length === DRUM_STEPS && raw.every((v) => v === 0 || v === 1 || v === 2) ? (raw as DrumStep[]) : null;

function sanitizePattern(raw: unknown, fallback: DrumPattern): DrumPattern {
  if (typeof raw !== 'object' || raw === null) return fallback;
  const r = raw as Record<string, unknown>;
  const out = {} as Record<DrumVoice, readonly DrumStep[]>;
  for (const { voice } of DRUM_VOICES) out[voice] = sanitizeRow(r[voice]) ?? fallback[voice];
  return out;
}

export function sanitizeKit(raw: unknown): DrumKit {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_KIT;
  const r = raw as Record<string, unknown>;
  const list = Array.isArray(r.patterns) ? r.patterns : [];
  const [a, b, c, d] = DEFAULT_KIT.patterns;
  return {
    patterns: [sanitizePattern(list[0], a), sanitizePattern(list[1], b), sanitizePattern(list[2], c), sanitizePattern(list[3], d)],
    fill: sanitizePattern(r.fill, DEFAULT_KIT.fill),
  };
}
