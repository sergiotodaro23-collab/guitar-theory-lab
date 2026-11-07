/**
 * The jam drum kit, synthesised: a tone with a falling pitch for drums, a
 * filtered noise burst for snares, hats and claps. No samples, nothing to
 * license. A recipe describes one hit; the audio sink builds it. Pure.
 */
export interface DrumRecipe {
  /** Body: a sine (or triangle) gliding from `from` to `to` Hz. */
  readonly tone: { readonly type: OscillatorType; readonly from: number; readonly to: number; readonly decay: number; readonly level: number } | null;
  /** Noise through one filter. */
  readonly noise: { readonly filter: BiquadFilterType; readonly frequency: number; readonly q: number; readonly decay: number; readonly level: number } | null;
  /** Repeated onsets (a clap is a few hands slightly apart), in seconds. */
  readonly bursts: readonly number[];
}

const RECIPES: Readonly<Record<string, DrumRecipe>> = {
  kick: { tone: { type: 'sine', from: 150, to: 45, decay: 0.42, level: 1 }, noise: { filter: 'lowpass', frequency: 1200, q: 0.7, decay: 0.012, level: 0.25 }, bursts: [0] },
  snare: { tone: { type: 'triangle', from: 230, to: 170, decay: 0.12, level: 0.45 }, noise: { filter: 'bandpass', frequency: 1900, q: 0.8, decay: 0.19, level: 0.8 }, bursts: [0] },
  hat: { tone: null, noise: { filter: 'highpass', frequency: 7500, q: 0.7, decay: 0.045, level: 0.45 }, bursts: [0] },
  open: { tone: null, noise: { filter: 'highpass', frequency: 7000, q: 0.7, decay: 0.32, level: 0.4 }, bursts: [0] },
  clap: { tone: null, noise: { filter: 'bandpass', frequency: 1250, q: 1.4, decay: 0.12, level: 0.75 }, bursts: [0, 0.011, 0.022] },
  tom: { tone: { type: 'sine', from: 190, to: 110, decay: 0.32, level: 0.85 }, noise: { filter: 'lowpass', frequency: 900, q: 0.7, decay: 0.02, level: 0.15 }, bursts: [0] },
};

export function drumRecipe(voice: string): DrumRecipe | null {
  return RECIPES[voice] ?? null;
}
