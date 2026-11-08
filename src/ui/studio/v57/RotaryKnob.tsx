/**
 * Rendered knob (handoff RotaryKnob): a static lit body, a rotating pointer
 * and slider semantics. −135°..+135°; drag 0.6 units per pixel; arrows ±2,
 * Shift ±10, PageUp/PageDown ±10, Home/End; double-click resets.
 */
import { useRef, type KeyboardEvent } from 'react';

export interface RotaryKnobProps {
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly label: string;
  readonly valueText?: string;
  readonly bodySrc: string;
  readonly bodySize: number;
  readonly hitSize: number;
  readonly pointer: { readonly length: number; readonly offset: number; readonly color: string; readonly width?: number };
  readonly cx: number;
  readonly cy: number;
  readonly defaultValue?: number;
  readonly disabled?: boolean;
  readonly testId?: string;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function RotaryKnob(p: RotaryKnobProps) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const angle = -135 + clamp(p.value) * 2.7;
  const width = p.pointer.width ?? 3;
  const key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    let n = p.value;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') n += step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') n -= step;
    else if (e.key === 'PageUp') n += 10;
    else if (e.key === 'PageDown') n -= 10;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = 100;
    else return;
    e.preventDefault();
    p.onChange(clamp(n));
  };
  return (
    <>
      <img src={p.bodySrc} alt="" draggable={false} className="v57-knob-body" style={{ left: p.cx - p.bodySize / 2, top: p.cy - p.bodySize / 2, width: p.bodySize, height: p.bodySize }} />
      <span aria-hidden="true" className="v57-knob-ptr" style={{ left: p.cx, top: p.cy, transform: `rotate(${angle}deg)` }}>
        <i style={{ left: -width / 2, top: -p.pointer.offset - p.pointer.length, width, height: p.pointer.length, background: p.pointer.color }} />
      </span>
      <button
        type="button"
        role="slider"
        className="v57-knob-hit"
        aria-label={p.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamp(p.value)}
        aria-valuetext={p.valueText}
        disabled={p.disabled}
        data-testid={p.testId}
        style={{ left: p.cx, top: p.cy, width: p.hitSize, height: p.hitSize }}
        onPointerDown={(e) => { drag.current = { y: e.clientY, v: p.value }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (d) p.onChange(clamp(d.v + (d.y - e.clientY) * 0.6)); }}
        onPointerUp={(e) => { drag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={() => { drag.current = null; }}
        onDoubleClick={() => { if (p.defaultValue !== undefined) p.onChange(p.defaultValue); }}
        onKeyDown={key}
      />
    </>
  );
}
