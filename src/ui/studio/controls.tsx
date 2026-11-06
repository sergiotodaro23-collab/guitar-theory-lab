/**
 * Studio hardware controls. Each is a real input: a knob is an ARIA slider
 * with keyboard and drag, a fader is a native range, a meter reads the audio
 * output. No control here only looks like one.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { engine } from '../../app/engine';
import { usePlayhead } from '../../app/store';

interface KnobProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
  readonly format: (value: number) => string;
  readonly testId?: string;
}

const SWEEP = 270;

export function Knob({ label, value, min, max, step, onChange, format, testId }: KnobProps) {
  const drag = useRef<{ y: number; value: number } | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const set = (v: number) => {
    const next = clamp(v);
    if (next !== value) onChange(Number(next.toFixed(4)));
  };
  const ratio = (value - min) / (max - min);
  const angle = -SWEEP / 2 + ratio * SWEEP;
  const big = (max - min) / 10;

  const onKey = (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: big, PageDown: -big,
    };
    if (event.key in moves) set(value + (moves[event.key] ?? 0));
    else if (event.key === 'Home') set(min);
    else if (event.key === 'End') set(max);
    else return;
    event.preventDefault();
  };
  const onPointerDown = (event: PointerEvent) => {
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, value };
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag.current) return;
    // 160 px of travel covers the whole range; Shift for fine moves.
    const travel = (drag.current.y - event.clientY) / (event.shiftKey ? 640 : 160);
    set(drag.current.value + travel * (max - min));
  };

  const r = 22;
  const arc = (to: number) => {
    const a0 = ((-SWEEP / 2 - 90) * Math.PI) / 180;
    const a1 = ((to - 90) * Math.PI) / 180;
    const large = to - -SWEEP / 2 > 180 ? 1 : 0;
    return `M ${30 + r * Math.cos(a0)} ${30 + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${30 + r * Math.cos(a1)} ${30 + r * Math.sin(a1)}`;
  };

  return (
    <div className="knob">
      <div
        className="knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        data-testid={testId}
        onKeyDown={onKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onDoubleClick={() => set(min)}
      >
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <path className="knob-track" d={arc(SWEEP / 2)} />
          {ratio > 0.001 ? <path className="knob-value" d={arc(angle)} /> : null}
          <circle className="knob-skirt" cx="30" cy="30" r="17" />
          <circle className="knob-cap" cx="30" cy="30" r="13" />
          <line className="knob-pointer" x1="30" y1="30" x2="30" y2="19" transform={`rotate(${angle} 30 30)`} />
        </svg>
      </div>
      <span className="knob-label">{label}</span>
      <span className="knob-readout">{format(value)}</span>
    </div>
  );
}

export function Fader({ label, value, onChange, testId }: { readonly label: string; readonly value: number; readonly onChange: (v: number) => void; readonly testId?: string }) {
  return (
    <label className="fader">
      <span className="fader-value">{Math.round(value * 100)}</span>
      <span className="fader-slot">
        <input type="range" min={0} max={1} step={0.01} value={value} aria-label={`Volume ${label}`} data-testid={testId} onChange={(e) => onChange(Number(e.target.value))} />
      </span>
      <span className="fader-label">{label}</span>
    </label>
  );
}

/** Output level from the audio graph's analyser, read only while sound can be playing. */
export function OutputMeter() {
  const state = usePlayhead((p) => p.state);
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (state !== 'playing') {
      setLevel(0);
      return;
    }
    let frame = 0;
    let held = 0;
    const loop = () => {
      // Fast attack, slow release, like a hardware meter.
      held = Math.max(engine.outputLevel(), held * 0.9);
      setLevel(held);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state]);
  const segments = 12;
  // RMS 0.5 fills the meter; most material sits in the middle.
  const lit = Math.min(segments, Math.round((level / 0.5) * segments));
  return (
    <div className="meter" role="meter" aria-label="Livello in uscita" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, level / 0.5) * 100)}>
      {Array.from({ length: segments }, (_, i) => {
        const n = segments - i;
        const zone = n > 10 ? 'hot' : n > 7 ? 'warm' : 'ok';
        return <span key={n} className={`meter-led meter-${zone} ${n <= lit ? 'is-on' : ''}`} />;
      })}
      <span className="meter-label">Out</span>
    </div>
  );
}
