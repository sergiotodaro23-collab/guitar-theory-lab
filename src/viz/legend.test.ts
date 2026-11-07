import { describe, expect, it } from 'vitest';
import { legendEntries } from './legend';
import type { Marker } from './markers';

const marker = (over: Partial<Marker>): Marker => ({
  string: 0, fret: 0, midi: 40, pc: 4, label: 'E', role: 'scale', isGuide: false, dim: false, pinned: false,
  target: null, layers: [], inVoicing: false, fn: null, ...over,
} as Marker);

describe('legend follows the drawn markers', () => {
  it('a scale alone: tonic and scale notes only', () => {
    const kinds = legendEntries([marker({ role: 'root' }), marker({ role: 'scale' })], { played: false }).map((e) => e.kind);
    expect(kinds).toEqual(['root', 'scale']);
  });

  it('over Cmaj7: guide tones apart from the other chord tones, tensions and avoid notes listed once', () => {
    const kinds = legendEntries([
      marker({ role: 'chord-tone', isGuide: true }),
      marker({ role: 'chord-tone' }),
      marker({ role: 'tension' }),
      marker({ role: 'tension' }),
      marker({ role: 'avoid' }),
    ], { played: false }).map((e) => e.kind);
    expect(kinds).toEqual(['guide', 'chord-tone', 'tension', 'avoid']);
  });

  it('voicing, targets and the played note appear only when shown', () => {
    const kinds = legendEntries([marker({ role: 'chord-tone', inVoicing: true, target: 'next' })], { played: true }).map((e) => e.kind);
    expect(kinds).toEqual(['chord-tone', 'voicing', 'target-next', 'played']);
    expect(legendEntries([], { played: false })).toEqual([]);
  });

  it('detected notes: the likely place and the other possible ones, each only when drawn', () => {
    expect(legendEntries([], { played: false, live: { likely: true, others: true } }).map((e) => e.kind)).toEqual(['live-likely', 'live-possible']);
    expect(legendEntries([], { played: false, live: { likely: false, others: true } }).map((e) => e.kind)).toEqual(['live-possible']);
  });
});
