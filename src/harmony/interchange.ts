/**
 * Where a chord comes from, in a key (P1-11b, D-30): diatonic to the home
 * mode, a secondary dominant, borrowed from a parallel mode (modal
 * interchange), or chromatic. Each origin proposes the scale that keeps the
 * chord in its context, so avoid notes and tensions follow the chord rather
 * than the key. Pure: no DOM.
 */
import { SCALES, buildScale, mod, type Chord, type ScaleId } from '../theory';

export const MODES: readonly ScaleId[] = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
/** Home modes the analysis accepts: the seven church modes. */
export const HOME_MODES: readonly ScaleId[] = MODES;
/** Parallel modes tried for a borrowed chord, most common source first. */
const PARALLEL: readonly ScaleId[] = ['aeolian', 'dorian', 'mixolydian', 'phrygian', 'lydian', 'harmonicMinor', 'melodicMinor', 'locrian', 'ionian'];

export type ChordOriginKind = 'diatonic' | 'secondary' | 'borrowed' | 'chromatic';

export interface ChordOrigin {
  readonly kind: ChordOriginKind;
  /** Roman numeral against the key: "ii7", "bVIImaj7", "V7/ii". */
  readonly numeral: string;
  /** The mode it is diatonic to or borrowed from (on the key's tonic); null for chromatic. */
  readonly source: ScaleId | null;
  /** Scale to play over it, on the chord's root; null when the analysis has no proposal. */
  readonly scale: { readonly tonic: string; readonly scaleId: ScaleId } | null;
  /** One line in Italian for the panel. */
  readonly text: string;
}

const NUMERALS = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
const rootPc = (chord: Chord) => chord.tones[0]?.pc ?? 0;
const pcsOf = (tonic: string, id: ScaleId) => buildScale(tonic, id).tones.map((t) => t.pc);
const contains = (scale: readonly number[], chord: Chord) => chord.tones.every((t) => scale.includes(t.pc));
const minorish = (chord: Chord) => chord.family === 'minor' || chord.family === 'halfDiminished' || chord.family === 'diminished';

/** The chord's quality as a numeral suffix: m7 → 7 on a lower-case numeral, m7b5 → ø7. */
function qualityMark(chord: Chord): string {
  switch (chord.family) {
    case 'halfDiminished': return 'ø7';
    case 'diminished': return chord.suffix.includes('7') ? '°7' : '°';
    case 'augmented': return chord.suffix === 'aug' ? '+' : `+${chord.suffix.replace('#5', '').replace('aug', '')}`;
    case 'minor': return chord.suffix.replace(/^m/, '');
    default: return chord.suffix;
  }
}

/** Roman numeral of a chord against a tonic pitch class. */
export function numeralOf(chord: Chord, tonicPc: number): string {
  const base = NUMERALS[mod(rootPc(chord) - tonicPc, 12)] ?? '?';
  const letters = base.replace(/[b#]/, '');
  const accidental = base.slice(0, base.length - letters.length);
  return `${accidental}${minorish(chord) ? letters.toLowerCase() : letters}${qualityMark(chord)}`;
}

/** The mode of a parent scale that starts on the chord's root, when the parent is a church mode. */
function modeOnRoot(chord: Chord, keyTonic: string, parent: ScaleId): ScaleId | null {
  const index = MODES.indexOf(parent);
  if (index < 0) return null;
  const degree = buildScale(keyTonic, parent).tones.findIndex((t) => t.pc === rootPc(chord));
  return degree < 0 ? null : (MODES[(index + degree) % 7] ?? null);
}

/** Triad quality on a degree of the home scale, as a numeral: the target of a secondary dominant. */
function diatonicNumeral(keyTonic: string, home: ScaleId, degreePc: number, tonicPc: number): string | null {
  const scale = buildScale(keyTonic, home).tones;
  const i = scale.findIndex((t) => t.pc === degreePc);
  if (i < 0) return null;
  const third = mod((scale[(i + 2) % 7]?.pc ?? 0) - degreePc, 12);
  const fifth = mod((scale[(i + 4) % 7]?.pc ?? 0) - degreePc, 12);
  if (fifth === 6) return null; // a diminished triad is not tonicised
  const base = NUMERALS[mod(degreePc - tonicPc, 12)] ?? '?';
  return third === 3 ? base.toLowerCase() : base;
}

const scaleName = (tonic: string, id: ScaleId) => `${tonic} ${SCALES[id].name.toLowerCase()}`;

export function chordOrigin(chord: Chord, keyTonic: string, homeMode: ScaleId): ChordOrigin {
  const home = HOME_MODES.includes(homeMode) ? homeMode : 'ionian';
  const tonicPc = buildScale(keyTonic, home).tones[0]?.pc ?? 0;
  const root = rootPc(chord);
  const rootName = chord.rootName;
  const numeral = numeralOf(chord, tonicPc);

  if (contains(pcsOf(keyTonic, home), chord)) {
    const mode = modeOnRoot(chord, keyTonic, home);
    return {
      kind: 'diatonic', numeral, source: home,
      scale: mode ? { tonic: rootName, scaleId: mode } : null,
      text: `Diatonico in ${scaleName(keyTonic, home)}${mode ? `: ${scaleName(rootName, mode)}` : ''}.`,
    };
  }
  // A dominant whose root is a fifth above a diatonic chord points at that chord.
  if (chord.family === 'dominant') {
    const targetPc = mod(root + 5, 12);
    const target = targetPc === tonicPc ? null : diatonicNumeral(keyTonic, home, targetPc, tonicPc);
    if (target) {
      const toMinor = target === target.toLowerCase();
      return {
        kind: 'secondary', numeral: `V${chord.suffix}/${target}`, source: null,
        scale: { tonic: rootName, scaleId: 'mixolydian' },
        text: `Dominante secondaria verso ${target}: ${scaleName(rootName, 'mixolydian')}${toMinor ? ', con ♭9 e ♭13 se risolve sul minore' : ''}.`,
      };
    }
  }
  for (const parallel of PARALLEL) {
    if (parallel === home) continue;
    if (!contains(pcsOf(keyTonic, parallel), chord)) continue;
    const mode = modeOnRoot(chord, keyTonic, parallel);
    return {
      kind: 'borrowed', numeral, source: parallel,
      scale: mode ? { tonic: rootName, scaleId: mode } : null,
      text: `Prestito da ${scaleName(keyTonic, parallel)} (interscambio modale)${mode ? `: ${scaleName(rootName, mode)}` : ''}.`,
    };
  }
  return { kind: 'chromatic', numeral, source: null, scale: null, text: `Fuori dalla tonalità di ${keyTonic}: la scala viene dall'accordo stesso.` };
}
