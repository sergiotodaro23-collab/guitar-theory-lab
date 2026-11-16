/**
 * Guitar Rig parts (D-42) shared by the Studio V6 rack: the store hook and
 * the pedal. Every control writes `settings.rig`; the audio graph
 * (src/audio/guitarRig.ts) follows it on the listening branch. Pedals are
 * live HTML controls over rendered pictures (tools/blender, specs/pedals.json):
 * body per pedal, shared knob strip, LED and footswitch in two states.
 */
import { Fragment } from 'react';
import { PEDAL_SPECS, type AmpKnob, type PedalId, type RigSettings } from '../../../app/rig';
import { useApp } from '../../../app/store';
import { RotaryKnob } from './RotaryKnob';
import { PEDALS_HW } from '../v6/hardware/pedals.generated';
import bodyComp from '../v6/hardware/assets/pedal-comp@2x.webp';
import bodyFuzz from '../v6/hardware/assets/pedal-fuzz@2x.webp';
import bodyDrive from '../v6/hardware/assets/pedal-drive@2x.webp';
import bodyEq from '../v6/hardware/assets/pedal-eq@2x.webp';
import bodyChorus from '../v6/hardware/assets/pedal-chorus@2x.webp';
import bodyDelay from '../v6/hardware/assets/pedal-delay@2x.webp';
import bodyReverb from '../v6/hardware/assets/pedal-reverb@2x.webp';
import knobStrip from '../v6/hardware/assets/pedal-knob-strip@2x.webp';
import ledOff from '../v6/hardware/assets/pedal-led-off@2x.webp';
import ledOn from '../v6/hardware/assets/pedal-led-on@2x.webp';
import switchUp from '../v6/hardware/assets/pedal-switch-up@2x.webp';
import switchDown from '../v6/hardware/assets/pedal-switch-down@2x.webp';

/** Geometry of the rendered pedals: the numbers Blender built the pictures from (tools/blender/specs/pedals.json). */
const HW = PEDALS_HW.spec;
const BODY: Record<PedalId, string> = { comp: bodyComp, fuzz: bodyFuzz, drive: bodyDrive, eq: bodyEq, chorus: bodyChorus, delay: bodyDelay, reverb: bodyReverb };
const BODY_BOX = PEDALS_HW.assets['body-comp'];

/** One pedal enclosure, in CSS px. */
export const PEDAL_SIZE = HW.size;
const BOARD = { pedal: PEDAL_SIZE };

export const AMP_LABELS: Record<AmpKnob, string> = { gain: 'Gain', bass: 'Bass', mid: 'Middle', treble: 'Treble', presence: 'Presence', out: 'Output' };

export function useRig(): [RigSettings, (change: (r: RigSettings) => RigSettings) => void] {
  const rig = useApp((s) => s.settings.rig);
  const update = useApp((s) => s.update);
  return [rig, (change) => update({ rig: change(useApp.getState().settings.rig) })];
}

export function Pedal({ id, x, y }: { readonly id: PedalId; readonly x: number; readonly y: number }) {
  const [rig, setRig] = useRig();
  const spec = PEDAL_SPECS[id];
  const state = rig.pedals[id];
  const count = spec.knobs.length;
  const setKnob = (knob: string, v: number) => setRig((r) => ({ ...r, pedals: { ...r.pedals, [id]: { ...r.pedals[id], knobs: { ...r.pedals[id].knobs, [knob]: v } } } }));
  const toggle = () => setRig((r) => ({ ...r, pedals: { ...r.pedals, [id]: { ...r.pedals[id], on: !r.pedals[id].on } } }));
  return (
    <div className="v57-pedal" role="group" aria-label={`Pedale ${spec.name}`} data-testid={`pedal-${id}`} data-on={state.on ? '1' : '0'} data-ink={spec.darkInk ? 'dark' : 'light'}
      style={{ left: x, top: y + 10, width: BOARD.pedal.w, height: BOARD.pedal.h }}>
      <img className="v57-pedal-body" src={BODY[id]} alt="" draggable={false} data-testid={`pedal-${id}-body`} style={{ left: BODY_BOX.offset[0], top: BODY_BOX.offset[1], width: BODY_BOX.css[0], height: BODY_BOX.css[1] }} />
      {spec.knobs.map(([knob, label, def], i) => {
        const cx = BOARD.pedal.w / 2 + (i - (count - 1) / 2) * HW.knobs.pitch;
        return (
          <Fragment key={knob}>
            <RotaryKnob value={state.knobs[knob] ?? def} onChange={(v) => setKnob(knob, v)} label={`${spec.name} ${label}`} valueText={`${Math.round((state.knobs[knob] ?? def) / 10)} su 10`}
              sprite={{ src: knobStrip, frames: HW.knobs.frames }} bodySize={HW.knobs.frame} hitSize={HW.knobs.hit} cx={cx} cy={HW.knobs.y} defaultValue={def} testId={`pedal-${id}-${knob}`} />
            <span className="v57-pedal-klab" style={{ left: cx, top: HW.labelY }}>{label}</span>
          </Fragment>
        );
      })}
      <span className="v57-pedal-name" style={{ top: HW.name.y, height: HW.name.h, lineHeight: `${HW.name.h}px` }}>{spec.name}</span>
      <span className="v57-pedal-led" data-on={state.on ? '1' : '0'} role="img" aria-label={state.on ? `${spec.name} acceso` : `${spec.name} spento`} data-testid={`pedal-${id}-led`}
        style={{ left: HW.led.x, top: HW.led.y, width: HW.led.frame, height: HW.led.frame, backgroundImage: `url(${state.on ? ledOn : ledOff})` }} />
      <img src={state.on ? switchDown : switchUp} alt="" className="gtl-abs" draggable={false} style={{ left: HW.switch.x - HW.switch.frame / 2, top: HW.switch.y - HW.switch.frame / 2, width: HW.switch.frame, height: HW.switch.frame }} />
      <button type="button" className="gtl-hit v57-pedal-switch" style={{ left: HW.switch.x - HW.switch.hit / 2, top: HW.switch.y - HW.switch.hit / 2, width: HW.switch.hit, height: HW.switch.hit, borderRadius: '50%' }}
        aria-pressed={state.on} aria-label={`Interruttore ${spec.name}`} data-testid={`pedal-${id}-switch`} onClick={toggle} />
    </div>
  );
}
