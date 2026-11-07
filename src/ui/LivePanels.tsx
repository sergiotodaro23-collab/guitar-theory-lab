/**
 * Guitar input panels (D-21): the input itself (device, gain, level,
 * monitoring), the Live Monitor and the Tuner. Every reading comes from the
 * pitch analysis of the dry signal; nothing here is simulated. A heard pitch
 * says which note, not which string: the panels keep the two apart.
 */
import { engine } from '../app/engine';
import { analysisSettingsOf, tuningOf } from '../app/settings';
import { useApp, usePlayhead } from '../app/store';
import { CalibrationPanel } from './Calibration';
import { liveInput, useLive } from '../audio/liveInput';
import { IN_TUNE_CENTS, MIN_CONFIDENCE, STRING_NAMES, TUNINGS, noteOf, positionsOf, tunerReading } from '../pitch';
import { Field, Panel, Segmented, Select, Toggle } from './controls';

const pct = (value: number) => `${Math.round(value * 100)}%`;
const place = (p: { string: number; fret: number }) => `${STRING_NAMES[p.string]} corda, ${p.fret === 0 ? 'a vuoto' : `${p.fret}° tasto`}`;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOfMidi = (midi: number) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

const CHANNEL_OPTIONS = [
  { value: 'mix' as const, label: 'Entrambi' },
  { value: 'left' as const, label: 'Canale 1' },
  { value: 'right' as const, label: 'Canale 2' },
];

/** Start the input with the saved device, channel and gain. */
export function startInput(deviceId?: string): void {
  const s = useApp.getState().settings;
  liveInput.configure(analysisSettingsOf(s));
  void liveInput.start(() => engine.audioOut(), deviceId ?? s.inputDeviceId, s.inputChannel).then(() => liveInput.setGain(useApp.getState().settings.inputGain));
}

/** The one line under the input: error, clipping, weak signal or all clear. Always the same height. */
function InputMessage() {
  const live = useLive();
  if (live.error) return <p className="live-message is-error" role="alert" data-testid="live-error">{live.error}</p>;
  if (live.clipping) return <p className="live-message is-warn" role="status" data-testid="live-clip">Segnale saturo: abbassa il gain.</p>;
  if (live.state === 'on' && live.level < 0.01) return <p className="live-message" role="status" data-testid="live-weak">Segnale debole o assente: suona una corda o alza il gain.</p>;
  return <p className="live-message" role="status">{live.state === 'on' ? 'Segnale presente.' : 'L’ingresso è spento: nessun dato dal microfono.'}</p>;
}

/** Start, device, channel, gain, level, monitoring: shared by Live Monitor and Tuner. */
export function InputControls() {
  const live = useLive();
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const on = live.state === 'on';
  return (
    <div className="live-input" data-testid="live-input">
      <div className="row live-start">
        <button
          type="button"
          className={`btn ${on ? '' : 'btn-accent'}`}
          data-testid="live-toggle"
          aria-pressed={on}
          disabled={live.state === 'starting'}
          onClick={() => (on ? liveInput.stop() : startInput())}
        >
          {on ? 'Ferma l’ingresso' : live.state === 'starting' ? 'Apertura…' : 'Avvia l’ingresso'}
        </button>
        <span className="live-status" data-testid="live-status">
          {on ? 'Ingresso attivo' : live.state === 'error' ? 'Errore' : 'Ingresso spento'}
        </span>
      </div>
      <InputMessage />
      <Field label="Dispositivo">
        <Select
          label="Dispositivo d’ingresso"
          testId="live-device"
          value={on ? live.deviceId : ''}
          options={on && live.devices.length > 0 ? live.devices.map((d) => ({ value: d.id, label: d.label })) : [{ value: '', label: 'Avvia l’ingresso per vedere i dispositivi' }]}
          onChange={(id) => { update({ inputDeviceId: id }); startInput(id); }}
        />
      </Field>
      <Field label="Canale della chitarra" group>
        <Segmented
          label="Canale della chitarra"
          value={s.inputChannel}
          options={CHANNEL_OPTIONS}
          onChange={(inputChannel) => { update({ inputChannel }); liveInput.route(inputChannel); }}
        />
      </Field>
      <Field label={`Gain d’ingresso: ${pct(s.inputGain)}`}>
        <input className="range" type="range" min={0} max={4} step={0.05} value={s.inputGain} aria-label="Gain d’ingresso"
          onChange={(e) => { const inputGain = Number(e.target.value); update({ inputGain }); liveInput.setGain(inputGain); }} />
      </Field>
      <div className="live-level" role="meter" aria-label="Livello d’ingresso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, live.level / 0.5) * 100)} data-testid="live-level">
        <span className="live-level-bar" style={{ transform: `scaleX(${Math.min(1, live.level / 0.5)})` }} />
      </div>
      <MonitorControls />
      <InputDiagnostics />
    </div>
  );
}

