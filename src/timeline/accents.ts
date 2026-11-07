/**
 * Click accents: a 16-step pattern that is separate from the meter. The meter
 * says where bars and beats fall; the pattern says how loud each click is.
 * With no pattern the levels follow the meter. Pure, no DOM.
 */
import type { MetronomeEvent, Meter, Subdivision } from './model';

/** 0 silent, 1 soft, 2 normal, 3 accent. */
export type AccentLevel = 0 | 1 | 2 | 3;
export const ACCENT_STEPS = 16;
export const ACCENT_NAMES: Readonly<Record<AccentLevel, string>> = { 0: 'muto', 1: 'debole', 2: 'normale', 3: 'accento' };

/** Clicks in one bar of this meter at this subdivision. */
export const clicksPerBar = (meter: Meter, subdivision: Subdivision): number => meter.beatsPerBar * subdivision;

/**
 * Compound meters (6/8, 9/8, 12/8) are felt in groups of three eighths: the
 * pulse falls every three beats, not on every eighth.
 */
export function pulseEvery(meter: Meter): number {
  return meter.beatUnit === 8 && meter.beatsPerBar % 3 === 0 && meter.beatsPerBar > 3 ? 3 : 1;
}

/** The level a click has by its place in the meter alone. */
export function meterLevel(step: number, meter: Meter, subdivision: Subdivision): AccentLevel {
  if (step === 0) return 3;
  if (step % subdivision !== 0) return 1;
  const beat = step / subdivision;
  return beat % pulseEvery(meter) === 0 ? 2 : 1;
}

/** The pattern the meter implies, padded to 16 steps; steps past the bar are silent. */
export function meterAccents(meter: Meter, subdivision: Subdivision): readonly AccentLevel[] {
  const count = clicksPerBar(meter, subdivision);
  return Array.from({ length: ACCENT_STEPS }, (_, i) => (i < count ? meterLevel(i, meter, subdivision) : 0));
}

/**
 * The level of one click. A custom pattern covers the first 16 clicks of a
 * bar; longer bars (12/8 in sixteenths) fall back to the meter after that.
 */
export function accentLevel(pattern: readonly AccentLevel[] | null, event: MetronomeEvent, subdivision: Subdivision): AccentLevel {
  const custom = pattern && event.step < ACCENT_STEPS ? pattern[event.step] : undefined;
  return custom ?? meterLevel(event.step, event.meter, subdivision);
}

/** One press goes one level up, and from accent back to silent. */
export const nextAccent = (level: AccentLevel): AccentLevel => ((level + 1) % 4) as AccentLevel;

export function sanitizeAccents(raw: unknown): readonly AccentLevel[] | null {
  if (!Array.isArray(raw) || raw.length !== ACCENT_STEPS) return null;
  return raw.every((v) => v === 0 || v === 1 || v === 2 || v === 3) ? (raw as AccentLevel[]) : null;
}
