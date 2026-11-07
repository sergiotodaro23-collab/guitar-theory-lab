/**
 * Guitar input panels (D-21): the input itself (device, gain, level,
 * monitoring), the Live Monitor and the Tuner. Every reading comes from the
 * pitch analysis of the dry signal; nothing here is simulated. A heard pitch
 * says which note, not which string: the panels keep the two apart.
 */
import { engine } from '../app/engine';
import { useApp, usePlayhead } from '../app/store';
import { liveInput, useLive } from '../audio/liveInput';
import { IN_TUNE_CENTS, MIN_CONFIDENCE, STRING_NAMES, TUNINGS, livePositions, noteOf, positionsOf, tunerReading } from '../pitch';
import { Field, Panel, Select, Toggle } from './controls';

const pct = (value: number) => `${Math.round(value * 100)}%`;
const place = (p: { string: number; fret: number }) => `${STRING_NAMES[p.string]} corda, ${p.fret === 0 ? 'a vuoto' : `${p.fret}° tasto`}`;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOfMidi = (midi: number) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

/** Start, device, gain, level, monitoring: shared by Live Monitor and Tuner. */
export function InputControls() {
  const live = useLive();
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const on = live.state === 'on';
  const start = (deviceId: string) => {
    void liveInput.start(() => engine.audioOut(), deviceId).then(() => liveInput.setGain(useApp.getState().settings.inputGain));
  };
  return (
    <div className="live-input" data-testid="live-input">
      <div className="row">
        <button
          type="button"
          className={`btn ${on ? '' : 'btn-accent'}`}
          data-testid="live-toggle"
          aria-pressed={on}
          disabled={live.state === 'starting'}
          onClick={() => (on ? liveInput.stop() : start(s.inputDeviceId))}
        >
          {on ? 'Ferma l’ingresso' : live.state === 'starting' ? 'Apertura…' : 'Avvia l’ingresso'}
        </button>
        <span className="live-status" data-testid="live-status">
          {on ? 'Ingresso attivo' : live.state === 'error' ? 'Errore' : 'Ingresso spento'}
        </span>
      </div>
      {live.error ? <p className="issue" role="alert" data-testid="live-error">{live.error}</p> : null}
      {on && live.devices.length > 0 ? (
        <Field label="Dispositivo">
          <Select
            label="Dispositivo d’ingresso"
            testId="live-device"
            value={live.deviceId}
            options={live.devices.map((d) => ({ value: d.id, label: d.label }))}
            onChange={(id) => { update({ inputDeviceId: id }); start(id); }}
          />
        </Field>
      ) : null}
      <Field label={`Gain d’ingresso: ${pct(s.inputGain)}`}>
        <input className="range" type="range" min={0} max={4} step={0.05} value={s.inputGain} aria-label="Gain d’ingresso"
          onChange={(e) => { const inputGain = Number(e.target.value); update({ inputGain }); liveInput.setGain(inputGain); }} />
      </Field>
      <div className="live-level" role="meter" aria-label="Livello d’ingresso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, live.level / 0.5) * 100)} data-testid="live-level">
        <span className="live-level-bar" style={{ width: pct(Math.min(1, live.level / 0.5)) }} />
      </div>
      {live.clipping ? <p className="issue" data-testid="live-clip">Segnale saturo: abbassa il gain.</p> : null}
      {on && live.level < 0.01 ? <p className="field-hint" data-testid="live-weak">Segnale debole o assente: suona una corda o alza il gain.</p> : null}
      <Toggle checked={live.monitorOn} onChange={(monitor) => liveInput.setMonitor(monitor && on, s.monitorVol)}>
        Ascolta la chitarra (usa le cuffie: con le casse può fischiare)
      </Toggle>
      {live.monitorOn ? (
        <Field label={`Volume dell’ascolto: ${pct(s.monitorVol)}`}>
          <input className="range" type="range" min={0} max={1} step={0.01} value={s.monitorVol} aria-label="Volume dell’ascolto"
            onChange={(e) => { const monitorVol = Number(e.target.value); update({ monitorVol }); liveInput.setMonitor(true, monitorVol); }} />
        </Field>
      ) : null}
    </div>
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
  const where = note ? livePositions(note.midi, [], null) : null;
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
      {note && where ? (
        <p className="field-hint" data-testid="live-positions">
          Un segnale solo dà l’altezza, non la corda: {nameOfMidi(note.midi)} si suona in {where.all.length} {where.all.length === 1 ? 'punto' : 'punti'} ({positionsOf(note.midi).map(place).join('; ')}). Sulla tastiera il punto pieno è il più probabile secondo ciò che mostra.
        </p>
      ) : null}
      {feedback ? (
        <p className={`live-feedback is-${feedback}`} data-testid="live-feedback">
          {feedback === 'giusto' ? 'Giusto' : feedback === 'ottava' ? `Nota giusta, ottava diversa (attesa ${nameOfMidi(expected?.midi ?? 0)})` : `Attesa ${nameOfMidi(expected?.midi ?? 0)}`}
        </p>
      ) : null}
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
      <TunerPanel />
    </>
  );
}
