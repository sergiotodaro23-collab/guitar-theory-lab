import { describe, expect, it } from 'vitest';
import { drumVoiceFor } from '../audio/samplerMap';
import { PPQ } from '../timeline';
import { DEFAULT_KIT, DRUM_VOICES, drumTrack, landingBar, pattern } from './drums';
import { genreOf } from './genres';

const m44 = { beatsPerBar: 4, beatUnit: 4 } as const;
const BAR = PPQ * 4;
const at = (events: readonly { tick: number; payload: { voice: string } }[], tick: number) => events.filter((e) => e.tick === tick).map((e) => e.payload.voice);

describe('kit pieces (J3)', () => {
  it('ten kit pieces, the pedal, crash and cross-stick among them, each on its recorded voice', () => {
    expect(DRUM_VOICES.map((v) => v.voice)).toEqual(['kick', 'snare', 'cross', 'hat', 'pedal', 'open', 'ride', 'crash', 'clap', 'tom']);
    expect(drumVoiceFor('pedal', 0.7)).toBe('hhPedal');
    expect(drumVoiceFor('crash', 1)).toBe('crash');
    expect(drumVoiceFor('cross', 0.7)).toBe('crossStick');
  });

  it('jazz: ride spang-a-lang with the hi-hat pedal on 2 and 4 (beats 2 and 4 = steps 4 and 12)', () => {
    for (const groove of genreOf('jazz').kit.patterns) {
      expect(groove.pedal.flatMap((v, i) => (v > 0 ? [i] : []))).toEqual([4, 12]);
      expect(groove.hat.every((v) => v === 0)).toBe(true);
    }
  });

  it('bossa nova: cross-stick clave, not hand claps', () => {
    const bossa = genreOf('latin').kit.patterns[0];
    expect(bossa.cross.filter((v) => v > 0)).toHaveLength(5);
    expect(bossa.clap.every((v) => v === 0)).toBe(true);
  });

  it('after the fill the next downbeat lands on an accented crash with the kick', () => {
    const track = drumTrack(DEFAULT_KIT, 0, m44, 4);
    expect(track.lengthTicks).toBe(BAR * 4);
    // Bar 1 (the bar after the looped fill) opens on the crash; bars 2 and 3 do not.
    expect(at(track.events, 0)).toEqual(expect.arrayContaining(['kick', 'crash']));
    expect(track.events.find((e) => e.tick === 0 && e.payload.voice === 'crash')?.payload.velocity).toBe(1);
    expect(at(track.events, BAR)).not.toContain('crash');
    expect(at(track.events, BAR * 2)).not.toContain('crash');
    // Without fills nothing changes.
    expect(drumTrack(DEFAULT_KIT, 0, m44, 0).events.some((e) => e.payload.voice === 'crash')).toBe(false);
  });

  it('a groove that already crashes, or has nothing on the downbeat, keeps its bar', () => {
    const crashing = pattern({ crash: 'X...', kick: 'X...' });
    expect(landingBar(crashing)).toBe(crashing);
    const sparse = pattern({ hat: '..x.' });
    expect(landingBar(sparse)).toBe(sparse);
  });
});
