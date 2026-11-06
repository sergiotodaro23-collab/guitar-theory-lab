import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { DEFAULT_FRETS, type FretPosition } from '../fretboard';
import type { FretArrow, Marker } from './markers';

const WIDTH = 1240;
const HEIGHT = 252;
const NUT_X = 54;
const RIGHT = WIDTH - 14;
const TOP = 26;
const BOTTOM = HEIGHT - 38;
const STRING_GAP = (BOTTOM - TOP) / 5;
const RADIUS = 13;

/**
 * Uniform cells, not the real scale length: this is a study instrument, so
 * fret 24 must be as readable and clickable as fret 1.
 */
export function fretX(fret: number): number {
  return NUT_X + ((RIGHT - NUT_X) * fret) / DEFAULT_FRETS;
}

const noteX = (fret: number): number => (fret === 0 ? NUT_X - 26 : (fretX(fret - 1) + fretX(fret)) / 2);
/** High E on top, as in tablature. */
const stringY = (string: number): number => BOTTOM - string * STRING_GAP;

const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAYS = [12, 24];

const FretGrid = memo(function FretGrid() {
  return (
    <g>
      <rect className="board" x={NUT_X} y={TOP - 12} width={RIGHT - NUT_X} height={BOTTOM - TOP + 24} />
      <rect className="board-grain" x={NUT_X} y={TOP - 12} width={RIGHT - NUT_X} height={BOTTOM - TOP + 24} />
      {INLAYS.map((fret) => (
        <circle key={fret} className="inlay" cx={noteX(fret)} cy={(TOP + BOTTOM) / 2} r={5} />
      ))}
      {DOUBLE_INLAYS.map((fret) => (
        <g key={fret}>
          <circle className="inlay" cx={noteX(fret)} cy={TOP + STRING_GAP * 1.5} r={5} />
          <circle className="inlay" cx={noteX(fret)} cy={BOTTOM - STRING_GAP * 1.5} r={5} />
        </g>
      ))}
      {Array.from({ length: DEFAULT_FRETS }, (_, i) => i + 1).map((fret) => (
        <line key={fret} className="fret" x1={fretX(fret)} x2={fretX(fret)} y1={TOP - 12} y2={BOTTOM + 12} />
      ))}
      <line className="nut" x1={NUT_X} x2={NUT_X} y1={TOP - 12} y2={BOTTOM + 12} />
      {[0, 1, 2, 3, 4, 5].map((string) => (
        <line key={string} className="string" style={{ strokeWidth: 2.4 - string * 0.32 }} x1={NUT_X - 40} x2={RIGHT} y1={stringY(string)} y2={stringY(string)} />
      ))}
      {[...INLAYS, ...DOUBLE_INLAYS].map((fret) => (
        <text key={fret} className="fret-number" x={noteX(fret)} y={HEIGHT - 8}>{fret}</text>
      ))}
    </g>
  );
});

function roleName(marker: Marker): string {
  switch (marker.role) {
    case 'root': return 'tonica';
    case 'scale': return 'nota della scala';
    case 'other-scale': return 'nota di una scala sovrapposta';
    case 'chord-tone': return marker.isGuide ? 'guide tone' : 'chord tone';
    case 'tension': return 'tensione';
    case 'avoid': return 'avoid contestuale';
    case 'outside': return 'nota esterna';
  }
}

function Shape({ marker, x, y }: { readonly marker: Marker; readonly x: number; readonly y: number }) {
  const r = RADIUS;
  if (marker.role === 'tension') {
    return <rect className="shape" x={x - r * 0.86} y={y - r * 0.86} width={r * 1.72} height={r * 1.72} transform={`rotate(45 ${x} ${y})`} />;
  }
  if (marker.role === 'avoid') {
    return <polygon className="shape" points={`${x},${y - r * 1.1} ${x + r * 1.05},${y + r * 0.8} ${x - r * 1.05},${y + r * 0.8}`} />;
  }
  return <circle className="shape" cx={x} cy={y} r={marker.role === 'outside' ? r * 0.85 : r} />;
}

/** Look of an overlaid scale, indexed by its position in the user's list. */
export interface LayerStyle {
  /** Suffix of a `layer-*` CSS class. */
  readonly color: string;
  readonly opacity: number;
  readonly name: string;
}

/** Pip offsets around a note, by list position: top-right, bottom-right, bottom-left, top-left. */
const PIP_OFFSETS: readonly (readonly [number, number])[] = [[1, -1], [1, 1], [-1, 1], [-1, -1]];

interface MarkerProps {
  readonly marker: Marker;
  readonly layerStyles: readonly LayerStyle[];
  readonly onPick: (marker: Marker) => void;
}

