/**
 * Live Monitor 2.0 (D-31): sensitivity, calibration and profiles. Each step
 * records the dry input for a few seconds and turns it into a setting; every
 * value is marked as measured or set by hand. Nothing here claims to know the
 * string or the fret: the input is one voice, the place is always a guess.
 */
import { useState } from 'react';
import { engine } from '../app/engine';
import { analysisSettingsOf } from '../app/settings';
import { useApp } from '../app/store';
import { liveInput, useLive } from '../audio/liveInput';
import { newLayerId } from '../app/scaleLayers';
import {
  DEFAULT_PROFILE, MAX_PROFILES, SENSITIVITIES, SENSITIVITY, analyseOffline, detectOnsets, measureLatency, measureNoise, measureNotes, suggestSensitivity,
  type LiveProfile, type Sensitivity,
} from '../pitch';
import { Field, Panel, Segmented, Select } from './controls';

type Step = 'noise' | 'notes' | 'response' | 'latency';
const STEPS: readonly { id: Step; title: string; ask: string; seconds: number }[] = [
  { id: 'noise', title: '1 · Silenzio', ask: 'Non suonare e smorza le corde: misuro il rumore di fondo.', seconds: 2 },
  { id: 'notes', title: '2 · Note tenute', ask: 'Suona e tieni alcune note, una alla volta, con il tuo attacco normale.', seconds: 4 },
  { id: 'response', title: '3 · Passaggio breve', ask: 'Suona un passaggio veloce, anche con legati: confronto le modalità.', seconds: 4 },
  { id: 'latency', title: '4 · Latenza', ask: 'Pizzica una corda a ogni click (otto click), oppure collega l’uscita all’ingresso.', seconds: 5 },
];

const mark = (measured: boolean) => (measured ? 'misurato' : 'impostato a mano');

