/**
 * Guitar Rig parts (D-42) shared by the Studio V6 rack: the store hook and
 * the pedal. Every control writes `settings.rig`; the audio graph
 * (src/audio/guitarRig.ts) follows it on the listening branch. Pedals are
 * skeuomorphic HTML over CSS enclosures with the rendered knob and
 * footswitch: nothing is flattened into an image.
 */
import { Fragment } from 'react';
import { PEDAL_SPECS, type AmpKnob, type PedalId, type RigSettings } from '../../../app/rig';
import { useApp } from '../../../app/store';
import { RotaryKnob } from './RotaryKnob';
import knobBlack from './assets/knob-black@2x.png';
import footswitch from './assets/footswitch@2x.png';

/** One pedal enclosure, in CSS px. */
export const PEDAL_SIZE = { w: 124, h: 206 } as const;
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
