/**
 * Compact mixer: the eight strips in one row of knobs, under the notebook.
 * The same strips as the extended mixer (`useMixerStrips`): same values, same
 * setters, same meters. Per channel: name, a knob for the volume (the
 * rendered pedal knob, with slider semantics and the keyboard of every knob
 * in the Studio), an arc of coloured segments for the measured level (the
 * owner's reference: green, yellow, orange, red), the value in dB and the
 * keys the channel has, beside the dial so the row is low and the notebook
 * above it keeps its room. The row never wraps: when it does not fit, it
 * scrolls sideways inside the mixer.
 */
import { useEffect, useRef, useState } from 'react';
import { RotaryKnob } from '../v57/RotaryKnob';
import { PEDALS_HW } from './hardware/pedals.generated';
import knobStrip from './hardware/assets/pedal-knob-strip@2x.webp';
import { MIXER_VARS } from './hardware/mixerVars';
import { FULL_SCALE, MixerModeSwitch, SEGMENTS, db, useMixerStrips, type StripModel } from './Mixer';

const KNOB = PEDALS_HW.spec.knobs;
/** The dial: knob in the middle, the level arc around it. CSS px. */
const DIAL = 46;
const ARC_R = 20.6;
const ARC_WIDTH = 3.6;
const SWEEP = KNOB.sweep;
/**
 * The level arc of the owner's reference: a band of segments round the knob, green on the left, through yellow at the top,
 * to orange and red on the right. Eight segments, as in the reference, over the knob's own travel, with a small gap between them.
 */
const ARC_COLOURS = ['#178a34', '#2fb344', '#9cc832', '#e6d02a', '#f3a623', '#f07a1f', '#e8401c', '#cf1f16'] as const;
const ARC_GAP = 4;

const polar = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [DIAL / 2 + r * Math.cos(a), DIAL / 2 + r * Math.sin(a)];
};
const arc = (from: number, to: number): string => {
  const [x0, y0] = polar(from, ARC_R);
  const [x1, y1] = polar(to, ARC_R);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${ARC_R} ${ARC_R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

/**
 * The measured level, as lit segments of the arc. It is not the volume: the volume is the knob's pointer and the dB readout.
 * The level comes from the same analyser as the extended mixer's meter, through the same 14 steps, shown on the eight segments.
 */
function LevelArc({ level, label, testId }: { readonly level: number; readonly label: string; readonly testId: string }) {
  const steps = Math.min(SEGMENTS, Math.round((level / FULL_SCALE) * SEGMENTS));
  const lit = Math.round((steps / SEGMENTS) * ARC_COLOURS.length);
  const span = SWEEP / ARC_COLOURS.length;
  return (
    <svg className="v6-mc-ring" width={DIAL} height={DIAL} viewBox={`0 0 ${DIAL} ${DIAL}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((steps / SEGMENTS) * 100)} data-lit={lit} data-testid={testId}>
      {ARC_COLOURS.map((colour, i) => (
        <path key={colour} d={arc(-SWEEP / 2 + span * i + ARC_GAP / 2, -SWEEP / 2 + span * (i + 1) - ARC_GAP / 2)} stroke={colour} strokeWidth={ARC_WIDTH} fill="none" style={{ color: colour }} data-on={i < lit ? '1' : '0'} />
      ))}
    </svg>
  );
}

function Cell({ strip }: { readonly strip: StripModel }) {
  return (
    <div className="v6-mc-cell" role="group" aria-label={strip.label} data-kind={strip.kind} data-strip={strip.id}>
      <div className="v6-mc-dial" style={{ width: DIAL, height: DIAL }}>
        {strip.level !== null ? <LevelArc level={strip.level} label={strip.meterLabel} testId={`meter-${strip.id}`} /> : null}
        <RotaryKnob value={Math.round(strip.value * 100)} onChange={(v) => strip.set(v / 100)} label={`Volume ${strip.label}`} valueText={db(strip.value)}
          sprite={{ src: knobStrip, frames: KNOB.frames }} bodySize={KNOB.frame - 8} hitSize={KNOB.hit} cx={DIAL / 2} cy={DIAL / 2} testId={`mixknob-${strip.id}`} />
      </div>
      <div className="v6-mc-side">
        <span className="v6-mx-name"><i className="v6-mx-led" data-on={strip.open ? '1' : '0'} aria-hidden="true" title="Canale aperto (non indica la presenza di segnale)" />{strip.label}</span>
        <span className="v6-mx-read">{db(strip.value)}</span>
        {strip.keys.length ? (
          <div className="v6-mc-keys">
            {strip.keys.map((k) => (
              <button key={k.testId} type="button" className="v6-mx-key" data-tone={k.tone} aria-pressed={k.on} aria-label={k.label} title={k.title ?? k.label} disabled={k.disabled ?? false} data-testid={k.testId} onClick={k.press}>{k.short}</button>
            ))}
          </div>
        ) : <div className="v6-mc-keys" aria-hidden="true" />}
      </div>
    </div>
  );
}

/** Where the row is scrolled to, as fractions of its content: the thumb of the bar under it. Null when everything fits. */
function useScrollThumb() {
  const row = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const read = () => setThumb(el.scrollWidth > el.clientWidth + 1 ? { left: el.scrollLeft / el.scrollWidth, width: el.clientWidth / el.scrollWidth } : null);
    read();
    el.addEventListener('scroll', read, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    observer?.observe(el);
    return () => { el.removeEventListener('scroll', read); observer?.disconnect(); };
  }, []);
  return [row, thumb] as const;
}

export function MixerCompact() {
  const strips = useMixerStrips();
  const [row, thumb] = useScrollThumb();
  return (
    <section className="v6-mc" aria-label="Mixer" data-testid="v57-mixer" data-mode="compact" style={MIXER_VARS}>
      <MixerModeSwitch />
      <div className="v6-mc-main">
        <div className="v6-mc-row" ref={row} data-testid="mixer-compact-row" tabIndex={0} role="group" aria-label="Canali del mixer">
          {strips.map((strip) => <Cell key={strip.id} strip={strip} />)}
        </div>
        {/* Our own bar: the browser's may be an overlay that hides. Drawn only when the channels do not fit; the row itself scrolls (wheel, drag, keys). */}
        <div className="v6-mc-bar" aria-hidden="true" data-testid="mixer-compact-bar" data-on={thumb ? '1' : '0'}>
          {thumb ? <i style={{ left: `${thumb.left * 100}%`, width: `${thumb.width * 100}%` }} /> : null}
        </div>
      </div>
    </section>
  );
}
