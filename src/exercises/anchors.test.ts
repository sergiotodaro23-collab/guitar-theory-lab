import { describe, expect, it } from 'vitest';
import { ANCHOR_INTERVALS, anchoredTonic, applyAnchors } from './anchors';
import { defaultPhase, sanitizeRoutine, transposeRoutineBetween, type Routine, type RoutinePhase } from './routine';
import { parseNote, pitchClass } from '../theory';

const phase = (id: string, change: Partial<RoutinePhase>): RoutinePhase => ({ ...defaultPhase(id), ...change });
const routine = (...phases: RoutinePhase[]): Routine => ({ name: 'test', phases });
const tonics = (r: Routine) => r.phases.map((p) => p.tonic);

describe('anchored phases (M2)', () => {
  it('spells the interval by letter: relative minor (M6), dominant (P5), relative major (m3)', () => {
    expect(anchoredTonic('C', 'M6')).toBe('A');
    expect(anchoredTonic('Eb', 'M6')).toBe('C');
    expect(anchoredTonic('F#', 'M6')).toBe('D#');
    expect(anchoredTonic('Bb', 'P5')).toBe('F');
    expect(anchoredTonic('A', 'm3')).toBe('C');
    expect(anchoredTonic('C', 'A4')).toBe('F#');
    expect(anchoredTonic('C', 'd5')).toBe('Gb');
  });

  it('every interval keeps its semitones from every tonic', () => {
    for (const tonic of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
      for (const a of ANCHOR_INTERVALS) {
        const diff = (pitchClass(parseNote(anchoredTonic(tonic, a.id))) - pitchClass(parseNote(tonic)) + 12) % 12;
        expect(diff, `${tonic} ${a.id}`).toBe(a.interval.semitones);
      }
    }
  });

  it('a phase hangs on another and follows its edits; anchors chain', () => {
    const r = routine(
      phase('a', { tonic: 'C', scaleId: 'ionian' }),
      phase('b', { tonic: 'D', scaleId: 'aeolian', link: 'anchor', anchorTo: 'a', anchorInterval: 'M6' }),
      phase('c', { tonic: 'D', link: 'anchor', anchorTo: 'b', anchorInterval: 'P5' }),
    );
    expect(tonics(applyAnchors(r).routine)).toEqual(['C', 'A', 'E']);
    const edited = applyAnchors({ ...r, phases: r.phases.map((p) => (p.id === 'a' ? { ...p, tonic: 'Eb' } : p)) }).routine;
    expect(tonics(edited)).toEqual(['Eb', 'C', 'G']);
  });

  it('follows a key change through the phase it hangs on, and stays with a fixed one', () => {
    const follow = routine(phase('a', { tonic: 'C' }), phase('b', { link: 'anchor', anchorTo: 'a', anchorInterval: 'M6' }));
    expect(tonics(transposeRoutineBetween(applyAnchors(follow).routine, 'C', 'D'))).toEqual(['D', 'B']);
    const fixed = routine(phase('a', { tonic: 'C', link: 'fixed' }), phase('b', { link: 'anchor', anchorTo: 'a', anchorInterval: 'M6' }));
    expect(tonics(transposeRoutineBetween(applyAnchors(fixed).routine, 'C', 'D'))).toEqual(['C', 'A']);
  });

  it('a cycle is reported with a fix and changes nothing; a missing phase warns', () => {
    const loop = routine(
      phase('a', { tonic: 'C', link: 'anchor', anchorTo: 'b', anchorInterval: 'P5' }),
      phase('b', { tonic: 'G', link: 'anchor', anchorTo: 'a', anchorInterval: 'P4' }),
    );
    const result = applyAnchors(loop);
    expect([...result.issues.values()].some((i) => i.level === 'error' && i.fix?.change.link === 'fixed')).toBe(true);
    // No tonic is derived from a loop it is part of.
    expect(result.routine.phases.some((p) => result.issues.get(p.id)?.level === 'error')).toBe(true);
    const orphan = applyAnchors(routine(phase('a', { tonic: 'E', link: 'anchor', anchorTo: 'gone', anchorInterval: 'P5' })));
    expect(tonics(orphan.routine)).toEqual(['E']);
    expect(orphan.issues.get('a')?.level).toBe('warning');
  });

  it('survives a save: sanitize keeps the anchor and recomputes the tonic', () => {
    const saved = JSON.parse(JSON.stringify(routine(phase('a', { tonic: 'G' }), phase('b', { tonic: 'C', link: 'anchor', anchorTo: 'a', anchorInterval: 'M6' }))));
    const back = sanitizeRoutine(saved, routine(phase('x', {})));
    expect(back.phases[1]).toMatchObject({ link: 'anchor', anchorTo: 'a', anchorInterval: 'M6', tonic: 'E' });
    // Old routines without the fields read as before.
    const old = sanitizeRoutine({ name: 'v', phases: [{ id: 'a', tonic: 'D' }] }, routine(phase('x', {})));
    expect(old.phases[0]).toMatchObject({ link: 'follow', anchorTo: '', anchorInterval: 'P5', tonic: 'D' });
    expect(sanitizeRoutine({ name: 'v', phases: [{ id: 'a', anchorInterval: 'P9' }] }, old).phases[0]?.anchorInterval).toBe('P5');
  });
});
