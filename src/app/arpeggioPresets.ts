/**
 * Arpeggios Lab starter presets (AR7): four levels, from triads in one
 * position to irregular groups and triad pairs. Shapes, fingerings and lines
 * come from the engine; the data only chooses them. Pure data.
 */
import { withChord, type Progression } from '../jam';
import type { ExerciseLevel } from '../exercises';
import { functionalProgression, harmonizationProgression } from './harmonyVoicings';
import type { Settings } from './settings';

interface Preset {
  readonly id: string;
  readonly name: string;
  readonly level: ExerciseLevel;
  readonly data: Partial<Settings>;
}

const BASE: Partial<Settings> = {
  mode: 'arpeggio', arpCustomOn: false, labelMode: 'function', arpShape: 'window', arpForm: 'E', arpOctaves: 2, arpStrings: 5,
  arpReturn: 'same', arpStart: 0, arpDirection: 'updown', arpLink: 'connect', arpTarget: 1, arpNotesPerBeat: 2,
  arpPattern: 'none', arpPerm: '1 5 3 7', arpUpper: 'II', arpGroup: 3, compOn: true,
};

const chordPreset = (id: string, name: string, level: ExerciseLevel, symbol: string, bpm: number, data: Partial<Settings>): Preset => ({
  id, name, level, data: { ...BASE, arpSource: 'chord', arpSymbol: symbol, bpm, ...data },
});

const progressionPreset = (id: string, name: string, level: ExerciseLevel, key: string, progression: Progression, bpm: number, data: Partial<Settings>): Preset => ({
  id, name, level, data: { ...BASE, arpSource: 'progression', harmonyKey: key, harmonyMode: 'ionian', progression, bpm, ...data },
});

const bars = (symbols: readonly string[]): Progression => ({ name: symbols.join(' – '), chords: symbols.map((s) => withChord(s, { value: 1, unit: 'bars' })) });

