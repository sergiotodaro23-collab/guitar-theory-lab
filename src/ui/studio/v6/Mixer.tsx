/**
 * Studio V6 mixer: a console as wide as the notebook, with long faders and a
 * level meter on every channel. Faders, mutes and solos write the same mix
 * settings as before (the engine applies them to the real channel gains);
 * the meters read analysers placed after each fader. Nothing is simulated:
 * a channel that plays nothing shows nothing.
 *
 * The eight strips are described once (`useMixerStrips`): this extended face
 * and the compact one (MixerCompact.tsx) draw the same values, write through
 * the same setters and read the same meters, so they cannot disagree.
 */
import { useEffect, useState } from 'react';
import { engine } from '../../../app/engine';
import { MIX_CHANNELS, channelVolume, type MixChannel, type SoloTarget } from '../../../app/settings';
import { useApp } from '../../../app/store';
import { liveInput, useLive } from '../../../audio/liveInput';
import { useStudioUi } from '../v57/uiStore';
import { MIXER_VARS } from './hardware/mixerVars';

const CHANNELS = [
  { id: 'click', label: 'Click', vol: 'volClick', mute: 'muteClick' },
  { id: 'notes', label: 'Note', vol: 'volNotes', mute: 'muteNotes' },
  { id: 'comp', label: 'Accordi', vol: 'volComp', mute: 'muteComp' },
  { id: 'bass', label: 'Basso', vol: 'volBass', mute: 'muteBass' },
  { id: 'drums', label: 'Batteria', vol: 'volDrums', mute: 'muteDrums' },
] as const;

export const db = (gain: number) => (gain === 0 ? '−∞ dB' : `${(20 * Math.log10(gain)).toFixed(1)} dB`);
/** dB marks beside the fader, each at the height where the fader gives that gain (the fader is linear in gain). */
const SCALE_MARKS: readonly (readonly [string, number])[] = [['0', 1], ['−3', 10 ** (-3 / 20)], ['−6', 0.5], ['−12', 0.25], ['−∞', 0]];
export const SEGMENTS = 14;
/** RMS that fills a meter: most material sits around the middle. */
export const FULL_SCALE = 0.35;

type Levels = Readonly<Record<MixChannel | 'master', number>>;
const SILENT: Levels = { click: 0, notes: 0, comp: 0, bass: 0, drums: 0, master: 0 };

/** Channel and master levels from the audio graph, with a hardware-like release. */
export function useLevels(): Levels {
  const [levels, setLevels] = useState<Levels>(SILENT);
  useEffect(() => {
    let frame = 0;
    let held: Record<string, number> = { ...SILENT };
    const read = () => {
      const next: Record<string, number> = {};
      let changed = false;
      for (const id of MIX_CHANNELS) next[id] = Math.max(engine.channelLevel(id), (held[id] ?? 0) * 0.88);
      next.master = Math.max(engine.outputLevel(), (held.master ?? 0) * 0.88);
      for (const key of Object.keys(next)) {
        if ((next[key] ?? 0) < 0.0005) next[key] = 0;
        if (Math.round(((next[key] ?? 0) / FULL_SCALE) * SEGMENTS) !== Math.round(((held[key] ?? 0) / FULL_SCALE) * SEGMENTS)) changed = true;
      }
      held = next;
      if (changed) setLevels(next as Levels);
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  }, []);
  return levels;
}

function Meter({ level, label, testId }: { readonly level: number; readonly label: string; readonly testId?: string }) {
  const lit = Math.min(SEGMENTS, Math.round((level / FULL_SCALE) * SEGMENTS));
  return (
    <div className="v6-mx-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((lit / SEGMENTS) * 100)} data-testid={testId}>
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const n = SEGMENTS - i;
        return <i key={n} data-zone={n > 12 ? 'hot' : n > 9 ? 'warm' : 'ok'} data-on={n <= lit ? '1' : '0'} />;
      })}
    </div>
  );
}

