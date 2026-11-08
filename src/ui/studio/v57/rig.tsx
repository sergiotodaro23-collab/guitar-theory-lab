/**
 * Guitar Rig device (D-42): the rendered amp head on top, the cabinet IR unit
 * and the pedalboard below, in one drawer. Every control writes `settings.rig`;
 * the audio graph (src/audio/guitarRig.ts) follows it on the listening branch.
 * Pedals and cabinet are skeuomorphic HTML over CSS enclosures, reusing the
 * rendered knob and footswitch: nothing is flattened into an image.
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { engine } from '../../../app/engine';
import {
  AMP_KNOB_IDS, PEDAL_SPECS, POST_PEDALS, PRE_PEDALS, type AmpKnob, type CabModel, type PedalId, type RigSettings,
} from '../../../app/rig';
import { useApp } from '../../../app/store';
import { liveInput, useLive } from '../../../audio/liveInput';
import { startInput } from '../../LivePanels';
import { RotaryKnob } from './RotaryKnob';
import ampBody from './assets/amp-body@2x.webp';
import knobGold from './assets/knob-gold@2x.png';
import knobBlack from './assets/knob-black@2x.png';
import rockerOn from './assets/rocker-on@2x.png';
import rockerOff from './assets/rocker-off@2x.png';
import toggleUp from './assets/toggle-up@2x.png';
import toggleDown from './assets/toggle-down@2x.png';
import footswitch from './assets/footswitch@2x.png';

/** Amp head geometry (handoff AMP) and the pedalboard under it, in device CSS px. */
export const AMP = { canvas: { w: 868, h: 344 }, render: { w: 930, h: 402 }, knobCx: [270, 350, 430, 510, 590, 670], knobCy: 268, labelY: 210 };
const BOARD = { w: 856, h: 224, pedal: { w: 124, h: 206 }, cab: { w: 140 }, gap: 14 };
/**
 * Two arrangements of the same parts: the pedalboard under the head (tall
 * notebooks) or beside it (wide, short ones). The drawer picks the one that
 * shows the controls larger.
 */
export type RigLayout = 'stack' | 'row';
export const RIG_LAYOUTS: Readonly<Record<RigLayout, { w: number; h: number; board: { x: number; y: number } }>> = {
  stack: { w: AMP.canvas.w, h: 356 + BOARD.h, board: { x: 6, y: 356 } },
  row: { w: AMP.canvas.w + 14 + BOARD.w, h: AMP.canvas.h, board: { x: AMP.canvas.w + 14, y: (AMP.canvas.h - BOARD.h) / 2 + 10 } },
};

const AMP_LABELS: Record<AmpKnob, string> = { gain: 'Gain', bass: 'Bass', mid: 'Middle', treble: 'Treble', presence: 'Presence', out: 'Output' };

function useRig(): [RigSettings, (change: (r: RigSettings) => RigSettings) => void] {
  const rig = useApp((s) => s.settings.rig);
  const update = useApp((s) => s.update);
  return [rig, (change) => update({ rig: change(useApp.getState().settings.rig) })];
}

function Pedal({ id, x, y }: { readonly id: PedalId; readonly x: number; readonly y: number }) {
  const [rig, setRig] = useRig();
  const spec = PEDAL_SPECS[id];
  const state = rig.pedals[id];
  const count = spec.knobs.length;
  const setKnob = (knob: string, v: number) => setRig((r) => ({ ...r, pedals: { ...r.pedals, [id]: { ...r.pedals[id], knobs: { ...r.pedals[id].knobs, [knob]: v } } } }));
  const toggle = () => setRig((r) => ({ ...r, pedals: { ...r.pedals, [id]: { ...r.pedals[id], on: !r.pedals[id].on } } }));
  return (
    <div className="v57-pedal" role="group" aria-label={`Pedale ${spec.name}`} data-testid={`pedal-${id}`} data-on={state.on ? '1' : '0'} data-ink={spec.darkInk ? 'dark' : 'light'}
      style={{ left: x, top: y + 10, width: BOARD.pedal.w, height: BOARD.pedal.h, ['--paint' as string]: spec.color }}>
      <span className="v57-pedal-led" data-on={state.on ? '1' : '0'} role="img" aria-label={state.on ? `${spec.name} acceso` : `${spec.name} spento`} data-testid={`pedal-${id}-led`} />
      {spec.knobs.map(([knob, label, def], i) => {
        const cx = BOARD.pedal.w / 2 + (i - (count - 1) / 2) * 38;
        return (
          <Fragment key={knob}>
            <RotaryKnob value={state.knobs[knob] ?? def} onChange={(v) => setKnob(knob, v)} label={`${spec.name} ${label}`} valueText={`${Math.round((state.knobs[knob] ?? def) / 10)} su 10`}
              bodySrc={knobBlack} bodySize={34} hitSize={30} pointer={{ length: 6, offset: 2, color: '#f0ece2', width: 2 }} cx={cx} cy={38} defaultValue={def} testId={`pedal-${id}-${knob}`} />
            <span className="v57-pedal-klab" style={{ left: cx, top: 58 }}>{label}</span>
          </Fragment>
        );
      })}
      <span className="v57-pedal-name">{spec.name}</span>
      <img src={footswitch} alt="" className="gtl-abs" style={{ left: (BOARD.pedal.w - 70) / 2, top: 118, width: 70, height: 70, transform: state.on ? 'scale(.985) translateY(1px)' : 'none' }} />
      <button type="button" className="gtl-hit v57-pedal-switch" style={{ left: (BOARD.pedal.w - 46) / 2, top: 130, width: 46, height: 46, borderRadius: '50%' }}
        aria-pressed={state.on} aria-label={`Interruttore ${spec.name}`} data-testid={`pedal-${id}-switch`} onClick={toggle} />
    </div>
  );
}

