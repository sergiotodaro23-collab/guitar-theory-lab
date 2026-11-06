import { parseDegree, parseNote, pitchClass, spellDegree, noteName, type Degree, type SpelledNote } from './notes';

export type ScaleId =
  | 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian'
  | 'harmonicMinor' | 'melodicMinor'
  | 'majorPentatonic' | 'minorPentatonic' | 'minorBlues';

export interface ScaleDefinition {
  readonly id: ScaleId;
  readonly name: string;
  readonly formula: readonly string[];
  /**
   * Semitones from this scale's tonic to the major key whose CAGED shapes it
   * borrows. Dorian on D uses C major shapes, so its offset is -2.
   */
  readonly parentOffset: number;
}

const def = (id: ScaleId, name: string, formula: string, parentOffset: number): ScaleDefinition => ({
  id, name, formula: formula.split(' '), parentOffset,
});

export const SCALES: Readonly<Record<ScaleId, ScaleDefinition>> = {
  ionian: def('ionian', 'Maggiore (ionica)', '1 2 3 4 5 6 7', 0),
  dorian: def('dorian', 'Dorica', '1 2 b3 4 5 6 b7', -2),
  phrygian: def('phrygian', 'Frigia', '1 b2 b3 4 5 b6 b7', -4),
  lydian: def('lydian', 'Lidia', '1 2 3 #4 5 6 7', -5),
  mixolydian: def('mixolydian', 'Misolidia', '1 2 3 4 5 6 b7', -7),
  aeolian: def('aeolian', 'Minore naturale (eolia)', '1 2 b3 4 5 b6 b7', -9),
  locrian: def('locrian', 'Locria', '1 b2 b3 4 b5 b6 b7', -11),
  harmonicMinor: def('harmonicMinor', 'Minore armonica', '1 2 b3 4 5 b6 7', -9),
  melodicMinor: def('melodicMinor', 'Minore melodica (jazz)', '1 2 b3 4 5 6 7', -9),
  majorPentatonic: def('majorPentatonic', 'Pentatonica maggiore', '1 2 3 5 6', 0),
  minorPentatonic: def('minorPentatonic', 'Pentatonica minore', '1 b3 4 5 b7', -9),
  minorBlues: def('minorBlues', 'Blues minore', '1 b3 4 b5 5 b7', -9),
};

export const SCALE_IDS = Object.keys(SCALES) as ScaleId[];

export interface ScaleTone {
  readonly degree: string;
  readonly note: SpelledNote;
  readonly name: string;
  readonly pc: number;
}

export interface Scale {
  readonly tonic: SpelledNote;
  readonly tonicName: string;
  readonly definition: ScaleDefinition;
  readonly tones: readonly ScaleTone[];
}

export function buildScale(tonicName: string, id: ScaleId): Scale {
  const tonic = parseNote(tonicName);
  const definition = SCALES[id];
  const tones = definition.formula.map((degreeText) => {
    const degree: Degree = parseDegree(degreeText);
    const note = spellDegree(tonic, degree);
    return { degree: degreeText, note, name: noteName(note), pc: pitchClass(note) };
  });
  return { tonic, tonicName: noteName(tonic), definition, tones };
}

export function scaleToneForPc(scale: Scale, pc: number): ScaleTone | undefined {
  return scale.tones.find((tone) => tone.pc === pc);
}
