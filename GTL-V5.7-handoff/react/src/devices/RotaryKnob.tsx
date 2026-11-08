import React, { useRef } from 'react';

/** Rendered knob: static body image (lighting never rotates) + rotating pointer layer + slider semantics. */
export interface RotaryKnobProps {
  value: number;                 // 0..100
  onChange(v: number): void;
  label: string;                 // accessible name
  valueText?: string;
  bodySrc: string;               // e.g. assets.knobGold
  bodySize: number;              // css px of the asset canvas (72 gold, 56 black, 84 alu)
  hitSize: number;               // circular hit area (52 / 40 / 60)
  pointer: { length: number; offset: number; color: string; width?: number };
  /** centre of the knob in the device canvas */
  cx: number; cy: number;
  defaultValue?: number;
}
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function RotaryKnob(p: RotaryKnobProps) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const angle = -135 + p.value * 2.7;
  const key = (e: React.KeyboardEvent) => {
    const st = e.shiftKey ? 10 : 2; let n = p.value;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') n += st; else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') n -= st;
    else if (e.key === 'PageUp') n += 10; else if (e.key === 'PageDown') n -= 10; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = 100; else return;
    e.preventDefault(); p.onChange(clamp(n));
  };
  return (
    <>
      <img src={p.bodySrc} alt="" draggable={false} style={{ position: 'absolute', left: p.cx - p.bodySize / 2, top: p.cy - p.bodySize / 2, width: p.bodySize, height: p.bodySize, pointerEvents: 'none' }} />
      <span aria-hidden="true" style={{ position: 'absolute', left: p.cx, top: p.cy, width: 0, height: 0, transform: `rotate(${angle}deg)`, pointerEvents: 'none' }}>
        <i style={{ position: 'absolute', left: -(p.pointer.width ?? 3) / 2, top: -p.pointer.offset - p.pointer.length, width: p.pointer.width ?? 3, height: p.pointer.length, borderRadius: 2, background: p.pointer.color, boxShadow: '0 0 1px rgba(0,0,0,.8)' }} />
      </span>
      <button type="button" role="slider" aria-label={p.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.value} aria-valuetext={p.valueText}
        style={{ position: 'absolute', left: p.cx, top: p.cy, width: p.hitSize, height: p.hitSize, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: 0, padding: 0, background: 'transparent', cursor: 'ns-resize', touchAction: 'none' }}
        onPointerDown={(e) => { drag.current = { y: e.clientY, v: p.value }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (d) p.onChange(clamp(d.v + (d.y - e.clientY) * 0.6)); }}
        onPointerUp={(e) => { drag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
        onDoubleClick={() => p.defaultValue != null && p.onChange(p.defaultValue)}
        onKeyDown={key} />
    </>
  );
}
