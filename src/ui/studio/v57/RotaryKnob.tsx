/**
 * Rendered knob (handoff RotaryKnob): a static lit body, a rotating pointer
 * and slider semantics. −135°..+135°; drag 0.6 units per pixel; arrows ±2,
 * Shift ±10, PageUp/PageDown ±10, Home/End; double-click resets.
 *
 * With `sprite` the body is a strip of renders of the knob at every position
 * of its travel (tools/blender): the frame for the value is shown, so the
 * pointer turns while the light stays where it is. No pointer is drawn then.
 */
import { useRef, type KeyboardEvent } from 'react';

export interface RotaryKnobProps {
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly label: string;
  readonly valueText?: string;
  readonly bodySrc?: string;
  readonly bodySize: number;
  readonly hitSize: number;
  readonly pointer?: { readonly length: number; readonly offset: number; readonly color: string; readonly width?: number };
  /** A horizontal strip of `frames` square renders, first = minimum, last = maximum. */
  readonly sprite?: { readonly src: string; readonly frames: number };
  readonly cx: number;
  readonly cy: number;
  readonly defaultValue?: number;
  readonly disabled?: boolean;
  readonly testId?: string;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** The frame of a sprite strip that shows a value 0–100. */
export const knobFrame = (value: number, frames: number): number => Math.round((clamp(value) / 100) * (frames - 1));

export function RotaryKnob(p: RotaryKnobProps) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const angle = -135 + clamp(p.value) * 2.7;
  const width = p.pointer?.width ?? 3;
  const frame = p.sprite ? knobFrame(p.value, p.sprite.frames) : 0;
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
      {p.sprite ? (
        <span aria-hidden="true" className="v57-knob-body v57-knob-sprite" data-frame={frame}
          style={{ left: p.cx - p.bodySize / 2, top: p.cy - p.bodySize / 2, width: p.bodySize, height: p.bodySize, backgroundImage: `url(${p.sprite.src})`, backgroundSize: `${p.sprite.frames * p.bodySize}px ${p.bodySize}px`, backgroundPosition: `${-frame * p.bodySize}px 0` }} />
      ) : (
        <>
          <img src={p.bodySrc} alt="" draggable={false} className="v57-knob-body" style={{ left: p.cx - p.bodySize / 2, top: p.cy - p.bodySize / 2, width: p.bodySize, height: p.bodySize }} />
          {p.pointer ? (
            <span aria-hidden="true" className="v57-knob-ptr" style={{ left: p.cx, top: p.cy, transform: `rotate(${angle}deg)` }}>
              <i style={{ left: -width / 2, top: -p.pointer.offset - p.pointer.length, width, height: p.pointer.length, background: p.pointer.color }} />
            </span>
          ) : null}
        </>
      )}
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