function CabUnit({ x, y }: { readonly x: number; readonly y: number }) {
  const [rig, setRig] = useRig();
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const loaded = rig.cab.model === 'file' && rig.cab.fileName;
  const choose = (model: CabModel) => {
    if (model === 'file') { file.current?.click(); return; }
    setRig((r) => ({ ...r, cab: { ...r.cab, model, fileName: '' } }));
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      await liveInput.loadCabinet(f, engine.audioOut().ctx);
      setRig((r) => ({ ...r, cab: { ...r.cab, model: 'file', fileName: f.name } }));
      setMessage('');
    } catch {
      setMessage('File non leggibile come risposta all’impulso.');
    }
  };
  return (
    <div className="v57-cab" role="group" aria-label="Cabinet IR" data-testid="rig-cab" data-on={rig.cab.on ? '1' : '0'}
      style={{ left: x, top: y + 10, width: BOARD.cab.w, height: BOARD.pedal.h }}>
      <span className="v57-cab-title">Cabinet IR</span>
      <span className="v57-pedal-led" data-on={rig.cab.on && !rig.amp.bypass ? '1' : '0'} role="img" aria-label={rig.cab.on ? 'Cabinet attivo' : 'Cabinet escluso'} />
      <div className="v57-cab-grille" aria-hidden="true" />
      <select className="v57-cab-select" aria-label="Risposta all’impulso del cabinet" data-testid="rig-cab-model" value={rig.cab.model}
        onChange={(e) => choose(e.target.value as CabModel)}>
        <option value="4x12">4x12 (sintetico)</option>
        <option value="1x12">1x12 (sintetico)</option>
        <option value="file">{loaded ? `File: ${rig.cab.fileName}` : 'Carica un file IR…'}</option>
      </select>
      <input ref={file} type="file" accept="audio/*,.wav,.aif,.aiff" hidden data-testid="rig-cab-file" onChange={(e) => void onFile(e.target.files?.[0])} />
      <button type="button" className="v57-cab-switch" aria-pressed={rig.cab.on} data-testid="rig-cab-switch"
        onClick={() => setRig((r) => ({ ...r, cab: { ...r.cab, on: !r.cab.on } }))}>{rig.cab.on ? 'Cab ON' : 'Cab OFF'}</button>
      {message ? <span className="v57-cab-msg" role="alert">{message}</span> : null}
    </div>
  );
}

/** What the rig does right now, read from the live graph (null while the input is off). */
function RigStatus() {
  const live = useLive();
  const rig = useApp((s) => s.settings.rig);
  const monitorVol = useApp((s) => s.settings.monitorVol);
  const [active, setActive] = useState<readonly string[]>([]);
  useEffect(() => { setActive(liveInput.rigState()?.active ?? []); }, [rig, live.state]);
  const on = live.state === 'on';
  return (
    <p className="v57-dvnote v57-rig-status" data-testid="rig-status">
      {on
        ? live.monitorOn
          ? `Elaborazione attiva sull’ascolto della chitarra: ${active.length ? active.join(' → ') : 'segnale diretto'}.`
          : 'Ingresso attivo, ascolto spento: il rig è pronto ma non si sente (usa le cuffie).'
        : 'Il rig elabora l’ascolto della chitarra: avvia l’ingresso.'}{' '}
      <button type="button" className="v57-linkbtn" data-testid="rig-input" disabled={live.state === 'starting'} onClick={() => (on ? liveInput.stop() : startInput())}>{on ? 'Ferma l’ingresso' : 'Avvia l’ingresso'}</button>
      {' · '}
      <button type="button" className="v57-linkbtn" data-testid="rig-monitor" aria-pressed={live.monitorOn} disabled={!on} onClick={() => liveInput.setMonitor(!live.monitorOn, monitorVol)}>{live.monitorOn ? 'Spegni l’ascolto' : 'Ascolta'}</button>
    </p>
  );
}

