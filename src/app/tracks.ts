/** Translate settings into the timeline tracks each mode needs. Pure. */
import { exerciseTrack, generateSequence, progressionArpeggioTrack, progressionExerciseTrack, routineTrack } from '../exercises';
import type { FretNote } from '../fretboard';
import { chordAsScale, viewNotes, viewScale } from './chordViews';
import { arrangementTracks, bassTrack, chordSpans, chordTrack, compTrack, drumTrack, genreOf, progressionLength, parsedChords } from '../jam';
import { tryParseChord, type Chord } from '../theory';
import { guideTones } from '../harmony';
import { ticksPerBeat, type Track } from '../timeline';
import { arpeggioPlanOf, arpeggioSpecOf, currentExerciseSequence, exerciseSpecOf, meterOf, tuningOf, type Settings } from './settings';

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
    exercise = routineTrack(s.routine, meter, tuningOf(s));
  } else if (s.exerciseOn && auto && viewsDriveExercise(s)) {
    exercise = progressionExerciseTrack(
      chordSpans(s.progression, meter).map((span) => ({ tick: span.tick, lengthTicks: span.lengthTicks, sequence: chordExerciseSequence(s, span.index, span.chord) })),
      meter, s.notesPerBeat, progressionLength(s.progression, meter), loop,
    );
  } else if (s.exerciseOn) {
    const sequence = currentExerciseSequence(s);
    if (sequence.length > 0) exercise = exerciseTrack(sequence, meter, s.notesPerBeat);
  }
  // A song form: the band follows the sections; the exercise keeps its own loop.
  if (s.mode === 'jam' && auto && s.arrangementOn && s.arrangement.length > 0) {
    const genre = genreOf(s.jamGenre);
    const song = arrangementTracks({
      progression: s.progression, meter, kit: s.drumKit, compPattern: s.compPattern,
      bass: genre.bass[s.bassPattern] ?? genre.bass[0], loop,
      // The band switches still rule: a part off is off in every section.
      sections: s.arrangement.map((x) => ({ ...x, drums: x.drums && s.drumOn, bass: x.bass && s.bassOn, comp: x.comp && s.compOn })),
    });
    return {
      exercise,
      chords: song.chords,
      comp: song.comp,
      bass: song.bass,
      drums: song.drums,
      endTick: loop ? null : song.lengthTicks,
    };
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

/** True when at least one chord of the progression has a view the exercise should follow. */
const viewsDriveExercise = (s: Settings): boolean =>
  s.chordViewsOn && s.exerciseFollowsView && s.progression.chords.some((c) => s.chordViews[c.id]);

/**
 * The exercise over one chord: on its view's notes and scale (the chord's
 * tones as the scale when the view shows only the arpeggio), or the general
 * exercise when the chord has no view.
 */
export function chordExerciseSequence(s: Settings, index: number, chord: Chord): readonly FretNote[] {
  const id = s.progression.chords[index]?.id;
  const view = id ? s.chordViews[id] : undefined;
  if (!view) return currentExerciseSequence(s);
  // The whole neck is a map, not an exercise: practise in the view's CAGED form instead.
  const shaped = view.positionType === 'neck' ? { ...view, positionType: 'caged' as const } : view;
  const scale = view.show === 'arpeggio' ? chordAsScale(chord) : viewScale(view);
  return generateSequence(viewNotes(shaped, chord, tuningOf(s)), scale, exerciseSpecOf(s));
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
