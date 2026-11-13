/**
 * Studio V6 global preset library: a dialog from the header with search and
 * combinable filters over the starter presets and the user's own. Loading
 * goes through the same path as before (settings sanitised, mixer and look
 * untouched); saving stores the same study data as the settings panel did.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LAB_NAMES, NO_FILTER, PRESET_LEVELS, PRESET_TYPES, buildLibrary, filterLibrary, libraryKeys, type LibraryEntry, type LibraryFilter } from '../../../app/presetLibrary';
import type { AppMode } from '../../../app/settings';
import { presetRepository, useApp } from '../../../app/store';
import { loadStudyPreset, pickStudy } from '../../panels';

const LABS = Object.keys(LAB_NAMES) as AppMode[];

function Card({ entry, onLoad, onRename, onDelete }: { readonly entry: LibraryEntry; readonly onLoad: () => void; readonly onRename: (name: string) => string | null; readonly onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.name);
  const [error, setError] = useState('');
  const submit = () => {
    const problem = onRename(name);
    if (problem) setError(problem);
    else { setEditing(false); setError(''); }
  };
  return (
    <li className="v6-pl-card" data-source={entry.source} data-preset-id={entry.id} data-testid="preset-card">
      <button type="button" className="v6-pl-load" onClick={onLoad} aria-label={`Carica ${entry.name}`}>
        <strong>{entry.name}</strong>
        <small>{LAB_NAMES[entry.lab]} · {entry.type}{entry.key ? ` · ${entry.key}` : ''}{entry.level ? ` · ${entry.level}` : ''}</small>
        {entry.summary ? <span>{entry.summary}</span> : null}
      </button>
      {entry.source === 'user' ? (
        <div className="v6-pl-own">
          <em>Tuo</em>
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <input className="v6-pl-input" aria-label={`Nuovo nome per ${entry.name}`} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
              <button type="submit" className="v6-minikey">Salva</button>
              <button type="button" className="v6-minikey" onClick={() => { setEditing(false); setName(entry.name); setError(''); }}>Annulla</button>
            </form>
          ) : (
            <>
              <button type="button" className="v6-minikey" aria-label={`Rinomina ${entry.name}`} onClick={() => setEditing(true)}>Rinomina</button>
              <button type="button" className="v6-minikey" aria-label={`Elimina ${entry.name}`} onClick={onDelete}>Elimina</button>
            </>
          )}
          {error ? <span className="v6-pl-error" role="alert">{error}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

export function PresetLibrary({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState(() => presetRepository.list('study'));
  const [filter, setFilter] = useState<LibraryFilter>(NO_FILTER);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) { setSaved(presetRepository.list('study')); setMessage(''); el.showModal(); }
    if (!open && el.open) el.close();
  }, [open]);
  const library = useMemo(() => buildLibrary(saved), [saved]);
  const shown = filterLibrary(library, filter);
  const refresh = () => setSaved(presetRepository.list('study'));
  const set = (change: Partial<LibraryFilter>) => setFilter({ ...filter, ...change });
  const save = () => {
    const result = presetRepository.save(name, 'study', pickStudy(useApp.getState().settings));
    if (result.ok) { setMessage(`Salvato: ${result.preset.name}`); setName(''); refresh(); } else setMessage(result.error);
  };
  return (
    <dialog ref={dialog} className="v6-pl" aria-label="Preset Library" data-testid="preset-library" onClose={onClose} onClick={(e) => { if (e.target === dialog.current) onClose(); }}>
      {open ? (
        <div className="v6-pl-in">
          <header className="v6-pl-head">
            <h2>Preset Library</h2>
            <button type="button" className="v6-minikey" data-testid="preset-library-close" onClick={onClose}>Chiudi</button>
          </header>
          <div className="v6-pl-filters" role="search" aria-label="Cerca e filtra i preset">
            <input className="v6-pl-input v6-pl-search" type="search" placeholder="Cerca per nome, scala, accordi…" aria-label="Cerca preset" data-testid="preset-search" value={filter.query} onChange={(e) => set({ query: e.target.value })} />
            <select className="v6-select" aria-label="Laboratorio" data-testid="preset-filter-lab" value={filter.lab} onChange={(e) => set({ lab: e.target.value as LibraryFilter['lab'] })}>
              <option value="">Tutti i laboratori</option>
              {LABS.map((lab) => <option key={lab} value={lab}>{LAB_NAMES[lab]}</option>)}
            </select>
            <select className="v6-select" aria-label="Tipo" data-testid="preset-filter-type" value={filter.type} onChange={(e) => set({ type: e.target.value as LibraryFilter['type'] })}>
              <option value="">Tutti i tipi</option>
              {PRESET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="v6-select" aria-label="Tonalità" data-testid="preset-filter-key" value={filter.key} onChange={(e) => set({ key: e.target.value })}>
              <option value="">Tutte le tonalità</option>
              {libraryKeys(library).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <select className="v6-select" aria-label="Difficoltà" data-testid="preset-filter-level" value={filter.level} onChange={(e) => set({ level: e.target.value as LibraryFilter['level'] })}>
              <option value="">Tutte le difficoltà</option>
              {PRESET_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="v6-select" aria-label="Origine" data-testid="preset-filter-source" value={filter.source} onChange={(e) => set({ source: e.target.value as LibraryFilter['source'] })}>
              <option value="">Di partenza e tuoi</option>
              <option value="builtin">Di partenza</option>
              <option value="user">Tuoi</option>
            </select>
          </div>
          <p className="v6-pl-count" role="status" data-testid="preset-count">{shown.length} di {library.length} preset{filter.level ? ' · la difficoltà è indicata solo sui preset di partenza' : ''}</p>
          <ul className="v6-pl-grid" data-testid="preset-results">
            {shown.map((entry) => (
              <Card key={entry.id} entry={entry}
                onLoad={() => { if (loadStudyPreset(entry.id, saved)) onClose(); }}
                onRename={(next) => { const r = presetRepository.rename(entry.id, next); if (r.ok) { refresh(); setMessage(`Rinominato: ${r.preset.name}`); return null; } return r.error; }}
                onDelete={() => { presetRepository.remove(entry.id); refresh(); setMessage(`Eliminato: ${entry.name}`); }} />
            ))}
            {shown.length === 0 ? <li className="v6-pl-empty">Nessun preset con questi filtri.</li> : null}
          </ul>
          <form className="v6-pl-save" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label>Salva lo studio corrente come preset
              <input className="v6-pl-input" data-testid="preset-name" placeholder="Nome del preset" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button type="submit" className="v6-minikey" data-testid="preset-save">Salva preset</button>
            <span className="v6-pl-msg" role="status" data-testid="preset-status">{message}</span>
          </form>
          <p className="v6-pl-foot">Un preset conserva lo studio (laboratorio, scala, accordi, esercizio, tempo). Mixer, rig, ingresso e aspetto restano i tuoi. Un nome già usato sovrascrive quel preset.</p>
        </div>
      ) : null}
    </dialog>
  );
}
