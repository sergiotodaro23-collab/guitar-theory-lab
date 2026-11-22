/**
 * Harmony Lab starter presets (HA5): four levels, every voicing worked out by
 * the engine from the data below (type, strings, how each chord picks its
 * voicing), never written as frets. Pure data.
 */
import { withChord, PROGRESSION_TEMPLATES, instantiateTemplate, type Progression } from '../jam';
import type { ExerciseLevel } from '../exercises';
import type { ScaleId } from '../theory';
import { functionalProgression, harmonizationProgression } from './harmonyVoicings';
import type { HarmonyVoicingType, Settings, VoicingMove } from './settings';

interface Preset {
  readonly id: string;
  readonly name: string;
  readonly level: ExerciseLevel;
  readonly data: Partial<Settings>;
}

const repeated = (name: string, symbols: readonly string[], times: number): Progression => ({
  name,
  chords: symbols.flatMap((symbol) => Array.from({ length: times }, () => withChord(symbol, { value: 1, unit: 'bars' }))),
});

interface VoiceChoice {
  readonly type: HarmonyVoicingType;
  readonly set?: string;
  readonly move: VoicingMove;
  readonly inversion?: 0 | 1 | 2 | 3;
  readonly near?: number;
}

function harmonyPreset(id: string, name: string, level: ExerciseLevel, key: string, home: ScaleId, progression: Progression, v: VoiceChoice, bpm: number, extra: Partial<Settings> = {}): Preset {
  return {
    id, name, level,
    data: {
      mode: 'harmony', harmonyKey: key, harmonyMode: home, tonic: key, scaleId: home,
      progression, changeMode: 'auto', loop: true, focus: 'all', labelMode: 'function', exerciseOn: false,
      contextScales: true, chordViewsOn: false, compOn: true, compPattern: 'sustain',
      voicingOn: true, voicingType: v.type, voicingSet: v.set ?? '1-2-3-4', voicingMove: v.move,
      voicingInversion: v.inversion ?? 0, voicingNear: v.near ?? 5, bpm,
      ...extra,
    },
  };
}

const modal = PROGRESSION_TEMPLATES.find((t) => t.id === 'modal');

