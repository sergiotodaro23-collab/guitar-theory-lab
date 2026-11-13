/**
 * Click timbres, synthesised from oscillators: no samples, nothing to license.
 * A recipe says what one click of a given accent level sounds like. Pure.
 */
import type { AccentLevel } from '../timeline';

export type ClickSound = 'beep' | 'wood' | 'stick' | 'bell' | 'soft';
export const CLICK_SOUNDS: readonly { readonly value: ClickSound; readonly label: string }[] = [
  { value: 'beep', label: 'Bip' },
  { value: 'wood', label: 'Legno' },
  { value: 'stick', label: 'Bacchetta' },
  { value: 'bell', label: 'Campanaccio' },
  { value: 'soft', label: 'Morbido' },
];

export interface ClickRecipe {
  readonly duration: number;
  readonly level: number;
  readonly attack: number;
  /** Exponential decay (struck sounds) instead of a held tone. */
  readonly decaying: boolean;
  readonly oscillators: readonly { readonly type: OscillatorType; readonly frequency: number; readonly mix?: number }[];
}

const GAIN: Readonly<Record<Exclude<AccentLevel, 0>, number>> = { 1: 0.2, 2: 0.45, 3: 0.7 };

/** The click for a level, or null when the step is silent. Accents are louder and higher. */
export function clickRecipe(sound: ClickSound, level: AccentLevel): ClickRecipe | null {
  if (level === 0) return null;
  const gain = GAIN[level];
  const pitch = level === 3 ? 1.5 : level === 2 ? 1.0 : 0.82;
  switch (sound) {
    case 'beep':
      return { duration: 0.035, level: gain, attack: 0.001, decaying: false, oscillators: [{ type: 'square', frequency: 1180 * pitch }] };
    case 'wood':
      return {
        duration: 0.07, level: gain * 1.2, attack: 0.001, decaying: true,
        oscillators: [{ type: 'sine', frequency: 880 * pitch }, { type: 'triangle', frequency: 880 * pitch * 2.71, mix: 0.3 }],
      };
    case 'stick':
      return {
        duration: 0.028, level: gain, attack: 0.0005, decaying: true,
        oscillators: [{ type: 'triangle', frequency: 2400 * pitch }, { type: 'square', frequency: 3710 * pitch, mix: 0.18 }],
      };
    case 'bell':
      // Two detuned squares a fifth-and-a-bit apart: the classic struck-metal clang.
      return {
        duration: 0.2, level: gain * 0.55, attack: 0.001, decaying: true,
        oscillators: [{ type: 'square', frequency: 540 * pitch }, { type: 'square', frequency: 800 * pitch, mix: 0.9 }],
      };
    case 'soft':
      // A low, round tick for quiet practice: one sine with a slower attack and no bright partials.
      return { duration: 0.06, level: gain * 0.9, attack: 0.004, decaying: true, oscillators: [{ type: 'sine', frequency: 620 * pitch }] };
  }
}
