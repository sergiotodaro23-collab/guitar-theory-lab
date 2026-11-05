/** Everything the user can configure and save. Pure and framework-free. */
import { CAGED_FORMS, cagedPosition, threeNpsPosition, allFretNotes, DEFAULT_FRETS, type CagedForm, type FretNote } from '../fretboard';
import { generateSequence, parseCustomPattern, type Direction, type ExerciseKind, type ExerciseSpec, type IntervalNumber, type PairMotion } from '../exercises';
import type { AvoidProfile } from '../harmony';
import { COMP_PATTERNS, PROGRESSION_TEMPLATES, instantiateTemplate, isValidProgression, type CompPattern, type Progression } from '../jam';
import { SCALES, TONICS, buildScale, mod, type Scale, type ScaleId } from '../theory';
import type { Meter, Subdivision } from '../timeline';

export type AppMode = 'fretboard' | 'harmony' | 'jam';
export type PositionType = 'caged' | '3nps' | 'neck';
export type LabelMode = 'note' | 'degree' | 'function' | 'finger' | 'none';
export type HarmonyFocus = 'all' | 'guide' | 'common' | 'resolution' | 'targeting';
export type ChangeMode = 'auto' | 'manual';

export const METERS: Readonly<Record<string, Meter>> = {
  '4/4': { beatsPerBar: 4, beatUnit: 4 },
  '3/4': { beatsPerBar: 3, beatUnit: 4 },
  '5/4': { beatsPerBar: 5, beatUnit: 4 },
  '6/8': { beatsPerBar: 6, beatUnit: 8 },
  '12/8': { beatsPerBar: 12, beatUnit: 8 },
};

export const BPM_MIN = 30;
export const BPM_MAX = 280;

export interface StudySettings {
  readonly tonic: string;
  readonly scaleId: ScaleId;
  readonly positionType: PositionType;
  readonly cagedForm: CagedForm;
  readonly npsStart: number;
  readonly labelMode: LabelMode;
  readonly overlayChord: string;
  readonly exerciseOn: boolean;
  readonly exerciseKind: ExerciseKind;
  readonly interval: IntervalNumber;
  readonly direction: Direction;
  readonly pairMotion: PairMotion;
  readonly customText: string;
  readonly notesPerBeat: Subdivision;
  readonly bpm: number;
  readonly meterId: string;
  readonly subdivision: Subdivision;
  readonly swing: number;
}

export interface HarmonySettings {
  readonly progression: Progression;
  readonly loop: boolean;
  readonly changeMode: ChangeMode;
  readonly quantize: 'beat' | 'bar';
  readonly focus: HarmonyFocus;
  readonly avoidProfile: AvoidProfile;
  readonly showAids: boolean;
  readonly secondScaleOn: boolean;
  readonly secondTonic: string;
  readonly secondScaleId: ScaleId;
  readonly compOn: boolean;
  readonly compPattern: CompPattern;
  readonly volClick: number;
  readonly volNotes: number;
  readonly volComp: number;
}

export interface Settings extends StudySettings, HarmonySettings {
  readonly mode: AppMode;
}

const firstTemplate = PROGRESSION_TEMPLATES[0];
if (!firstTemplate) throw new Error('Nessuna progressione predefinita');

export const DEFAULT_SETTINGS: Settings = {
  mode: 'fretboard',
  tonic: 'C',
  scaleId: 'ionian',
  positionType: 'caged',
  cagedForm: 'E',
  npsStart: 0,
  labelMode: 'degree',
  overlayChord: '',
  exerciseOn: true,
  exerciseKind: 'interval',
  interval: 3,
  direction: 'updown',
  pairMotion: 'ascending',
  customText: '1 2 3 5',
  notesPerBeat: 2,
  bpm: 80,
  meterId: '4/4',
  subdivision: 1,
  swing: 0,
  progression: instantiateTemplate(firstTemplate, firstTemplate.defaultKey),
  loop: true,
  changeMode: 'auto',
  quantize: 'beat',
  focus: 'all',
  avoidProfile: 'chord-scale',
  showAids: true,
  secondScaleOn: false,
  secondTonic: 'A',
  secondScaleId: 'minorPentatonic',
  compOn: true,
  compPattern: 'charleston',
  volClick: 0.7,
  volNotes: 0.7,
  volComp: 0.7,
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const oneOf = <T,>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const number01 = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : fallback);