const MarkerGlyph = memo(function MarkerGlyph({ marker, layerStyles, onPick }: MarkerProps) {
  const x = noteX(marker.fret);
  const y = stringY(marker.string);
  const classes = ['marker', `role-${marker.role}`];
  if (marker.dim) classes.push('is-dim');
  if (marker.isGuide) classes.push('is-guide');
  if (marker.pinned) classes.push('is-pinned');
  if (marker.inVoicing) classes.push('in-voicing');
  const owner = marker.role === 'other-scale' ? layerStyles[marker.layers[0] ?? -1] : undefined;
  if (owner) classes.push(`layer-${owner.color}`);
  const fnText = marker.fn ? `, ${marker.fn.degree} dell’accordo` : '';
  const layerNames = marker.layers.map((i) => layerStyles[i]?.name).filter(Boolean);
  const layerText = (layerNames.length ? `; in ${layerNames.join(', ')}` : '') + (marker.inVoicing ? '; nella forma dell’accordo' : '');
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onPick(marker);
    }
  };
  return (
    <g
      className={classes.join(' ')}
      data-string={marker.string}
      data-fret={marker.fret}
      data-label={marker.label}
      data-role={marker.role}
      role="button"
      tabIndex={marker.dim ? -1 : 0}
      aria-label={`Corda ${6 - marker.string}, tasto ${marker.fret}: ${roleName(marker)}${fnText}${layerText}`}
      onClick={() => onPick(marker)}
      onKeyDown={onKey}
    >
      {marker.inVoicing ? <rect className="voicing-ring" x={x - RADIUS - 5} y={y - RADIUS - 5} width={(RADIUS + 5) * 2} height={(RADIUS + 5) * 2} rx={6} /> : null}
      {marker.isGuide && !marker.dim ? <circle className="guide-ring" cx={x} cy={y} r={RADIUS + 3.5} /> : null}
      {marker.target ? <circle className={`target-ring target-${marker.target}`} cx={x} cy={y} r={RADIUS + 6} /> : null}
      <Shape marker={marker} x={x} y={y} />
      <text className="marker-label" x={x} y={y + 1}>{marker.label}</text>
      {marker.layers.map((index) => {
        const style = layerStyles[index];
        const offset = PIP_OFFSETS[index];
        if (!style || !offset) return null;
        const d = RADIUS * 0.8;
        return <circle key={index} className={`pip layer-${style.color}`} style={{ opacity: style.opacity }} data-layer={index} cx={x + offset[0] * d} cy={y + offset[1] * d} r={4.6} />;
      })}
    </g>
  );
});

function ArrowLine({ arrow }: { readonly arrow: FretArrow }) {
  const x1 = noteX(arrow.from.fret);
  const y1 = stringY(arrow.from.string);
  const x2 = noteX(arrow.to.fret);
  const y2 = stringY(arrow.to.string);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const trim = RADIUS + 3;
  if (length < trim * 2) return null;
  return (
    <line
      className={`arrow arrow-${arrow.kind}`}
      markerEnd={`url(#arrow-${arrow.kind})`}
      x1={x1 + (dx / length) * trim}
      y1={y1 + (dy / length) * trim}
      x2={x2 - (dx / length) * trim}
      y2={y2 - (dy / length) * trim}
    />
  );
}

export interface ActiveNote extends FretPosition {
  readonly label: string;
}

export interface FretboardProps {
  readonly markers: readonly Marker[];
  readonly arrows: readonly FretArrow[];
  readonly active: ActiveNote | null;
  readonly trail: readonly FretPosition[];
  readonly layerStyles?: readonly LayerStyle[];
  readonly onPick: (marker: Marker) => void;
}

const NO_LAYERS: readonly LayerStyle[] = [];

