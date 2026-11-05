import { describe, expect, it } from 'vitest';
import { mod, parseChord } from '../theory';
import { PPQ } from '../timeline';
import {
  PROGRESSION_TEMPLATES, addChord, chordSpans, chordTrack, compTrack, duplicateChord, instantiateTemplate, isValidProgression, moveChord,
  progressionLength, removeChord, transposeProgression, updateChord, voiceChord, withChord, type Progression,
} from './index';

const meter = { beatsPerBar: 4, beatUnit: 4 } as const;
const symbols = (p: Progression) => p.chords.map((c) => c.symbol);
const iiVI: Progression = { name: 't', chords: [withChord('Dm7'), withChord('G7'), withChord('Cmaj7', { value: 2, unit: 'bars' })] };
const template = (id: string) => PROGRESSION_TEMPLATES.find((t) => t.id === id)!;

describe('progression edits', () => {
  it('adds, removes, duplicates and reorders without mutating', () => {
    expect(symbols(addChord(iiVI, 'A7'))).toEqual(['Dm7', 'G7', 'Cmaj7', 'A7']);
    expect(symbols(removeChord(iiVI, 1))).toEqual(['Dm7', 'Cmaj7']);
    expect(symbols(moveChord(iiVI, 0, 1))).toEqual(['G7', 'Dm7', 'Cmaj7']);
    expect(symbols(moveChord(iiVI, 0, -1))).toEqual(['Dm7', 'G7', 'Cmaj7']);
    const dup = duplicateChord(iiVI, 1);
    expect(symbols(dup)).toEqual(['Dm7', 'G7', 'G7', 'Cmaj7']);
    expect(dup.chords[1]?.id).not.toBe(dup.chords[2]?.id);
    expect(symbols(iiVI)).toEqual(['Dm7', 'G7', 'Cmaj7']);
    expect(symbols(updateChord(iiVI, 0, { symbol: 'D7' }))[0]).toBe('D7');
  });
  it('transposes with readable spelling', () => {
    expect(symbols(transposeProgression(iiVI, 2))).toEqual(['Em7', 'A7', 'Dmaj7']);
    expect(symbols(transposeProgression(iiVI, -2))).toEqual(['Cm7', 'F7', 'Bbmaj7']);
    expect(symbols(transposeProgression(iiVI, 12))).toEqual(symbols(iiVI));
  });
  it('validates content', () => {
    expect(isValidProgression(iiVI)).toBe(true);
    expect(isValidProgression({ name: '', chords: [] })).toBe(false);
    expect(isValidProgression({ name: '', chords: [withChord('Hm')] })).toBe(false);
  });
});

describe('progression timing', () => {
  it('lays out bars and beats', () => {
    const mixed: Progression = { name: '', chords: [withChord('C', { value: 1, unit: 'bars' }), withChord('F', { value: 2, unit: 'beats' })] };
    expect(chordSpans(mixed, meter).map((s) => [s.tick, s.lengthTicks])).toEqual([[0, PPQ * 4], [PPQ * 4, PPQ * 2]]);
    expect(progressionLength(mixed, meter)).toBe(PPQ * 6);
  });
  it('a bar scales with the meter', () => {
    expect(progressionLength(iiVI, { beatsPerBar: 3, beatUnit: 4 })).toBe(PPQ * 3 * 4);
  });
  it('builds a chord track', () => {
    const track = chordTrack(iiVI, meter, true);
    expect(track.events.map((e) => [e.tick, e.payload.chordIndex])).toEqual([[0, 0], [PPQ * 4, 1], [PPQ * 8, 2]]);
    expect(track.lengthTicks).toBe(PPQ * 16);
  });
});

