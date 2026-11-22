/**
 * Arpeggio editing (AR6): change one note of the engine's line, or write the
 * whole route by hand, and see what a hand would find hard in it. The engine
 * keeps the line; the edits name its notes by index, so changing one note
 * never moves the others.
 */
import { useState } from 'react';
import { applyEdits, ergonomicIssues, formatRoute, lineKey, parseRoute, samePitchPlaces, stepOnString, withEdit, type ArpEdit, type ErgoIssue, type ErgoRules } from '../exercises';
import { arpeggioPlanOf, engineArpeggioLine, tuningOf } from '../app/settings';
import { useApp } from '../app/store';
import { chromaticName, noteName, tryParseChord, type Chord } from '../theory';
import type { FretNote } from '../fretboard';
import { Field, Select, Toggle } from './controls';

const nameOf = (chord: Chord, pc: number): string => {
  const tone = chord.tones.find((t) => t.pc === pc);
  return tone ? noteName(tone.note) : chromaticName(pc, chord.rootName.includes('b'));
};

function issueText(issue: ErgoIssue, rules: ErgoRules): string {
  const at = `Nota ${issue.index + 1}`;
  switch (issue.kind) {
    case 'stretch': return `${at}: apertura di ${issue.amount} tasti, oltre i ${rules.maxStretch} scelti.`;
    case 'jump': return `${at}: salto di ${issue.amount} tasti dalla nota prima.`;
    case 'shifts': return `${at}: ${issue.amount} cambi di posizione, oltre i ${rules.maxShifts} scelti.`;
    case 'open': return `${at}: corda a vuoto, esclusa dai limiti.`;
    case 'outside': return `${at}: fuori dall’accordo e dalla linea del motore.`;
  }
}

