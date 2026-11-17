import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

/**
 * The input gain became two: `inputGain` for the analysis (detection) and
 * `rigGain` for the rig. Nobody's level may change because of the split.
 */
describe('input gains: detection and rig', () => {
  it('both start neutral (0 dB)', () => {
    expect(DEFAULT_SETTINGS.inputGain).toBe(1);
    expect(DEFAULT_SETTINGS.rigGain).toBe(1);
    expect(sanitizeSettings({}).rigGain).toBe(1);
  });
  it('settings saved before the split keep their level on both paths: the rig takes the single gain they had', () => {
    const old = sanitizeSettings({ inputGain: 2.5 });
    expect(old.inputGain).toBe(2.5);
    expect(old.rigGain).toBe(2.5);
  });
  it('once saved, the two are independent', () => {
    const s = sanitizeSettings({ inputGain: 0.5, rigGain: 3 });
    expect(s.inputGain).toBe(0.5);
    expect(s.rigGain).toBe(3);
    expect(sanitizeSettings({ inputGain: 3, rigGain: 0 }).rigGain).toBe(0);
  });
  it('out-of-range or broken values fall back, never through to the audio graph', () => {
    expect(sanitizeSettings({ inputGain: 2, rigGain: 9 }).rigGain).toBe(2);
    expect(sanitizeSettings({ inputGain: 2, rigGain: 'loud' }).rigGain).toBe(2);
    expect(sanitizeSettings({ inputGain: -1, rigGain: Number.NaN }).rigGain).toBe(1);
  });
});
