/**
 * Studio V6 notebook pages that read the current selection back in words:
 * «Dettagli» (shared by every lab) and «Voice leading» (Harmony Lab). The
 * figures come from `detailsModel`, which only asks the theory and harmony
 * engines; nothing here decides anything musical.
 */
import { currentExerciseSequence } from '../../../app/settings';
import { useApp } from '../../../app/store';
import { HarmonyPanel } from '../../panels';
import { useNowNext } from '../v57/hooks';
import { positionText } from '../v57/layout';
import { detailsModel } from './details';

function Row({ label, children, testId }: { readonly label: string; readonly children: React.ReactNode; readonly testId?: string }) {
  return <div className="v6-dt-row"><dt>{label}</dt><dd data-testid={testId}>{children}</dd></div>;
}

function useDetails() {
  const settings = useApp((s) => s.settings);
  const { now, next } = useNowNext();
  return { settings, model: detailsModel(settings, now, next) };
}

export function DetailsPage() {
  const { settings, model } = useDetails();
  const { scale, chord, next } = model;
  const exercise = settings.mode === 'fretboard' || settings.mode === 'harmony' || settings.mode === 'jam' ? currentExerciseSequence(settings).length : null;
  return (
    <>
      <section className="v57-sc" aria-label="Scala e tonalità" data-testid="details-scale">
        <h4 className="v57-sh">{settings.mode === 'fretboard' || (settings.mode === 'arpeggio' && settings.arpSource === 'chord') ? 'Scala studiata' : 'Tonalità della progressione'}</h4>
        <dl className="v6-dt">
          <Row label="Scala" testId="details-scale-name">{scale.tonic} {scale.name}</Row>
          <Row label="Formula" testId="details-formula">{scale.formula}</Row>
          <Row label="Note" testId="details-notes">{scale.notes}</Row>
          <Row label="Posizione" testId="details-position">{positionText(settings)}</Row>
        </dl>
      </section>
      <section className="v57-sc" aria-label="Accordo" data-testid="details-chord">
        <h4 className="v57-sh">Accordo {chord ? `· ${chord.symbol}` : ''}</h4>
        {chord ? (
          <dl className="v6-dt">
            <Row label="Note" testId="details-chord-tones">{chord.tones}</Row>
            <Row label="Guide tones">{chord.guide || '—'}</Row>
            <Row label="Funzione" testId="details-numeral">{chord.numeral} in {scale.tonic}</Row>
            <Row label="Basso">{chord.bass}</Row>
          </dl>
        ) : <p className="v57-note">Nessun accordo attivo: la tastiera mostra la sola scala.</p>}
      </section>
      <section className="v57-sc" aria-label="Verso il prossimo accordo" data-testid="details-next">
        <h4 className="v57-sh">Verso il prossimo {next ? `· ${next.symbol}` : ''}</h4>
        {next ? (
          <dl className="v6-dt">
            <Row label="Note comuni">{next.common.length ? next.common.join(' · ') : 'nessuna'}</Row>
            <Row label="Guide tones">{next.motion.length ? next.motion.join(' · ') : '—'}</Row>
          </dl>
        ) : <p className="v57-note">Non c’è un accordo successivo in questo laboratorio.</p>}
        {exercise !== null ? <p className="v57-note" data-testid="details-exercise">Esercizio corrente: {exercise} note nella sequenza.</p> : null}
      </section>
    </>
  );
}

export function VoiceLeadingPage() {
  const { model } = useDetails();
  const { chord, next } = model;
  return (
    <>
      <HarmonyPanel part="voice" />
      <section className="v57-sc v57-sc-wide" aria-label="Movimento delle voci" data-testid="voice-leading">
        <h4 className="v57-sh">Movimento delle voci {chord && next ? `· ${chord.symbol} → ${next.symbol}` : ''}</h4>
        {chord && next ? (
          <dl className="v6-dt">
            <Row label="Note comuni" testId="voice-common">{next.common.length ? next.common.join(' · ') : 'nessuna'}</Row>
            <div className="v6-dt-row"><dt>Guide tones</dt><dd><ul className="v6-dt-list" data-testid="voice-motion">{next.motion.map((m) => <li key={m}>{m}</li>)}</ul></dd></div>
          </dl>
        ) : <p className="v57-note">Servono almeno due accordi nella progressione.</p>}
        <p className="v57-note">Calcolato dal motore armonico sull’accordo attivo e sul successivo: segue la riproduzione e il cambio manuale. La scheda «Tastiera secondaria» mostra il prossimo accordo sul manico.</p>
      </section>
    </>
  );
}
