/**
 * Compact mixer: the eight strips in one row of knobs, under the notebook.
 * The same strips as the extended mixer (`useMixerStrips`): same values, same
 * setters, same meters. Per channel: name, a knob for the volume (the
 * rendered pedal knob, with slider semantics and the keyboard of every knob
 * in the Studio), a ring of lamps for the measured level, the value in dB and
 * the keys the channel has. The row never wraps: when it does not fit, it
 * scrolls sideways inside the mixer.
 */
import { RotaryKnob } from '../v57/RotaryKnob';
import { PEDALS_HW } from './hardware/pedals.generated';
import knobStrip from './hardware/assets/pedal-knob-strip@2x.webp';
import { MIXER_VARS } from './hardware/mixerVars';
import { FULL_SCALE, MixerModeSwitch, SEGMENTS, db, useMixerStrips, type StripModel } from './Mixer';

const KNOB = PEDALS_HW.spec.knobs;
/** The dial: knob in the middle, level lamps around it. CSS px. */
const DIAL = 58;
const RING_R = 25.5;
const SWEEP = KNOB.sweep;

const polar = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [DIAL / 2 + r * Math.cos(a), DIAL / 2 + r * Math.sin(a)];
};

/** Lamps around the knob over its own travel: lit up to the measured level. Not the volume: that is the knob's pointer. */
function LevelRing({ level, label, testId }: { readonly level: number; readonly label: string; readonly testId: string }) {
  const lit = Math.min(SEGMENTS, Math.round((level / FULL_SCALE) * SEGMENTS));
  return (
    <svg className="v6-mc-ring" width={DIAL} height={DIAL} viewBox={`0 0 ${DIAL} ${DIAL}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((lit / SEGMENTS) * 100)} data-testid={testId}>
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const n = i + 1;
        const [x, y] = polar(-SWEEP / 2 + (SWEEP * (i + 0.5)) / SEGMENTS, RING_R);
        return <circle key={n} cx={x} cy={y} r={1.9} data-zone={n > 12 ? 'hot' : n > 9 ? 'warm' : 'ok'} data-on={n <= lit ? '1' : '0'} />;
      })}
    </svg>
  );
}

function Cell({ strip }: { readonly strip: StripModel }) {
  return (
    <div className="v6-mc-cell" role="group" aria-label={strip.label} data-kind={strip.kind} data-strip={strip.id}>
      <span className="v6-mx-name"><i className="v6-mx-led" data-on={strip.open ? '1' : '0'} aria-hidden="true" title="Canale aperto (non indica la presenza di segnale)" />{strip.label}</span>
      <div className="v6-mc-mid">
        <div className="v6-mc-dial" style={{ width: DIAL, height: DIAL }}>
          {strip.level !== null ? <LevelRing level={strip.level} label={strip.meterLabel} testId={`meter-${strip.id}`} /> : null}
          <RotaryKnob value={Math.round(strip.value * 100)} onChange={(v) => strip.set(v / 100)} label={`Volume ${strip.label}`} valueText={db(strip.value)}
            sprite={{ src: knobStrip, frames: KNOB.frames }} bodySize={KNOB.frame} hitSize={KNOB.hit + 4} cx={DIAL / 2} cy={DIAL / 2} testId={`mixknob-${strip.id}`} />
        </div>
        {strip.keys.length ? (
          <div className="v6-mc-keys">
            {strip.keys.map((k) => (
              <button key={k.testId} type="button" className="v6-mx-key" data-tone={k.tone} aria-pressed={k.on} aria-label={k.label} title={k.title ?? k.label} disabled={k.disabled ?? false} data-testid={k.testId} onClick={k.press}>{k.short}</button>
            ))}
          </div>
        ) : null}
      </div>
      <span className="v6-mx-read">{db(strip.value)}</span>
    </div>
  );
}

export function MixerCompact() {
  const strips = useMixerStrips();
  return (
    <section className="v6-mc" aria-label="Mixer" data-testid="v57-mixer" data-mode="compact" style={MIXER_VARS}>
      <MixerModeSwitch />
      <div className="v6-mc-row" data-testid="mixer-compact-row" tabIndex={0} role="group" aria-label="Canali del mixer">
        {strips.map((strip) => <Cell key={strip.id} strip={strip} />)}
      </div>
    </section>
  );
}