export const HARMONY_PRESETS: readonly Preset[] = [
  // Principiante: triads on three strings, one position, slow.
  harmonyPreset('ha-triads-c-123', 'Triadi di Do maggiore sulle corde 1-2-3', 'Principiante', 'C', 'ionian',
    harmonizationProgression('C', 'ionian', 'triad'), { type: 'close', set: '1-2-3', move: 'lead', near: 5 }, 60),
  harmonyPreset('ha-inversions-cfg-234', 'Rivolti di Do, Fa e Sol sulle corde 2-3-4', 'Principiante', 'C', 'ionian',
    repeated('I–IV–V nei tre rivolti', ['C', 'F', 'G'], 3), { type: 'close', set: '2-3-4', move: 'climb', near: 0 }, 60),
  harmonyPreset('ha-triads-am-234', 'Triadi di La minore naturale sulle corde 2-3-4', 'Principiante', 'A', 'aeolian',
    harmonizationProgression('A', 'aeolian', 'triad'), { type: 'close', set: '2-3-4', move: 'lead', near: 5 }, 60),
  harmonyPreset('ha-full-i-vi-ii-v-g', 'Accordi pieni su I–vi–ii–V in Sol', 'Principiante', 'G', 'ionian',
    functionalProgression('I-vi-ii-V', 'G'), { type: 'full', move: 'lead', near: 3 }, 70),
  harmonyPreset('ha-sus-d-123', 'Triadi sus4 di Re maggiore sulle corde 1-2-3', 'Principiante', 'D', 'ionian',
    harmonizationProgression('D', 'ionian', 'sus4'), { type: 'close', set: '1-2-3', move: 'lead', near: 7 }, 60),
  harmonyPreset('ha-triads-g-345', 'Triadi di Sol maggiore sulle corde 3-4-5, salendo di rivolto', 'Principiante', 'G', 'ionian',
    harmonizationProgression('G', 'ionian', 'triad', 3), { type: 'close', set: '3-4-5', move: 'climb', near: 0 }, 66),
  // Intermedio: seventh chords in Drop 2, shells, the ii–V–I.
  harmonyPreset('ha-drop2-c-1234', 'Quadriadi di Do maggiore in Drop 2 sulle corde 1-4', 'Intermedio', 'C', 'ionian',
    harmonizationProgression('C', 'ionian', 'seventh'), { type: 'drop2', set: '1-2-3-4', move: 'lead', near: 5 }, 66),
  harmonyPreset('ha-251-drop2-f-2345', 'ii–V–I in Fa, Drop 2 sulle corde 2-5', 'Intermedio', 'F', 'ionian',
    functionalProgression('ii-V-I', 'F'), { type: 'drop2', set: '2-3-4-5', move: 'lead', near: 5 }, 72),
  harmonyPreset('ha-shell-251-bb', 'Shell R-3-7 su ii–V–I in Sib', 'Intermedio', 'Bb', 'ionian',
    functionalProgression('ii-V-I', 'Bb'), { type: 'shell', set: '3-4-5', move: 'lead', near: 3 }, 76),
  harmonyPreset('ha-triads-harmonic-345', 'Triadi di La minore armonica sulle corde 3-4-5, tutti i rivolti', 'Intermedio', 'A', 'aeolian',
    harmonizationProgression('A', 'harmonicMinor', 'triad', 3), { type: 'close', set: '3-4-5', move: 'climb', near: 0 }, 66, { scaleId: 'harmonicMinor' }),
  harmonyPreset('ha-turnaround-drop2-c', 'Turnaround I–vi–ii–V in Drop 2 sulle corde 1-4', 'Intermedio', 'C', 'ionian',
    functionalProgression('I-vi-ii-V', 'C'), { type: 'drop2', set: '1-2-3-4', move: 'lead', near: 7 }, 80),
  harmonyPreset('ha-cmaj7-climb-1234', 'Cmaj7 in Drop 2 attraverso i quattro rivolti, corde 1-4', 'Intermedio', 'C', 'ionian',
    repeated('Cmaj7 nei quattro rivolti', ['Cmaj7'], 4), { type: 'drop2', set: '1-2-3-4', move: 'climb', near: 0 }, 60),
  // Avanzato: Drop 3, Drop 2&4, minor ii–V, melodic minor, secondary dominants.
  harmonyPreset('ha-251-minor-drop3-c', 'ii–V–i minore in Do, Drop 3 sulle corde 6-4-3-2', 'Avanzato', 'C', 'aeolian',
    functionalProgression('ii-V-i', 'C'), { type: 'drop3', set: '2-3-4-6', move: 'lead', near: 7 }, 76),
  harmonyPreset('ha-melodic-drop2-first', 'Quadriadi di La minore melodica in Drop 2, primo rivolto', 'Avanzato', 'A', 'aeolian',
    harmonizationProgression('A', 'melodicMinor', 'seventh'), { type: 'drop2', set: '2-3-4-5', move: 'fixed', inversion: 1, near: 5 }, 66, { scaleId: 'melodicMinor' }),
  harmonyPreset('ha-iii-vi-drop24', 'Turnaround iii–VI7–ii–V in Drop 2&4 sulle corde 6-5-3-2', 'Avanzato', 'C', 'ionian',
    functionalProgression('iii-VI-ii-V', 'C'), { type: 'drop24', set: '2-3-5-6', move: 'lead', near: 5 }, 72),
  harmonyPreset('ha-secondary-chain', 'Catena di dominanti secondarie in Drop 2, corde 1-4', 'Avanzato', 'G', 'ionian',
    functionalProgression('secondary-chain', 'G'), { type: 'drop2', set: '1-2-3-4', move: 'lead', near: 7 }, 80),
  harmonyPreset('ha-harmonic-drop3', 'Quadriadi di Mi minore armonica in Drop 3 sulle corde 5-3-2-1', 'Avanzato', 'E', 'aeolian',
    harmonizationProgression('E', 'harmonicMinor', 'seventh'), { type: 'drop3', set: '1-2-3-5', move: 'lead', near: 5 }, 66, { scaleId: 'harmonicMinor' }),
  harmonyPreset('ha-shell-blues-f', 'Shell R-7-3 sulla catena di dominanti in Fa, corde 6-4-3', 'Avanzato', 'F', 'ionian',
    functionalProgression('secondary-chain', 'F'), { type: 'shell', set: '3-4-6', move: 'lead', near: 3 }, 84),
  // Esperto: substitutions, quartal harmony, inversions across the neck.
  harmonyPreset('ha-tritone-eb', 'ii–♭II7–I in Mib con sostituto di tritono, Drop 2 sulle corde 2-5', 'Esperto', 'Eb', 'ionian',
    functionalProgression('ii-V-I', 'Eb', true), { type: 'drop2', set: '2-3-4-5', move: 'lead', near: 5 }, 88),
  harmonyPreset('ha-quartal-dorian', 'Quartali sul vamp dorico di Re, corde 1-4', 'Esperto', 'D', 'dorian',
    modal ? instantiateTemplate(modal, 'D') : functionalProgression('ii-V-I', 'C'), { type: 'quartal', set: '1-2-3-4', move: 'lead', near: 5 }, 92),
  harmonyPreset('ha-drop3-climb-c', 'Do maggiore in quadriadi Drop 3, ogni accordo in quattro rivolti', 'Esperto', 'C', 'ionian',
    harmonizationProgression('C', 'ionian', 'seventh', 4), { type: 'drop3', set: '2-3-4-6', move: 'climb', near: 0 }, 72),
  harmonyPreset('ha-turnaround-tritone-drop24', 'Turnaround con dominante secondaria e tritoni, Drop 2&4', 'Esperto', 'Bb', 'ionian',
    functionalProgression('I-VI7-ii-V', 'Bb', true), { type: 'drop24', set: '1-2-4-5', move: 'lead', near: 5 }, 96),
  harmonyPreset('ha-quartal-251', 'Quartali su ii–V–I in Do, corde 2-5', 'Esperto', 'C', 'ionian',
    functionalProgression('ii-V-I', 'C'), { type: 'quartal', set: '2-3-4-5', move: 'lead', near: 5 }, 84),
  harmonyPreset('ha-melodic-all-inversions', 'Quadriadi di Do minore melodica, Drop 2 su 1-4 in tutti i rivolti', 'Esperto', 'C', 'aeolian',
    harmonizationProgression('C', 'melodicMinor', 'seventh', 4), { type: 'drop2', set: '1-2-3-4', move: 'climb', near: 0 }, 72, { scaleId: 'melodicMinor' }),
];
