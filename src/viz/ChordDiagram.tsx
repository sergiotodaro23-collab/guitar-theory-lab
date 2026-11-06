/** Classic chord box: strings vertical, low E on the left, nut or position number on top. */
import type { Voicing } from '../fretboard';

const W = 112;
const H = 112;
const LEFT = 16;
const RIGHT = W - 12;
const TOP = 22;
const ROWS = 4;
const ROW = (H - TOP - 8) / ROWS;
const COL = (RIGHT - LEFT) / 5;

export function ChordDiagram({ voicing, label }: { readonly voicing: Voicing; readonly label: string }) {
  const fretted = voicing.frets.filter((f): f is number => f !== null && f > 0);
  const top = fretted.length && Math.max(...fretted) > ROWS ? Math.min(...fretted) : 1;
  const sorted = [...voicing.notes].sort((a, b) => a.midi - b.midi);
  const degreeAt = new Map(sorted.map((n, i) => [n.string, voicing.degrees[i] ?? '']));
  return (
    <svg className="chord-diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {top > 1 ? <text className="diagram-fret" x={2} y={TOP + ROW / 2 + 4}>{top}</text> : <rect className="diagram-nut" x={LEFT - 1} y={TOP - 4} width={RIGHT - LEFT + 2} height={4} />}
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line key={`f${r}`} className="diagram-line" x1={LEFT} x2={RIGHT} y1={TOP + r * ROW} y2={TOP + r * ROW} />
      ))}
      {voicing.frets.map((fret, string) => {
        const x = LEFT + string * COL;
        return (
          <g key={string}>
            <line className="diagram-line" x1={x} x2={x} y1={TOP} y2={TOP + ROWS * ROW} />
            {fret === null ? <text className="diagram-mark" x={x} y={TOP - 8}>×</text> : null}
            {fret === 0 ? <circle className="diagram-open" cx={x} cy={TOP - 11} r={3.6} /> : null}
            {fret !== null && fret > 0 ? (
              <g>
                <circle className={`diagram-dot ${degreeAt.get(string) === '1' ? 'is-root' : ''}`} cx={x} cy={TOP + (fret - top + 0.5) * ROW} r={6.2} />
                <text className="diagram-degree" x={x} y={TOP + (fret - top + 0.5) * ROW + 0.5}>{degreeAt.get(string)}</text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