export function CalibrationPanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const on = useLive((l) => l.state === 'on');
  const [busy, setBusy] = useState<Step | null>(null);
  const [result, setResult] = useState('');
  const [name, setName] = useState('');
  const profile = s.liveProfiles.find((p) => p.id === s.liveProfileId) ?? null;

  const apply = (next: Partial<typeof s>) => {
    update(next);
    const after = { ...useApp.getState().settings };
    liveInput.configure(analysisSettingsOf(after));
    if (next.inputGain !== undefined) liveInput.setGain(after.inputGain);
    if (next.inputChannel !== undefined) liveInput.route(after.inputChannel);
  };
  const saveProfile = (changes: Partial<LiveProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...changes };
    apply({ liveProfiles: s.liveProfiles.map((p) => (p.id === profile.id ? updated : p)) });
  };
  const choose = (id: string) => {
    const p = s.liveProfiles.find((x) => x.id === id);
    apply(p ? { liveProfileId: id, inputGain: p.inputGain, inputChannel: p.channel, liveSensitivity: p.sensitivity } : { liveProfileId: '' });
  };
  const create = () => {
    const label = name.trim() || `Profilo ${s.liveProfiles.length + 1}`;
    const p: LiveProfile = { ...DEFAULT_PROFILE, id: newLayerId(), name: label, inputGain: s.inputGain, channel: s.inputChannel, sensitivity: s.liveSensitivity };
    apply({ liveProfiles: [...s.liveProfiles, p], liveProfileId: p.id });
    setName('');
  };

  const run = async (step: Step) => {
    if (!profile) return;
    setBusy(step);
    setResult('');
    const seconds = STEPS.find((x) => x.id === step)?.seconds ?? 3;
    const clicks = step === 'latency' ? liveInput.playClicks(8, 0.5, engine.audioOut().destination) : [];
    const take = await liveInput.capture(seconds);
    setBusy(null);
    if (!take) { setResult('Ingresso non attivo.'); return; }
    if (step === 'noise') {
      const r = measureNoise(take.levels);
      saveProfile({ noiseRms: r.noiseRms, minRms: r.minRms, measured: { ...profile.measured, noise: true } });
      setResult(`Rumore ${r.noiseRms.toFixed(4)} RMS: sotto ${r.minRms.toFixed(3)} è silenzio.`);
    } else if (step === 'notes') {
      const r = measureNotes(take.readings);
      if (!r) { setResult('Non ho sentito note abbastanza a lungo: riprova suonando più forte o alzando il gain.'); return; }
      const inputGain = Math.min(4, Math.max(0, Math.round(s.inputGain * r.gainFactor * 20) / 20));
      saveProfile({ inputGain, minConfidence: r.minConfidence, measured: { ...profile.measured, notes: true } });
      apply({ inputGain });
      setResult(`Livello ${r.level.toFixed(3)} RMS, affidabilità tipica ${Math.round(r.confidence * 100)}%: gain ${Math.round(inputGain * 100)}%, soglia ${Math.round(r.minConfidence * 100)}%.`);
    } else if (step === 'response') {
      const balanced = analyseOffline(take.samples, take.sampleRate, 'balanced', profile.minRms).length;
      const fast = analyseOffline(take.samples, take.sampleRate, 'fast', profile.minRms).length;
      const sensitivity = suggestSensitivity(balanced, fast);
      saveProfile({ sensitivity, measured: { ...profile.measured, response: true } });
      apply({ liveSensitivity: sensitivity });
      setResult(`Bilanciata ${balanced} note, Rapida ${fast}: consiglio ${SENSITIVITY[sensitivity].label}.`);
    } else {
      const onsets = detectOnsets(take.samples, take.sampleRate, profile.minRms).map((t) => t + take.startTime);
      const latency = measureLatency(clicks, onsets);
      if (latency === null) { setResult('Non ho sentito abbastanza risposte ai click: la latenza resta quella impostata.'); return; }
      saveProfile({ latencyMs: latency, measured: { ...profile.measured, latency: true } });
      setResult(`Latenza misurata: ${latency} ms.`);
    }
  };

  return (
    <Panel title="Sensibilità e calibrazione" className="calibration-panel">
      <Field label="Sensibilità" hint={SENSITIVITY[s.liveSensitivity].help} group>
        <Segmented<Sensitivity>
          label="Sensibilità del Live Monitor"
          value={s.liveSensitivity}
          options={SENSITIVITIES.map((m) => ({ value: m, label: SENSITIVITY[m].label }))}
          onChange={(liveSensitivity) => { apply({ liveSensitivity }); if (profile) saveProfile({ sensitivity: liveSensitivity }); }}
        />
      </Field>
      <div className="row">
        <Field label="Profilo">
          <Select<string>
            label="Profilo dello strumento" testId="live-profile" value={s.liveProfileId}
            options={[{ value: '', label: 'Nessuno (valori di partenza)' }, ...s.liveProfiles.map((p) => ({ value: p.id, label: p.name }))]}
            onChange={choose}
          />
        </Field>
        <Field label="Nuovo profilo">
          <input className="text-input" data-testid="profile-name" placeholder="Strat, pickup al ponte, scheda…" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <button type="button" className="btn" data-testid="profile-create" disabled={s.liveProfiles.length >= MAX_PROFILES} onClick={create}>Crea</button>
      </div>
      {profile ? (
        <>
          <div className="row">
            <Field label="Chitarra"><input className="text-input" aria-label="Chitarra del profilo" value={profile.guitar} onChange={(e) => saveProfile({ guitar: e.target.value.slice(0, 40) })} /></Field>
            <Field label="Pickup"><input className="text-input" aria-label="Pickup del profilo" value={profile.pickup} onChange={(e) => saveProfile({ pickup: e.target.value.slice(0, 40) })} /></Field>
            <Field label="Scheda audio"><input className="text-input" aria-label="Scheda audio del profilo" value={profile.device} onChange={(e) => saveProfile({ device: e.target.value.slice(0, 80) })} /></Field>
          </div>
          <ol className="calibration-steps" data-testid="calibration-steps">
            {STEPS.map((step) => (
              <li key={step.id} className="calibration-step">
                <strong>{step.title}</strong>
                <span className="muted">{step.ask}</span>
                <button type="button" className="btn" data-testid={`calibrate-${step.id}`} disabled={!on || busy !== null} onClick={() => void run(step.id)}>
                  {busy === step.id ? `Ascolto ${step.seconds} s…` : 'Misura'}
                </button>
              </li>
            ))}
          </ol>
          {!on ? <p className="field-hint">Avvia l’ingresso per misurare.</p> : null}
          <p className="field-hint calibration-result" role="status" data-testid="calibration-result">{result}</p>
          <dl className="calibration-values" data-testid="calibration-values">
            <dt>Silenzio sotto</dt><dd data-testid="value-minrms">{profile.minRms.toFixed(3)} RMS · {mark(profile.measured.noise)}</dd>
            <dt>Gain</dt><dd>{Math.round(profile.inputGain * 100)}% · {mark(profile.measured.notes)}</dd>
            <dt>Soglia di affidabilità</dt>
            <dd>
              <input className="range" type="range" min={0.6} max={0.95} step={0.01} value={profile.minConfidence} aria-label="Soglia di affidabilità del profilo"
                onChange={(e) => saveProfile({ minConfidence: Number(e.target.value), measured: { ...profile.measured, notes: false } })} />
              {Math.round(profile.minConfidence * 100)}% · {mark(profile.measured.notes)}
            </dd>
            <dt>Sensibilità</dt><dd>{SENSITIVITY[profile.sensitivity].label} · {mark(profile.measured.response)}</dd>
            <dt>Latenza</dt>
            <dd>
              <input className="text-input narrow" type="number" min={0} max={500} aria-label="Latenza del profilo in millisecondi" value={profile.latencyMs}
                onChange={(e) => saveProfile({ latencyMs: Math.max(0, Math.min(500, Number(e.target.value) || 0)), measured: { ...profile.measured, latency: false } })} /> ms · {mark(profile.measured.latency)}
            </dd>
          </dl>
          <div className="row">
            <button type="button" className="btn" data-testid="profile-reset" onClick={() => saveProfile({ ...DEFAULT_PROFILE, guitar: profile.guitar, pickup: profile.pickup, device: profile.device })}>Ripristina i valori di partenza</button>
            <button type="button" className="btn" data-testid="profile-delete" onClick={() => apply({ liveProfiles: s.liveProfiles.filter((p) => p.id !== profile.id), liveProfileId: '' })}>Elimina il profilo</button>
          </div>
          <p className="field-hint">La latenza del profilo scelto corregge il riscontro sugli esercizi: la nota sentita si confronta con quella chiesta in quell’istante.</p>
        </>
      ) : <p className="field-hint">Crea un profilo per ogni chitarra, pickup, scheda e canale: la calibrazione si salva lì.</p>}
    </Panel>
  );
}
