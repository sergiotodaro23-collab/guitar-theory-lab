import { describe, expect, it } from 'vitest';
import { MemoryStorage, PresetRepository, type StorageLike } from './presets';

const repo = (storage: StorageLike = new MemoryStorage()) => new PresetRepository(storage, () => new Date('2026-11-05T10:00:00Z'));

describe('preset repository', () => {
  it('round-trips presets across instances', () => {
    const storage = new MemoryStorage();
    repo(storage).save('Terze', 'study', { bpm: 80 });
    const [preset] = new PresetRepository(storage).list('study');
    expect(preset).toMatchObject({ name: 'Terze', kind: 'study', data: { bpm: 80 } });
  });
  it('filters by kind and overwrites by name', () => {
    const r = repo();
    r.save('A', 'study', { v: 1 });
    r.save('A', 'progression', { v: 2 });
    r.save('A', 'study', { v: 3 });
    expect(r.list()).toHaveLength(2);
    expect(r.list('study')[0]?.data).toEqual({ v: 3 });
  });
  it('rejects empty names', () => {
    expect(repo().save('  ', 'study', {})).toMatchObject({ ok: false });
  });
  it('removes presets', () => {
    const r = repo();
    const result = r.save('A', 'study', {});
    if (!result.ok) throw new Error('save failed');
    r.remove(result.preset.id);
    expect(r.list()).toEqual([]);
  });
  it('survives corrupt, foreign and future data', () => {
    const storage = new MemoryStorage();
    storage.setItem('gtl.presets', '{nope');
    expect(repo(storage).list()).toEqual([]);
    storage.setItem('gtl.presets', JSON.stringify({ version: 99, presets: [] }));
    expect(repo(storage).list()).toEqual([]);
    storage.setItem('gtl.presets', JSON.stringify({ version: 1, presets: [{ id: 1 }, { id: 'a', name: 'ok', kind: 'study', savedAt: 'x', data: {} }] }));
    expect(repo(storage).list()).toHaveLength(1);
  });
  it('reports a blocked storage instead of throwing', () => {
    const broken: StorageLike = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => undefined,
    };
    const r = repo(broken);
    expect(r.list()).toEqual([]);
    expect(r.save('A', 'study', {})).toMatchObject({ ok: false });
    expect(r.loadSession()).toBeNull();
    expect(() => r.saveSession({})).not.toThrow();
  });
  it('round-trips the session', () => {
    const r = repo();
    r.saveSession({ bpm: 70 });
    expect(r.loadSession()).toEqual({ bpm: 70 });
  });
});
