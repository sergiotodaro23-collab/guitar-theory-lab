import React from 'react';
import type { TunerProps } from '../types';
import { assets } from '../assets';
import { RotaryKnob } from './RotaryKnob';

export const TUNER = { canvas: { w: 428, h: 404 }, render: { w: 490, h: 462 }, display: { left: 56, top: 52, w: 316, h: 136 }, arc: { cx: 214, cy: 204, r: 118, cells: 21, stepDeg: 6 } };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** The reading comes ONLY from props. Never synthesise a pitch here. */
export function TunerDevice(p: TunerProps) {
  const r = p.enabled ? p.reading : null;
  const idx = r ? Math.max(0, Math.min(20, Math.round(r.cents / 5) + 10)) : -1;
  const led = r ? (Math.abs(r.cents) <= 3 ? 'tune' : r.cents > 3 ? 'sharp' : 'flat') : null;
  const cents = !p.enabled ? 'ACCORDATORE SPENTO' : !r ? 'NESSUN SEGNALE' : Math.abs(r.cents) <= 3 ? 'IN ACCORDO' : (r.cents > 0 ? '+' : '−') + Math.abs(r.cents) + ' cent';
  return (
    <div className="gtl-wrap" style={{ width: TUNER.canvas.w * p.scale, height: TUNER.canvas.h * p.scale }}>
      <div className="gtl-canvas" style={{ width: TUNER.canvas.w, height: TUNER.canvas.h, transform: `scale(${p.scale})` }}>
        <img className="gtl-body" src={assets.tunerBody} alt="" style={{ width: TUNER.render.w, height: TUNER.render.h }} />
        <div className="gtl-t-disp" data-on={p.enabled ? 1 : 0} role="status" aria-live="polite"
          aria-label={r ? `Nota ${NAMES[r.midi % 12]}${Math.floor(r.midi / 12) - 1}, ${cents}${r.source === 'demo' ? ' (segnale DEMO)' : ''}` : cents}>
          {Array.from({ length: TUNER.arc.cells }, (_, i) => {
            const a = (-60 + i * TUNER.arc.stepDeg) * Math.PI / 180;
            const x = TUNER.arc.cx + TUNER.arc.r * Math.sin(a) - 5 - TUNER.display.left; const y = TUNER.arc.cy - TUNER.arc.r * Math.cos(a) - 7 - TUNER.display.top;
            const col = i === 10 ? '#7dff6a' : Math.abs(i - 10) >= 7 ? '#ff3b2f' : '#ffb23f';
            return <i key={i} className="gtl-t-seg" style={{ left: x, top: y, transform: `rotate(${-60 + i * 6}deg)`, background: i === idx ? col : i === 10 ? 'rgba(125,255,106,.25)' : 'rgba(79,178,255,.16)', boxShadow: i === idx ? `0 0 8px ${col}` : 'none' }} />;
          })}
          <span className="gtl-t-note">{r ? NAMES[r.midi % 12] : '—'}{r && <small>{Math.floor(r.midi / 12) - 1}</small>}</span>
          <span className="gtl-t-hz">{p.calibrationHz} Hz</span><span className="gtl-t-ct">{cents}</span>
        </div>
        {r?.source === 'demo' && <span className="gtl-tape" style={{ left: 150, top: 24 }}>Segnale DEMO</span>}
        <div className="gtl-t-refs" role="group" aria-label="Note di riferimento">
          {NAMES.map((n, pc) => <button key={n} type="button" aria-pressed={p.referencePc === pc} onClick={() => p.onReferenceTone(pc)}>{n}</button>)}
        </div>
        <RotaryKnob value={(p.calibrationHz - 435) * 10} onChange={(v) => p.onCalibrationChange(435 + Math.round(v / 10))} label="Calibrazione del La (435–445 Hz)" valueText={p.calibrationHz + ' Hz'}
          bodySrc={assets.knobBlack} bodySize={56} hitSize={40} pointer={{ length: 7, offset: 3, color: '#e8e8e8', width: 2.5 }} cx={102} cy={270} defaultValue={50} />
        {(['tune', 'sharp', 'flat'] as const).map((k, i) => <span key={k} className={'gtl-t-led ' + k} data-on={led === k ? 1 : 0} style={{ top: 236 + i * 26 }} />)}
        <img src={assets.footswitch} alt="" style={{ position: 'absolute', left: 159, top: 245, width: 110, height: 110, pointerEvents: 'none', transform: p.enabled ? 'scale(.985) translateY(1px)' : 'none' }} />
        <button type="button" className="gtl-hit" style={{ left: 184, top: 270, width: 60, height: 60, borderRadius: '50%' }} aria-pressed={p.enabled} aria-label="Interruttore a pedale: attiva o disattiva l'accordatore" onClick={p.onToggle} />
      </div>
    </div>
  );
}
