import { describe, expect, it } from 'vitest';
import { PPQ } from '../timeline';
import { ARRANGEMENT_PRESETS, arrangementTracks, sanitizeSections, section, sectionAtBar, sectionSpans, sectionSymbols, songChords } from './arrangement';
import { DEFAULT_KIT, pattern } from './drums';
import { genreOf } from './genres';
import { withChord, type Progression } from './progression';

const m44 = { beatsPerBar: 4, beatUnit: 4 } as const;
const BAR = 4 * PPQ;
const prog: Progression = { name: 't', chords: ['Am7', 'D7'].map((c) => withChord(c)) };
// A kit whose patterns are told apart by their kick: A on 1, B on 1 and 3, C none (snare only), D four on the floor; fill all toms.
const kit = {
  patterns: [pattern({ kick: 'X' }), pattern({ kick: 'X.......X' }), pattern({ snare: '....X' }), pattern({ kick: 'X...X...X...X' })] as const,
  fill: pattern({ tom: 'XXXXXXXXXXXXXXXX' }),
};
const input = (sections: ReturnType<typeof section>[]) => ({ progression: prog, meter: m44, kit, compPattern: 'half' as const, bass: genreOf('rock').bass[0], sections, loop: true });

describe('arrangements (P3-08)', () => {
  it('sections are laid end to end: two bars of progression times the repeats', () => {
    const spans = sectionSpans([section('intro'), section('verse', { repeats: 2 }), section('outro')], prog, m44);
    expect(spans.map((s) => [s.firstBar, s.bars])).toEqual([[0, 2], [2, 4], [6, 2]]);
    expect(sectionAtBar(spans, 3)?.section.kind).toBe('verse');
    expect(sectionAtBar(spans, 8)?.section.kind).toBe('intro');
  });

  it('each section plays its groove, its fill on the last bar, and its dynamics', () => {
    const song = arrangementTracks(input([section('verse', { pattern: 1, dynamics: 'soft' }), section('chorus', { pattern: 3, dynamics: 'loud', fill: false })]));
    const kicksIn = (from: number, to: number) => song.drums.events.filter((e) => e.payload.voice === 'kick' && e.tick >= from && e.tick < to);
    // Verse: pattern B (two kicks a bar), the second bar is the fill (toms only).
    expect(kicksIn(0, BAR)).toHaveLength(2);
    expect(kicksIn(BAR, 2 * BAR)).toHaveLength(0);
    expect(song.drums.events.filter((e) => e.payload.voice === 'tom' && e.tick >= BAR && e.tick < 2 * BAR)).toHaveLength(16);
    // Chorus: pattern D, four kicks a bar, no fill, louder.
    expect(kicksIn(2 * BAR, 4 * BAR)).toHaveLength(8);
    const soft = kicksIn(0, BAR)[0]?.payload.velocity ?? 0;
    const loud = kicksIn(2 * BAR, 3 * BAR)[0]?.payload.velocity ?? 0;
    expect(loud).toBeGreaterThan(soft);
    expect(song.lengthTicks).toBe(4 * BAR);
  });

  it('a part switched off in a section leaves no events there; the chord changes go on', () => {
    const song = arrangementTracks(input([section('intro', { bass: false, comp: false }), section('verse')]));
    expect(song.bass.events.some((e) => e.tick < 2 * BAR)).toBe(false);
    expect(song.comp.events.some((e) => e.tick < 2 * BAR)).toBe(false);
    expect(song.bass.events.some((e) => e.tick >= 2 * BAR)).toBe(true);
    expect(song.chords.events.map((e) => e.tick)).toEqual([0, BAR, 2 * BAR, 3 * BAR]);
  });

  it('with the bass silent the chords keep their own low note', () => {
    const withBass = arrangementTracks(input([section('verse')])).comp.events[0]?.payload.midis.length ?? 0;
    const alone = arrangementTracks(input([section('verse', { bass: false })])).comp.events[0]?.payload.midis.length ?? 0;
    expect(alone).toBe(withBass + 1);
  });

  it('presets build valid songs, and saved sections are cleaned', () => {
    for (const p of ARRANGEMENT_PRESETS) expect(sanitizeSections(p.sections())).toHaveLength(p.sections().length);
    expect(sanitizeSections([{ kind: 'chorus', repeats: 99, pattern: 7, dynamics: 'x' }, { kind: 'nope' }, null])).toMatchObject([{ kind: 'chorus', repeats: 8, pattern: 3, dynamics: 'medium', fill: true }]);
    expect(DEFAULT_KIT.patterns).toHaveLength(4);
  });
});

describe('a progression per section (P3-08)', () => {
  it('a chorus with its own chords: one bar each, its own length, indices after the shared ones', () => {
    const sections = [section('verse'), section('chorus', { chords: 'Fmaj7 G7 Em7 Am7' })];
    const spans = sectionSpans(sections, prog, m44);
    expect(spans.map((s) => s.bars)).toEqual([2, 4]);
    const song = arrangementTracks(input(sections));
    expect(song.chords.events.map((e) => [e.tick / BAR, e.payload.chordIndex])).toEqual([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]);
    const all = songChords(prog, sections).chords.map((c) => c.symbol);
    expect(all).toEqual(['Am7', 'D7', 'Fmaj7', 'G7', 'Em7', 'Am7']);
    // The bass follows the section's chords: F on the chorus downbeat.
    expect((song.bass.events.find((e) => e.tick === 2 * BAR)?.payload.midi ?? 0) % 12).toBe(5);
  });
  it('an unreadable chord falls back to the shared progression', () => {
    expect(sectionSymbols('Am7 Xyz')).toBeNull();
    expect(sectionSpans([section('verse', { chords: 'Am7 Xyz' })], prog, m44)[0]?.bars).toBe(2);
  });
});
