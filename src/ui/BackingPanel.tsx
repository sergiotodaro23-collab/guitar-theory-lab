/**
 * Local backing track (P3-09, D-34): load an audio file from this computer,
 * tell the app its tempo and where bar 1 starts, and it plays in time with
 * the jam, looping with the progression or the song. The file stays here.
 */
import { useRef, useState } from 'react';
import { engine } from '../app/engine';
import { useApp } from '../app/store';
import { backingTrack, useBacking } from '../audio/backingTrack';
import { bpmFromTaps, type BackingSettings } from '../jam';
import { Field, Panel, Toggle } from './controls';

export function BackingPanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const loaded = useBacking((b) => b.loaded);
  const duration = useBacking((b) => b.duration);
  const error = useBacking((b) => b.error);
  const playing = useBacking((b) => b.playing);
  const taps = useRef<number[]>([]);
  const [tapped, setTapped] = useState<number | null>(null);
  const b = s.backing;
  const set = (patch: Partial<BackingSettings>) => update({ backing: { ...b, ...patch } });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const ok = await backingTrack.load(engine.audioOut().ctx, await file.arrayBuffer());
    if (ok) update({ backing: { ...b, name: file.name, on: true }, mode: 'jam' });
  };
  const tap = () => {
    const now = performance.now() / 1000;
    taps.current = [...taps.current.filter((t) => now - t < 4), now];
    const bpm = bpmFromTaps(taps.current);
    setTapped(bpm);
    if (bpm) set({ bpm });
  };

  return (
    <Panel title="Backing track" className="backing-panel">
      <p className="field-hint">Un file audio del tuo computer: resta in questo browser, non viene caricato da nessuna parte.</p>
      <div className="row">
        <Field label="File">
          <input type="file" accept="audio/*" data-testid="backing-file" aria-label="Scegli il file della backing track" onChange={(e) => void onFile(e.target.files?.[0])} />
        </Field>
        <Toggle checked={b.on} onChange={(on) => set({ on })}>Suona con la jam</Toggle>
      </div>
      <p className="field-hint" data-testid="backing-status" role="status">
        {error ?? (loaded ? `${b.name || 'Traccia'} · ${duration.toFixed(1)} s${playing ? ' · in riproduzione' : ''}` : b.name ? `${b.name}: premi Avvia per ricaricarla da questo browser.` : 'Nessun file.')}
      </p>
      <div className="row">
        <Field label="Tempo della traccia (BPM)">
          <input className="text-input narrow" type="number" min={30} max={300} step={0.1} data-testid="backing-bpm" value={b.bpm}
            onChange={(e) => set({ bpm: Math.max(30, Math.min(300, Number(e.target.value) || 120)) })} />
        </Field>
        <button type="button" className="btn" onClick={tap} aria-label="Batti il tempo della traccia">Tap{tapped ? ` · ${tapped}` : ''}</button>
        <Field label="La battuta 1 inizia a (s)">
          <input className="text-input narrow" type="number" min={0} max={600} step={0.01} data-testid="backing-offset" value={b.offset}
            onChange={(e) => set({ offset: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })} />
        </Field>
      </div>
      {b.on && s.bpm !== b.bpm ? (
        <p className="field-hint is-warning" data-testid="backing-bpm-warning">
          La jam è a {s.bpm} BPM, la traccia a {b.bpm}: senza lo stesso tempo non restano insieme.{' '}
          <button type="button" className="btn" data-testid="backing-use-bpm" onClick={() => update({ bpm: Math.round(b.bpm) })}>Usa il tempo della traccia</button>
        </p>
      ) : null}
      <div className="row">
        <Toggle checked={b.loop} onChange={(loop) => set({ loop })}>Ripeti con la progressione</Toggle>
        <Field label={`Volume: ${Math.round(b.volume * 100)}%`}>
          <input className="range" type="range" min={0} max={1} step={0.01} value={b.volume} aria-label="Volume della backing track" onChange={(e) => set({ volume: Number(e.target.value) })} />
        </Field>
      </div>
      <p className="field-hint">La progressione di Harmony Lab fa da mappa degli accordi: scale, arpeggi e viste seguono la traccia se il tempo e la battuta 1 sono giusti. Niente time-stretch: la traccia suona alla sua velocità.</p>
    </Panel>
  );
}