export function Fretboard({ markers, arrows, active, trail, layerStyles = NO_LAYERS, onPick }: FretboardProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const lowestFret = markers.length > 0 ? Math.min(...markers.map((m) => m.fret)) : 0;
  const [view, setView] = useState<{ low: number; high: number; scrolls: boolean }>({ low: 0, high: DEFAULT_FRETS, scrolls: false });

  // Whether the neck overflows depends on the box width, which changes on resize and rotation.
  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setView(visibleFrets(element)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // On a narrow screen, keep the position in view rather than the empty low frets.
  useEffect(() => {
    const element = scroller.current;
    if (!element || element.scrollWidth <= element.clientWidth) return;
    const ratio = noteX(Math.max(0, lowestFret - 1)) / WIDTH;
    element.scrollLeft = Math.max(0, ratio * element.scrollWidth - 12);
    setView(visibleFrets(element));
  }, [lowestFret]);

  const step = (direction: number) => {
    const element = scroller.current;
    if (!element) return;
    // Four frets at a time: one hand position.
    const fretWidth = (element.scrollWidth * (fretX(1) - fretX(0))) / WIDTH;
    element.scrollBy({ left: direction * fretWidth * 4, behavior: 'smooth' });
  };

  return (
    <div className="fretboard-wrap">
      {view.scrolls ? (
        <div className="fret-nav" data-testid="fret-nav">
          <button type="button" className="fret-nav-btn" aria-label="Mostra i tasti più bassi" disabled={view.low <= 0} onClick={() => step(-1)}>‹</button>
          <span className="fret-nav-range" aria-live="polite">Tasti {view.low}–{view.high}</span>
          <button type="button" className="fret-nav-btn" aria-label="Mostra i tasti più alti" disabled={view.high >= DEFAULT_FRETS} onClick={() => step(1)}>›</button>
        </div>
      ) : null}
    <div className="fretboard-scroll" ref={scroller} onScroll={(e) => setView(visibleFrets(e.currentTarget))}>
      <svg className="fretboard" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Tastiera della chitarra">
        <defs>
          {/* Materials for the Studio look; the Simple look ignores them. */}
          <linearGradient id="gtl-maple" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dcb67a" />
            <stop offset="0.12" stopColor="#ecd09a" />
            <stop offset="0.55" stopColor="#f2d9a6" />
            <stop offset="0.9" stopColor="#e6c58c" />
            <stop offset="1" stopColor="#cfa468" />
          </linearGradient>
          <pattern id="gtl-grain" width="420" height="38" patternUnits="userSpaceOnUse">
            <path d="M0 6 C 90 3, 210 10, 420 5" stroke="#b9874a" strokeOpacity="0.22" strokeWidth="1.2" fill="none" />
            <path d="M0 17 C 120 21, 260 13, 420 18" stroke="#a87638" strokeOpacity="0.16" strokeWidth="0.9" fill="none" />
            <path d="M0 29 C 140 25, 300 33, 420 28" stroke="#b9874a" strokeOpacity="0.2" strokeWidth="1.4" fill="none" />
            <path d="M60 12 C 70 11, 85 13, 98 12" stroke="#8f5f2c" strokeOpacity="0.25" strokeWidth="0.8" fill="none" />
          </pattern>
          <linearGradient id="gtl-fret" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7e8287" />
            <stop offset="0.5" stopColor="#f1f2f4" />
            <stop offset="1" stopColor="#8a8e93" />
          </linearGradient>
          <radialGradient id="gtl-pearl" cx="0.35" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.5" stopColor="#e6e9ef" />
            <stop offset="0.8" stopColor="#d6dbe6" />
            <stop offset="1" stopColor="#b9bfcc" />
          </radialGradient>
          <marker id="arrow-guide" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" className="arrowhead-guide" />
          </marker>
          <marker id="arrow-tension" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" className="arrowhead-tension" />
          </marker>
        </defs>
        <FretGrid />
        {arrows.map((arrow, i) => <ArrowLine key={i} arrow={arrow} />)}
        {markers.map((marker) => (
          <MarkerGlyph key={`${marker.string}-${marker.fret}`} marker={marker} layerStyles={layerStyles} onPick={onPick} />
        ))}
        {trail.map((note, i) => (
          <circle key={i} className="trail" style={{ opacity: 0.55 - i * 0.16 }} cx={noteX(note.fret)} cy={stringY(note.string)} r={RADIUS + 3} />
        ))}
        {active ? (
          <g className="active-note" data-active-string={active.string} data-active-fret={active.fret} data-active-label={active.label}>
            <circle className="active-halo" cx={noteX(active.fret)} cy={stringY(active.string)} r={RADIUS + 7} />
            <circle className="active-core" cx={noteX(active.fret)} cy={stringY(active.string)} r={RADIUS + 1} />
            <text className="active-label" x={noteX(active.fret)} y={stringY(active.string) + 1}>{active.label}</text>
          </g>
        ) : null}
      </svg>
    </div>
    </div>
  );
}

/** Frets fully or mostly in view, and whether the neck is wider than its box. */
function visibleFrets(element: HTMLElement): { low: number; high: number; scrolls: boolean } {
  const scrolls = element.scrollWidth > element.clientWidth + 1;
  const scale = WIDTH / element.scrollWidth;
  const left = element.scrollLeft * scale;
  const right = (element.scrollLeft + element.clientWidth) * scale;
  const fretAt = (x: number) => Math.min(DEFAULT_FRETS, Math.max(0, Math.round(((x - NUT_X) / (RIGHT - NUT_X)) * DEFAULT_FRETS)));
  return { low: fretAt(left), high: fretAt(right), scrolls };
}
