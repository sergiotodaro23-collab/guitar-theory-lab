/**
 * Studio V6 rig rack (right sidebar): audio input, amplifier, cabinet IR,
 * pedalboard and routing as hardware modules, each with its own real
 * on/off and a fold key. Every control writes the same settings the Guitar
 * Rig drawer used (D-42): `settings.rig`, the input gain and channel, the
 * listening switch. The audio graph follows on the guitar's listening branch;
 * the pitch analysis keeps the dry signal.
 */
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { engine } from '../../../app/engine';
import { AMP_KNOB_IDS, PEDAL_SPECS, RIG_PRESETS, matchingRigPreset, type CabModel, type PedalId } from '../../../app/rig';
import { PEDAL_IDS, addPedal, availablePedals, defaultChain, isDefaultChain, movePedal, removePedal, wiredOrder, type ChainStage, type PedalChain } from '../../../app/pedalChain';
import { useApp } from '../../../app/store';
import { liveInput, useLive, type InputChannel } from '../../../audio/liveInput';
import { namHost, useNam, type NamStatus } from '../../../audio/namHost';
import { describeNamModel } from '../../../app/namModel';
import { formatLabel, gearLabel } from '../../../app/tone3000';
import { T3kMark, Tone3000Dialog, Tone3000Wordmark } from './Tone3000';
import { useMidi } from '../../../audio/midi';
import { noteOf } from '../../../pitch';
import { startInput } from '../../LivePanels';
import { RotaryKnob } from '../v57/RotaryKnob';
import { gainDb, gainToKnob, knobToGain, type RackModuleId } from '../v57/layout';
import { AMP_LABELS, PEDAL_SIZE, Pedal, useRig } from '../v57/rig';
import { useStudioUi } from '../v57/uiStore';
import knobGold from '../v57/assets/knob-gold@2x.png';
import knobAlu from '../v57/assets/knob-alu@2x.png';

const CHEVRON_UP = 'M2 7l6-5 6 5';
const CHEVRON_DOWN = 'M2 2l6 5 6-5';

function Switch({ on, label, testId, disabled, onClick }: { readonly on: boolean; readonly label: string; readonly testId?: string; readonly disabled?: boolean; readonly onClick: () => void }) {
  return <button type="button" className="v6-toggle" aria-pressed={on} aria-label={label} title={label} disabled={disabled} data-testid={testId} onClick={onClick}><i aria-hidden="true" /></button>;
}

interface ModuleProps {
  readonly id: RackModuleId;
  readonly title: string;
  /** The module's own on/off, beside the title. */
  readonly power?: ReactNode;
  readonly lit: boolean;
  readonly testId?: string;
  readonly children: ReactNode;
}

function Module({ id, title, power, lit, testId, children }: ModuleProps) {
  const folded = useStudioUi((u) => u.rackFolded.includes(id));
  const toggle = useStudioUi((u) => u.toggleRackModule);
  return (
    <section className="v6-mod" data-folded={folded ? '1' : '0'} data-module={id} aria-label={title} data-testid={testId}>
      <header className="v6-mod-head">
        <i className="v6-mod-led" data-on={lit ? '1' : '0'} aria-hidden="true" />
        <h3>{title}</h3>
        {power}
        <button type="button" className="v6-mod-fold" aria-expanded={!folded} aria-label={folded ? `Espandi ${title}` : `Comprimi ${title}`} data-testid={`rack-fold-${id}`} onClick={() => toggle(id)}>
          <svg width="14" height="8" viewBox="0 0 16 9" aria-hidden="true"><path d={folded ? CHEVRON_DOWN : CHEVRON_UP} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </header>
      {folded ? null : <div className="v6-mod-body">{children}</div>}
    </section>
  );
}

/* ---------------- 1 · audio interface / input ---------------- */

const CHANNEL_OF: Record<1 | 2, InputChannel> = { 1: 'left', 2: 'right' };

