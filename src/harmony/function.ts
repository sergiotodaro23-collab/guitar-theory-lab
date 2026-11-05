/**
 * Chord & Harmony Engine: what a physical note means over a chord.
 *
 * The fretboard position gives a pitch class. Its function exists only relative
 * to a chord, so nothing in here knows about strings or frets.
 */
import { mod, noteName, spellDegree, parseDegree, type Chord, type ChordTone, type SpelledNote } from '../theory';

export type ToneRole = 'chord-tone' | 'tension' | 'avoid' | 'outside';

/**
 * Avoid notes depend on style, voicing and context, so the caller picks a profile
 * and the result always carries the reasoning rather than a universal verdict.
 */
export type AvoidProfile = 'chord-scale' | 'altered-dominants' | 'modal';

export const AVOID_PROFILES: Readonly<Record<AvoidProfile, { name: string; description: string }>> = {
  'chord-scale': {
    name: 'Chord-scale tradizionale',
    description: 'Evita la nota che forma una nona minore su un chord tone, come 11 su Cmaj7.',
  },
  'altered-dominants': {
    name: 'Dominanti alterate',
    description: 'Come il tradizionale, ma sui dominanti accetta b9, #9, #11 e b13 senza riserve.',
  },
  modal: {
    name: 'Modale e rock',
    description: 'Nessuna avoid: conta il colore della scala, non la tensione sull’accordo.',
  },
};

export interface ToneFunction {
  readonly role: ToneRole;
  /** Degree relative to the chord root: "3", "9", "13", "b9". */
  readonly degree: string;
  /** Name of the note as the chord spells it. */
  readonly name: string;
  readonly isGuideTone: boolean;
  /** True when another style or voicing could reasonably classify it differently. */
  readonly contextual: boolean;
  /** Why it got this role. Empty for plain chord tones. */
  readonly reason: string;
}

/** Non-chord tone degree by semitones above the root. */
const DEGREE_BY_SEMITONE: readonly string[] = ['1', 'b9', '9', '#9', '3', '11', '#11', '5', 'b13', '13', 'b7', '7'];

function nonChordDegree(semitones: number, chord: Chord): string {
  const has = (degree: string) => chord.tones.some((tone) => tone.degree === degree);
  const hasMajorThird = has('3');
  if (semitones === 3 && !hasMajorThird) return 'b3';
  if (semitones === 6 && (has('b5') || chord.family === 'halfDiminished')) return 'b5';
  if (semitones === 8 && chord.family === 'augmented') return '#5';
  return DEGREE_BY_SEMITONE[semitones] as string;
}

type Table = Readonly<Record<string, ToneRole>>;

/** Traditional chord-scale table per chord family. Anything absent is outside. */
const CHORD_SCALE_TABLE: Readonly<Record<Chord['family'], Table>> = {
  major: { '9': 'tension', '#11': 'tension', '13': 'tension', '11': 'avoid' },
  dominant: {
    '9': 'tension', '13': 'tension', b9: 'tension', '#9': 'tension', '#11': 'tension', b13: 'tension', '11': 'avoid',
  },
  minor: { '9': 'tension', '11': 'tension', '13': 'tension', b13: 'avoid', b9: 'avoid' },
  halfDiminished: { '9': 'tension', '11': 'tension', b13: 'tension', b9: 'avoid' },
  diminished: { '9': 'tension', '11': 'tension', b13: 'tension', '7': 'tension' },
  augmented: { '9': 'tension', '#11': 'tension' },
  suspended: { '9': 'tension', '13': 'tension', '3': 'avoid' },
};

const CONTEXTUAL_NOTES: Readonly<Record<string, string>> = {
  'major:11': 'Forma una nona minore con la terza, ma funziona di passaggio o in un voicing sus.',
  'dominant:11': 'Forma una nona minore con la terza; sui 7sus è invece un chord tone.',
  'minor:13': 'Disponibile in dorico; sul ii di un ii–V alcuni la evitano per il tritono con la b3.',
  'minor:b13': 'Tipica dell’eolio; forma una nona minore con la quinta, quindi va usata di passaggio.',
  'minor:b9': 'Tipica del frigio; altrove suona come nota di passaggio.',
  'halfDiminished:b9': 'Tipica del locrio; forma una nona minore con la radice.',
  'suspended:3': 'Annulla la sospensione, a meno che il brano non la risolva proprio lì.',
};

export interface ClassifyOptions {
  readonly profile?: AvoidProfile;
  /** Pitch classes of the scale being studied. */
  readonly scalePcs?: ReadonlySet<number>;
}

export function guideTones(chord: Chord): readonly ChordTone[] {
  const third = chord.tones.find((t) => t.degree === '3' || t.degree === 'b3')
    ?? chord.tones.find((t) => t.degree === '4' || t.degree === '2');
  const seventh = chord.tones.find((t) => ['7', 'b7', 'bb7'].includes(t.degree))
    ?? chord.tones.find((t) => t.degree === '6');
  return [third, seventh].filter((t): t is ChordTone => t !== undefined);
}

function spellNonChord(chord: Chord, degree: string): SpelledNote {
  return spellDegree(chord.root, parseDegree(degree));
}

export function classifyTone(pc: number, chord: Chord, options: ClassifyOptions = {}): ToneFunction {
  const profile = options.profile ?? 'chord-scale';
  const inChord = chord.tones.find((tone) => tone.pc === mod(pc, 12));
  if (inChord) {
    return {
      role: 'chord-tone',
      degree: inChord.degree,
      name: inChord.name,
      isGuideTone: guideTones(chord).some((tone) => tone.pc === inChord.pc),
      contextual: false,
      reason: '',
    };
  }

  const semitones = mod(pc - (chord.tones[0] as ChordTone).pc, 12);
  const degree = nonChordDegree(semitones, chord);
  const name = noteName(spellNonChord(chord, degree));
  const key = `${chord.family}:${degree}`;
  const base: ToneRole = CHORD_SCALE_TABLE[chord.family][degree] ?? 'outside';
  const inScale = options.scalePcs?.has(mod(pc, 12)) ?? false;
  const common = { degree, name, isGuideTone: false };

  if (profile === 'modal') {
    if (inScale || base !== 'outside') {
      return { ...common, role: 'tension', contextual: base === 'avoid', reason: 'Colore modale: nessuna avoid in questo profilo.' };
    }
    return { ...common, role: 'outside', contextual: false, reason: 'Fuori dalla scala e dall’accordo.' };
  }
  if (profile === 'altered-dominants' && chord.family === 'dominant' && base === 'tension') {
    return { ...common, role: 'tension', contextual: false, reason: 'Alterazione accettata sul dominante.' };
  }
  if (base === 'avoid') {
    return {
      ...common,
      role: 'avoid',
      contextual: true,
      reason: CONTEXTUAL_NOTES[key] ?? 'Crea attrito con un chord tone: dipende da stile e voicing.',
    };
  }
  if (base === 'tension') {
    const note = CONTEXTUAL_NOTES[key];
    return { ...common, role: 'tension', contextual: note !== undefined, reason: note ?? 'Estensione disponibile.' };
  }
  return { ...common, role: 'outside', contextual: inScale, reason: inScale ? 'Nella scala, ma estranea a questo accordo.' : 'Cromatica rispetto all’accordo.' };
}
