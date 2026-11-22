/**
 * The geometric legend (N2): one shape per role, the same on the neck and in
 * the legend. Circles, squares, diamonds and triangles, filled or outlined, so
 * every role reads without its colour. Pure, no DOM: both the fretboard and
 * the legend draw from this table.
 */
import type { LegendKind } from './legend';
import type { MarkerRole } from './markers';

export type GlyphShape = 'circle' | 'square' | 'diamond' | 'triangle';
/** 'filled': the note's own body. 'outline': a mark drawn around a note (ring, frame, triangle). 'dashed': an outline in dashes. */
export type GlyphStyle = 'filled' | 'outline' | 'dashed';

export interface GlyphSpec {
  readonly shape: GlyphShape;
  readonly style: GlyphStyle;
  /** Italian name of the shape, read in the legend and by screen readers. */
  readonly shapeName: string;
}

const g = (shape: GlyphShape, style: GlyphStyle, shapeName: string): GlyphSpec => ({ shape, style, shapeName });

/** The body of a note on the neck, by role. */
export const ROLE_GLYPH: Readonly<Record<MarkerRole, GlyphSpec>> = {
  root: g('square', 'filled', 'quadrato'),
  scale: g('circle', 'filled', 'cerchio'),
  'chord-tone': g('circle', 'filled', 'cerchio'),
  tension: g('diamond', 'filled', 'rombo'),
  avoid: g('triangle', 'filled', 'triangolo pieno'),
  outside: g('circle', 'outline', 'cerchio vuoto'),
  'other-scale': g('circle', 'dashed', 'cerchio tratteggiato'),
};

/** The chord's root is a square like the tonic: a square always marks the note everything else is counted from. */
export const CHORD_ROOT_GLYPH: GlyphSpec = g('square', 'filled', 'quadrato');

/** The body a marker is drawn with: its role's, except the chord's root, which takes the square. */
export function markerGlyph(marker: { readonly role: MarkerRole; readonly fn: { readonly degree: string } | null }): GlyphSpec {
  return marker.role === 'chord-tone' && marker.fn?.degree === '1' ? CHORD_ROOT_GLYPH : ROLE_GLYPH[marker.role];
}

/** Every legend entry, including the marks drawn around a note (guide ring, chord frame, arpeggio triangle, targets). */
export const LEGEND_GLYPH: Readonly<Record<LegendKind, GlyphSpec>> = {
  ...ROLE_GLYPH,
  'chord-root': CHORD_ROOT_GLYPH,
  guide: g('circle', 'outline', 'cerchio con anello'),
  arpeggio: g('triangle', 'outline', 'triangolo a contorno'),
  voicing: g('square', 'outline', 'cornice quadrata'),
  'target-now': g('circle', 'outline', 'anello'),
  'target-next': g('circle', 'dashed', 'anello tratteggiato'),
  played: g('circle', 'filled', 'cerchio luminoso'),
  'live-likely': g('circle', 'filled', 'cerchio rosso'),
  'live-possible': g('circle', 'dashed', 'cerchio rosso tratteggiato'),
};

/** Points of a shape centred on (x, y) with half-size r, as an SVG description the neck and the legend share. */
export type GlyphGeometry =
  | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly kind: 'rect'; readonly x: number; readonly y: number; readonly size: number; readonly rotate: number }
  | { readonly kind: 'polygon'; readonly points: string };

export function glyphGeometry(shape: GlyphShape, x: number, y: number, r: number): GlyphGeometry {
  switch (shape) {
    case 'circle': return { kind: 'circle', cx: x, cy: y, r };
    // A square as wide as the circle reads as the same size on the neck.
    case 'square': return { kind: 'rect', x: x - r * 0.9, y: y - r * 0.9, size: r * 1.8, rotate: 0 };
    case 'diamond': return { kind: 'rect', x: x - r * 0.86, y: y - r * 0.86, size: r * 1.72, rotate: 45 };
    case 'triangle': return { kind: 'polygon', points: `${x},${y - r * 1.1} ${x + r * 1.05},${y + r * 0.8} ${x - r * 1.05},${y + r * 0.8}` };
  }
}
