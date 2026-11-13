/**
 * Studio V6 «Dettagli» page: what the current selection is, in words. Pure:
 * every figure comes from the theory and harmony engines (scale formula and
 * notes, chord tones, guide tones, roman numeral, common tones and guide-tone
 * motion towards the next chord). Nothing here is typed by hand.
 */
import type { Settings } from '../../../app/settings';
import { commonTones, guideToneMotion, guideTones, numeralOf } from '../../../harmony';
import { INVERSION_NAMES, buildScale, type Chord } from '../../../theory';

export interface DetailsModel {
  /** The key the display reads: the studied scale, or the progression's key in the harmonic labs. */
  readonly scale: { readonly tonic: string; readonly name: string; readonly formula: string; readonly notes: string };
  readonly chord: {
    readonly symbol: string;
    /** "C (1) · E (3) · G (5) · B (7)" */
    readonly tones: string;
    readonly guide: string;
    /** Roman numeral in the key above; empty when the lab has no key for it. */
    readonly numeral: string;
    readonly bass: string;
  } | null;
  readonly next: {
    readonly symbol: string;
    /** Notes the two chords share, with the degree each has before and after. */
    readonly common: readonly string[];
    /** Where each guide tone of the chord goes in the next one. */
    readonly motion: readonly string[];
  } | null;
}

type DetailSettings = Pick<Settings, 'mode' | 'tonic' | 'scaleId' | 'harmonyKey' | 'harmonyMode' | 'arpSource'>;

const semitones = (n: number): string => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'semitono' : 'semitoni'}`;
const nameOf = (chord: Chord, pc: number): string => chord.tones.find((t) => t.pc === pc)?.name ?? '?';

export function detailsModel(s: DetailSettings, chord: Chord | null, next: Chord | null): DetailsModel {
  const harmonic = s.mode === 'harmony' || s.mode === 'jam' || (s.mode === 'arpeggio' && s.arpSource === 'progression');
  const key = harmonic ? buildScale(s.harmonyKey, s.harmonyMode) : buildScale(s.tonic, s.scaleId);
  const tonicPc = key.tones[0]?.pc ?? 0;
  const bassText = (c: Chord): string => {
    if (!c.bass) return 'fondamentale al basso';
    const inversion = c.bass.inversion === null ? null : INVERSION_NAMES[c.bass.inversion];
    return `${c.bass.name} al basso${inversion ? ` · ${inversion}` : c.bass.degree === null ? ' · basso estraneo all’accordo' : ''}`;
  };
  return {
    scale: { tonic: key.tonicName, name: key.definition.name, formula: key.definition.formula.join(' – '), notes: key.tones.map((t) => t.name).join(' – ') },
    chord: chord ? {
      symbol: chord.symbol,
      tones: chord.tones.map((t) => `${t.name} (${t.degree})`).join(' · '),
      guide: guideTones(chord).map((t) => `${t.name} (${t.degree})`).join(' · '),
      numeral: numeralOf(chord, tonicPc),
      bass: bassText(chord),
    } : null,
    next: chord && next ? {
      symbol: next.symbol,
      common: commonTones(chord, next).map((c) => `${nameOf(chord, c.pc)}: ${c.from} → ${c.to}`),
      motion: guideToneMotion(chord, next).map((m) => {
        const from = `${nameOf(chord, m.fromPc)} (${m.fromDegree})`;
        const to = `${nameOf(next, m.toPc)} (${m.toDegree})`;
        return m.motion === 0 ? `${from} resta e diventa ${m.toDegree}` : `${from} → ${to}: ${m.motion > 0 ? 'sale' : 'scende'} di ${semitones(m.motion)}`;
      }),
    } : null,
  };
}
