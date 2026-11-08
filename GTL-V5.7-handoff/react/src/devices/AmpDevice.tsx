import React from 'react';
import type { AmpProps, AmpKnobId } from '../types';
import { assets } from '../assets';
import { RotaryKnob } from './RotaryKnob';

export const AMP = { canvas: { w: 868, h: 344 }, render: { w: 930, h: 402 }, knobCx: [270, 350, 430, 510, 590, 670], knobCy: 268, labelY: 210 };
const KNOBS: [AmpKnobId, string, number][] = [['gain', 'Gain', 55], ['bass', 'Bass', 50], ['mid', 'Middle', 60], ['treble', 'Treble', 58], ['presence', 'Presence', 45], ['out', 'Output', 62]];

/** Design demo: knobs and switches change only their visual state unless `processingConnected` is true. */
export function AmpDevice(p: AmpProps) {
  return (
    <div className="gtl-wrap" style={{ width: AMP.canvas.w * p.scale, height: AMP.canvas.h * p.scale }}>
      <div className="gtl-canvas" style={{ width: AMP.canvas.w, height: AMP.canvas.h, transform: `scale(${p.scale})` }}>
        <img className="gtl-body" src={assets.ampBody} alt="" style={{ width: AMP.render.w, height: AMP.render.h }} />
        {!p.processingConnected && <span className="gtl-tape" style={{ left: 86, top: 26 }}>Design demo · nessun DSP · NAM futuro</span>}
        <span className="gtl-a-lab" style={{ left: 89, top: AMP.labelY }}>Power</span>
        <span className="gtl-a-lab" style={{ left: 134, top: AMP.labelY }}>On</span>
        <span className="gtl-a-lab" style={{ left: 182, top: AMP.labelY }}>Input</span>
        <span className="gtl-a-lab" style={{ left: 752, top: AMP.labelY }}>Bypass</span>
        <img src={p.power ? assets.rockerOn : assets.rockerOff} alt="" style={{ position: 'absolute', left: 64, top: 239, width: 50, height: 62, pointerEvents: 'none' }} />
        <button type="button" className="gtl-hit" style={{ left: 70, top: 244, width: 38, height: 52 }} aria-pressed={p.power} aria-label="Accensione dell'amplificatore (stato di design)" onClick={p.onPowerToggle} />
        <span className="gtl-a-lamp" data-on={p.power ? 1 : 0} />
        <img src={p.bypass ? assets.toggleDown : assets.toggleUp} alt="" style={{ position: 'absolute', left: 732, top: 238, width: 40, height: 60, pointerEvents: 'none' }} />
        <button type="button" className="gtl-hit" style={{ left: 734, top: 240, width: 36, height: 56 }} aria-pressed={p.bypass} aria-label="Bypass dell'amplificatore (stato di design)" onClick={p.onBypassToggle} />
        {KNOBS.map(([id, name, def], i) => (
          <React.Fragment key={id}>
            <span className="gtl-a-lab" style={{ left: AMP.knobCx[i], top: AMP.labelY }}>{name}</span>
            <RotaryKnob value={p.knobs[id]} onChange={(v) => p.onKnobChange(id, v)} label={name + (p.processingConnected ? '' : ' (stato di design, nessun DSP)')} valueText={Math.round(p.knobs[id] / 10) + ' su 10'}
              bodySrc={assets.knobGold} bodySize={72} hitSize={52} pointer={{ length: 10, offset: 4, color: '#efe3bd' }} cx={AMP.knobCx[i]} cy={AMP.knobCy} defaultValue={def} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
