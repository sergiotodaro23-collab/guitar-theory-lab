/**
 * TONE3000 in the amp head (D-52, docs/TONE3000_INTEGRATION.md): the optional
 * way to pick a NAM capture from the TONE3000 library. The catalogue itself
 * is TONE3000's own Select flow in a popup; this dialog is the entry point,
 * the introduction shown before signing in, and the details of the chosen
 * tone with its model selector. Guitar Theory Lab works fully without it.
 */
import { useEffect, useRef, useState } from 'react';
import { engine } from '../../../app/engine';
import { architectureLabel, formatLabel, gearIncludesCab, gearLabel, type T3kArchitecture, type T3kModel } from '../../../app/tone3000';
import {
  browseTone3000, cancelTone3000, clearTone, downloadModel, forgetPublishableKey, hasBuiltInKey, publishableKey, redirectUri, savePublishableKey, signOutTone3000, useTone3000,
} from '../../../app/tone3000Client';
import { namHost, useNam } from '../../../audio/namHost';
import { useRig } from '../v57/rig';

/** The full name first, wherever TONE3000 is entered; the short T3K mark only where the user already has that context. */
export function Tone3000Wordmark() {
  return <span className="v6-t3k-word" aria-label="TONE3000">TONE3000</span>;
}
export function T3kMark() {
  return <span className="v6-t3k-mark" title="Da TONE3000" aria-label="Da TONE3000">T3K</span>;
}

function KeySetup({ onSaved }: { readonly onSaved: () => void }) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const save = () => {
    const check = savePublishableKey(value);
    if (check.ok) { setMessage(''); onSaved(); } else setMessage(check.message);
  };
  return (
    <div className="v6-t3k-block" data-testid="t3k-key-setup">
      <p>Questa copia di Guitar Theory Lab non ha una chiave TONE3000. Il catalogo è facoltativo: il rig, i modelli da file e tutto il resto funzionano senza.</p>
      <p>Per collegarlo serve una <b>chiave pubblicabile</b> (<code>t3k_pub_…</code>), che si crea su tone3000.com in Settings → API Keys. Se sulla chiave registri degli indirizzi di ritorno, aggiungi questo:</p>
      <p><code data-testid="t3k-redirect">{redirectUri()}</code></p>
      <label className="v6-t3k-field">
        <span>Chiave pubblicabile</span>
        <input className="v6-pl-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="t3k_pub_…" autoComplete="off" spellCheck={false} data-testid="t3k-key-input" />
      </label>
      <div className="v6-t3k-row">
        <button type="button" className="v6-minikey" data-testid="t3k-key-save" onClick={save}>Salva la chiave su questo dispositivo</button>
      </div>
      {message ? <p className="v6-alert" role="alert" data-testid="t3k-key-error">{message}</p> : null}
      <p className="v6-pl-foot">Mai la chiave segreta (<code>t3k_cs_…</code>): quest’app gira tutta nel browser. La chiave pubblicabile resta su questo dispositivo, fuori dai preset e dalle sessioni.</p>
    </div>
  );
}

