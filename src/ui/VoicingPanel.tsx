/**
 * Harmony Lab voicings (HA3–HA5, D-67): harmonize a scale or load a
 * functional progression, then voice every chord with the engine on a group
 * of strings. The board and the comping read the same voicings.
 */
import { useState } from 'react';
import { STRING_SETS, VOICING_TYPE_NAMES, type StringVoicing } from '../fretboard';
import { HARMONIZED_SCALES, HARMONY_KINDS, HARMONY_KIND_NAMES, PROGRESSION_KIND_NAMES, type HarmonyKind, type ProgressionKind } from '../harmony';
import { analysisModeOf, functionalProgression, harmonizationProgression, progressionVoicings, voicingMotions } from '../app/harmonyVoicings';
import { HARMONY_VOICING_TYPES, type HarmonyVoicingType, type VoicingMove } from '../app/settings';
import { useApp, usePlayhead } from '../app/store';
import { INVERSION_NAMES, SCALES, TONICS, type ScaleId } from '../theory';
import { Field, Panel, Segmented, Select, Toggle } from './controls';

const TYPE_LABEL = (t: HarmonyVoicingType): string => (t === 'full' ? 'Accordo pieno (4–6 corde)' : VOICING_TYPE_NAMES[t]);
const tonics = TONICS.map((t) => ({ value: t, label: t }));

function describe(v: StringVoicing | null | undefined): string {
  if (!v) return 'Nessun voicing su queste corde: prova un altro gruppo o un altro tipo.';
  const shape = v.frets.map((f) => (f === null ? 'x' : String(f))).join(' ');
  const inversion = v.inversion === null ? `basso sul ${v.degrees[0] ?? '?'}` : (INVERSION_NAMES[v.inversion] ?? '');
  return `${shape} · ${v.degrees.join('-')} · ${inversion}${v.omitted.length ? ` · omesse ${v.omitted.join(', ')}` : ''} · difficoltà ${v.difficulty}/5`;
}

