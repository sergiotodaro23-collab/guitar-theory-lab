import { describe, expect, it } from 'vitest';
import { parseMidi } from './midi';

describe('MIDI messages (P4-06)', () => {
  it('notes, the velocity-0 note-off and controllers on any channel', () => {
    expect(parseMidi([0x90, 64, 100])).toEqual({ type: 'note-on', note: 64, velocity: 100, channel: 0 });
    expect(parseMidi([0x93, 64, 0])).toEqual({ type: 'note-off', note: 64, channel: 3 });
    expect(parseMidi([0x80, 40, 10])).toEqual({ type: 'note-off', note: 40, channel: 0 });
    expect(parseMidi([0xb5, 64, 127])).toEqual({ type: 'cc', controller: 64, value: 127, channel: 5 });
  });
  it('real-time Start, Continue, Stop; everything else ignored', () => {
    expect([0xfa, 0xfb, 0xfc].map((b) => parseMidi([b])?.type)).toEqual(['start', 'continue', 'stop']);
    expect(parseMidi([0xe0, 0, 64])).toBeNull();
    expect(parseMidi([0xf8])).toBeNull();
  });
});
