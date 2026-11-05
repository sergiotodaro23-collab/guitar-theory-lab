/** Starter presets: a place to begin, not data. They are never written to storage. */
import { PROGRESSION_TEMPLATES, instantiateTemplate } from '../jam';
import type { Settings } from './settings';

export interface BuiltinPreset {
  readonly id: string;
  readonly name: string;
  readonly data: Partial<Settings>;
}

const template = (id: string, key: string) => {
  const found = PROGRESSION_TEMPLATES.find((t) => t.id === id);
  if (!found) throw new Error(`Progressione sconosciuta: ${id}`);
  return instantiateTemplate(found, key);
};

export const STUDY_PRESETS: readonly BuiltinPreset[] = [
  {
    id: 'thirds-c',
    name: 'Terze in Do maggiore, forma E',
    data: { mode: 'fretboard', tonic: 'C', scaleId: 'ionian', positionType: 'caged', cagedForm: 'E', exerciseOn: true, exerciseKind: 'interval', interval: 3, direction: 'updown', pairMotion: 'ascending', notesPerBeat: 2, bpm: 72, overlayChord: '' },
  },
  {
    id: 'fourths-dorian',
    name: 'Quarte in Re dorico, 3NPS',
    data: { mode: 'fretboard', tonic: 'D', scaleId: 'dorian', positionType: '3nps', npsStart: 0, exerciseOn: true, exerciseKind: 'interval', interval: 4, direction: 'updown', pairMotion: 'alternating', notesPerBeat: 2, bpm: 66, overlayChord: 'Dm7' },
  },
  {
    id: 'sixths-harmonic',
    name: 'Seste in La minore armonica',
    data: { mode: 'fretboard', tonic: 'A', scaleId: 'harmonicMinor', positionType: 'caged', cagedForm: 'G', exerciseOn: true, exerciseKind: 'interval', interval: 6, direction: 'up', pairMotion: 'ascending', notesPerBeat: 1, bpm: 60, overlayChord: 'E7' },
  },
  {
    id: 'sequence-1235',
    name: 'Sequenza 1-2-3-5 in Sol maggiore',
    data: { mode: 'fretboard', tonic: 'G', scaleId: 'ionian', positionType: '3nps', npsStart: 0, exerciseOn: true, exerciseKind: 'custom', customText: '1 2 3 5', direction: 'updown', notesPerBeat: 4, bpm: 70, overlayChord: '' },
  },
  {
    id: 'guide-251',
    name: 'Guide tones su ii–V–I in Do',
    data: { mode: 'harmony', tonic: 'C', scaleId: 'ionian', positionType: 'caged', cagedForm: 'A', exerciseOn: false, focus: 'guide', changeMode: 'auto', labelMode: 'function', bpm: 84, progression: template('ii-v-i', 'C'), compOn: true },
  },
  {
    id: 'thirds-251',
    name: 'Terze sopra un ii–V–I',
    data: { mode: 'harmony', tonic: 'C', scaleId: 'ionian', positionType: 'caged', cagedForm: 'E', exerciseOn: true, exerciseKind: 'interval', interval: 3, direction: 'updown', pairMotion: 'ascending', notesPerBeat: 2, focus: 'all', changeMode: 'auto', labelMode: 'function', bpm: 72, progression: template('ii-v-i', 'C'), compOn: true },
  },
  {
    id: 'blues-a',
    name: 'Jam: blues in La',
    data: { mode: 'jam', tonic: 'A', scaleId: 'minorBlues', positionType: 'caged', cagedForm: 'G', exerciseOn: false, focus: 'all', labelMode: 'function', bpm: 96, swing: 0.3, subdivision: 1, progression: template('blues', 'A'), compOn: true, compPattern: 'charleston', loop: true },
  },
];
