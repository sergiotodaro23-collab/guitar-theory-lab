import React from 'react';
import type { AudioInterfaceProps } from '../types';
import { assets } from '../assets';
import { RotaryKnob } from './RotaryKnob';

export const IFACE = { canvas: { w: 668, h: 254 }, render: { w: 730, h: 312 }, gain: { cx: 294, cy: 120 }, inputs: [94, 184] };

/** Opening this device must never switch live monitoring on. */
export function InterfaceDevice(p: AudioInterfaceProps) {
  const halo = p.inputLevel <= 0 ? 0 : p.inputLevel > 0.82 ? 3 : 2;
  return (
    <div className="gtl-wrap" style={{ width: IFACE.canvas.w * p.scale, height: IFACE.canvas.h * p.scale }}>
      <div className="gtl-canvas" style={{ width: IFACE.canvas.w, height: IFACE.canvas.h, transform: `scale(${p.scale})` }}>
        <img className="gtl-body" src={assets.ifaceBody} alt="" style={{ width: IFACE.render.w, height: IFACE.render.h }} />
        {!p.deviceConnected && <span className="gtl-tape" style={{ left: 190, top: 44 }}>Nessun dispositivo reale collegato</span>}
        <div role="radiogroup" aria-label="Canale di ingresso">
          {([1, 2] as const).map((n, i) => (
            <React.Fragment key={n}>
              <span className="gtl-i-lab" style={{ left: IFACE.inputs[i], top: 150 }}>Input {n}</span>
              <button type="button" role="radio" aria-checked={p.inputChannel === n} className="gtl-i-ch" data-on={p.inputChannel === n ? 1 : 0}
                style={{ left: IFACE.inputs[i] - 13, top: 176 }} aria-label={'Ingresso ' + n} onClick={() => p.onChannelChange(n)}>{n}</button>
            </React.Fragment>
          ))}
        </div>
        <span className="gtl-i-halo" data-s={halo} />
        <RotaryKnob value={p.inputGain} onChange={p.onGainChange} label="Input gain" valueText={'+' + Math.round(p.inputGain * 0.2) + ' dB'}
          bodySrc={assets.knobAlu} bodySize={84} hitSize={60} pointer={{ length: 12, offset: 5, color: '#f1f1f1' }} cx={IFACE.gain.cx} cy={IFACE.gain.cy} defaultValue={62} />
        <span className="gtl-i-lab" style={{ left: IFACE.gain.cx, top: 172 }}>Gain +{Math.round(p.inputGain * 0.2)} dB</span>
        <div className="gtl-i-mon">
          <button type="button" aria-pressed={p.liveMonitor} onClick={p.onLiveMonitorToggle}><i data-lit={p.liveMonitor ? 1 : 0} />Live monitor</button>
          <button type="button" aria-pressed={p.demoSignal} onClick={p.onDemoToggle}><i data-lit={p.demoSignal ? 1 : 0} />Segnale test DEMO</button>
        </div>
        <div className="gtl-i-met" role="img" aria-label={p.inputLevel > 0 ? 'Livello d\'ingresso' : 'Nessun segnale'}>
          {Array.from({ length: 14 }, (_, i) => { const on = i < Math.round(p.inputLevel * 14); const c = i >= 12 ? '#ff3b2f' : i >= 9 ? '#ffb23f' : '#7dff6a'; return <i key={i} style={{ background: c, opacity: on ? 1 : 0.16 }} />; })}
        </div>
        <div className="gtl-i-lcd"><b>{p.statusText}</b><span>{p.pathText} · Rilevato: {p.detectedText}</span></div>
      </div>
    </div>
  );
}