export function RigDevice({ scale, layout }: { readonly scale: number; readonly layout: RigLayout }) {
  const [rig, setRig] = useRig();
  const amp = rig.amp;
  const frame = RIG_LAYOUTS[layout];
  const by = frame.board.y;
  const preStart = frame.board.x + 6;
  const cabX = preStart + PRE_PEDALS.length * (BOARD.pedal.w + BOARD.gap);
  const postStart = cabX + BOARD.cab.w + BOARD.gap;
  return (
    <>
      <RigStatus />
      <div className="gtl-wrap" style={{ width: frame.w * scale, height: frame.h * scale }} data-testid="rig" data-layout={layout}>
        <div className="gtl-canvas" style={{ width: frame.w, height: frame.h, transform: `scale(${scale})` }}>
          <img className="gtl-body" src={ampBody} alt="" draggable={false} style={{ width: AMP.render.w, height: AMP.render.h }} />
          <span className="gtl-tape" style={{ left: 86, top: 26 }}>DSP interno · modello NAM: fase P4-01</span>
          <span className="gtl-a-lab" style={{ left: 89, top: AMP.labelY }}>Power</span>
          <span className="gtl-a-lab" style={{ left: 134, top: AMP.labelY }}>On</span>
          <span className="gtl-a-lab" style={{ left: 182, top: AMP.labelY }}>Input</span>
          <span className="gtl-a-lab" style={{ left: 752, top: AMP.labelY }}>Bypass</span>
          <img src={amp.power ? rockerOn : rockerOff} alt="" className="gtl-abs" style={{ left: 64, top: 239, width: 50, height: 62 }} />
          <button type="button" className="gtl-hit" style={{ left: 70, top: 244, width: 38, height: 52 }} aria-pressed={amp.power} aria-label="Accensione dell’amplificatore" data-testid="amp-power"
            onClick={() => setRig((r) => ({ ...r, amp: { ...r.amp, power: !r.amp.power } }))} />
          <span className="gtl-a-lamp" data-on={amp.power ? 1 : 0} data-testid="amp-lamp" />
          <img src={amp.bypass ? toggleDown : toggleUp} alt="" className="gtl-abs" style={{ left: 732, top: 238, width: 40, height: 60 }} />
          <button type="button" className="gtl-hit" style={{ left: 734, top: 240, width: 36, height: 56 }} aria-pressed={amp.bypass} aria-label="Bypass di amplificatore e cabinet" data-testid="amp-bypass"
            onClick={() => setRig((r) => ({ ...r, amp: { ...r.amp, bypass: !r.amp.bypass } }))} />
          {AMP_KNOB_IDS.map((id, i) => (
            <Fragment key={id}>
              <span className="gtl-a-lab" style={{ left: AMP.knobCx[i], top: AMP.labelY }}>{AMP_LABELS[id]}</span>
              <RotaryKnob value={amp.knobs[id]} label={`Amplificatore ${AMP_LABELS[id]}`} valueText={`${Math.round(amp.knobs[id] / 10)} su 10`}
                onChange={(v) => setRig((r) => ({ ...r, amp: { ...r.amp, knobs: { ...r.amp.knobs, [id]: v } } }))}
                bodySrc={knobGold} bodySize={72} hitSize={52} pointer={{ length: 10, offset: 4, color: '#efe3bd' }} cx={AMP.knobCx[i] ?? 0} cy={AMP.knobCy} defaultValue={50} testId={`amp-${id}`} />
            </Fragment>
          ))}
          <div className="v57-board-plate" aria-hidden="true" style={{ left: frame.board.x, top: by, width: BOARD.w, height: BOARD.h }} />
          <span className="v57-board-lab" style={{ left: preStart, top: by - 2 }}>Pre</span>
          <span className="v57-board-lab" style={{ left: postStart, top: by - 2 }}>Post</span>
          {PRE_PEDALS.map((id, i) => <Pedal key={id} id={id} x={preStart + i * (BOARD.pedal.w + BOARD.gap)} y={by} />)}
          <CabUnit x={cabX} y={by} />
          {POST_PEDALS.map((id, i) => <Pedal key={id} id={id} x={postStart + i * (BOARD.pedal.w + BOARD.gap)} y={by} />)}
        </div>
      </div>
    </>
  );
}