interface StripProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly open: boolean;
  readonly level: number | null;
  readonly meterLabel?: string;
  readonly onChange: (v: number) => void;
  readonly kind?: 'channel' | 'group' | 'guitar' | 'master';
  readonly children?: React.ReactNode;
}

function Strip({ id, label, value, open, level, meterLabel, onChange, kind = 'channel', children }: StripProps) {
  return (
    <div className="v6-mx-strip" role="group" aria-label={label} data-kind={kind} data-strip={id}>
      <span className="v6-mx-name"><i className="v6-mx-led" data-on={open ? '1' : '0'} aria-hidden="true" title="Canale aperto (non indica la presenza di segnale)" />{label}</span>
      <div className="v6-mx-run">
        <span className="v6-mx-scale" aria-hidden="true">{SCALE_MARKS.map(([text, gain]) => <b key={text} style={{ ['--g' as string]: gain }}>{text}</b>)}</span>
        <span className="v6-mx-slot" style={{ ['--v' as string]: value }}>
          <input type="range" min={0} max={1} step={0.01} value={value} aria-label={`Volume ${label}`} aria-orientation="vertical" aria-valuetext={db(value)}
            data-testid={`fader-${id}`} onChange={(e) => onChange(Number(e.target.value))} />
        </span>
        {level !== null ? <Meter level={level} label={meterLabel ?? `Livello ${label}`} testId={`meter-${id}`} /> : <span className="v6-mx-meter" data-empty="1" aria-hidden="true" />}
      </div>
      <div className="v6-mx-keys">{children}</div>
      <span className="v6-mx-read">{db(value)}</span>
    </div>
  );
}

function Key({ on, label, text, tone, testId, disabled, title, onClick }: { readonly on: boolean; readonly label: string; readonly text: string; readonly tone: 'mute' | 'solo'; readonly testId?: string; readonly disabled?: boolean; readonly title?: string; readonly onClick: () => void }) {
  return <button type="button" className="v6-mx-key" data-tone={tone} aria-pressed={on} aria-label={label} title={title ?? label} disabled={disabled} data-testid={testId} onClick={onClick}>{text}</button>;
}

/** A Mute, Solo or Listen key of a strip: what it shows and what it does. */
export interface StripKey {
  readonly tone: 'mute' | 'solo';
  readonly on: boolean;
  readonly label: string;
  readonly text: string;
  /** One letter for the compact face. */
  readonly short: string;
  readonly testId: string;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly press: () => void;
}

export interface StripModel {
  readonly id: string;
  readonly label: string;
  readonly kind: 'channel' | 'group' | 'guitar' | 'master';
  /** Linear gain 0–1, as stored. */
  readonly value: number;
  readonly set: (v: number) => void;
  /** The channel lets signal through (not muted, not at zero): the name's lamp. */
  readonly open: boolean;
  /** Measured level, or null where no meter exists (the Backing group). */
  readonly level: number | null;
  readonly meterLabel: string;
  readonly keys: readonly StripKey[];
}

