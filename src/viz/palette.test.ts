import { describe, expect, it } from 'vitest';
import { COLOR_ROLES, DARK_INK, LIGHT_INK, contrast, inkFor, markerColorVars, sanitizeMarkerColors } from './palette';

describe('N3 · customizable marker colours', () => {
  it('keeps only known roles with a #rrggbb colour', () => {
    expect(sanitizeMarkerColors({ root: '#FF0000', scale: 'blue', chord: '#12345', bogus: '#000000', tension: 7 })).toEqual({ root: '#ff0000' });
    expect(sanitizeMarkerColors(null)).toEqual({});
    expect(sanitizeMarkerColors(['#ffffff'])).toEqual({});
  });

  it('a role left alone sets no property: the theme colour stays', () => {
    expect(markerColorVars({}, 'studio')).toEqual({});
  });

  it('Studio and Simple read different properties for the same role', () => {
    expect(markerColorVars({ root: '#123456' }, 'studio')).toMatchObject({ '--marker-tonic': '#123456' });
    expect(markerColorVars({ root: '#123456' }, 'simple')).toMatchObject({ '--root': '#123456' });
    expect(markerColorVars({ arpeggio: '#ff00ff' }, 'studio')).toEqual({ '--arp-mark': '#ff00ff' });
  });

  it('the label ink follows the fill: dark on light colours, light on dark ones, always readable', () => {
    expect(inkFor('#ffff00')).toBe(DARK_INK);
    expect(inkFor('#101060')).toBe(LIGHT_INK);
    for (const fill of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080', '#f08a24', '#1d3561']) {
      expect(contrast(fill, inkFor(fill))).toBeGreaterThanOrEqual(4.5);
    }
    expect(markerColorVars({ scale: '#101060' }, 'studio')['--ink-scale']).toBe(LIGHT_INK);
  });

  it('the theme defaults shown in the pickers are valid colours', () => {
    for (const role of COLOR_ROLES) {
      expect(sanitizeMarkerColors({ [role.id]: role.defaults.studio })).toEqual({ [role.id]: role.defaults.studio });
      expect(sanitizeMarkerColors({ [role.id]: role.defaults.simple })).toEqual({ [role.id]: role.defaults.simple });
    }
  });
});
