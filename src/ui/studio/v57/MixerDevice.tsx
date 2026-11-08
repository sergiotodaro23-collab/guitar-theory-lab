/** Adapted from GTL-V5.7-handoff/react/src/devices/MixerDevice.tsx.
 * Same rendered chassis/coordinates, controlled by production gains (0..1).
 * No audio clock, simulated meters or private/persisted copy of the mix.
 */
import { useEffect, useRef, useState } from 'react';
import { engine } from '../../../app/engine';
import { channelVolume, type MixChannel } from '../../../app/settings';
import { useApp } from '../../../app/store';
import { liveInput, useLive } from '../../../audio/liveInput';
import mixerBody from './assets/mixer-body@2x.webp';
import faderCap from './assets/fader-cap@2x.png';
import faderCapMaster from './assets/fader-cap-master@2x.png';
import btnOff from './assets/btn-off@2x.png';
import btnMuteOn from './assets/btn-mute-on@2x.png';
import btnSoloOn from './assets/btn-solo-on@2x.png';
import './mixer.css';

const CHANNELS = [
  { id: 'click', label: 'Click', vol: 'volClick', mute: 'muteClick' },
  { id: 'notes', label: 'Note', vol: 'volNotes', mute: 'muteNotes' },
  { id: 'comp', label: 'Accordi', vol: 'volComp', mute: 'muteComp' },
  { id: 'bass', label: 'Basso', vol: 'volBass', mute: 'muteBass' },
  { id: 'drums', label: 'Batteria', vol: 'volDrums', mute: 'muteDrums' },
] as const;
const CENTRES = [85, 183, 281, 379, 477, 575, 692] as const;
const db = (gain: number) => gain === 0 ? '−∞ dB' : `${(20 * Math.log10(gain)).toFixed(1)} dB`;

/** Only the master is metered: the engine has no per-bus analysers. */
function MasterMeter() {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      // Auditioned notes and the diagnostic tone can sound with transport stopped.
      setLevel(Math.min(1, engine.outputLevel() / 0.5));
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <div className="v57-output meter" role="meter" aria-label="Livello in uscita" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
    {Array.from({ length: 12 }, (_, i) => <span key={i} className={`meter-led meter-${i < 2 ? 'hot' : i < 5 ? 'warm' : 'ok'} ${12 - i <= Math.round(level * 12) ? 'is-on' : ''}`} />)}
    <span className="meter-label">Out</span>
  </div>;
}

interface Strip {
  id: MixChannel | 'guitar' | 'master';
  label: string;
  value: number;
  active: boolean;
  muted: boolean;
  solo: boolean;
  onChange(value: number): void;
  onMute?: () => void;
  onSolo?: () => void;
}

export function MixerDevice() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const inputOn = useLive((state) => state.state === 'on');
  const monitorOn = useLive((state) => state.monitorOn);
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(Math.min(1, Math.max(0.63, entry.contentRect.width / 890)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const strips: Strip[] = CHANNELS.map(({ id, label, vol, mute }) => ({
    id, label, value: s[vol], active: channelVolume(s, id) > 0,
    muted: s[mute], solo: s.soloChannel === id,
    onChange: (value) => update({ [vol]: value }),
    onMute: () => update({ [mute]: !s[mute] }),
    onSolo: () => update({ soloChannel: s.soloChannel === id ? '' : id }),
  }));
  strips.push({
    id: 'guitar', label: 'Chitarra', value: s.monitorVol, active: monitorOn && s.monitorVol > 0,
    muted: !monitorOn, solo: false,
    onChange: (monitorVol) => {
      update({ monitorVol });
      if (monitorOn) liveInput.setMonitor(true, monitorVol);
    },
    ...(inputOn ? { onMute: () => liveInput.setMonitor(!monitorOn, s.monitorVol) } : {}),
  }, {
    id: 'master', label: 'Master', value: s.volMaster, active: s.volMaster > 0,
    muted: false, solo: false, onChange: (volMaster) => update({ volMaster }),
  });

  return <section className="ws-mixer v57-mixer" aria-label="Mixer">
    <h2 className="ws-engraved ws-plate-title">Mixer Studio</h2>
    <div className="v57-mixer-host" ref={host}>
      <div className="v57-mixer-size" style={{ width: 890 * scale, height: 490 * scale }}>
        <div className="v57-mixer-canvas" data-testid="v57-mixer" style={{ transform: `scale(${scale})` }}>
          <img className="v57-mixer-body" src={mixerBody} alt="" draggable={false} />
          {strips.map((c, i) => <div key={c.id} className="v57-strip" role="group" aria-label={c.label} style={{ left: (CENTRES[i] ?? 0) - 49 + 40 }}>
            <span className="v57-m-name">{c.label}</span>
            <span className="v57-m-led" data-on={c.active} aria-hidden="true" title="Canale aperto (non indica la presenza di segnale)" />
            {[0, 1, 2, 3, 4, 5, 6].map((tick) => <span key={tick} className="v57-m-tick" style={{ top: 112 + tick * 136 / 6 }}>
              <b>{tick === 6 ? '−∞' : (20 * Math.log10(1 - tick / 6)).toFixed(1)}</b><i />
            </span>)}
            <img className="v57-m-cap" src={c.id === 'master' ? faderCapMaster : faderCap} alt="" style={{ top: 248 - c.value * 136 - 36 }} />
            <input className="v57-m-slider" type="range" min={0} max={1} step={0.01} value={c.value}
              aria-label={`Volume ${c.label}`} aria-orientation="vertical" aria-valuetext={db(c.value)} data-testid={`fader-${c.id}`}
              onChange={(event) => c.onChange(Number(event.target.value))} />
            {c.id !== 'master' && <button type="button" className="v57-m-btn" style={{ top: 273 }}
              disabled={!c.onMute} aria-label={c.id === 'guitar' ? 'Ascolta la chitarra' : `Muto ${c.label}`}
              aria-pressed={c.id === 'guitar' ? monitorOn : c.muted} data-testid={c.id === 'guitar' ? 'mixer-listen' : `mute-${c.id}`}
              title={c.id === 'guitar' ? 'Ascolto manuale: usa le cuffie. Avvia prima l’ingresso chitarra.' : `Muto ${c.label}`} onClick={c.onMute}>
              <img src={(c.id === 'guitar' ? monitorOn : c.muted) ? btnMuteOn : btnOff} alt="" />
              <span data-lit={c.id === 'guitar' ? monitorOn : c.muted}>{c.id === 'guitar' ? 'Ascolta' : 'Mute'}</span>
            </button>}
            {c.onSolo && <button type="button" className="v57-m-btn" style={{ top: 313 }} aria-pressed={c.solo} aria-label={`Solo ${c.label}`} onClick={c.onSolo}>
              <img src={c.solo ? btnSoloOn : btnOff} alt="" /><span data-lit={c.solo}>Solo</span>
            </button>}
            <span className="v57-m-read">{db(c.value)}</span>
          </div>)}
          <MasterMeter />
        </div>
      </div>
    </div>
    <p className="v57-mixer-hint">LED: canali aperti · Out: livello reale. Solo isola Click, Note, Accordi, Basso e Batteria; la chitarra e la backing track restano indipendenti.</p>
  </section>;
}
