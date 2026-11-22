/**
 * N5 · the scale the Note views show over the chord in play, why, and the
 * other scales on its root that hold every chord tone, each one overlayable.
 * Consultation only: it changes what is drawn, never what is played.
 */
import { compatibleScales, followsChords, overlayScale, shownScaleFor } from '../app/noteScale';
import { useApp } from '../app/store';
import { MAX_EXTRA_SCALES } from '../app/scaleLayers';
import { SCALES } from '../theory';
import { useHarmonyContext } from './Board';

export function ChordScalePanel() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.update);
  const { chord } = useHarmonyContext();
  if (!followsChords(settings.mode)) return null;
  const shown = shownScaleFor(settings, chord);
  const options = chord ? compatibleScales(chord, shown) : [];
  const full = settings.scaleLayers.length >= MAX_EXTRA_SCALES;
  const overlaid = (tonic: string, scaleId: string) => settings.scaleLayers.some((l) => l.tonic === tonic && l.scaleId === scaleId);
  return (
    <div className="chord-scale" data-testid="chord-scale">
      <p className="chord-scale-now">
        <strong data-testid="chord-scale-shown">{chord ? `${chord.symbol} → ${shown.tonic} ${SCALES[shown.scaleId].name.toLowerCase()}` : 'Nessun accordo'}</strong>
        {' '}<span className="muted" data-testid="chord-scale-why">{shown.text}</span>
      </p>
      <label className="chord-scale-toggle">
        <input type="checkbox" checked={settings.contextScales} data-testid="chord-scale-follow" onChange={(e) => update({ contextScales: e.target.checked })} />
        {' '}Segui l’accordo in esecuzione (altrimenti resta la scala di riferimento)
      </label>
      {options.length > 0 ? (
        <>
          <h5 className="chord-scale-sub">Scale compatibili su {chord?.rootName}</h5>
          <ul className="chord-scale-list" data-testid="chord-scale-options">
            {options.map((o) => (
              <li key={o.scaleId} data-scale={o.scaleId} data-current={o.current ? '1' : '0'}>
                <span>{o.name}{o.current ? <span className="muted"> · sulla tastiera</span> : null}</span>
                {o.current ? null : (
                  <button
                    type="button"
                    className="link"
                    disabled={full || overlaid(o.tonic, o.scaleId)}
                    aria-label={`Sovrapponi ${o.name}`}
                    onClick={() => update({ scaleLayers: overlayScale(settings.scaleLayers, o, shown) })}
                  >
                    {overlaid(o.tonic, o.scaleId) ? 'Sovrapposta' : 'Sovrapponi'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {full ? <p className="muted">Quattro scale sovrapposte al massimo: togline una nella sezione Scala qui sotto.</p> : null}
        </>
      ) : null}
    </div>
  );
}
