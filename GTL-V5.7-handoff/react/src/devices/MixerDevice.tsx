import React, { useRef } from 'react';
import type { MixerProps, ChannelId } from '../types';
import { assets } from '../assets';

/** Geometry of the rendered chassis (device css px). Do not change without re-rendering mixer-body. */
export const MIXER = {
  canvas: { w: 828, h: 432 }, render: { w: 890, h: 490 }, offset: { x: 24, y: 20 },
  channelCx: [85, 183, 281, 379, 477, 575, 692],   // device x of each fader slot
  slot: { top: 96, height: 168 },                   // fader hit area
  travel: { top: 112, bottom: 248 },                // cap centre at v=100 / v=0
  muteTop: 273, soloTop: 313, ledY: 74,
  ticks: [[112, '+6'], [134.7, '0'], [157.3, '−6'], [180, '−12'], [202.7, '−18'], [225.3, '−24'], [248, '−∞']] as const
};
export const faderDb = (v: number) => (v <= 1.5 ? '−∞ dB' : (() => { const d = -30 + v * 0.36; return (d > 0.05 ? '+' : d < -0.05 ? '−' : '') + Math.abs(d).toFixed(1) + ' dB'; })());
const capTop = (v: number) => MIXER.travel.bottom - v * ((MIXER.travel.bottom - MIXER.travel.top) / 100) - 36;
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function MixerDevice(p: MixerProps) {
  const dragging = useRef<ChannelId | null>(null);
  const fromY = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const k = r.height / MIXER.slot.height;
    const y = (e.clientY - r.top) / k + MIXER.slot.top;
    return clamp((MIXER.travel.bottom - y) / (MIXER.travel.bottom - MIXER.travel.top) * 100);
  };
  return (
    <div className="gtl-wrap" style={{ width: MIXER.canvas.w * p.scale, height: MIXER.canvas.h * p.scale }}>
      <div className="gtl-canvas" style={{ width: MIXER.canvas.w, height: MIXER.canvas.h, transform: `scale(${p.scale})` }}>
        <img className="gtl-body" src={assets.mixerBody} alt="" style={{ width: MIXER.render.w, height: MIXER.render.h }} />
        {p.channels.map((c, i) => {
          const left = MIXER.channelCx[i] - 49 + MIXER.offset.x; const master = c.id === 'master';
          const lit = c.wired && !c.muted && c.level > 0.03;
          return (
            <div key={c.id} role="group" aria-label={c.label} style={{ position: 'absolute', left, top: MIXER.offset.y, width: 98, height: 380 }}>
              <span className="gtl-m-name">{c.label}</span>
              {!c.wired && <span className="gtl-m-proto">proto · senza audio</span>}
              <span className="gtl-m-led" data-s={lit ? 2 : c.wired && !c.muted ? 1 : 0} />
              {MIXER.ticks.map(([y, l]) => <span key={l} className="gtl-m-tick" style={{ top: y }}><b>{l}</b><i /></span>)}
              <img src={master ? assets.faderCapMaster : assets.faderCap} alt="" style={{ position: 'absolute', left: 19, top: capTop(c.value), width: 60, height: 72, pointerEvents: 'none' }} />
              <button type="button" role="slider" aria-orientation="vertical" aria-label={'Livello ' + c.label + (c.wired ? '' : ' (non collegato)')}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.value} aria-valuetext={faderDb(c.value)}
                style={{ position: 'absolute', left: 24, top: MIXER.slot.top, width: 50, height: MIXER.slot.height, border: 0, background: 'transparent', cursor: 'ns-resize', touchAction: 'none' }}
                onPointerDown={(e) => { dragging.current = c.id; e.currentTarget.setPointerCapture(e.pointerId); p.onValueChange(c.id, fromY(e)); }}
                onPointerMove={(e) => { if (dragging.current === c.id) p.onValueChange(c.id, fromY(e)); }}
                onPointerUp={(e) => { dragging.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
                onKeyDown={(e) => { const st = e.shiftKey ? 10 : 2; let n = c.value; if (e.key === 'ArrowUp') n += st; else if (e.key === 'ArrowDown') n -= st; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = 100; else return; e.preventDefault(); p.onValueChange(c.id, clamp(n)); }} />
              <button type="button" className="gtl-m-btn" aria-pressed={c.muted} aria-label={'Mute ' + c.label} style={{ top: MIXER.muteTop }} onClick={() => p.onMuteToggle(c.id)}>
                <img src={c.muted ? assets.btnMuteOn : assets.btnOff} alt="" /><span data-lit={c.muted ? 1 : 0}>Mute</span>
              </button>
              <button type="button" className="gtl-m-btn" disabled={!p.onSoloToggle} aria-label={'Solo ' + c.label + (p.onSoloToggle ? '' : ': funzione futura')} style={{ top: MIXER.soloTop }} onClick={() => p.onSoloToggle?.(c.id)}>
                <img src={assets.btnOff} alt="" /><span>Solo</span>
              </button>
              <span className="gtl-m-read">{faderDb(c.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
