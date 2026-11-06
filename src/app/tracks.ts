/** Translate settings into the timeline tracks each mode needs. Pure. */
import { exerciseTrack, routineTrack } from '../exercises';
import { chordTrack, compTrack, progressionLength, parsedChords } from '../jam';
import { guideTones } from '../harmony';
import { ticksPerBeat, type Track } from '../timeline';
import { currentExerciseSequence, meterOf, type Settings } from './settings';

export type TrackSpec = Omit<Track, 'originTick'>;

export interface ModeTracks {
  readonly exercise: TrackSpec | null;
  readonly chords: TrackSpec | null;
  readonly comp: TrackSpec | null;
  /** Ticks after the chord track starts where a non-looping progression ends. */
  readonly endTick: number | null;
}

export function buildTracks(s: Settings): ModeTracks {
  const meter = meterOf(s);
  const inHarmony = s.mode !== 'fretboard';
  const manual = s.mode === 'harmony' && s.changeMode === 'manual';
  const hasProgression = s.progression.chords.length > 0;
  const loop = s.mode === 'jam' ? s.loop : true;
  const auto = inHarmony && !manual && hasProgression;

  let exercise: TrackSpec | null = null;
  if (s.exerciseOn && s.exerciseMode === 'routine') {
    exercise = routineTrack(s.routine, meter);
  } else if (s.exerciseOn) {
    const sequence = currentExerciseSequence(s);
    if (sequence.length > 0) exercise = exerciseTrack(sequence, meter, s.notesPerBeat);
  }
  return {
    exercise,
    chords: auto ? chordTrack(s.progression, meter, loop) : null,
    comp: auto && s.compOn ? compTrack(s.progression, meter, s.compPattern, loop) : null,
    endTick: s.mode === 'jam' && !s.loop && hasProgression ? progressionLength(s.progression, meter) : null,
  };
}

/** A sustained guide-tone shell for manual changes, one bar long. */
export function manualCompMidis(s: Settings, chordIndex: number): readonly number[] {
  const chord = parsedChords(s.progression)[chordIndex];
  if (!chord) return [];
  const bass = 40 + (((chord.bass?.pc ?? chord.tones[0]?.pc ?? 0) - 4 + 12) % 12);
  return [bass, ...guideTones(chord).map((tone) => 60 + tone.pc), 72 + (chord.tones.find((t) => t.degree.includes('5'))?.pc ?? 0) - 12];
}

export const manualCompDuration = (s: Settings): number => ticksPerBeat(meterOf(s)) * meterOf(s).beatsPerBar;