export function ArpEditor() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const [selected, setSelected] = useState<number | null>(null);
  if (s.arpSource !== 'chord') {
    return <p className="field-hint" data-testid="arp-edit-progression">L’editing nota per nota e il percorso a mano valgono su un accordo singolo.</p>;
  }
  const chord = tryParseChord(s.arpSymbol);
  if (!chord) return null;
  const tuning = tuningOf(s);
  const base = engineArpeggioLine(chord, s);
  const key = lineKey(base);
  const edits = s.arpEditKey === key ? s.arpEdits : [];
  const played = arpeggioPlanOf(chord, s)?.sequence ?? [];
  const allowed = new Set([...chord.tones.map((t) => t.pc), ...base.map((n) => n.pc)]);
  const issues = ergonomicIssues(played, s.arpErgo, allowed);
  const route = parseRoute(s.arpRouteText, tuning);
  const ergo = (patch: Partial<ErgoRules>) => update({ arpErgo: { ...s.arpErgo, ...patch } });
  const edit = (e: ArpEdit) => update({ arpEdits: withEdit(edits, e), arpEditKey: key });
  const shown = base.map((n, i): FretNote | null => {
    const e = edits.find((x) => x.index === i);
    if (!e) return n;
    return e.to === null ? null : (applyEdits([n], [{ index: 0, to: e.to }], tuning)[0] ?? n);
  });
  const current = selected !== null ? shown[selected] : undefined;
  const chordPcs = new Set(chord.tones.map((t) => t.pc));
  const strings = tuning.length;

  return (
    <div className="arp-editor" data-testid="arp-editor">
      <div className="row">
        <Toggle checked={s.arpRouteOn} onChange={(arpRouteOn) => update({ arpRouteOn, ...(arpRouteOn && !s.arpRouteText ? { arpRouteText: formatRoute(played, strings) } : {}) })}>Percorso scritto a mano</Toggle>
      </div>
      {s.arpRouteOn ? (
        <>
          <Field label="Percorso (corda/tasto)" hint="Corde numerate dal Mi cantino (1) al Mi basso (6): 6/8 5/7 5/10 4/10.">
            <input className={`text-input ${route.errors.length ? 'is-invalid' : ''}`} data-testid="arp-route" defaultValue={s.arpRouteText} key={`${s.arpRouteText}`} aria-invalid={route.errors.length > 0} onBlur={(e) => update({ arpRouteText: e.target.value })} />
          </Field>
          {route.errors.length ? <ul className="field-hint" data-testid="arp-route-errors">{route.errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
          <button type="button" className="btn" data-testid="arp-route-from-engine" onClick={() => update({ arpRouteText: formatRoute(base, strings) })}>Riparti dal percorso del motore</button>
        </>
      ) : (
        <>
          <Field label="Note della linea" hint="Scegli una nota: spostala su un’altra corda, cambiala con la nota dell’accordo vicina o toglila. Le altre restano dove sono.">
            <ol className="chord-view-chips" data-testid="arp-edit-notes">
              {shown.map((n, i) => (
                <li key={i}>
                  <button type="button" className={`chord-chip small ${edits.some((e) => e.index === i) ? 'has-view' : ''}`} aria-pressed={selected === i} data-testid={`arp-note-${i}`} onClick={() => setSelected(selected === i ? null : i)}>
                    {n ? `${nameOf(chord, n.pc)} ${strings - n.string}/${n.fret}` : '—'}
                  </button>
                </li>
              ))}
            </ol>
          </Field>
          {selected !== null && selected < base.length ? (
            <div className="row" data-testid="arp-edit-actions">
              {current ? (
                <>
                  <button type="button" className="btn" data-testid="arp-edit-string" disabled={!samePitchPlaces(current, tuning).length} onClick={() => {
                    const places = [current, ...samePitchPlaces(current, tuning)].sort((a, b) => a.string - b.string);
                    const next = places[(places.findIndex((p) => p.string === current.string) + 1) % places.length] as FretNote;
                    edit({ index: selected, to: { string: next.string, fret: next.fret } });
                  }}>Stessa nota, altra corda</button>
                  {([1, -1] as const).map((dir) => {
                    const next = stepOnString(current, chordPcs, dir, tuning);
                    return (
                      <button key={dir} type="button" className="btn" data-testid={dir > 0 ? 'arp-edit-up' : 'arp-edit-down'} disabled={!next} onClick={() => next && edit({ index: selected, to: { string: next.string, fret: next.fret } })}>
                        {dir > 0 ? 'Nota dell’accordo sopra' : 'Nota dell’accordo sotto'}
                      </button>
                    );
                  })}
                  <button type="button" className="btn" data-testid="arp-edit-remove" onClick={() => edit({ index: selected, to: null })}>Togli</button>
                </>
              ) : null}
              <button type="button" className="btn" data-testid="arp-edit-reset-one" disabled={!edits.some((e) => e.index === selected)} onClick={() => update({ arpEdits: edits.filter((e) => e.index !== selected), arpEditKey: key })}>Ripristina la nota</button>
            </div>
          ) : null}
          {edits.length ? <button type="button" className="btn" data-testid="arp-edit-reset" onClick={() => { update({ arpEdits: [], arpEditKey: '' }); setSelected(null); }}>Ripristina la linea del motore</button> : null}
          {s.arpEdits.length && s.arpEditKey !== key ? <p className="field-hint" data-testid="arp-edit-stale">Le modifiche salvate erano per un’altra forma: qui suona la linea del motore.</p> : null}
        </>
      )}
      <div className="row">
        <Field label="Apertura della mano">
          <Select<number> label="Apertura massima" testId="arp-ergo-stretch" value={s.arpErgo.maxStretch} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n + 1} tasti` }))} onChange={(maxStretch) => ergo({ maxStretch })} />
        </Field>
        <Field label="Salto massimo">
          <Select<number> label="Salto massimo" testId="arp-ergo-jump" value={s.arpErgo.maxJump} options={[3, 4, 5, 6, 7, 9, 12].map((n) => ({ value: n, label: `${n} tasti` }))} onChange={(maxJump) => ergo({ maxJump })} />
        </Field>
        <Field label="Cambi di posizione">
          <Select<number> label="Cambi di posizione massimi" testId="arp-ergo-shifts" value={s.arpErgo.maxShifts} options={[0, 1, 2, 3, 4, 6, 8].map((n) => ({ value: n, label: String(n) }))} onChange={(maxShifts) => ergo({ maxShifts })} />
        </Field>
        <Toggle checked={s.arpErgo.allowOpen} onChange={(allowOpen) => ergo({ allowOpen })}>Corde a vuoto</Toggle>
      </div>
      <div className="field-hint" data-testid="arp-ergo" role="status">
        {issues.length ? <ul>{issues.map((i) => <li key={`${i.index}-${i.kind}`}>{issueText(i, s.arpErgo)}</li>)}</ul> : 'Nessun problema di diteggiatura con questi limiti.'}
      </div>
    </div>
  );
}
