/**
 * Studio V6 mixer: a console as wide as the notebook, with long faders and a
 * level meter on every channel. Faders, mutes and solos write the same mix
 * settings as before (the engine applies them to the real channel gains);
 * the meters read analysers placed after each fader. Nothing is simulated:
 * a channel that plays nothing shows nothing.
 */
import { useEffect, useState } from 'react';
import { engine } from '../../../app/engine';
import { MIX_CHANNELS, channelVolume, type MixChannel, type SoloTarget } from '../../../app/settings';
import { useApp } from '../../../app/store';
import { liveInput, useLive } from '../../../audio/liveInput';

const CHANNELS = [
  { id: 'click', label: 'Click', vol: 'volClick', mute: 'muteClick' },
  { id: 'notes', label: 'Note', vol: 'volNotes', mute: 'muteNotes' },
  { id: 'comp', label: 'Accordi', vol: 'volComp', mute: 'muteComp' },
  { id: 'bass', label: 'Basso', vol: 'volBass', mute: 'muteBass' },
  { id: 'drums', label: 'Batteria', vol: 'volDrums', mute: 'muteDrums' },
] as const;

const db = (gain: number) => (gain === 0 ? '−∞ dB' : `${(20 * Math.log10(gain)).toFixed(1)} dB`);
/** dB marks beside the fader, each at the height where the fader gives that gain (the fader is linear in gain). */
const SCALE_MARKS: readonly (readonly [string, number])[] = [['0', 1], ['−3', 10 ** (-3 / 20)], ['−6', 0.5], ['−12', 0.25], ['−∞', 0]];
const SEGMENTS = 14;
/** RMS that fills a meter: most material sits around the middle. */
const FULL_SCALE = 0.35;

type Levels = Readonly<Record<MixChannel | 'master', number>>;
const SILENT: Levels = { click: 0, notes: 0, comp: 0, bass: 0, drums: 0, master: 0 };

/** Channel and master levels from the audio graph, with a hardware-like release. */
function useLevels(): Levels {
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

export function Mixer() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const inputOn = useLive((l) => l.state === 'on');
  const monitorOn = useLive((l) => l.monitorOn);
  const inputLevel = useLive((l) => l.level);
  const levels = useLevels();
  const solo = (target: SoloTarget) => update({ soloChannel: s.soloChannel === target ? '' : target });
  return (
    <section className="v6-mx" aria-label="Mixer" data-testid="v57-mixer">
      <div className="v6-mx-banks">
      <div className="v6-mx-bank" role="group" aria-label="Canali">
        {CHANNELS.map(({ id, label, vol, mute }) => (
          <Strip key={id} id={id} label={label} value={s[vol]} open={channelVolume(s, id) > 0} level={levels[id]} onChange={(v) => update({ [vol]: v })}>
            <Key tone="mute" on={s[mute]} label={`Muto ${label}`} text="Mute" testId={`mute-${id}`} onClick={() => update({ [mute]: !s[mute] })} />
            <Key tone="solo" on={s.soloChannel === id} label={`Solo ${label}`} text="Solo" testId={`solo-${id}`} onClick={() => solo(id)} />
          </Strip>
        ))}
      </div>
      <div className="v6-mx-bank" role="group" aria-label="Gruppi e uscita">
        <Strip id="backing" kind="group" label="Backing" value={s.volBacking} open={!s.muteBacking && s.volBacking > 0} level={null} onChange={(v) => update({ volBacking: v })}>
          <Key tone="mute" on={s.muteBacking} label="Muto Backing" text="Mute" testId="mute-backing" title="Muto di accordi, basso, batteria e backing track" onClick={() => update({ muteBacking: !s.muteBacking })} />
          <Key tone="solo" on={s.soloChannel === 'backing'} label="Solo Backing" text="Solo" testId="solo-backing" title="Solo di accordi, basso e batteria: click e note tacciono" onClick={() => solo('backing')} />
        </Strip>
        <Strip id="guitar" kind="guitar" label="Chitarra" value={s.monitorVol} open={monitorOn && s.monitorVol > 0} level={inputOn ? inputLevel : 0} meterLabel="Livello d’ingresso della chitarra (prima dell’ascolto)"
          onChange={(v) => { update({ monitorVol: v }); if (monitorOn) liveInput.setMonitor(true, v); }}>
          <Key tone="mute" on={monitorOn} label="Ascolta la chitarra" text="Ascolta" testId="mixer-listen" disabled={!inputOn}
            title={inputOn ? 'Ascolto manuale: usa le cuffie.' : 'Ascolto manuale: usa le cuffie. Avvia prima l’ingresso chitarra.'} onClick={() => liveInput.setMonitor(!monitorOn, s.monitorVol)} />
        </Strip>
        <Strip id="master" kind="master" label="Master" value={s.volMaster} open={s.volMaster > 0} level={levels.master} meterLabel="Livello in uscita" onChange={(v) => update({ volMaster: v })} />
      </div>
      </div>
      <p className="v6-mx-note">Misuratori: livello reale di ogni canale dopo il fader; quello della chitarra legge l’ingresso. Il fader Backing regola insieme accordi, basso, batteria e backing track. Solo non tocca la chitarra.</p>
    </section>
  );
}
