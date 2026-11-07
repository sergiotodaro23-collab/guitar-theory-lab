/** Translate settings into the timeline tracks each mode needs. Pure. */
import { exerciseTrack, progressionArpeggioTrack, routineTrack } from '../exercises';
import { bassTrack, chordSpans, chordTrack, compTrack, drumTrack, genreOf, progressionLength, parsedChords } from '../jam';
import { tryParseChord, type Chord } from '../theory';
import { guideTones } from '../harmony';
import { ticksPerBeat, type Track } from '../timeline';
import { arpeggioPlanOf, arpeggioSpecOf, currentExerciseSequence, meterOf, type Settings } from './settings';

export type TrackSpec = Omit<Track, 'originTick'>;

export interface ModeTracks {
  readonly exercise: TrackSpec | null;
  readonly chords: TrackSpec | null;
  readonly comp: TrackSpec | null;
  /** Jam Studio only. */
  readonly drums: TrackSpec | null;
  readonly bass: TrackSpec | null;
  /** Ticks after the chord track starts where a non-looping progression ends. */
  readonly endTick: number | null;
}

export function buildTracks(s: Settings): ModeTracks {
  const meter = meterOf(s);
  if (s.mode === 'arpeggio') return arpeggioTracks(s);
  const inHarmony = s.mode !== 'fretboard';
  const manual = s.mode === 'harmony' && s.changeMode === 'manual';
  const hasProgression = s.progression.chords.length > 0;
  const loop = s.mode === 'jam' ? s.loop : true;
  const auto = inHarmony && !manual && hasProgression;
  const bassPlays = s.mode === 'jam' && auto && s.bassOn;

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
    comp: auto && s.compOn ? compTrack(s.progression, meter, s.compPattern, loop, bassPlays) : null,
    bass: bassPlays ? bassTrack(s.progression, meter, genreOf(s.jamGenre).bass[s.bassPattern] ?? genreOf(s.jamGenre).bass[0], loop) : null,
    drums: s.mode === 'jam' && s.drumOn ? drumTrack(s.drumKit, s.drumPattern, meter, s.drumFillEvery) : null,
    endTick: s.mode === 'jam' && !s.loop && hasProgression ? progressionLength(s.progression, meter) : null,
  };
}

/** Arpeggios Lab: the arpeggio is the exercise; on a progression the chords and comping play along. */
function arpeggioTracks(s: Settings): ModeTracks {
  const meter = meterOf(s);
  const spec = arpeggioSpecOf(s);
  if (s.arpSource === 'chord') {
    const sequence = arpeggioPlanOf(tryParseChord(s.arpSymbol), s)?.sequence ?? [];
    return { exercise: sequence.length ? exerciseTrack(sequence, meter, s.arpNotesPerBeat) : null, chords: null, comp: null, drums: null, bass: null, endTick: null };
  }
  if (s.progression.chords.length === 0) return { exercise: null, chords: null, comp: null, drums: null, bass: null, endTick: null };
  const lengthTicks = progressionLength(s.progression, meter);
  const route = s.arpShape === 'octaves' || s.arpShape === 'sweep' || s.arpShape === 'skip';
  const exercise = progressionArpeggioTrack({
    spans: chordSpans(s.progression, meter), lengthTicks, loop: true, meter, low: s.arpLow, spec, notesPerBeat: s.arpNotesPerBeat, link: s.arpLink,
    target: s.arpTarget,
    notesOf: (chord) => arpeggioPlanOf(chord, s)?.notes ?? [],
    ...(route ? { sequenceOf: (chord: Chord) => arpeggioPlanOf(chord, s)?.sequence ?? [] } : {}),
  });
  return {
    exercise: exercise.events.length ? exercise : null,
    chords: chordTrack(s.progression, meter, true),
    comp: s.compOn ? compTrack(s.progression, meter, s.compPattern, true) : null,
    drums: null,
    bass: null,
    endTick: null,
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
