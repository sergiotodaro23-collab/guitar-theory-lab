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

  it('carries over the prototype names', () => {
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, appearance: 'workbench' }).appearance).toBe('studio');
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, appearance: 'classic' }).appearance).toBe('simple');
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, appearance: 'neon' }).appearance).toBe('simple');
  });
});
