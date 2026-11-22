/**
 * SVG for the geometric legend (N2): the neck and the legend draw the same
 * elements with the same classes, so a colour or shape change shows in both.
 */
import { glyphGeometry, LEGEND_GLYPH, type GlyphShape } from './glyphs';
import type { LegendKind } from './legend';

export function GlyphShapeEl({ shape, x, y, r, className }: { readonly shape: GlyphShape; readonly x: number; readonly y: number; readonly r: number; readonly className: string }) {
  const geo = glyphGeometry(shape, x, y, r);
  switch (geo.kind) {
    case 'circle': return <circle className={className} data-glyph={shape} cx={geo.cx} cy={geo.cy} r={geo.r} />;
    case 'rect': return <rect className={className} data-glyph={shape} x={geo.x} y={geo.y} width={geo.size} height={geo.size} transform={geo.rotate ? `rotate(${geo.rotate} ${geo.x + geo.size / 2} ${geo.y + geo.size / 2})` : undefined} />;
    case 'polygon': return <polygon className={className} data-glyph={shape} points={geo.points} />;
  }
}

/** Half-size of a note in the legend's 28-unit box: the same proportions as on the neck (radius 13 of 28). */
const R = 9;
const C = 14;

/** Role classes a legend entry borrows from the neck, so the theme's fill and stroke rules colour both. */
const BODY: Partial<Record<LegendKind, string>> = {
  root: 'role-root',
  scale: 'role-scale',
  'chord-tone': 'role-chord-tone',
  'chord-root': 'role-chord-tone',
  guide: 'role-chord-tone is-guide',
  tension: 'role-tension',
  avoid: 'role-avoid',
  outside: 'role-outside',
  'other-scale': 'role-other-scale',
};

/**
 * The legend swatch: the note's body for a role, or the mark drawn around a
 * note (guide ring, chord frame, arpeggio triangle, target ring) round a plain
 * note, exactly as the neck draws them.
 */
export function LegendGlyph({ kind }: { readonly kind: LegendKind }) {
  const spec = LEGEND_GLYPH[kind];
  const body = BODY[kind];
  return (
    <svg className="legend-glyph" viewBox="0 0 28 28" width="22" height="22" aria-hidden="true" data-glyph={spec.shape} data-style={spec.style}>
      {body ? (
        <g className={`legend-mark ${body}`}>
          {kind === 'guide' ? <circle className="guide-ring" cx={C} cy={C} r={R + 2.6} /> : null}
          <GlyphShapeEl shape={kind === 'guide' ? 'circle' : spec.shape} x={C} y={C} r={kind === 'guide' ? R - 1 : R} className="shape" />
        </g>
      ) : null}
      {kind === 'voicing' ? (
        <g className="legend-mark role-scale in-voicing">
          <rect className="voicing-ring" x={C - R - 3.5} y={C - R - 3.5} width={(R + 3.5) * 2} height={(R + 3.5) * 2} rx={2.5} />
          <circle className="shape legend-plain" cx={C} cy={C} r={R - 3} />
        </g>
      ) : null}
      {kind === 'arpeggio' ? (
        <g className="legend-mark role-scale">
          <circle className="shape legend-plain" cx={C} cy={C + 2} r={R - 4} />
          <polygon className="arp-mark" points={`${C},${C - 12} ${C + 11.5},${C + 8} ${C - 11.5},${C + 8}`} />
        </g>
      ) : null}
      {kind === 'target-now' || kind === 'target-next' ? (
        <g className="legend-mark role-scale">
          <circle className={`target-ring target-${kind === 'target-now' ? 'now' : 'next'}`} cx={C} cy={C} r={R + 3.5} />
          <circle className="shape legend-plain" cx={C} cy={C} r={R - 3} />
        </g>
      ) : null}
      {kind === 'played' ? <g className="legend-played"><circle className="legend-played-halo" cx={C} cy={C} r={R + 3} /><circle className="legend-played-core" cx={C} cy={C} r={R - 1} /></g> : null}
      {kind === 'live-likely' ? <circle className="legend-live-likely" cx={C} cy={C} r={R} /> : null}
      {kind === 'live-possible' ? <circle className="legend-live-possible" cx={C} cy={C} r={R} /> : null}
    </svg>
  );
}
