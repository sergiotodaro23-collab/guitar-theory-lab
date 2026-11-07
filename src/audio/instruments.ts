/**
 * Jam timbres (P3-07, D-32): drum kits, bass and comping sounds, all
 * synthesised from oscillators, noise and filters. No samples: nothing to
 * license, nothing to download. A recipe is data; the sink plays it. Pure.
 */
import type { DrumRecipe } from './drumSounds';

export type DrumKitSound = 'acoustic' | 'electronic' | 'brushes';
export type BassTimbre = 'finger' | 'pick' | 'upright' | 'synth';
export type CompTimbre = 'keys' | 'epiano' | 'organ' | 'clean' | 'pad';

export const DRUM_KIT_SOUNDS: Readonly<Record<DrumKitSound, string>> = { acoustic: 'Acustica', electronic: 'Elettronica', brushes: 'Spazzole' };
export const BASS_TIMBRES: Readonly<Record<BassTimbre, string>> = { finger: 'Elettrico a dita', pick: 'Elettrico col plettro', upright: 'Contrabbasso', synth: 'Synth bass' };
export const COMP_TIMBRES: Readonly<Record<CompTimbre, string>> = { keys: 'Tastiera', epiano: 'Piano elettrico', organ: 'Organo', clean: 'Chitarra pulita', pad: 'Pad' };

/** Kit variants over the acoustic recipes: only what differs. */
const KIT_OVERRIDES: Readonly<Record<Exclude<DrumKitSound, 'acoustic'>, Readonly<Record<string, DrumRecipe>>>> = {
  // Drum machine: a long sine kick, a snappy tonal snare, metallic hats.
  electronic: {
    kick: { tone: { type: 'sine', from: 120, to: 42, decay: 0.7, level: 1 }, noise: null, bursts: [0] },
    snare: { tone: { type: 'triangle', from: 260, to: 200, decay: 0.08, level: 0.5 }, noise: { filter: 'highpass', frequency: 2400, q: 0.7, decay: 0.16, level: 0.7 }, bursts: [0] },
    hat: { tone: { type: 'square', from: 7800, to: 7600, decay: 0.03, level: 0.06 }, noise: { filter: 'highpass', frequency: 9000, q: 0.7, decay: 0.035, level: 0.4 }, bursts: [0] },
    open: { tone: { type: 'square', from: 7400, to: 7200, decay: 0.2, level: 0.05 }, noise: { filter: 'highpass', frequency: 8500, q: 0.7, decay: 0.25, level: 0.35 }, bursts: [0] },
    clap: { tone: null, noise: { filter: 'bandpass', frequency: 1100, q: 1.1, decay: 0.16, level: 0.8 }, bursts: [0, 0.008, 0.017, 0.027] },
    tom: { tone: { type: 'sine', from: 220, to: 90, decay: 0.4, level: 0.85 }, noise: null, bursts: [0] },
  },
  // Brushes: a swept snare, a soft felt kick, a quiet hi-hat foot.
  brushes: {
    kick: { tone: { type: 'sine', from: 110, to: 55, decay: 0.25, level: 0.7 }, noise: { filter: 'lowpass', frequency: 600, q: 0.7, decay: 0.02, level: 0.1 }, bursts: [0] },
    snare: { tone: null, noise: { filter: 'bandpass', frequency: 3200, q: 0.5, decay: 0.22, level: 0.45 }, bursts: [0, 0.03] },
    hat: { tone: null, noise: { filter: 'highpass', frequency: 6000, q: 0.5, decay: 0.03, level: 0.25 }, bursts: [0] },
    clap: { tone: null, noise: { filter: 'bandpass', frequency: 2400, q: 0.6, decay: 0.12, level: 0.35 }, bursts: [0] },
    tom: { tone: { type: 'sine', from: 160, to: 120, decay: 0.25, level: 0.55 }, noise: { filter: 'bandpass', frequency: 2500, q: 0.5, decay: 0.08, level: 0.15 }, bursts: [0] },
  },
};

export function kitRecipe(voice: string, kit: DrumKitSound, acoustic: (voice: string) => DrumRecipe | null): DrumRecipe | null {
  if (kit === 'acoustic') return acoustic(voice);
  return KIT_OVERRIDES[kit][voice] ?? acoustic(voice);
}

export interface TonePartial {
  readonly type: OscillatorType;
  /** Multiple of the note's frequency. */
  readonly ratio: number;
  readonly level: number;
  /** Cents. */
  readonly detune?: number;
}