describe('templates', () => {
  it('ii–V–I in every key', () => {
    expect(symbols(instantiateTemplate(template('ii-v-i'), 'C'))).toEqual(['Dm7', 'G7', 'Cmaj7']);
    expect(symbols(instantiateTemplate(template('ii-v-i'), 'Eb'))).toEqual(['Fm7', 'Bb7', 'Ebmaj7']);
  });
  it('minor ii–V–i', () => {
    expect(symbols(instantiateTemplate(template('ii-v-i-minor'), 'A'))).toEqual(['Bm7b5', 'E7b9', 'Am7']);
  });
  it('blues lasts twelve bars with the standard form', () => {
    const blues = instantiateTemplate(template('blues'), 'A');
    expect(progressionLength(blues, meter)).toBe(12 * 4 * PPQ);
    expect(symbols(blues)).toEqual(['A7', 'D7', 'A7', 'D7', 'A7', 'E7', 'D7', 'A7', 'E7']);
  });
  it('rhythm changes covers a 16-bar A plus bridge in Bb', () => {
    const rhythm = instantiateTemplate(template('rhythm'), 'Bb');
    expect(progressionLength(rhythm, meter)).toBe(16 * 4 * PPQ);
    expect(symbols(rhythm).slice(0, 4)).toEqual(['Bbmaj7', 'Gm7', 'Cm7', 'F7']);
    expect(symbols(rhythm).slice(-4)).toEqual(['D7', 'G7', 'C7', 'F7']);
  });
  it('all templates parse on every tonic', () => {
    for (const t of PROGRESSION_TEMPLATES) {
      for (const key of ['C', 'F#', 'Gb', 'B', 'Db']) {
        expect(isValidProgression(instantiateTemplate(t, key))).toBe(true);
      }
    }
  });
});

describe('accompaniment', () => {
  it('voices only chord tones, with the root in the bass and in a guitar range', () => {
    for (const symbol of ['Cmaj7', 'Dm9', 'G13', 'F#m7b5', 'Bb7alt', 'Asus4']) {
      const chord = parseChord(symbol);
      const pcs = new Set(chord.tones.map((t) => t.pc));
      const voicing = voiceChord(chord);
      expect(mod(voicing[0] as number, 12)).toBe(chord.tones[0]?.pc);
      for (const midi of voicing) {
        expect(pcs.has(mod(midi, 12))).toBe(true);
        expect(midi).toBeGreaterThanOrEqual(40);
        expect(midi).toBeLessThanOrEqual(76);
      }
    }
  });
  it('includes the guide tones in every voicing', () => {
    const voicing = voiceChord(parseChord('G13')).map((m) => mod(m, 12));
    expect(voicing).toEqual(expect.arrayContaining([11, 5]));
  });
  it('keeps voices close across a ii–V', () => {
    const a = voiceChord(parseChord('Dm7'));
    const b = voiceChord(parseChord('G7'), a);
    const center = (v: readonly number[]) => v.slice(1).reduce((x, y) => x + y, 0) / (v.length - 1);
    expect(Math.abs(center(a) - center(b))).toBeLessThan(5);
  });
  it('places patterns on the beat and a chord starting mid-bar always sounds', () => {
    const p: Progression = { name: '', chords: [withChord('C', { value: 3, unit: 'beats' }), withChord('F', { value: 1, unit: 'beats' })] };
    const track = compTrack(p, meter, 'sustain', true);
    expect(track.events.map((e) => e.tick)).toEqual([0, PPQ * 3]);
    const q = compTrack(iiVI, meter, 'quarter', true);
    expect(q.events.filter((e) => e.tick < PPQ * 4).map((e) => e.tick)).toEqual([0, PPQ, PPQ * 2, PPQ * 3]);
    const c = compTrack(iiVI, meter, 'charleston', true);
    expect(c.events.filter((e) => e.tick < PPQ * 4).map((e) => e.tick)).toEqual([0, PPQ * 1.5]);
  });
  it('no note rings past the next hit', () => {
    const track = compTrack(iiVI, meter, 'eighths', true);
    track.events.forEach((e, i) => {
      const next = track.events[i + 1]?.tick ?? track.lengthTicks;
      expect(e.tick + e.payload.durationTicks).toBeLessThanOrEqual(next);
    });
  });
});