/** Hearing the guitar: off at every start, on only by choice, with its own level. */
export function MonitorControls() {
  const live = useLive();
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const on = live.state === 'on';
  return (
    <div className="live-monitor">
      <button
        type="button"
        className="btn live-listen"
        data-testid="monitor-toggle"
        aria-pressed={live.monitorOn}
        disabled={!on}
        onClick={() => liveInput.setMonitor(!live.monitorOn, s.monitorVol)}
      >
        {live.monitorOn ? 'Ascolto acceso' : 'Ascolta la chitarra'}
      </button>
      <p className="field-hint live-monitor-hint">Usa le cuffie: con le casse il microfono riprende l’uscita e fischia. Se la scheda audio ha l’ascolto diretto, puoi usare quello e lasciare spento questo.</p>
      <Field label={`Volume della chitarra: ${pct(s.monitorVol)}`}>
        <input className="range" type="range" min={0} max={1} step={0.01} value={s.monitorVol} aria-label="Volume della chitarra" data-testid="monitor-volume"
          onChange={(e) => { const monitorVol = Number(e.target.value); update({ monitorVol }); if (live.monitorOn) liveInput.setMonitor(true, monitorVol); }} />
      </Field>
    </div>
  );
}

/** What the browser reports about the audio path, and a beep to test the output. Nothing here is estimated. */
function InputDiagnostics() {
  const d = useLive((l) => l.diagnostics);
  const on = useLive((l) => l.state === 'on');
  const ms = (v: number | null) => (v === null ? 'non disponibile' : `${(v * 1000).toFixed(1)} ms`);
  return (
    <details className="live-diagnostics" data-testid="live-diagnostics">
      <summary>Diagnostica audio</summary>
      <button type="button" className="btn" data-testid="test-tone" onClick={() => engine.testTone()}>Suono di prova (La 440 Hz)</button>
      <p className="field-hint">Se non senti il suono di prova, il problema è nell’uscita: dispositivo di uscita del sistema, volume, cuffie collegate alla scheda giusta.</p>
      {on && d ? (
        <dl className="diag-list">
          <dt>Stato dell’audio</dt><dd>{d.contextState === 'running' ? 'attivo' : d.contextState}</dd>
          <dt>Frequenza di campionamento</dt><dd>{d.sampleRate} Hz{d.trackSampleRate && d.trackSampleRate !== d.sampleRate ? ` (ingresso ${d.trackSampleRate} Hz, ricampionato)` : ''}</dd>
          <dt>Dispositivo</dt><dd>{d.deviceLabel || 'senza nome'}</dd>
          <dt>Canali d’ingresso</dt><dd>{d.inputChannels ?? 'non dichiarati'}</dd>
          <dt>Latenza di base dichiarata</dt><dd>{ms(d.baseLatency)}</dd>
          <dt>Latenza d’uscita dichiarata</dt><dd>{ms(d.outputLatency)}</dd>
        </dl>
      ) : <p className="field-hint">Avvia l’ingresso per leggere i dati del dispositivo.</p>}
      <p className="field-hint">I valori di latenza sono quelli dichiarati dal browser: la latenza d’ingresso non è misurabile da qui.</p>
    </details>
  );
}

export function LiveMonitorPanel() {
  const pitch = useLive((l) => l.pitch);
  const on = useLive((l) => l.state === 'on');
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const expected = usePlayhead((p) => p.note);
  const playing = usePlayhead((p) => p.state === 'playing');
  const note = pitch ? noteOf(pitch.frequency, s.tunerA4) : null;
  const tuning = tuningOf(useApp.getState().settings);
  const where = note ? { all: positionsOf(note.midi, tuning) } : null;
  // Feedback only on a steady reading against the exercise note sounding now.
  const feedback = note && pitch?.stable && playing && expected
    ? note.midi === expected.midi ? 'giusto' : note.midi % 12 === expected.midi % 12 ? 'ottava' : 'diverso'
    : null;
  return (
    <Panel title="Live Monitor" className="live-panel">
      <InputControls />
      <div className="live-readout" aria-live="polite">
        <span className="live-note" data-testid="live-note">{note ? `${note.name}${note.octave}` : '—'}</span>
        <span className="live-detail" data-testid="live-frequency">{pitch ? `${pitch.frequency.toFixed(1)} Hz` : on ? 'In ascolto…' : 'Avvia l’ingresso'}</span>
        <span className="live-detail" data-testid="live-confidence">{pitch ? `Affidabilità ${pct(pitch.confidence)}${pitch.stable ? ', stabile' : ''}` : `Mostra le note sopra ${pct(MIN_CONFIDENCE)} di affidabilità`}</span>
      </div>
      {/* Fixed boxes: a note coming and going never moves what is below. */}
      <p className="field-hint live-positions" data-testid="live-positions" title={note ? positionsOf(note.midi, tuning).map(place).join('; ') : undefined}>
        {note && where
          ? `${nameOfMidi(note.midi)} si suona in ${where.all.length} ${where.all.length === 1 ? 'punto' : 'punti'}: ${positionsOf(note.midi, tuning).map(place).join('; ')}.`
          : 'Un segnale solo dà l’altezza, non la corda: la tastiera mostra tutte le posizioni possibili e piena la più probabile, che resta una stima.'}
      </p>
      <p className={`live-feedback ${feedback ? `is-${feedback}` : ''}`} data-testid="live-feedback">
        {feedback === 'giusto' ? 'Giusto' : feedback === 'ottava' ? `Nota giusta, ottava diversa (attesa ${nameOfMidi(expected?.midi ?? 0)})` : feedback === 'diverso' ? `Attesa ${nameOfMidi(expected?.midi ?? 0)}` : ' '}
      </p>
      <Toggle checked={s.liveOnBoard} onChange={(liveOnBoard) => update({ liveOnBoard })}>Mostra la nota rilevata sulla tastiera</Toggle>
    </Panel>
  );
}