export const ARPEGGIO_PRESETS: readonly Preset[] = [
  // Principiante: triads, inversions, one or two octaves, simple positions.
  chordPreset('ar-c-triad-position', 'Triade di Do maggiore in una posizione', 'Principiante', 'C', 60, { arpLow: 7 }),
  chordPreset('ar-g-first-inversion', 'Sol maggiore dal primo rivolto, forma E', 'Principiante', 'G', 60, { arpShape: 'caged', arpForm: 'E', arpStart: 1 }),
  chordPreset('ar-am-two-octaves', 'La minore su due ottave', 'Principiante', 'Am', 60, { arpShape: 'octaves', arpOctaves: 2, arpLow: 5 }),
  progressionPreset('ar-d-i-iv-v', 'Triadi di I–IV–V in Re, collegate', 'Principiante', 'D', bars(['D', 'G', 'A', 'D']), 60, { arpLow: 2, arpLink: 'connect' }),
  chordPreset('ar-em-second-inversion', 'Mi minore dal secondo rivolto in prima posizione', 'Principiante', 'Em', 60, { arpLow: 0, arpStart: 2 }),
  chordPreset('ar-f-caged-a', 'Fa maggiore nella forma A, sale e scende', 'Principiante', 'F', 66, { arpShape: 'caged', arpForm: 'A' }),
  // Intermedio: seventh chords, CAGED, permutations, string skipping, octave leaps, diatonic arpeggios.
  chordPreset('ar-cmaj7-perm-1537', 'Cmaj7 in permutazione 1-5-3-7 su due ottave', 'Intermedio', 'Cmaj7', 66, { arpShape: 'octaves', arpOctaves: 2, arpLow: 3, arpPattern: 'perm', arpPerm: '1 5 3 7', arpDirection: 'up' }),
  chordPreset('ar-dm7-octave-leaps', 'Dm7 con salti d’ottava 1-3-5-8', 'Intermedio', 'Dm7', 66, { arpShape: 'octaves', arpOctaves: 2, arpLow: 5, arpPattern: 'perm', arpPerm: '1 3 5 8', arpDirection: 'up' }),
  progressionPreset('ar-c-diatonic-sevenths', 'Quadriadi diatoniche di Do collegate in posizione', 'Intermedio', 'C', harmonizationProgression('C', 'ionian', 'seventh'), 70, { arpLow: 7, arpLink: 'connect' }),
  chordPreset('ar-am7-skip', 'Am7 con salto di corda', 'Intermedio', 'Am7', 66, { arpShape: 'skip', arpLow: 5 }),
  chordPreset('ar-bbmaj7-third-inversion', 'Bbmaj7 dal terzo rivolto, forma C', 'Intermedio', 'Bbmaj7', 66, { arpShape: 'caged', arpForm: 'C', arpStart: 3 }),
  progressionPreset('ar-g-251-target-third', 'ii–V–I in Sol: ogni accordo arriva sulla terza', 'Intermedio', 'G', functionalProgression('ii-V-I', 'G'), 72, { arpLow: 7, arpLink: 'target', arpTarget: 1 }),
  // Avanzato: enclosures, triad pairs, upper structures, sweep, extensions.
  chordPreset('ar-cmaj7-enclosure', 'Enclosure su Cmaj7: grado sopra, semitono sotto', 'Avanzato', 'Cmaj7', 66, { arpLow: 7, arpPattern: 'enclosure', arpNotesPerBeat: 3, arpDirection: 'up' }),
  chordPreset('ar-lydian-triad-pair', 'Triad pair Do–Re su Cmaj7#11 (lidio)', 'Avanzato', 'Cmaj7#11', 72, { arpLow: 7, arpPattern: 'pair', arpNotesPerBeat: 3, arpDirection: 'updown' }),
  chordPreset('ar-c7-ust-ii', 'Upper structure II su C7: 9, #11, 13', 'Avanzato', 'C7', 72, { arpLow: 7, arpPattern: 'upper', arpUpper: 'II' }),
  chordPreset('ar-g7-ust-bvi', 'Upper structure bVI su G7: b13, 1, #9', 'Avanzato', 'G7', 72, { arpLow: 2, arpPattern: 'upper', arpUpper: 'bVI' }),
  chordPreset('ar-am7-sweep', 'Am7 in sweep su cinque corde', 'Avanzato', 'Am7', 76, { arpShape: 'sweep', arpStrings: 5, arpLow: 5, arpNotesPerBeat: 3 }),
  chordPreset('ar-cm9-rootless', 'Cm9 senza fondamentale: 3-5-7-9', 'Avanzato', 'Cm9', 70, { arpShape: 'octaves', arpOctaves: 2, arpLow: 3, arpPattern: 'perm', arpPerm: '3 5 7 9', arpDirection: 'up' }),
  // Esperto: irregular groups against the meter, triad pairs in minor, patterns over progressions.
  chordPreset('ar-dm7-groups-of-3', 'Gruppi di 3 in sedicesimi su Dm7: poliritmia 3 contro 4', 'Esperto', 'Dm7', 72, { arpShape: 'octaves', arpOctaves: 2, arpLow: 5, arpPattern: 'group', arpGroup: 3, arpNotesPerBeat: 4, arpDirection: 'up' }),
  chordPreset('ar-fmaj7-groups-of-5', 'Gruppi di 5 in sedicesimi su Fmaj7', 'Esperto', 'Fmaj7', 69, { arpShape: 'octaves', arpOctaves: 3, arpLow: 1, arpPattern: 'group', arpGroup: 5, arpNotesPerBeat: 4, arpDirection: 'up' }),
  chordPreset('ar-melodic-triad-pair', 'Triad pair Re–Mi su AmMaj7 (minore melodica)', 'Esperto', 'AmMaj7', 80, { arpLow: 5, arpPattern: 'pair', arpNotesPerBeat: 3, arpDirection: 'updown' }),
  progressionPreset('ar-f-251-enclosure', 'Enclosure sui ii–V–I in Fa', 'Esperto', 'F', functionalProgression('ii-V-I', 'F'), 76, { arpLow: 5, arpPattern: 'enclosure', arpNotesPerBeat: 3, arpDirection: 'up' }),
  chordPreset('ar-bb7-groups-of-7', 'Gruppi di 7 su Bb7 su tre ottave', 'Esperto', 'Bb7', 66, { arpShape: 'octaves', arpOctaves: 3, arpLow: 1, arpPattern: 'group', arpGroup: 7, arpNotesPerBeat: 4, arpDirection: 'up' }),
  progressionPreset('ar-turnaround-perm', 'Permutazione 3-1-5-7 sul turnaround I–VI7–ii–V in Do', 'Esperto', 'C', functionalProgression('I-VI7-ii-V', 'C'), 80, { arpShape: 'octaves', arpOctaves: 2, arpLow: 5, arpPattern: 'perm', arpPerm: '3 1 5 7', arpDirection: 'up' }),
];