export function VoicingPanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const selected = useApp((state) => state.selectedChord);
  const playing = usePlayhead((p) => p.chordIndex);
  const [tonic, setTonic] = useState('C');
  const [scaleId, setScaleId] = useState<ScaleId>('ionian');
  const [kind, setKind] = useState<HarmonyKind>('triad');
  const [repeat, setRepeat] = useState(1);
  const [prog, setProg] = useState<ProgressionKind>('ii-V-I');
  const [tritone, setTritone] = useState(false);

  const sets = s.voicingType === 'full' ? [] : STRING_SETS[s.voicingType];
  const voicings = progressionVoicings(s);
  const index = Math.min(playing ?? selected, Math.max(0, s.progression.chords.length - 1));
  const current = voicings[index];
  const motion = voicingMotions(voicings)[index];

  const setType = (voicingType: HarmonyVoicingType) => {
    const allowed = voicingType === 'full' ? [] : STRING_SETS[voicingType].map((x) => x.id);
    update({ voicingType, voicingOn: true, ...(allowed.length && !allowed.includes(s.voicingSet) ? { voicingSet: allowed[0] as string } : {}) });
  };

  return (
    <Panel title="Voicing e armonizzazioni" className="panel-wide">
      <div data-testid="voicing-panel">
      <div className="row">
        <Field label="Armonizza">
          <Select label="Tonica da armonizzare" testId="harmonize-tonic" value={tonic} options={tonics} onChange={setTonic} />
        </Field>
        <Field label="Scala">
          <Select<ScaleId> label="Scala da armonizzare" testId="harmonize-scale" value={scaleId} options={HARMONIZED_SCALES.map((id) => ({ value: id, label: SCALES[id].name }))} onChange={setScaleId} />
        </Field>
        <Field label="In">
          <Select<HarmonyKind> label="Tipo di accordi" testId="harmonize-kind" value={kind} options={HARMONY_KINDS.map((k) => ({ value: k, label: HARMONY_KIND_NAMES[k] }))} onChange={setKind} />
        </Field>
        <Field label="Ogni accordo">
          <Select<number> label="Ripetizioni per accordo" testId="harmonize-repeat" value={repeat} options={[1, 2, 3, 4].map((n) => ({ value: n, label: n === 1 ? '1 volta' : `${n} volte (rivolti)` }))} onChange={setRepeat} />
        </Field>
        <button
          type="button"
          className="btn"
          data-testid="harmonize-apply"
          onClick={() => update({ progression: harmonizationProgression(tonic, scaleId, kind, repeat), harmonyKey: tonic, harmonyMode: analysisModeOf(scaleId), voicingOn: true, ...(repeat > 1 ? { voicingMove: 'climb' as const } : {}) })}
        >Crea la progressione</button>
      </div>
      <div className="row">
        <Field label="Progressione funzionale">
          <Select<ProgressionKind> label="Progressione funzionale" testId="functional-kind" value={prog} options={(Object.keys(PROGRESSION_KIND_NAMES) as ProgressionKind[]).map((k) => ({ value: k, label: PROGRESSION_KIND_NAMES[k] }))} onChange={setProg} />
        </Field>
        <Toggle checked={tritone} onChange={setTritone}>Sostituti di tritono</Toggle>
        <button
          type="button"
          className="btn"
          data-testid="functional-apply"
          onClick={() => update({ progression: functionalProgression(prog, tonic, tritone), harmonyKey: tonic, harmonyMode: prog === 'ii-V-i' ? 'aeolian' : 'ionian', voicingOn: true })}
        >Carica in {tonic}</button>
      </div>
      <div className="row">
        <Toggle checked={s.voicingOn} onChange={(voicingOn) => update({ voicingOn })}>Voicing dal motore</Toggle>
        <Field label="Tipo">
          <Select<HarmonyVoicingType> label="Tipo di voicing" testId="voicing-type" value={s.voicingType} options={HARMONY_VOICING_TYPES.map((t) => ({ value: t, label: TYPE_LABEL(t) }))} onChange={setType} />
        </Field>
        {sets.length ? (
          <Field label="Corde">
            <Select label="Gruppo di corde" testId="voicing-set" value={s.voicingSet} options={sets.map((x) => ({ value: x.id, label: x.id }))} onChange={(voicingSet) => update({ voicingSet, voicingOn: true })} />
          </Field>
        ) : null}
        <Field label="Da un accordo all'altro">
          <Segmented<VoicingMove>
            label="Scelta del voicing"
            value={s.voicingMove}
            options={[{ value: 'lead', label: 'Voice leading' }, { value: 'climb', label: 'Sali di rivolto' }, { value: 'fixed', label: 'Rivolto fisso' }]}
            onChange={(voicingMove) => update({ voicingMove, voicingOn: true })}
          />
        </Field>
        {s.voicingMove === 'fixed' ? (
          <Field label="Rivolto">
            <Select<number> label="Rivolto" testId="voicing-inversion" value={s.voicingInversion} options={[0, 1, 2, 3].map((n) => ({ value: n, label: INVERSION_NAMES[n] ?? String(n) }))} onChange={(n) => update({ voicingInversion: n as 0 | 1 | 2 | 3 })} />
          </Field>
        ) : null}
        <Field label="Zona del manico">
          <Select<number> label="Tasto di partenza" testId="voicing-near" value={s.voicingNear} options={[0, 3, 5, 7, 9, 12, 15].map((n) => ({ value: n, label: n === 0 ? 'Prima posizione' : `Tasto ${n}` }))} onChange={(voicingNear) => update({ voicingNear })} />
        </Field>
      </div>
      {s.voicingOn ? (
        <p className="v57-note" data-testid="voicing-current">
          {s.progression.chords[index]?.symbol ?? ''}: {describe(current)}
          {motion ? ` · verso il prossimo: ${motion.map((m) => (m > 0 ? `+${m}` : String(m))).join(' ')} semitoni` : ''}
        </p>
      ) : null}
      </div>
    </Panel>
  );
}