/** The eight strips of the mixer, from the settings and the audio graph. Backing has no meter, the guitar listens instead of muting, the master has no keys: as the engine has them. */
export function useMixerStrips(): readonly StripModel[] {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const inputOn = useLive((l) => l.state === 'on');
  const monitorOn = useLive((l) => l.monitorOn);
  const inputLevel = useLive((l) => l.level);
  const levels = useLevels();
  const solo = (target: SoloTarget) => update({ soloChannel: s.soloChannel === target ? '' : target });
  const channels: StripModel[] = CHANNELS.map(({ id, label, vol, mute }) => ({
    id, label, kind: 'channel', value: s[vol], set: (v: number) => update({ [vol]: v }), open: channelVolume(s, id) > 0, level: levels[id], meterLabel: `Livello ${label}`,
    keys: [
      { tone: 'mute', on: s[mute], label: `Muto ${label}`, text: 'Mute', short: 'M', testId: `mute-${id}`, press: () => update({ [mute]: !s[mute] }) },
      { tone: 'solo', on: s.soloChannel === id, label: `Solo ${label}`, text: 'Solo', short: 'S', testId: `solo-${id}`, press: () => solo(id) },
    ],
  }));
  return [
    ...channels,
    {
      id: 'backing', label: 'Backing', kind: 'group', value: s.volBacking, set: (v) => update({ volBacking: v }), open: !s.muteBacking && s.volBacking > 0, level: null, meterLabel: 'Livello Backing',
      keys: [
        { tone: 'mute', on: s.muteBacking, label: 'Muto Backing', text: 'Mute', short: 'M', testId: 'mute-backing', title: 'Muto di accordi, basso, batteria e backing track', press: () => update({ muteBacking: !s.muteBacking }) },
        { tone: 'solo', on: s.soloChannel === 'backing', label: 'Solo Backing', text: 'Solo', short: 'S', testId: 'solo-backing', title: 'Solo di accordi, basso e batteria: click e note tacciono', press: () => solo('backing') },
      ],
    },
    {
      id: 'guitar', label: 'Chitarra', kind: 'guitar', value: s.monitorVol, set: (v) => { update({ monitorVol: v }); if (monitorOn) liveInput.setMonitor(true, v); }, open: monitorOn && s.monitorVol > 0,
      level: inputOn ? inputLevel : 0, meterLabel: 'Livello d’ingresso della chitarra (prima dell’ascolto)',
      keys: [
        { tone: 'mute', on: monitorOn, label: 'Ascolta la chitarra', text: 'Ascolta', short: 'A', testId: 'mixer-listen', disabled: !inputOn,
          title: inputOn ? 'Ascolto manuale: usa le cuffie.' : 'Ascolto manuale: usa le cuffie. Avvia prima l’ingresso chitarra.', press: () => liveInput.setMonitor(!monitorOn, s.monitorVol) },
      ],
    },
    { id: 'master', label: 'Master', kind: 'master', value: s.volMaster, set: (v) => update({ volMaster: v }), open: s.volMaster > 0, level: levels.master, meterLabel: 'Livello in uscita', keys: [] },
  ];
}

/** Extended | Compact, inside the open drawer only. */
export function MixerModeSwitch() {
  const mode = useStudioUi((u) => u.mixerMode);
  const setMode = useStudioUi((u) => u.setMixerMode);
  return (
    <div className="v6-mxmode" role="radiogroup" aria-label="Modalità del mixer" data-testid="mixer-mode">
      {([['extended', 'Esteso'], ['compact', 'Compatto']] as const).map(([id, text]) => (
        <button key={id} type="button" role="radio" aria-checked={mode === id} data-testid={`mixer-mode-${id}`} onClick={() => setMode(id)}>{text}</button>
      ))}
    </div>
  );
}

export function Mixer() {
  const strips = useMixerStrips();
  const bank = (items: readonly StripModel[]) => items.map((st) => (
    <Strip key={st.id} id={st.id} kind={st.kind} label={st.label} value={st.value} open={st.open} level={st.level} meterLabel={st.meterLabel} onChange={st.set}>
      {st.keys.map((k) => <Key key={k.testId} tone={k.tone} on={k.on} label={k.label} text={k.text} testId={k.testId} disabled={k.disabled ?? false} title={k.title ?? k.label} onClick={k.press} />)}
    </Strip>
  ));
  return (
    <section className="v6-mx" aria-label="Mixer" data-testid="v57-mixer" data-mode="extended" style={MIXER_VARS}>
      <div className="v6-mx-banks">
        <div className="v6-mx-bank" role="group" aria-label="Canali">{bank(strips.filter((st) => st.kind === 'channel'))}</div>
        <div className="v6-mx-bank" role="group" aria-label="Gruppi e uscita">{bank(strips.filter((st) => st.kind !== 'channel'))}</div>
      </div>
      <p className="v6-mx-note">Misuratori: livello reale di ogni canale dopo il fader; quello della chitarra legge l’ingresso. Il fader Backing regola insieme accordi, basso, batteria e backing track. Solo non tocca la chitarra.</p>
      <MixerModeSwitch />
    </section>
  );
}
