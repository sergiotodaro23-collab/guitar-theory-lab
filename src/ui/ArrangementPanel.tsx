/**
 * Jam Studio arrangement (P3-08, D-33): the progression as a song. Each
 * section repeats it with its own groove, dynamics, fill and band. The
 * panel edits the list; the engine plays it on the shared clock.
 */
import { useApp, usePlayhead } from '../app/store';
import {
  ARRANGEMENT_PRESETS, DYNAMICS, MAX_REPEATS, MAX_SECTIONS, PATTERN_NAMES, SECTION_NAMES, section, sectionAtBar, sectionSpans,
  type Dynamics, type Section, type SectionKind,
} from '../jam';
import { meterOf, type MixChannel } from '../app/settings';
import { Field, Panel, Segmented, Select, Toggle } from './controls';

const KIND_OPTIONS = (Object.keys(SECTION_NAMES) as SectionKind[]).map((k) => ({ value: k, label: SECTION_NAMES[k] }));
const DYN_OPTIONS = (Object.keys(DYNAMICS) as Dynamics[]).map((d) => ({ value: d, label: DYNAMICS[d].label }));
const SOLO_OPTIONS: readonly { value: MixChannel | ''; label: string }[] = [
  { value: '', label: 'Nessuno' }, { value: 'drums', label: 'Batteria' }, { value: 'bass', label: 'Basso' }, { value: 'comp', label: 'Accordi' },
  { value: 'notes', label: 'Note' }, { value: 'click', label: 'Click' },
];

export function ArrangementPanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const bar = usePlayhead((p) => p.bar);
  const transport = usePlayhead((p) => p.state);
  const spans = sectionSpans(s.arrangement, s.progression, meterOf(s));
  const now = s.arrangementOn && transport !== 'stopped' ? sectionAtBar(spans, bar) : null;
  const set = (sections: readonly Section[]) => update({ arrangement: sections });
  const change = (id: string, patch: Partial<Section>) => set(s.arrangement.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (i: number, by: number) => {
    const list = [...s.arrangement];
    const [item] = list.splice(i, 1);
    if (item) list.splice(Math.max(0, Math.min(list.length, i + by)), 0, item);
    set(list);
  };
  const totalBars = spans.reduce((sum, x) => sum + x.bars, 0);

  return (
    <Panel title="Arrangiamento" className="panel-wide arrangement-panel">
      <div className="row">
        <Toggle checked={s.arrangementOn} onChange={(arrangementOn) => update(arrangementOn && s.arrangement.length === 0
          ? { arrangementOn, arrangement: ARRANGEMENT_PRESETS[0]?.sections() ?? [] } : { arrangementOn })}>
          Suona come una canzone
        </Toggle>
        <Field label="Modello">
          <Select<string>
            label="Modello di arrangiamento" testId="arrangement-preset" value=""
            options={[{ value: '', label: 'Scegli…' }, ...ARRANGEMENT_PRESETS.map((p) => ({ value: p.id, label: p.name }))]}
            onChange={(id) => { const p = ARRANGEMENT_PRESETS.find((x) => x.id === id); if (p) update({ arrangement: p.sections(), arrangementOn: true }); }}
          />
        </Field>
        <Field label="Solo">
          <Select<MixChannel | ''> label="Canale in solo" testId="solo-channel" value={s.soloChannel} options={SOLO_OPTIONS} onChange={(soloChannel) => update({ soloChannel })} />
        </Field>
      </div>
      <p className="field-hint" data-testid="arrangement-now" role="status">
        {s.arrangementOn
          ? now ? `Ora: ${SECTION_NAMES[now.section.kind]} (${now.index + 1} di ${spans.length})` : `${spans.length} sezioni, ${totalBars} battute${s.loop ? ', poi da capo' : ''}.`
          : 'Spento: la progressione gira in loop con il pattern scelto.'}
      </p>
      <ol className="arrangement-list" data-testid="arrangement-list">
        {s.arrangement.map((x, i) => (
          <li key={x.id} className={`arrangement-item ${now?.section.id === x.id ? 'is-now' : ''}`} data-testid={`section-${i}`}>
            <div className="row">
              <Select<SectionKind> label={`Tipo della sezione ${i + 1}`} value={x.kind} options={KIND_OPTIONS} onChange={(kind) => change(x.id, { kind })} />
              <Select<number> label={`Ripetizioni della sezione ${i + 1}`} value={x.repeats} options={Array.from({ length: MAX_REPEATS }, (_, k) => ({ value: k + 1, label: `×${k + 1}` }))} onChange={(repeats) => change(x.id, { repeats })} />
              <Segmented<number> label={`Groove della sezione ${i + 1}`} value={x.pattern} options={PATTERN_NAMES.map((n, k) => ({ value: k, label: n }))} onChange={(pattern) => change(x.id, { pattern })} />
              <Select<Dynamics> label={`Dinamica della sezione ${i + 1}`} value={x.dynamics} options={DYN_OPTIONS} onChange={(dynamics) => change(x.id, { dynamics })} />
            </div>
            <div className="row">
              <Toggle checked={x.drums} onChange={(drums) => change(x.id, { drums })}>Batteria</Toggle>
              <Toggle checked={x.bass} onChange={(bass) => change(x.id, { bass })}>Basso</Toggle>
              <Toggle checked={x.comp} onChange={(comp) => change(x.id, { comp })}>Accordi</Toggle>
              <Toggle checked={x.fill} onChange={(fill) => change(x.id, { fill })}>Fill alla fine</Toggle>
              <button type="button" className="icon-btn" aria-label={`Sposta su la sezione ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="icon-btn" aria-label={`Sposta giù la sezione ${i + 1}`} disabled={i === s.arrangement.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="icon-btn" aria-label={`Rimuovi la sezione ${i + 1}`} onClick={() => set(s.arrangement.filter((y) => y.id !== x.id))}>✕</button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn" data-testid="section-add" disabled={s.arrangement.length >= MAX_SECTIONS} onClick={() => set([...s.arrangement, section('verse')])}>
        + Aggiungi sezione
      </button>
    </Panel>
  );
}
