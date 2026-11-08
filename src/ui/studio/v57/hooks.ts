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
      if (layers.length < 2) return { now: chord, next: null, nextIndex: null, source: 'chords' };
      const nextIndex = (settings.activeChord + 1) % layers.length;
      const layer = layers[nextIndex];
      const next = layer ? resolveChordLayer(layer, tuningOf(settings)).chord : null;
      return { now: chord, next, nextIndex, source: 'chords' };
    }
    if (settings.mode === 'arpeggio' && settings.arpSource === 'chord') return { now: chord, next: null, nextIndex: null, source: 'single' };
    return { now: chord, next: nextChord, nextIndex: chords.length > 1 ? (chordIndex + 1) % chords.length : null, source: 'progression' };
  }, [settings, chord, nextChord, chordIndex, chords.length]);
}