function ToneDetails() {
  const t3k = useTone3000();
  const nam = useNam();
  const [, setRig] = useRig();
  const [modelId, setModelId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const tone = t3k.tone;
  if (!tone) return null;
  const model: T3kModel | undefined = t3k.models.find((m) => m.id === modelId) ?? t3k.models[0];
  const busy = t3k.downloading || nam.pending !== '';
  const loadedHere = nam.phase === 'ready' && nam.origin?.kind === 'tone3000' && nam.origin.toneId === tone.id && nam.origin.modelId === model?.id;
  const load = async () => {
    if (!model) return;
    setMessage('');
    try {
      const text = await downloadModel(model);
      const ok = await namHost.load(text, `${model.name}.nam`, engine.audioOut().ctx, {
        kind: 'tone3000', toneId: tone.id, modelId: model.id, title: tone.title, author: tone.author, toneUrl: tone.url, gear: tone.gear, imageUrl: tone.imageUrl,
      });
      if (!ok) return;
      // An amp captured with its cabinet skips the rig's cabinet; the switch in the head stays the user's.
      const includesCab = gearIncludesCab(tone.gear) || (useNam.getState().summary?.includesCab ?? false);
      setRig((r) => ({ ...r, amp: { ...r.amp, model: 'nam', namCab: includesCab } }));
    } catch (error) {
      setMessage(`Download non riuscito: ${error instanceof Error ? error.message : 'errore di rete'}.`);
    }
  };
  return (
    <div className="v6-t3k-tone" data-testid="t3k-tone">
      {tone.imageUrl ? <img className="v6-t3k-img" src={tone.imageUrl} alt="" referrerPolicy="no-referrer" /> : <div className="v6-t3k-img" aria-hidden="true" />}
      <div className="v6-t3k-info">
        <h3 data-testid="t3k-tone-title">{tone.title}</h3>
        <p className="v6-t3k-tags"><span>{gearLabel(tone.gear)}</span><span>{formatLabel(tone.format)}</span>{tone.license ? <span>Licenza: {tone.license}</span> : null}</p>
        <p className="v6-t3k-by">
          {tone.avatarUrl ? <img src={tone.avatarUrl} alt="" width={20} height={20} referrerPolicy="no-referrer" /> : null}
          <span data-testid="t3k-tone-author">@{tone.author || 'sconosciuto'}</span>
          <a href={tone.url} target="_blank" rel="noreferrer noopener" data-testid="t3k-tone-link">Pagina su TONE3000</a>
        </p>
        {tone.description ? <p className="v6-t3k-desc">{tone.description}</p> : null}
        <label className="v6-t3k-field">
          <span>Modello</span>
          <select className="v6-select" aria-label="Modello del tone" data-testid="t3k-model" value={model?.id ?? ''} disabled={busy || t3k.models.length === 0} onChange={(e) => setModelId(Number(e.target.value))}>
            {t3k.models.map((m) => <option key={m.id} value={m.id}>{m.name}{architectureLabel(m.architecture) ? ` · ${architectureLabel(m.architecture)}` : ''}{m.size ? ` · ${m.size}` : ''}</option>)}
          </select>
        </label>
        <div className="v6-t3k-row">
          <button type="button" className="v6-minikey" data-testid="t3k-load" disabled={busy || !model} onClick={() => void load()}>{loadedHere ? 'Ricarica nel rig' : 'Carica nel rig'}</button>
          <button type="button" className="v6-minikey" data-testid="t3k-other" disabled={busy} onClick={() => void browseTone3000(t3k.architecture)}>Scegli un altro tone</button>
        </div>
        <p className="v6-pl-foot" role="status" data-testid="t3k-load-status">
          {t3k.downloading ? 'Download del modello da TONE3000…'
            : nam.pending ? (nam.phase === 'loading' ? 'Caricamento nel motore…' : 'Verifica e misura del modello…')
            : loadedHere ? 'Modello caricato nel motore: è nello stadio amplificatore.'
            : 'Il modello viene scaricato solo quando lo carichi, e resta in memoria per questa visita.'}
        </p>
        {message ? <p className="v6-alert" role="alert" data-testid="t3k-load-error">{message}</p> : null}
        {nam.error ? <p className="v6-alert" role="alert">{nam.error}</p> : null}
      </div>
    </div>
  );
}

export function Tone3000Dialog({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const t3k = useTone3000();
  const [keyed, setKeyed] = useState(() => publishableKey() !== '');
  const [architecture, setArchitecture] = useState<T3kArchitecture>('2');
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) { setKeyed(publishableKey() !== ''); el.showModal(); }
    if (!open && el.open) el.close();
  }, [open]);
  const working = t3k.phase === 'waiting' || t3k.phase === 'exchanging' || t3k.phase === 'fetching';
  return (
    <dialog ref={dialog} className="v6-pl v6-t3k" aria-label="TONE3000" data-testid="t3k-dialog" onClose={onClose} onClick={(e) => { if (e.target === dialog.current) onClose(); }}>
      <div className="v6-pl-in">
        <header className="v6-pl-head">
          <h2><Tone3000Wordmark /> <small>NAM Captures and IRs</small></h2>
          <button type="button" className="v6-minikey" data-testid="t3k-close" onClick={onClose}>Chiudi</button>
        </header>
        {!keyed ? <KeySetup onSaved={() => setKeyed(true)} /> : t3k.phase === 'tone' ? <ToneDetails /> : (
          <div className="v6-t3k-block" data-testid="t3k-splash">
            <p>Guitar Theory Lab si collega a <b>TONE3000</b> per darti accesso a una grande libreria di capture Neural Amp Modeler (NAM) di strumentazione analogica reale, creati da una comunità mondiale di musicisti.</p>
            <p>Sfogli e scegli il tone sul sito di TONE3000, con il tuo account; poi torni qui e lo carichi nella testata. Guitar Theory Lab non conserva il tuo accesso: resta in memoria finché la pagina è aperta.</p>
            <div className="v6-t3k-row" role="radiogroup" aria-label="Architettura dei modelli da mostrare">
              <span>Modelli</span>
              <button type="button" role="radio" className="v6-minikey" aria-checked={architecture === '2'} data-on={architecture === '2' ? '1' : '0'} data-testid="t3k-arch-2" disabled={working} onClick={() => setArchitecture('2')}>A2 (recenti)</button>
              <button type="button" role="radio" className="v6-minikey" aria-checked={architecture === '1'} data-on={architecture === '1' ? '1' : '0'} data-testid="t3k-arch-1" disabled={working} onClick={() => setArchitecture('1')}>A1 (classici)</button>
            </div>
            <div className="v6-t3k-row">
              {working
                ? <button type="button" className="v6-minikey" data-testid="t3k-cancel" onClick={cancelTone3000}>Annulla</button>
                : <button type="button" className="v6-minikey v6-t3k-go" data-testid="t3k-continue" onClick={() => void browseTone3000(architecture)}>Continua su TONE3000</button>}
            </div>
            <p className="v6-pl-foot" role="status" data-testid="t3k-status" data-phase={t3k.phase}>
              {t3k.phase === 'waiting' ? 'Il catalogo di TONE3000 è aperto in un’altra finestra: accedi e scegli un tone.'
                : t3k.phase === 'exchanging' ? 'Accesso in corso…'
                : t3k.phase === 'fetching' ? 'Lettura del tone scelto…'
                : t3k.note ?? (t3k.signedIn ? 'Accesso a TONE3000 attivo per questa visita.' : 'Si apre una finestra di TONE3000.')}
            </p>
            {t3k.error ? <p className="v6-alert" role="alert" data-testid="t3k-error">{t3k.error}</p> : null}
          </div>
        )}
        <footer className="v6-t3k-foot">
          {keyed && t3k.phase === 'tone' ? <button type="button" className="v57-linkbtn" onClick={clearTone}>Torna all’inizio</button> : null}
          {t3k.signedIn ? <button type="button" className="v57-linkbtn" data-testid="t3k-signout" onClick={signOutTone3000}>Dimentica l’accesso</button> : null}
          {keyed && !hasBuiltInKey() ? <button type="button" className="v57-linkbtn" data-testid="t3k-key-forget" onClick={() => { forgetPublishableKey(); signOutTone3000(); clearTone(); setKeyed(false); }}>Cambia chiave</button> : null}
          <span className="v6-pl-foot">I tone restano dei loro autori: rispetta la licenza indicata su ogni tone.</span>
        </footer>
      </div>
    </dialog>
  );
}
