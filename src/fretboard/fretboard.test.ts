import { describe, expect, it } from 'vitest';
import { buildScale, SCALE_IDS, TONICS, mod, type ScaleId } from '../theory';
import { CAGED_FORMS, allFretNotes, cagedPosition, fingerPosition, midiAt, threeNpsPosition, spellPosition } from './index';

const shape = (notes: readonly { string: number; fret: number }[]) => {
  const byString: Record<number, number[]> = {};
  for (const n of notes) (byString[n.string] ??= []).push(n.fret);
  return Object.values(byString).map((frets) => frets.sort((a, b) => a - b).join(','));
};

describe('fretboard map', () => {
  it('matches standard tuning', () => {
    expect(midiAt({ string: 0, fret: 0 })).toBe(40);
    expect(midiAt({ string: 5, fret: 12 })).toBe(76);
    expect(allFretNotes(22)).toHaveLength(6 * 23);
  });
});

describe('CAGED positions', () => {
  it('matches the textbook E form in G major', () => {
    const p = cagedPosition(buildScale('G', 'ionian'), 'E');
    expect(shape(p.notes)).toEqual(['2,3,5', '2,3,5', '2,4,5', '2,4,5', '3,5', '2,3,5']);
  });
  it('matches the textbook D form in G major', () => {
    const p = cagedPosition(buildScale('G', 'ionian'), 'D');
    expect(shape(p.notes)).toEqual(['5,7,8', '5,7', '4,5,7', '4,5,7', '5,7,8', '5,7,8']);
  });
  it('matches the textbook C form in G major', () => {
    const p = cagedPosition(buildScale('G', 'ionian'), 'C');
    expect(shape(p.notes)).toEqual(['7,8,10', '7,9,10', '7,9,10', '7,9', '7,8,10', '7,8,10']);
  });
  it('matches the textbook A form in G major', () => {
    const p = cagedPosition(buildScale('G', 'ionian'), 'A');
    expect(shape(p.notes)).toEqual(['10,12', '9,10,12', '9,10,12', '9,11,12', '10,12,13', '10,12']);
  });
  it('adds the missing F# in the G form in G major', () => {
    const p = cagedPosition(buildScale('G', 'ionian'), 'G');
    expect(shape(p.notes)).toEqual(['12,14,15', '12,14,15', '12,14', '11,12,14', '12,13,15', '12,14,15']);
  });
  it('uses parent-key shapes for modes', () => {
    const dorian = cagedPosition(buildScale('D', 'dorian'), 'E');
    const major = cagedPosition(buildScale('C', 'ionian'), 'E');
    expect(dorian.notes).toEqual(major.notes);
  });
  it('never skips a scale degree, for any tonic, scale and form', () => {
    for (const tonic of TONICS) {
      for (const id of SCALE_IDS as ScaleId[]) {
        const scale = buildScale(tonic, id);
        const pcs = new Set(scale.tones.map((t) => t.pc));
        for (const form of CAGED_FORMS) {
          const { notes } = cagedPosition(scale, form);
          expect(notes.length).toBeGreaterThanOrEqual(scale.tones.length);
          for (const note of notes) expect(pcs.has(mod(note.midi, 12))).toBe(true);
          const midis = notes.map((n) => n.midi);
          expect(new Set(midis).size).toBe(midis.length);
          const low = midis[0] as number;
          const high = midis[midis.length - 1] as number;
          for (let m = low; m <= high; m += 1) {
            if (pcs.has(mod(m, 12))) expect(midis, `${tonic} ${id} ${form} missing ${m}`).toContain(m);
          }
        }
      }
    }
  });
  it('keeps every shape playable: at most a 5-fret span plus one stretch', () => {
    for (const tonic of TONICS) {
      for (const form of CAGED_FORMS) {
        const frets = cagedPosition(buildScale(tonic, 'ionian'), form).notes.map((n) => n.fret);
        expect(Math.max(...frets) - Math.min(...frets), `${tonic} ${form}`).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('3NPS positions', () => {
  it('matches the textbook G major shape from the root', () => {
    const p = threeNpsPosition(buildScale('G', 'ionian'), 0);
    expect(p).not.toBeNull();
    expect(shape(p?.notes ?? [])).toEqual(['3,5,7', '3,5,7', '4,5,7', '4,5,7', '5,7,8', '5,7,8']);
  });
  it('builds three notes per string and consecutive degrees, for every heptatonic case', () => {
    for (const tonic of TONICS) {
      for (const id of SCALE_IDS as ScaleId[]) {
        const scale = buildScale(tonic, id);
        for (let start = 0; start < 7; start += 1) {
          const p = threeNpsPosition(scale, start);
          if (scale.tones.length !== 7) {
            expect(p).toBeNull();
            continue;
          }
          expect(p, `${tonic} ${id} ${start}`).not.toBeNull();
          expect(p?.notes).toHaveLength(18);
          for (let s = 0; s < 6; s += 1) expect(p?.notes.filter((n) => n.string === s)).toHaveLength(3);
          const midis = p?.notes.map((n) => n.midi) ?? [];
          for (let i = 1; i < midis.length; i += 1) {
            const step = (midis[i] as number) - (midis[i - 1] as number);
            expect(step).toBeGreaterThan(0);
            expect(step).toBeLessThanOrEqual(3);
          }
        }
      }
    }
  });
});

describe('fingering', () => {
  it('uses 1-2-4 on a string spanning a major third', () => {
    const notes = [3, 5, 7].map((fret) => ({ string: 0, fret, midi: 40 + fret, pc: mod(40 + fret, 12) }));
    expect(fingerPosition(notes).map((n) => n.finger)).toEqual([1, 3, 4]);
  });
  it('assigns zero to open strings and fingers between 1 and 4 otherwise', () => {
    const p = cagedPosition(buildScale('G', 'ionian'), 'E');
    for (const n of fingerPosition(p.notes)) {
      expect(n.finger).toBeGreaterThanOrEqual(1);
      expect(n.finger).toBeLessThanOrEqual(4);
    }
    const open = fingerPosition([{ string: 0, fret: 0, midi: 40, pc: 4 }]);
    expect(open[0]?.finger).toBe(0);
  });
});

describe('spelling a position', () => {
  it('spells every note by its scale degree', () => {
    const scale = buildScale('Db', 'ionian');
    const notes = spellPosition(cagedPosition(scale, 'E').notes, scale);
    expect(new Set(notes.map((n) => n.name))).toEqual(new Set(['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C']));
  });
});
