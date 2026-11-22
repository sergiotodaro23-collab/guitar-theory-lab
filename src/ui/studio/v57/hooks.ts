/** Studio V5.7 hooks over the shared store: the chord now and next, as every lab defines them. */
import { useMemo } from 'react';
import { resolveChordLayer } from '../../../app/chordLayers';
import { tuningOf } from '../../../app/settings';
import { useApp } from '../../../app/store';
import type { Chord } from '../../../theory';
import { useHarmonyContext } from '../../Board';

export interface NowNext {
  readonly now: Chord | null;
  readonly next: Chord | null;
  /** Index of the next chord in its list (progression, or the Fretboard Lab chord list). */
  readonly nextIndex: number | null;
  readonly source: 'chords' | 'progression' | 'single';
  /** Every chord of that list, by position (null where a Fretboard Lab chord does not parse): what the secondary neck can pick (N4). */
  readonly list: readonly (Chord | null)[];
}

/**
 * Fretboard Lab: the next chord of its own list (the one after the active).
 * Harmony, Jam and Arpeggios on a progression: the next chord of the song.
 */
export function useNowNext(): NowNext {
  const settings = useApp((s) => s.settings);
  const { chord, nextChord, chordIndex, chords } = useHarmonyContext();
  return useMemo(() => {
    if (settings.mode === 'fretboard') {
      const layers = settings.chordLayers;
      const list = layers.map((l) => resolveChordLayer(l, tuningOf(settings)).chord);
      if (layers.length < 2) return { now: chord, next: null, nextIndex: null, source: 'chords', list };
      const nextIndex = (settings.activeChord + 1) % layers.length;
      return { now: chord, next: list[nextIndex] ?? null, nextIndex, source: 'chords', list };
    }
    if (settings.mode === 'arpeggio' && settings.arpSource === 'chord') return { now: chord, next: null, nextIndex: null, source: 'single', list: [] };
    return { now: chord, next: nextChord, nextIndex: chords.length > 1 ? (chordIndex + 1) % chords.length : null, source: 'progression', list: chords };
  }, [settings, chord, nextChord, chordIndex, chords]);
}