/** Needle from −50 to +50 cents over a 120° arc. */
function TunerNeedle({ cents }: { readonly cents: number | null }) {
  const angle = cents === null ? 0 : Math.max(-50, Math.min(50, cents)) * 1.2;
  return (
    <svg className="tuner-meter" viewBox="0 0 200 110" aria-hidden="true">
      <path className="tuner-scale" d="M 20 100 A 80 80 0 0 1 180 100" />
      {[-50, -25, -10, 0, 10, 25, 50].map((c) => {
        const a = ((c * 1.2 - 90) * Math.PI) / 180;
        return <line key={c} className={`tuner-tick ${c === 0 ? 'is-zero' : ''}`} x1={100 + 72 * Math.cos(a)} y1={100 + 72 * Math.sin(a)} x2={100 + 84 * Math.cos(a)} y2={100 + 84 * Math.sin(a)} />;
      })}
      <line className={`tuner-needle ${cents === null ? 'is-idle' : ''}`} x1="100" y1="100" x2="100" y2="26" transform={`rotate(${angle} 100 100)`} />
      <circle className="tuner-hub" cx="100" cy="100" r="5" />
    </svg>
  );
}

export function TunerPanel() {
  const pitch = useLive((l) => l.pitch);
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const tuning = TUNINGS.find((t) => t.id === s.tunerTuning) ?? (TUNINGS[0] as (typeof TUNINGS)[number]);
  const target = pitch ? tunerReading(pitch.frequency, tuning, s.tunerA4) : null;
  const note = pitch ? noteOf(pitch.frequency, s.tunerA4) : null;
  const cents = target ? Math.round(target.cents * 10) / 10 : null;
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS && pitch?.stable === true;
  const advice = cents === null ? '' : inTune ? 'Intonata' : cents < 0 ? 'Calante: tendi la corda' : 'Crescente: allenta la corda';
  return (
    <Panel title="Accordatore" className="tuner-panel">
      <div className="row">
        <Field label="Accordatura">
          <Select label="Accordatura" testId="tuner-tuning" value={tuning.id} options={TUNINGS.map((t) => ({ value: t.id, label: t.name }))} onChange={(tunerTuning) => update({ tunerTuning })} />
        </Field>
        <Field label="La di riferimento (Hz)">
          <input className="text-input tuner-a4" type="number" min={415} max={466} step={1} value={s.tunerA4} data-testid="tuner-a4" aria-label="La di riferimento in hertz"
            onChange={(e) => { const v = Number(e.target.value); if (v >= 415 && v <= 466) update({ tunerA4: Math.round(v) }); }} />
        </Field>
      </div>
      <div className={`tuner-display ${inTune ? 'is-in-tune' : ''}`} data-testid="tuner">
        <TunerNeedle cents={cents} />
        <span className="tuner-string" data-testid="tuner-string">{target ? (target.string !== null ? `${STRING_NAMES[target.string]} corda · ${nameOfMidi(target.midi)}` : `${nameOfMidi(target.midi)} · cromatico`) : '—'}</span>
        <span className="tuner-cents" data-testid="tuner-cents">{cents === null ? '' : `${cents > 0 ? '+' : ''}${cents.toFixed(1)} cent`}</span>
        <span className="tuner-advice" data-testid="tuner-advice">{advice}</span>
        <span className="tuner-heard">{note && pitch ? `Sento ${note.name}${note.octave} · ${pitch.frequency.toFixed(1)} Hz` : 'Suona una corda a vuoto'}</span>
      </div>
    </Panel>
  );
}

/** The full input deck: Live Monitor and Tuner share one input. */
export function InputPanels() {
  return (
    <>
      <LiveMonitorPanel />
      <CalibrationPanel />
      <TunerPanel />
    </>
  );
}
