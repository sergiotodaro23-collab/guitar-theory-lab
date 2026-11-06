import { memo, useEffect, useRef, type KeyboardEvent } from 'react';
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
    case 'second-scale': return 'nota della seconda scala';
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

interface MarkerProps {
  readonly marker: Marker;
  readonly onPick: (marker: Marker) => void;
}

const MarkerGlyph = memo(function MarkerGlyph({ marker, onPick }: MarkerProps) {
  const x = noteX(marker.fret);
  const y = stringY(marker.string);
  const classes = ['marker', `role-${marker.role}`];
  if (marker.dim) classes.push('is-dim');
  if (marker.isGuide) classes.push('is-guide');
  if (marker.pinned) classes.push('is-pinned');
  if (marker.inSecondScale) classes.push('in-second');
  const fnText = marker.fn ? `, ${marker.fn.degree} dell’accordo` : '';
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
      aria-label={`Corda ${6 - marker.string}, tasto ${marker.fret}: ${roleName(marker)}${fnText}`}
      onClick={() => onPick(marker)}
      onKeyDown={onKey}
    >
      {marker.isGuide && !marker.dim ? <circle className="guide-ring" cx={x} cy={y} r={RADIUS + 3.5} /> : null}
      {marker.inSecondScale ? <circle className="second-ring" cx={x} cy={y} r={RADIUS + 3.5} /> : null}
      {marker.target ? <circle className={`target-ring target-${marker.target}`} cx={x} cy={y} r={RADIUS + 6} /> : null}
      <Shape marker={marker} x={x} y={y} />
      <text className="marker-label" x={x} y={y + 1}>{marker.label}</text>
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
  readonly onPick: (marker: Marker) => void;
}

export function Fretboard({ markers, arrows, active, trail, onPick }: FretboardProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const lowestFret = markers.length > 0 ? Math.min(...markers.map((m) => m.fret)) : 0;

  // On a narrow screen, keep the position in view rather than the empty low frets.
  useEffect(() => {
    const element = scroller.current;
    if (!element || element.scrollWidth <= element.clientWidth) return;
    const ratio = noteX(Math.max(0, lowestFret - 1)) / WIDTH;
    element.scrollLeft = Math.max(0, ratio * element.scrollWidth - 12);
  }, [lowestFret]);

  return (
    <div className="fretboard-scroll" ref={scroller}>
      <svg className="fretboard" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Tastiera della chitarra">
        <defs>
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
          <MarkerGlyph key={`${marker.string}-${marker.fret}`} marker={marker} onPick={onPick} />
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
  );
}
