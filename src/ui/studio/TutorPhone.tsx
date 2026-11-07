/**
 * The tutor's phone: a pixel-art guitarist and what the local rules have to
 * say about the current context. Three real mode keys under the screen, and a
 * key to fold the phone away. Words come from src/tutor, never from a service.
 */
import { memo, useMemo } from 'react';
import { meterOf } from '../../app/settings';
import { useApp, usePlayhead } from '../../app/store';
import { planRoutine } from '../../exercises';
import { buildScale } from '../../theory';
import { BASE, EXPRESSIONS, PALETTE, SPRITE_HEIGHT, SPRITE_WIDTH, type Expression } from '../../tutor/sprite';
import { TUTOR_MODES, tutorLine, type TutorMode } from '../../tutor/tutor';
import { useHarmonyContext } from '../Board';

const MODE_LABEL: Record<TutorMode, string> = { silent: 'Silenzioso', contextual: 'Contesto', tutor: 'Tutor' };

/** One frame as horizontal runs of rects: crisp at any integer scale. */
function frameRects(expression: Expression) {
  const grid = BASE.map((row) => row.split(''));
  for (const [x, y, key] of EXPRESSIONS[expression]) {
    const row = grid[y];
    if (row) row[x] = key;
  }
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x] ?? '.';
      let end = x + 1;
      while (end < row.length && row[end] === key) end += 1;
      const fill = PALETTE[key];
      if (key !== '.' && fill) rects.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return rects;
}

const Frame = memo(function Frame({ expression, className }: { readonly expression: Expression; readonly className: string }) {
  const rects = useMemo(() => frameRects(expression), [expression]);
  return (
    <g className={className}>
      {rects.map((r) => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
    </g>
  );
});

/** Two frames that alternate in CSS: blinking when idle, the mouth moving when talking. */
export function TutorSprite({ expression }: { readonly expression: Expression }) {
  const second: Expression = expression === 'talk' ? 'idle' : expression === 'idle' ? 'blink' : expression;
  return (
    <svg className={`tutor-sprite is-${expression}`} viewBox={`0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`} shapeRendering="crispEdges" role="img" aria-label="Il tutor, un chitarrista in pixel art" data-expression={expression}>
      <Frame expression={expression} className="frame-a" />
      {second !== expression ? <Frame expression={second} className="frame-b" /> : null}
    </svg>
  );
}

export function TutorPhone() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.update);
  const state = usePlayhead((p) => p.state);
  const { chord, nextChord } = useHarmonyContext();
  const scale = useMemo(() => buildScale(settings.tonic, settings.scaleId), [settings.tonic, settings.scaleId]);
  const issues = useMemo(() => (settings.exerciseMode === 'routine'
    ? planRoutine(settings.routine, meterOf(settings)).phases.reduce((n, p) => n + p.issues.length, 0)
    : 0), [settings]);
  const line = tutorLine(settings.tutorMode, { workspace: settings.mode, scale, chord, nextChord, playing: state === 'playing', issues });

  if (settings.tutorMinimized) {
    return (
      <button type="button" className="ws-phone-dock" data-testid="tutor-open" onClick={() => update({ tutorMinimized: false })}>
        <TutorSprite expression={line?.expression ?? 'idle'} />
        <span>Apri il tutor</span>
      </button>
    );
  }
  return (
    <section className="ws-phone" aria-label="Tutor" data-testid="tutor">
      <div className="ws-phone-screen">
        <div className="ws-phone-status">
          <span>Tutor</span>
          <span className="ws-phone-mode">{MODE_LABEL[settings.tutorMode]}</span>
          <button type="button" className="ws-phone-min" aria-label="Riduci il tutor" data-testid="tutor-minimize" onClick={() => update({ tutorMinimized: true })}>–</button>
        </div>
        {line ? (
          <div className="ws-bubble" aria-live="polite" data-testid="tutor-line">
            <p>{line.context}</p>
            {line.tip ? <p className="ws-bubble-tip">{line.tip}</p> : null}
          </div>
        ) : <p className="ws-bubble-silent">In ascolto. Scegli Contesto o Tutor per i suggerimenti.</p>}
        <TutorSprite expression={line?.expression ?? 'idle'} />
      </div>
      <div className="ws-phone-keys" role="group" aria-label="Modalità del tutor">
        {TUTOR_MODES.map((mode) => (
          <button key={mode} type="button" className="ws-phone-key" aria-pressed={settings.tutorMode === mode} onClick={() => update({ tutorMode: mode })}>
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>
    </section>
  );
}
