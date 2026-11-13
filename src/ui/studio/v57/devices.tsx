/**
 * The tuner on its rendered chassis (handoff geometry, device CSS px), on
 * the real guitar input. Input and Guitar Rig live in the Studio V6 rack.
 */
import type { ReactNode } from 'react';
import { engine } from '../../../app/engine';
import { useApp } from '../../../app/store';
import { useLive } from '../../../audio/liveInput';
import { IN_TUNE_CENTS, TUNINGS, noteOf, tunerReading } from '../../../pitch';
import { startInput } from '../../LivePanels';
import { hzToKnob, knobToHz } from './layout';
import { RotaryKnob } from './RotaryKnob';
import { useStudioUi } from './uiStore';
import tunerBody from './assets/tuner-body@2x.webp';
import knobBlack from './assets/knob-black@2x.png';
import footswitch from './assets/footswitch@2x.png';

/** Device canvases (CSS px at scale 1); the body renders are larger by the shadow margin. */
export const TUNER = { canvas: { w: 428, h: 404 }, render: { w: 490, h: 462 }, display: { left: 56, top: 52 }, arc: { cx: 214, cy: 204, r: 118, cells: 21, stepDeg: 6 } };

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function Canvas({ w, h, scale, body, render, children }: { readonly w: number; readonly h: number; readonly scale: number; readonly body: string; readonly render: { readonly w: number; readonly h: number }; readonly children: ReactNode }) {
  return (
    <div className="gtl-wrap" style={{ width: w * scale, height: h * scale }}>
      <div className="gtl-canvas" style={{ width: w, height: h, transform: `scale(${scale})` }}>
        <img className="gtl-body" src={body} alt="" draggable={false} style={{ width: render.w, height: render.h }} />
        {children}
      </div>
    </div>
  );
}

/* ---------------- tuner (real pitch detection) ---------------- */

export function TunerDevice({ scale }: { readonly scale: number }) {
  const ui = useStudioUi();
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const pitch = useLive((l) => l.pitch);
  const inputOn = useLive((l) => l.state === 'on');
  const starting = useLive((l) => l.state === 'starting');
  const tuning = TUNINGS.find((t) => t.id === s.tunerTuning) ?? (TUNINGS[0] as (typeof TUNINGS)[number]);
  const enabled = ui.tunerOn;
  const reading = enabled && inputOn && pitch ? tunerReading(pitch.frequency, tuning, s.tunerA4) : null;
  const cents = reading ? Math.round(reading.cents) : null;
  const idx = cents === null ? -1 : Math.max(0, Math.min(20, Math.round(cents / 5) + 10));
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS && pitch?.stable === true;
  const led = cents === null ? null : inTune ? 'tune' : cents > 0 ? 'sharp' : 'flat';
  const status = !enabled ? 'ACCORDATORE SPENTO' : !inputOn ? (starting ? 'APERTURA INGRESSO…' : 'INGRESSO SPENTO') : cents === null ? 'NESSUN SEGNALE' : inTune ? 'IN ACCORDO' : `${cents > 0 ? '+' : '−'}${Math.abs(cents)} cent`;
  const name = reading ? NAMES[((reading.midi % 12) + 12) % 12] : null;
  const octave = reading ? Math.floor(reading.midi / 12) - 1 : null;
  const heard = pitch && enabled && inputOn ? noteOf(pitch.frequency, s.tunerA4) : null;
  const toggle = () => {
    // The tuner needs the input: switching it on opens the input (monitoring stays off).
    if (!enabled && !inputOn && !starting) startInput();
    ui.setTuner({ tunerOn: !enabled });
  };
  return (
    <>
      <p className="v57-dvnote">
        {reading ? `Sento ${heard ? `${heard.name}${heard.octave}` : ''} · ${pitch?.frequency.toFixed(1)} Hz · ${reading.mode === 'string' ? `corda ${6 - (reading.string ?? 0)} di ${tuning.name}` : 'cromatico'}.` : `Lettura dall’ingresso chitarra reale. Accordatura: ${tuning.name}. I toni di riferimento sono a La 440 Hz.`}
      </p>
      <Canvas w={TUNER.canvas.w} h={TUNER.canvas.h} scale={scale} body={tunerBody} render={TUNER.render}>
        <div className="gtl-t-disp" data-on={enabled ? 1 : 0} role="status" aria-live="polite" data-testid="tuner-device-display"
          aria-label={reading ? `Nota ${name}${octave}, ${status}` : status}>
          {Array.from({ length: TUNER.arc.cells }, (_, i) => {
            const a = ((-60 + i * TUNER.arc.stepDeg) * Math.PI) / 180;
            const x = TUNER.arc.cx + TUNER.arc.r * Math.sin(a) - 5 - TUNER.display.left;
            const y = TUNER.arc.cy - TUNER.arc.r * Math.cos(a) - 7 - TUNER.display.top;
            const col = i === 10 ? '#7dff6a' : Math.abs(i - 10) >= 7 ? '#ff3b2f' : '#ffb23f';
            return <i key={i} className="gtl-t-seg" style={{ left: x, top: y, transform: `rotate(${-60 + i * 6}deg)`, background: i === idx ? col : i === 10 ? 'rgba(125,255,106,.25)' : 'rgba(79,178,255,.16)', boxShadow: i === idx ? `0 0 8px ${col}` : 'none' }} />;
          })}
          <span className="gtl-t-note" data-testid="tuner-device-note">{name ?? '—'}{octave !== null ? <small>{octave}</small> : null}</span>
          <span className="gtl-t-hz">{s.tunerA4} Hz</span><span className="gtl-t-ct" data-testid="tuner-device-cents">{status}</span>
        </div>
        <div className="gtl-t-refs" role="group" aria-label="Note di riferimento (La 440 Hz)">
          {NAMES.map((n, pc) => (
            <button key={n} type="button" aria-pressed={ui.referencePc === pc} aria-label={`Riferimento ${n}`}
              onClick={() => { ui.setTuner({ referencePc: pc }); engine.previewNote(60 + pc); }}>{n}</button>
          ))}
        </div>
        <span className="gtl-t-lab" style={{ left: 102, top: 230 }}>Calib</span>
        <RotaryKnob value={hzToKnob(s.tunerA4)} onChange={(v) => update({ tunerA4: knobToHz(v) })} label="Calibrazione del La (435–445 Hz)" valueText={`${s.tunerA4} Hz`}
          bodySrc={knobBlack} bodySize={56} hitSize={40} pointer={{ length: 7, offset: 3, color: '#e8e8e8', width: 2.5 }} cx={102} cy={270} defaultValue={50} testId="tuner-calibration" />
        {(['tune', 'sharp', 'flat'] as const).map((k, i) => <span key={k} className={`gtl-t-led ${k}`} data-on={led === k ? 1 : 0} style={{ top: 236 + i * 26 }} />)}
        <img src={footswitch} alt="" className="gtl-abs" style={{ left: 159, top: 245, width: 110, height: 110, transform: enabled ? 'scale(.985) translateY(1px)' : 'none' }} />
        <button type="button" className="gtl-hit" style={{ left: 184, top: 270, width: 60, height: 60, borderRadius: '50%' }} aria-pressed={enabled}
          aria-label="Interruttore a pedale: attiva o disattiva l’accordatore" data-testid="tuner-footswitch" onClick={toggle} />
      </Canvas>
    </>
  );
}
