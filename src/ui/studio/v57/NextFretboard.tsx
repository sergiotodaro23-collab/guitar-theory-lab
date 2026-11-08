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
import { Fretboard } from '../../../viz/Fretboard';
import { buildMarkerLayer } from '../../../viz/markers';
import { useNowNext } from './hooks';
import { useStudioUi } from './uiStore';

const NOOP = () => undefined;

export function NextFretboard() {
  const settings = useApp((s) => s.settings);
  const { now, next, nextIndex, source } = useNowNext();
  const layerMarks = useStudioUi((u) => u.viz.layerMarks);
  const holder = useRef<HTMLDivElement>(null);
  // A preview, not a second instrument: nothing inside takes focus or clicks.
  useEffect(() => { holder.current?.setAttribute('inert', ''); }, []);

  const layer = useMemo(() => {
    if (!next) return null;
    const tuning = tuningOf(settings);
    const onProgression = source === 'progression';
    const view = onProgression && settings.chordViewsOn && settings.mode !== 'arpeggio'
      ? viewForChord(settings.chordViews, settings.progression.chords.map((c) => c.id), nextIndex)
      : null;
    if (settings.mode === 'arpeggio') {
      const plan = arpeggioPlanOf(next, settings);
      return buildMarkerLayer({ notes: plan?.notes ?? [], scale: boardContext(settings, null).scale, chord: next, nextChord: null, chords: [next], chordIndex: 0, focus: 'all', profile: settings.avoidProfile, labelMode: settings.labelMode, pinnedPc: null, overlays: [], wholeNeck: false, exact: plan?.route ?? false, tuning, fingers: plan?.fingers ?? null });
    }
    const context = view ? { scale: viewScale(view), notes: viewNotes(view, next, tuning), wholeNeck: view.positionType === 'neck' } : boardContext(settings, null);
    const voicing = settings.mode === 'fretboard' && nextIndex !== null
      ? (() => { const l = settings.chordLayers[nextIndex]; return l ? resolveChordLayer(l, tuning).shape?.notes ?? null : null; })()
      : null;
    return buildMarkerLayer({ notes: context.notes, scale: context.scale, chord: next, nextChord: null, chords: [next], chordIndex: 0, focus: 'all', profile: settings.avoidProfile, labelMode: settings.labelMode, pinnedPc: null, overlays: [], voicing, wholeNeck: context.wholeNeck, tuning });
  }, [settings, next, nextIndex, source]);

  const label = source === 'chords' ? 'lista accordi di Fretboard Lab' : 'progressione';
  const message = source === 'single'
    ? 'Con un accordo solo non c’è un accordo successivo: scegli «Progressione» come sorgente degli arpeggi.'
    : !next ? (source === 'chords' ? 'Aggiungi un secondo accordo nella scheda Accordi per vedere il successivo.' : 'La progressione ha un accordo solo.') : null;

  return (
    <section className="v57-sc v57-sc-full" aria-label="Next Fretboard" data-testid="next-fretboard">
      <h4 className="v57-sh">Next Fretboard · {label} · anteprima</h4>
      <div className="v57-nxctx">
        <div className="v57-nxc"><small>Ora</small><b data-testid="next-now">{now?.symbol ?? '—'}</b></div>
        <span className="v57-nxa" aria-hidden="true">→</span>
        <div className="v57-nxc v57-nxt"><small>Prossimo</small><b data-testid="next-chord">{next?.symbol ?? '—'}</b></div>
        <p className="v57-nxp">
          Anteprima del materiale in arrivo, calcolata dal motore sulla stessa posizione. In riproduzione la tastiera principale cambia accordo da sola
          {settings.changeMode === 'manual' && source === 'progression' ? ' quando premi N (cambio manuale)' : ''}.
        </p>
      </div>
      <div className="v57-nxb" ref={holder}>
        {message ? <p className="v57-nxmsg">{message}</p> : null}
        {layer ? <Fretboard markers={layer.markers} arrows={[]} active={null} trail={[]} layerMarks={layerMarks} onPick={NOOP} /> : null}
      </div>
    </section>
  );
}