export interface ToneRecipe {
  readonly partials: readonly TonePartial[];
  /** Seconds. */
  readonly attack: number;
  /** Level after the attack, as a fraction of the peak, reached with this time constant. */
  readonly sustain: number;
  readonly decay: number;
  readonly release: number;
  /** Low-pass that opens at `from` Hz and settles at `to` within `time` seconds. */
  readonly filter: { readonly from: number; readonly to: number; readonly time: number; readonly q: number };
  /** Spread of a strum between the notes of a chord, seconds per note. */
  readonly strum: number;
  /** Overall level against the old keys sound. */
  readonly gain: number;
}

export const BASS_RECIPES: Readonly<Record<BassTimbre, ToneRecipe>> = {
  finger: { partials: [{ type: 'sawtooth', ratio: 1, level: 1 }, { type: 'sine', ratio: 1, level: 0.8 }], attack: 0.006, sustain: 0.58, decay: 0.12, release: 0.06, filter: { from: 1400, to: 380, time: 0.25, q: 2 }, strum: 0, gain: 1 },
  pick: { partials: [{ type: 'sawtooth', ratio: 1, level: 1 }, { type: 'square', ratio: 1, level: 0.25 }, { type: 'sine', ratio: 1, level: 0.6 }], attack: 0.002, sustain: 0.5, decay: 0.09, release: 0.04, filter: { from: 3200, to: 700, time: 0.15, q: 3 }, strum: 0, gain: 0.95 },
  upright: { partials: [{ type: 'sine', ratio: 1, level: 1 }, { type: 'triangle', ratio: 2, level: 0.25 }], attack: 0.012, sustain: 0.3, decay: 0.25, release: 0.08, filter: { from: 900, to: 300, time: 0.3, q: 1 }, strum: 0, gain: 1.2 },
  synth: { partials: [{ type: 'square', ratio: 1, level: 0.7 }, { type: 'sawtooth', ratio: 1, level: 0.6, detune: 8 }, { type: 'sine', ratio: 0.5, level: 0.5 }], attack: 0.004, sustain: 0.8, decay: 0.2, release: 0.05, filter: { from: 2600, to: 500, time: 0.2, q: 6 }, strum: 0, gain: 0.8 },
};

export const COMP_RECIPES: Readonly<Record<CompTimbre, ToneRecipe>> = {
  // The original comping sound: triangle with a touch of saw.
  keys: { partials: [{ type: 'triangle', ratio: 1, level: 1 }, { type: 'sawtooth', ratio: 1, level: 0.12, detune: 3 }], attack: 0.008, sustain: 1, decay: 1, release: 0.03, filter: { from: 6000, to: 6000, time: 0.1, q: 0.5 }, strum: 0, gain: 1 },
  // Electric piano: a bell (sine plus a high partial that fades fast), a slow decay.
  epiano: { partials: [{ type: 'sine', ratio: 1, level: 1 }, { type: 'sine', ratio: 3, level: 0.18 }, { type: 'sine', ratio: 14, level: 0.05 }], attack: 0.004, sustain: 0.45, decay: 0.6, release: 0.2, filter: { from: 5000, to: 2200, time: 0.4, q: 0.7 }, strum: 0, gain: 1.15 },
  // Drawbar organ: octave and twelfth, no decay, a quick key click.
  organ: { partials: [{ type: 'sine', ratio: 1, level: 1 }, { type: 'sine', ratio: 2, level: 0.6 }, { type: 'sine', ratio: 3, level: 0.4 }, { type: 'sine', ratio: 0.5, level: 0.4 }], attack: 0.01, sustain: 1, decay: 1, release: 0.04, filter: { from: 7000, to: 7000, time: 0.1, q: 0.5 }, strum: 0, gain: 0.75 },
  // Clean electric guitar: bright pluck, filter closing, the chord strummed low to high.
  clean: { partials: [{ type: 'sawtooth', ratio: 1, level: 0.7 }, { type: 'triangle', ratio: 1, level: 0.6 }], attack: 0.002, sustain: 0.25, decay: 0.35, release: 0.05, filter: { from: 4200, to: 1300, time: 0.35, q: 1.5 }, strum: 0.012, gain: 0.9 },
  // Pad: detuned saws through a soft filter, slow in and out.
  pad: { partials: [{ type: 'sawtooth', ratio: 1, level: 0.5, detune: -7 }, { type: 'sawtooth', ratio: 1, level: 0.5, detune: 7 }, { type: 'sine', ratio: 1, level: 0.5 }], attack: 0.35, sustain: 0.9, decay: 1, release: 0.6, filter: { from: 1400, to: 1100, time: 1, q: 0.7 }, strum: 0, gain: 0.7 },
};

/** Start offsets of a strum, lowest note first. */
export const strumOffsets = (notes: number, recipe: ToneRecipe): readonly number[] => Array.from({ length: notes }, (_, i) => i * recipe.strum);
