/**
 * Next Fretboard: a read-only preview of the chord that comes next, drawn by
 * the same marker engine as the main neck over the same position (or that
 * chord's own view, D-26). It plays nothing and moves nothing.
 */
import { useEffect, useMemo, useRef } from 'react';
import { resolveChordLayer } from '../../../app/chordLayers';
import { viewForChord, viewNotes, viewScale } from '../../../app/chordViews';
import { arpeggioPlanOf, boardContext, tuningOf } from '../../../app/settings';
import { useApp } from '../../../app/store';
import { shownScaleFor } from '../../../app/noteScale';
import { Fretboard } from '../../../viz/Fretboard';
import boardRosewood from '../v6/hardware/assets/board-rosewood@2x.webp';
import { buildMarkerLayer } from '../../../viz/markers';
import { useNowNext } from './hooks';
import { useStudioUi } from './uiStore';
import { secondaryIndex } from './layout';

const NOOP = () => undefined;

export function NextFretboard() {
  const settings = useApp((s) => s.settings);
  const { now, next, nextIndex, source, list } = useNowNext();
  // N4: the next chord, or one the user picks from the list.
  const choice = useStudioUi((u) => u.viz.secondary);
  const setViz = useStudioUi((u) => u.setViz);
  const targetIndex = source === 'single' ? null : secondaryIndex(choice, nextIndex, list.length);
  const target = choice === 'next' ? next : targetIndex === null ? null : list[targetIndex] ?? null;
  const layerMarks = useStudioUi((u) => u.viz.layerMarks);
  const holder = useRef<HTMLDivElement>(null);
  // A preview, not a second instrument: nothing inside takes focus or clicks.
  useEffect(() => { holder.current?.setAttribute('inert', ''); }, []);

  const layer = useMemo(() => {
    if (!target) return null;
    const tuning = tuningOf(settings);
    const onProgression = source === 'progression';
    const view = onProgression && settings.chordViewsOn && settings.mode !== 'arpeggio'
      ? viewForChord(settings.chordViews, settings.progression.chords.map((c) => c.id), targetIndex)
      : null;
    if (settings.mode === 'arpeggio') {
      const plan = arpeggioPlanOf(target, settings);
      return buildMarkerLayer({ notes: plan?.notes ?? [], scale: boardContext(settings, null).scale, chord: target, nextChord: null, chords: [target], chordIndex: 0, focus: 'all', profile: settings.avoidProfile, labelMode: settings.labelMode, pinnedPc: null, overlays: [], wholeNeck: false, exact: plan?.route ?? false, tuning, fingers: plan?.fingers ?? null });
    }
    // N5/N6: without a view, the next chord's scale by the same rule as the main neck.
    const shown = shownScaleFor(settings, target);
    const context = view ? { scale: viewScale(view), notes: viewNotes(view, target, tuning), wholeNeck: view.positionType === 'neck' } : boardContext({ ...settings, tonic: shown.tonic, scaleId: shown.scaleId }, null);
    const voicing = settings.mode === 'fretboard' && targetIndex !== null
      ? (() => { const l = settings.chordLayers[targetIndex]; return l ? resolveChordLayer(l, tuning).shape?.notes ?? null : null; })()
      : null;
    return buildMarkerLayer({ notes: context.notes, scale: context.scale, chord: target, nextChord: null, chords: [target], chordIndex: 0, focus: 'all', profile: settings.avoidProfile, labelMode: settings.labelMode, pinnedPc: null, overlays: [], voicing, wholeNeck: context.wholeNeck, tuning });
  }, [settings, target, targetIndex, source]);

  const label = source === 'chords' ? 'lista accordi di Fretboard Lab' : 'progressione';
  const message = source === 'single'
    ? 'Con un accordo solo non c’è un accordo successivo: scegli «Progressione» come sorgente degli arpeggi.'
    : !target ? (source === 'chords' ? 'Aggiungi un secondo accordo nella scheda Accordi per vedere il successivo.' : 'La progressione ha un accordo solo.') : null;

  return (
    <section className="v57-sc v57-sc-full" aria-label="Next Fretboard" data-testid="next-fretboard" data-board="rosewood">
      <h4 className="v57-sh">Next Fretboard · {label} · anteprima</h4>
      <div className="v57-nxctx">
        <div className="v57-nxc"><small>Ora</small><b data-testid="next-now">{now?.symbol ?? '—'}</b></div>
        <span className="v57-nxa" aria-hidden="true">→</span>
        <div className="v57-nxc v57-nxt"><small>{choice === 'next' ? 'Prossimo' : 'Scelto'}</small><b data-testid="next-chord">{target?.symbol ?? '—'}</b></div>
        {source !== 'single' && list.length > 0 ? (
          <label className="v57-nxpick">
            <small>Mostra</small>
            <select
              data-testid="secondary-pick"
              aria-label="Accordo della tastiera secondaria"
              value={choice === 'next' ? 'next' : String(targetIndex ?? 0)}
              onChange={(e) => setViz({ secondary: e.target.value === 'next' ? 'next' : Number(e.target.value) })}
            >
              <option value="next">Il prossimo accordo</option>
              {list.map((c, i) => <option key={i} value={i} disabled={!c}>{`${i + 1}. ${c?.symbol ?? '—'}`}</option>)}
            </select>
          </label>
        ) : null}
        <p className="v57-nxp">
          {choice === 'next' ? 'Anteprima del materiale in arrivo' : 'Accordo scelto, fermo mentre la progressione scorre'}, calcolata dal motore sulla stessa posizione. In riproduzione la tastiera principale cambia accordo da sola
          {settings.changeMode === 'manual' && source === 'progression' ? ' quando premi N (cambio manuale)' : ''}.
        </p>
      </div>
      <div className="v57-nxb" ref={holder}>
        {message ? <p className="v57-nxmsg">{message}</p> : null}
        {layer ? <Fretboard markers={layer.markers} arrows={[]} active={null} trail={[]} layerMarks={layerMarks} boardImage={boardRosewood} onPick={NOOP} /> : null}
      </div>
    </section>
  );
}