function InputModule() {
  const live = useLive();
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const mode = s.mode;
  const pickTab = useStudioUi((u) => u.pickTab);
  const on = live.state === 'on';
  const level = on ? Math.min(1, live.level / 0.5) : 0;
  const statusText = live.error ? 'Errore d’ingresso' : on ? 'Ingresso attivo' : live.state === 'starting' ? 'Apertura…' : 'Ingresso spento';
  const d = live.diagnostics;
  const pathText = on && d ? `${d.deviceLabel || 'dispositivo'} · ${d.sampleRate} Hz` : 'nessun dispositivo aperto';
  const note = live.pitch ? noteOf(live.pitch.frequency, s.tunerA4) : null;
  const pickChannel = (n: 1 | 2) => { const inputChannel = CHANNEL_OF[n]; update({ inputChannel }); liveInput.route(inputChannel); };
  return (
    <Module id="input" title="Scheda audio / Input" lit={on}
      power={<Switch on={on} label={on ? 'Ferma l’ingresso' : 'Avvia l’ingresso'} disabled={live.state === 'starting'} testId="iface-power" onClick={() => (on ? liveInput.stop() : startInput())} />}>
      <div className="v6-lcdline" data-testid="iface-lcd" role="status"><b>{statusText}</b><span>{pathText} · Rilevato: {note ? `${note.name}${note.octave}` : '—'}</span></div>
      <div className="v6-in-row">
        <div className="v6-knobcell" style={{ width: 62, height: 62 }}>
          <RotaryKnob value={gainToKnob(s.inputGain)} onChange={(v) => { const inputGain = knobToGain(v); update({ inputGain }); liveInput.setGain(inputGain); }}
            label="Gain d’ingresso" valueText={gainDb(s.inputGain)} bodySrc={knobAlu} bodySize={58} hitSize={46} pointer={{ length: 9, offset: 4, color: '#f1f1f1' }}
            cx={31} cy={31} defaultValue={25} testId="iface-gain" />
        </div>
        <div className="v6-in-side">
          <span className="v6-silk">Gain <b>{gainDb(s.inputGain)}</b></span>
          <div className="v6-meter" role="meter" aria-label="Livello d’ingresso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} data-clip={live.clipping ? '1' : '0'}>
            {Array.from({ length: 14 }, (_, i) => <i key={i} data-zone={i >= 12 ? 'hot' : i >= 9 ? 'warm' : 'ok'} data-on={i < Math.round(level * 14) ? '1' : '0'} />)}
          </div>
          <div className="v6-in-ch" role="radiogroup" aria-label="Canale di ingresso">
            <span className="v6-silk">Ingresso</span>
            {([1, 2] as const).map((n) => (
              <button key={n} type="button" role="radio" className="v6-chip" aria-checked={s.inputChannel === CHANNEL_OF[n]} data-on={s.inputChannel === CHANNEL_OF[n] || s.inputChannel === 'mix' ? '1' : '0'}
                aria-label={`Ingresso ${n}${s.inputChannel === 'mix' ? ' (ora: entrambi sommati)' : ''}`} onClick={() => pickChannel(n)}>{n}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="v6-line">
        <span className="v6-silk">Ascolto (cuffie)</span>
        <Switch on={live.monitorOn} label="Ascolto della chitarra (usa le cuffie)" disabled={!on} testId="iface-monitor" onClick={() => liveInput.setMonitor(!live.monitorOn, s.monitorVol)} />
      </div>
      <p className="v6-note">Aprire l’ingresso non attiva l’ascolto.{' '}
        <button type="button" className="v57-linkbtn" data-testid="rack-open-input" onClick={() => pickTab(mode, 'input')}>Dispositivo, calibrazione e MIDI nella scheda Ingresso</button>
      </p>
    </Module>
  );
}

/* ---------------- 2 · amplifier ---------------- */

const AMP_W = 300;
const KNOB_PITCH = AMP_W / AMP_KNOB_IDS.length;

/** True when the settings ask for the model, the engine holds one, and it includes its cabinet: the rig's cabinet is skipped. */
const namSkipsCab = (rig: { readonly amp: { readonly model: string; readonly namCab: boolean } }, nam: NamStatus): boolean => rig.amp.model === 'nam' && rig.amp.namCab && nam.phase === 'ready';

const percent = (v: number): string => `${Math.round(v * 100)}%`;

/** The NAM side of the amp head: engine choice, model file, what the engine reported and measured. */
function NamPanel() {
  const [rig, setRig] = useRig();
  const nam = useNam();
  const live = useLive();
  const file = useRef<HTMLInputElement>(null);
  const [engineNow, setEngineNow] = useState<'internal' | 'nam' | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const origin = nam.phase === 'ready' && nam.origin?.kind === 'tone3000' ? nam.origin : null;
  useEffect(() => { setEngineNow(liveInput.rigState()?.ampEngine ?? null); }, [rig, live.state, live.rigRevision, nam.phase]);
  const wanted = rig.amp.model === 'nam';
  const pick = (model: 'internal' | 'nam') => setRig((r) => ({ ...r, amp: { ...r.amp, model } }));
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const ok = await namHost.loadFile(f, engine.audioOut().ctx);
    if (file.current) file.current.value = '';
    if (!ok) return;
    // The metadata's hint about the cabinet is applied once, at load; the switch stays the user's.
    const includesCab = useNam.getState().summary?.includesCab ?? false;
    setRig((r) => ({ ...r, amp: { ...r.amp, model: 'nam', namCab: includesCab } }));
  };
  const busy = nam.phase === 'checking' || nam.phase === 'loading' || nam.pending !== '';
  const s = nam.summary;
  const m = nam.measure;
  let status: string;
  if (nam.pending) status = nam.phase === 'loading' ? `Caricamento nel motore: ${nam.pending}…` : `Verifica e misura: ${nam.pending}…`;
  else if (nam.phase === 'ready' && s) {
    status = engineNow === 'nam'
      ? `Modello attivo nello stadio amplificatore: ${s.name}.`
      : !wanted ? `Modello caricato nel motore: ${s.name}. Scegli NAM per usarlo.`
      : live.state === 'on' ? `Modello caricato: ${s.name}.` : `Modello caricato nel motore: ${s.name}. Avvia l’ingresso per usarlo.`;
  } else if (nam.phase === 'error') status = 'Nessun modello caricato: suona il DSP interno.';
  else status = wanted ? 'Nessun modello caricato: suona il DSP interno.' : 'Motore NAM non in uso.';
  return (
    <div className="v6-nam" data-testid="nam-panel">
      <div className="v6-line">
        <span className="v6-silk">Motore</span>
        <div className="v6-seg" role="radiogroup" aria-label="Motore dell’amplificatore">
          <button type="button" role="radio" className="v6-minikey" aria-checked={!wanted} data-on={!wanted ? '1' : '0'} data-testid="amp-engine-internal" onClick={() => pick('internal')}>DSP interno</button>
          <button type="button" role="radio" className="v6-minikey" aria-checked={wanted} data-on={wanted ? '1' : '0'} data-testid="amp-engine-nam" onClick={() => pick('nam')}>NAM</button>
        </div>
      </div>
      <p className="v6-note v6-status" role="status" data-testid="nam-status" data-phase={nam.phase} data-engine={engineNow ?? 'off'}>{status}</p>
      <div className="v6-line">
        <button type="button" className="v6-minikey" data-testid="nam-load" disabled={busy} onClick={() => file.current?.click()}>Carica file .nam</button>
        <button type="button" className="v6-minikey" data-testid="nam-unload" disabled={busy || nam.phase !== 'ready'} onClick={() => namHost.unload()}>Rimuovi modello</button>
      </div>
      <div className="v6-line">
        <button type="button" className="v6-minikey" data-testid="nam-browse-t3k" aria-label="Sfoglia TONE3000" onClick={() => setBrowsing(true)}>Sfoglia <Tone3000Wordmark /></button>
        <span className="v6-note">facoltativo</span>
      </div>
      <Tone3000Dialog open={browsing} onClose={() => setBrowsing(false)} />
      <input ref={file} type="file" accept=".nam,application/json" hidden data-testid="nam-file" onChange={(e) => void onFile(e.target.files?.[0])} />
      {nam.error ? <p className="v6-note v6-alert" role="alert" data-testid="nam-error">{nam.error}</p> : null}
      {nam.phase === 'ready' && s ? (
        <dl className="v6-nam-facts" data-testid="nam-facts">
          {origin ? (
            <div><dt>Origine</dt><dd className="v6-nam-origin" data-testid="nam-origin">
              {origin.imageUrl ? <img src={origin.imageUrl} alt="" referrerPolicy="no-referrer" /> : null}
              <span><T3kMark /> {origin.title} · {gearLabel(origin.gear)} · {formatLabel('nam')} · @{origin.author || 'sconosciuto'} · <a href={origin.toneUrl} target="_blank" rel="noreferrer noopener">pagina del tone</a></span>
            </dd></div>
          ) : null}
          <div><dt>Modello</dt><dd>{describeNamModel(s)}</dd></div>
          <div><dt>File</dt><dd>{s.fileName} · {(s.sizeBytes / 1024).toFixed(0)} kB · formato {s.version}</dd></div>
          {m ? <div><dt>Misurato qui</dt><dd data-testid="nam-measure">caricato in {Math.round(m.loadMs)} ms · costo stimato {percent(m.realtimeFactor)} del tempo audio ({Math.round(m.microsPerBlock)} µs per blocco su {Math.round(m.budgetMicros)}) · latenza aggiunta 0 campioni</dd></div> : null}
          <div><dt>Livello</dt><dd>{nam.info?.hasLoudness ? `normalizzato dal motore (il file dichiara ${nam.info.loudness.toFixed(1)} dB)` : 'non normalizzato: il file non dichiara il suo livello'}</dd></div>
        </dl>
      ) : null}
      {nam.phase === 'ready' && m?.verdict === 'heavy' ? <p className="v6-note v6-alert" role="status" data-testid="nam-heavy">Modello pesante per questo computer: l’audio può interrompersi. Se succede torna al DSP interno.</p> : null}
      {nam.phase === 'ready' && nam.rateNote ? <p className="v6-note v6-alert" role="status" data-testid="nam-rate">{nam.rateNote}</p> : null}
      <div className="v6-line">
        <span className="v6-silk">Il capture include il cabinet</span>
        <Switch on={rig.amp.namCab} label="Il capture NAM include già il cabinet: salta il Cabinet del rig" testId="nam-cab" onClick={() => setRig((r) => ({ ...r, amp: { ...r.amp, namCab: !r.amp.namCab } }))} />
      </div>
      <p className="v6-note">Formati: NAM A1 (WaveNet, LSTM, Linear) e A2. Il modello gira alla frequenza dell’audio, senza ricampionamento. Gain regola l’ingresso del modello (±12 dB), i toni lavorano dopo il modello. Il file resta in memoria solo per questa visita.</p>
    </div>
  );
}

function AmpModule() {
  const [rig, setRig] = useRig();
  const nam = useNam();
  const amp = rig.amp;
  const heard = amp.power && !amp.bypass;
  const namReady = amp.model === 'nam' && nam.phase === 'ready' && nam.summary !== null;
  return (
    <Module id="amp" title="Amplificatore" lit={heard}
      power={<Switch on={amp.power} label="Accensione dell’amplificatore" testId="amp-power" onClick={() => setRig((r) => ({ ...r, amp: { ...r.amp, power: !r.amp.power } }))} />}>
      <div className="v6-amp" data-on={amp.power ? '1' : '0'}>
        <div className="v6-amp-top">
          <span className="v6-amp-name">{namReady ? 'GTL NAM' : 'GTL Clean'}</span>
          <span className="v6-amp-tape" data-testid="amp-tape">{namReady ? `NAM · ${nam.origin?.kind === 'tone3000' ? `T3K · ${nam.origin.title}` : nam.summary?.name ?? ''}` : amp.model === 'nam' ? 'DSP interno · NAM senza modello' : 'DSP interno'}</span>
        </div>
        <div className="v6-amp-panel" style={{ width: AMP_W }}>
          <span className="v6-amp-lamp" data-on={amp.power ? 1 : 0} data-testid="amp-lamp" role="img" aria-label={amp.power ? 'Amplificatore acceso' : 'Amplificatore spento'} />
          {AMP_KNOB_IDS.map((id, i) => {
            const cx = KNOB_PITCH * (i + 0.5);
            const label = namReady && id === 'gain' ? 'Input' : AMP_LABELS[id];
            return (
              <Fragment key={id}>
                <span className="v6-amp-lab" style={{ left: cx }}>{label}</span>
                <RotaryKnob value={amp.knobs[id]} label={`Amplificatore ${label}`} valueText={`${Math.round(amp.knobs[id] / 10)} su 10`}
                  onChange={(v) => setRig((r) => ({ ...r, amp: { ...r.amp, knobs: { ...r.amp.knobs, [id]: v } } }))}
                  bodySrc={knobGold} bodySize={50} hitSize={38} pointer={{ length: 7, offset: 3, color: '#efe3bd', width: 2.5 }} cx={cx} cy={44} defaultValue={50} testId={`amp-${id}`} />
              </Fragment>
            );
          })}
        </div>
      </div>
      <NamPanel />
      <div className="v6-line">
        <span className="v6-silk">Bypass ampli e cabinet</span>
        <Switch on={amp.bypass} label="Bypass di amplificatore e cabinet" testId="amp-bypass" onClick={() => setRig((r) => ({ ...r, amp: { ...r.amp, bypass: !r.amp.bypass } }))} />
      </div>
    </Module>
  );
}

/* ---------------- 3 · cabinet / IR ---------------- */

function CabModule() {
  const [rig, setRig] = useRig();
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const skipped = namSkipsCab(rig, useNam());
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
    <Module id="cab" title="Cabinet / IR" lit={rig.cab.on && !rig.amp.bypass && !skipped} testId="rig-cab"
      power={<button type="button" className="v6-toggle" aria-pressed={rig.cab.on} aria-label="Cabinet" title={rig.cab.on ? 'Cabinet attivo' : 'Cabinet escluso'} data-testid="rig-cab-switch"
        onClick={() => setRig((r) => ({ ...r, cab: { ...r.cab, on: !r.cab.on } }))}><i aria-hidden="true" /></button>}>
      <div className="v6-cab">
        <div className="v6-cab-grille" aria-hidden="true" />
        <label className="v6-field"><span className="v6-silk">Risposta all’impulso</span>
          <select className="v6-select" aria-label="Risposta all’impulso del cabinet" data-testid="rig-cab-model" value={rig.cab.model} onChange={(e) => choose(e.target.value as CabModel)}>
            <option value="4x12">4x12 (sintetico)</option>
            <option value="1x12">1x12 (sintetico)</option>
            <option value="file">{loaded ? `File: ${rig.cab.fileName}` : 'Carica un file IR…'}</option>
          </select>
        </label>
      </div>
      <input ref={file} type="file" accept="audio/*,.wav,.aif,.aiff" hidden data-testid="rig-cab-file" onChange={(e) => void onFile(e.target.files?.[0])} />
      {message ? <p className="v6-note v6-alert" role="alert">{message}</p> : null}
      {skipped ? <p className="v6-note" role="status" data-testid="cab-skipped">Escluso: il modello NAM include già il cabinet (interruttore nella testata).</p> : null}
    </Module>
  );
}

/* ---------------- 4 · pedalboard ---------------- */

const PEDAL_GAP = 10;

/** Width of the amplifier and cabinet marker between the two pedal zones, in CSS px. */
const CHAIN_MARKER = 34;

const STAGE_NAME = (id: ChainStage): string => (id === 'amp' ? 'Ampli' : id === 'cab' ? 'Cabinet' : PEDAL_SPECS[id].name);

/**
 * The pedal chain (configurable order, D-49): the pedals in the order the
 * signal meets them, each with its own switch, knobs and the keys that move
 * it, remove it, and add the ones that are out of the chain. Order and
 * membership live in `settings.rig.chain`; parameters and switches stay put.
 */
function PedalsModule() {
  const [rig, setRig] = useRig();
  const chain = rig.chain;
  const stages = wiredOrder(chain);
  const pedalsIn = stages.filter((id): id is PedalId => id !== 'amp' && id !== 'cab');
  const anyOn = pedalsIn.some((id) => rig.pedals[id].on);
  const setChain = (next: PedalChain) => setRig((r) => ({ ...r, chain: next }));
  const allOff = () => setRig((r) => ({ ...r, pedals: Object.fromEntries(PEDAL_IDS.map((id) => [id, { ...r.pedals[id], on: false }])) as typeof r.pedals }));
  const slot = PEDAL_SIZE.w + PEDAL_GAP;
  // x of each stage: pre pedals, a marker for amp and cabinet, then the post pedals.
  let cursor = 0;
  const placed = stages.map((id) => {
    const at = cursor;
    if (id === 'amp') { cursor += CHAIN_MARKER; } else if (id === 'cab') { /* the marker covers both */ } else { cursor += slot; }
    return { id, x: at };
  });
  const preLength = chain.pre.length;
  const postX = preLength * slot + CHAIN_MARKER;
  const width = Math.max(cursor, 1);
  const available = availablePedals(chain);
  const readout = stages.map((id) => (id === 'amp' || id === 'cab' ? STAGE_NAME(id) : `${STAGE_NAME(id)}${rig.pedals[id].on ? '' : ' (spento)'}`));
  return (
    <Module id="pedals" title="Pedaliera" lit={anyOn}
      power={<button type="button" className="v6-minikey" disabled={!anyOn} data-testid="pedals-all-off" title="Spegne tutti i pedali" onClick={allOff}>Tutti off</button>}>
      <div className="v6-board" role="group" aria-label="Catena dei pedali: prima e dopo l’amplificatore" tabIndex={0}>
        <div className="v6-board-in" style={{ width: Math.max(width, 124), height: PEDAL_SIZE.h + 60 }}>
          <span className="v6-board-lab" style={{ left: 0 }}>Pre</span>
          <span className="v6-board-lab" style={{ left: postX }}>Post</span>
          <span className="v6-board-amp" style={{ left: preLength * slot + 2, width: CHAIN_MARKER - PEDAL_GAP + 6, height: PEDAL_SIZE.h }} aria-hidden="true">Ampli · Cab</span>
          {placed.map(({ id, x }) => {
            if (id === 'amp' || id === 'cab') return null;
            const list = chain.pre.includes(id) ? chain.pre : chain.post;
            const at = list.indexOf(id);
            const name = PEDAL_SPECS[id].name;
            return (
              <Fragment key={id}>
                <Pedal id={id} x={x} y={2} />
                <div className="v6-pedal-ctl" style={{ left: x, top: PEDAL_SIZE.h + 16, width: PEDAL_SIZE.w }} role="group" aria-label={`Posizione di ${name}`}>
                  <button type="button" className="v6-minikey" data-testid={`chain-left-${id}`} aria-label={`Sposta ${name} a sinistra`} title="Sposta a sinistra" disabled={at <= 0} onClick={() => setChain(movePedal(chain, id, -1))}>←</button>
                  <button type="button" className="v6-minikey" data-testid={`chain-right-${id}`} aria-label={`Sposta ${name} a destra`} title="Sposta a destra" disabled={at >= list.length - 1} onClick={() => setChain(movePedal(chain, id, 1))}>→</button>
                  <button type="button" className="v6-minikey" data-testid={`chain-remove-${id}`} aria-label={`Rimuovi ${name} dalla catena`} title="Rimuovi dalla catena: i parametri restano" onClick={() => setChain(removePedal(chain, id))}>×</button>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
      <p className="v6-chain-readout" role="status" data-testid="chain-readout">Segnale: {readout.join(' → ')}</p>
      <div className="v6-chain-add" role="group" aria-label="Pedali fuori catena">
        <span className="v6-silk">Fuori catena</span>
        {available.length === 0 ? <span className="v6-note">Tutti i pedali sono nella catena.</span> : null}
        {available.map((id) => (
          <button key={id} type="button" className="v6-minikey" data-testid={`chain-add-${id}`} aria-label={`Aggiungi ${PEDAL_SPECS[id].name} alla catena`} onClick={() => setChain(addPedal(chain, id))}>+ {PEDAL_SPECS[id].name}</button>
        ))}
        <button type="button" className="v6-minikey" data-testid="chain-reset" disabled={isDefaultChain(chain)} title="Riporta l’ordine e i pedali della catena predefinita; i parametri restano" onClick={() => setChain(defaultChain())}>Catena predefinita</button>
      </div>
      <p className="v6-note">Ordine nelle zone PRE e POST; amplificatore e cabinet restano fissi. Ogni pedale compare una sola volta. Spostare un pedale tra PRE e POST non è ancora possibile.</p>
    </Module>
  );
}

/* ---------------- 5 · routing / output ---------------- */

const STAGE: Record<string, string> = { comp: 'Compressor', fuzz: 'Fuzz', drive: 'Overdrive', amp: 'Ampli', cab: 'Cabinet', eq: 'EQ', chorus: 'Chorus', delay: 'Delay', reverb: 'Reverb' };

function OutMeter() {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    let frame = 0;
    let held = 0;
    const read = () => {
      held = Math.max(engine.outputLevel(), held * 0.9);
      setLevel(Math.min(1, held / 0.5));
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="v6-meter v6-meter-out" role="meter" aria-label="Livello in uscita (master)" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
      {Array.from({ length: 20 }, (_, i) => <i key={i} data-zone={i >= 17 ? 'hot' : i >= 13 ? 'warm' : 'ok'} data-on={i < Math.round(level * 20) ? '1' : '0'} />)}
    </div>
  );
}

function RoutingModule() {
  const live = useLive();
  const rig = useApp((s) => s.settings.rig);
  const [active, setActive] = useState<readonly string[]>([]);
  useEffect(() => { setActive(liveInput.rigState()?.active ?? []); }, [rig, live.state, live.rigRevision]);
  const on = live.state === 'on';
  const chain = active.length ? active.map((id) => STAGE[id] ?? id).join(' → ') : 'segnale diretto';
  return (
    <Module id="routing" title="Routing / Uscita" lit={on && live.monitorOn}>
      <p className="v6-note v6-status" data-testid="rig-status" role="status">
        {on
          ? live.monitorOn
            ? `Elaborazione attiva sull’ascolto della chitarra: ${chain}.`
            : 'Ingresso attivo, ascolto spento: il rig è pronto ma non si sente (usa le cuffie).'
          : 'Il rig elabora l’ascolto della chitarra: avvia l’ingresso.'}
      </p>
      <div className="v6-route" aria-hidden="true">
        <span>Ingresso</span><i /><span data-dim="1">Analisi (secco)</span>
      </div>
      <div className="v6-route" aria-hidden="true">
        <span>Ingresso</span><i /><span>Rig</span><i /><span>Fader chitarra</span><i /><span>Master</span>
      </div>
      <div className="v6-line"><span className="v6-silk">Uscita</span><OutMeter /></div>
    </Module>
  );
}

/* ---------------- sticky footer: position estimate and MIDI ---------------- */

const MIDI_TEXT: Record<string, string> = { off: 'spento', asking: 'richiesta…', on: 'attivo', denied: 'negato', unsupported: 'non supportato' };

function Footer() {
  const liveOnBoard = useApp((s) => s.settings.liveOnBoard);
  const mode = useApp((s) => s.settings.mode);
  const update = useApp((s) => s.update);
  const midi = useMidi();
  const pickTab = useStudioUi((u) => u.pickTab);
  return (
    <footer className="v6-rack-foot">
      <div className="v6-line">
        <span className="v6-silk">Nota rilevata sulla tastiera</span>
        <Switch on={liveOnBoard} label="Mostra la nota rilevata e la posizione stimata sulla tastiera" testId="rack-live-on-board" onClick={() => update({ liveOnBoard: !liveOnBoard })} />
      </div>
      <div className="v6-line">
        <span className="v6-silk">MIDI: <b data-testid="rack-midi">{MIDI_TEXT[midi.status] ?? midi.status}{midi.inputs.length ? ` · ${midi.inputs[0]}` : ''}</b></span>
        <button type="button" className="v6-minikey" onClick={() => pickTab(mode, 'input')}>Imposta</button>
      </div>
    </footer>
  );
}

/* ---------------- sound presets ---------------- */

/** Starting sounds of the rig: choosing one sets amp, cabinet and pedals; moving any control leaves it. */
function SoundPreset() {
  const [rig, setRig] = useRig();
  const current = matchingRigPreset(rig);
  return (
    <label className="v6-sound">
      <span className="v6-silk">Suono</span>
      <select className="v6-select" aria-label="Suono del rig" data-testid="rig-preset" value={current?.id ?? ''}
        onChange={(e) => { const preset = RIG_PRESETS.find((p) => p.id === e.target.value); if (preset) setRig(() => preset.rig); }}>
        <option value="">{current ? 'Scegli…' : 'Personale'}</option>
        {RIG_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}

/* ---------------- the rack ---------------- */

const SPINE: readonly { id: RackModuleId; glyph: string; label: string }[] = [
  { id: 'input', glyph: 'M12 3v7M8.5 10h7v4.5a3.5 3.5 0 0 1-7 0zM12 18v3', label: 'Scheda audio / Input' },
  { id: 'amp', glyph: 'M3 6h18v12H3zM3 9.5h18M7 14h.01M11 14h.01M15 14h.01M18.5 14h.01', label: 'Amplificatore' },
  { id: 'cab', glyph: 'M4 3h16v18H4zM12 15a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', label: 'Cabinet / IR' },
  { id: 'pedals', glyph: 'M6 3h12v18H6zM9 7h.01M15 7h.01M12 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', label: 'Pedaliera' },
  { id: 'routing', glyph: 'M4 7h11l-3-3M20 17H9l3 3', label: 'Routing / Uscita' },
];

function useModuleLit(): Record<RackModuleId, boolean> {
  const rig = useApp((s) => s.settings.rig);
  const inputOn = useLive((l) => l.state === 'on');
  const monitorOn = useLive((l) => l.monitorOn);
  const nam = useNam();
  return {
    input: inputOn,
    amp: rig.amp.power && !rig.amp.bypass,
    cab: rig.cab.on && !rig.amp.bypass && !namSkipsCab(rig, nam),
    pedals: Object.values(rig.pedals).some((p) => p.on),
    routing: inputOn && monitorOn,
  };
}

export function Rack() {
  const mode = useStudioUi((u) => u.rack);
  const setRack = useStudioUi((u) => u.setRack);
  const folded = useStudioUi((u) => u.rackFolded);
  const toggleModule = useStudioUi((u) => u.toggleRackModule);
  const lit = useModuleLit();
  if (mode === 'hidden') return null;
  if (mode === 'compact') {
    const open = (id: RackModuleId) => { if (folded.includes(id)) toggleModule(id); setRack('expanded'); };
    return (
      <aside className="v6-rack" data-mode="compact" aria-label="Audio e Rig" data-testid="rack">
        <button type="button" className="v6-rack-key" aria-label="Espandi il rack" title="Espandi il rack" data-testid="rack-expand" onClick={() => setRack('expanded')}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {SPINE.map((m) => (
          <button key={m.id} type="button" className="v6-spine" aria-label={m.label} title={m.label} data-on={lit[m.id] ? '1' : '0'} onClick={() => open(m.id)}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d={m.glyph} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <i aria-hidden="true" />
          </button>
        ))}
      </aside>
    );
  }
  return (
    <aside className="v6-rack" data-mode="expanded" aria-label="Audio e Rig" data-testid="rack">
      <div className="v6-rack-title">
        <button type="button" className="v6-rack-key" aria-label="Compatta il rack" title="Compatta il rack" data-testid="rack-compact" onClick={() => setRack('compact')}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6M19 5v14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <h2>Audio &amp; Rig</h2>
        <button type="button" className="v6-rack-key" aria-label="Nascondi il rack" title="Nascondi il rack" data-testid="rack-hide" onClick={() => setRack('hidden')}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="v6-rack-body" data-testid="rig">
        <SoundPreset />
        <InputModule />
        <AmpModule />
        <CabModule />
        <PedalsModule />
        <RoutingModule />
      </div>
      <Footer />
    </aside>
  );
}