/** Accept only what the app understands; anything else keeps its default. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, unknown>;
  const scaleIds = Object.keys(SCALES) as ScaleId[];
  const progression = r.progression as Progression | undefined;
  let validProgression = d.progression;
  try {
    if (progression && Array.isArray(progression.chords) && isValidProgression(progression)) validProgression = progression;
  } catch {
    // Keep the default.
  }
  return {
    mode: oneOf(r.mode, ['fretboard', 'harmony', 'jam'] as const, d.mode),
    tonic: oneOf(r.tonic, TONICS, d.tonic),
    scaleId: oneOf(r.scaleId, scaleIds, d.scaleId),
    positionType: oneOf(r.positionType, ['caged', '3nps', 'neck'] as const, d.positionType),
    cagedForm: oneOf(r.cagedForm, CAGED_FORMS, d.cagedForm),
    npsStart: typeof r.npsStart === 'number' ? mod(Math.round(r.npsStart), 7) : d.npsStart,
    labelMode: oneOf(r.labelMode, ['note', 'degree', 'function', 'finger', 'none'] as const, d.labelMode),
    overlayChord: typeof r.overlayChord === 'string' ? r.overlayChord : d.overlayChord,
    exerciseOn: typeof r.exerciseOn === 'boolean' ? r.exerciseOn : d.exerciseOn,
    exerciseKind: oneOf(r.exerciseKind, ['scale', 'interval', 'custom'] as const, d.exerciseKind),
    interval: oneOf(r.interval, [2, 3, 4, 5, 6, 7, 8] as const, d.interval),
    direction: oneOf(r.direction, ['up', 'down', 'updown'] as const, d.direction),
    pairMotion: oneOf(r.pairMotion, ['ascending', 'descending', 'alternating'] as const, d.pairMotion),
    customText: typeof r.customText === 'string' ? r.customText : d.customText,
    notesPerBeat: oneOf(r.notesPerBeat, [1, 2, 3, 4] as const, d.notesPerBeat),
    bpm: typeof r.bpm === 'number' && Number.isFinite(r.bpm) ? clamp(Math.round(r.bpm), BPM_MIN, BPM_MAX) : d.bpm,
    meterId: oneOf(r.meterId, Object.keys(METERS), d.meterId),
    subdivision: oneOf(r.subdivision, [1, 2, 3, 4] as const, d.subdivision),
    swing: typeof r.swing === 'number' && Number.isFinite(r.swing) ? clamp(r.swing, 0, 0.5) : d.swing,
    progression: validProgression,
    loop: typeof r.loop === 'boolean' ? r.loop : d.loop,
    changeMode: oneOf(r.changeMode, ['auto', 'manual'] as const, d.changeMode),
    quantize: oneOf(r.quantize, ['beat', 'bar'] as const, d.quantize),
    focus: oneOf(r.focus, ['all', 'guide', 'common', 'resolution', 'targeting'] as const, d.focus),
    avoidProfile: oneOf(r.avoidProfile, ['chord-scale', 'altered-dominants', 'modal'] as const, d.avoidProfile),
    showAids: typeof r.showAids === 'boolean' ? r.showAids : d.showAids,
    secondScaleOn: typeof r.secondScaleOn === 'boolean' ? r.secondScaleOn : d.secondScaleOn,
    secondTonic: oneOf(r.secondTonic, TONICS, d.secondTonic),
    secondScaleId: oneOf(r.secondScaleId, scaleIds, d.secondScaleId),
    compOn: typeof r.compOn === 'boolean' ? r.compOn : d.compOn,
    compPattern: oneOf(r.compPattern, Object.keys(COMP_PATTERNS) as CompPattern[], d.compPattern),
    volClick: number01(r.volClick, d.volClick),
    volNotes: number01(r.volNotes, d.volNotes),
    volComp: number01(r.volComp, d.volComp),
  };
}

export const currentScale = (s: Pick<StudySettings, 'tonic' | 'scaleId'>): Scale => buildScale(s.tonic, s.scaleId);

/** The notes shown for the chosen position. Pentatonics have no 3NPS shape: fall back to CAGED. */
export function currentPositionNotes(s: StudySettings): readonly FretNote[] {
  const scale = currentScale(s);
  if (s.positionType === 'neck') {
    const pcs = new Set(scale.tones.map((tone) => tone.pc));
    return allFretNotes(DEFAULT_FRETS).filter((note) => pcs.has(note.pc));
  }
  if (s.positionType === '3nps') {
    const position = threeNpsPosition(scale, s.npsStart);
    if (position) return position.notes;
  }
  return cagedPosition(scale, s.cagedForm).notes;
}

/** An exercise needs one playable shape, so the whole-neck view exercises its CAGED form. */
export function exerciseSpecOf(s: StudySettings): ExerciseSpec {
  return {
    kind: s.exerciseKind,
    interval: s.interval,
    direction: s.direction,
    pairMotion: s.pairMotion,
    customPattern: parseCustomPattern(s.customText) ?? [1],
  };
}

export function currentExerciseSequence(s: StudySettings) {
  const scale = currentScale(s);
  const notes = s.positionType === 'neck' ? cagedPosition(scale, s.cagedForm).notes : currentPositionNotes(s);
  return generateSequence(notes, scale, exerciseSpecOf(s));
}

export const meterOf = (s: Pick<StudySettings, 'meterId'>): Meter => METERS[s.meterId] ?? { beatsPerBar: 4, beatUnit: 4 };
