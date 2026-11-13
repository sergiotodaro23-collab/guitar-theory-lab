import { describe, expect, it } from 'vitest';
import { effectiveAppearance, studioAvailable } from './appearance';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../app/settings';

describe('appearance by viewport', () => {
  it.each([
    ['phone upright', 390, 844, false],
    ['large phone upright', 430, 932, false],
    ['phone on its side', 844, 390, false],
    ['large phone on its side', 932, 430, false],
    ['small tablet upright', 744, 1133, true],
    ['tablet upright', 768, 1024, true],
    ['tablet on its side', 1180, 820, true],
    ['laptop', 1280, 800, true],
    ['desktop', 1440, 900, true],
  ])('%s (%i×%i): Studio available = %s', (_name, w, h, expected) => {
    expect(studioAvailable(w, h)).toBe(expected);
  });

  it('falls back to Simple without forgetting the preference', () => {
    expect(effectiveAppearance('studio', 390, 844)).toBe('simple');
    expect(effectiveAppearance('studio', 1280, 800)).toBe('studio');
    expect(effectiveAppearance('simple', 1280, 800)).toBe('simple');
  });

  it('with no choice made, Studio on tablets and computers, Simple on phones', () => {
    expect(DEFAULT_SETTINGS.look).toBe('auto');
    expect(effectiveAppearance('auto', 1440, 900)).toBe('studio');
    expect(effectiveAppearance('auto', 768, 1024)).toBe('studio');
    expect(effectiveAppearance('auto', 390, 844)).toBe('simple');
    expect(effectiveAppearance('auto', 844, 390)).toBe('simple');
  });

  it('ignores the old look names, whose layouts were renamed', () => {
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, look: 'workbench' }).look).toBe('auto');
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, look: 'studio' }).look).toBe('studio');
    const old: Record<string, unknown> = { ...DEFAULT_SETTINGS, appearance: 'studio' };
    delete old.look;
    expect(sanitizeSettings(old).look).toBe('auto');
  });
});

describe('mixer mute', () => {
  it('mutes a channel without moving its fader, and unmuting restores the level', async () => {
    const { channelVolume } = await import('../app/settings');
    const s = { ...DEFAULT_SETTINGS, volClick: 0.4, muteClick: true };
    expect(channelVolume(s, 'click')).toBe(0);
    expect(channelVolume({ ...s, muteClick: false }, 'click')).toBe(0.4);
    expect(channelVolume(s, 'notes')).toBe(DEFAULT_SETTINGS.volNotes);
    expect(sanitizeSettings({ ...s, muteNotes: 'yes' }).muteNotes).toBe(false);
  });

  it('the backing trim scales comping, bass and drums only, and its mute silences them without moving any fader', async () => {
    const { channelVolume, backingTrackVolume } = await import('../app/settings');
    const s = { ...DEFAULT_SETTINGS, volComp: 0.8, volBass: 0.6, volDrums: 0.5, volClick: 0.7, volNotes: 0.7, volBacking: 0.5 };
    expect(channelVolume(s, 'comp')).toBeCloseTo(0.4);
    expect(channelVolume(s, 'bass')).toBeCloseTo(0.3);
    expect(channelVolume(s, 'drums')).toBeCloseTo(0.25);
    expect(channelVolume(s, 'click')).toBe(0.7);
    expect(channelVolume(s, 'notes')).toBe(0.7);
    const muted = { ...s, muteBacking: true };
    expect(['comp', 'bass', 'drums'].map((c) => channelVolume(muted, c as 'comp'))).toEqual([0, 0, 0]);
    expect(channelVolume(muted, 'click')).toBe(0.7);
    expect(muted.volComp).toBe(0.8);
    expect(backingTrackVolume({ ...s, backing: { ...s.backing, volume: 0.8 } })).toBeCloseTo(0.4);
    expect(backingTrackVolume(muted)).toBe(0);
    // Sessions saved before V6 have no trim: full level, not muted.
    const old = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    delete old.volBacking;
    delete old.muteBacking;
    expect(sanitizeSettings(old).volBacking).toBe(1);
    expect(sanitizeSettings(old).muteBacking).toBe(false);
  });
});
