/**
 * Studio V6 global header: the brand strip across the whole window and the
 * keys of the global tools (tuner, metronome, guitar input, rig). It carries
 * no transport: play, tempo and the LCD live in the console between the
 * sidebars.
 */
import { useEffect, useRef } from 'react';
import { CLICK_SOUNDS } from '../../../audio/clickSounds';
import { useApp } from '../../../app/store';
import { Select } from '../../controls';
import { ClickSelect, MeterSelect } from '../../Transport';
import { useStudioUi, type DeviceId } from '../v57/uiStore';

const TOOLS: readonly { id: DeviceId; text: string; label: string; icon: string }[] = [
  { id: 'tuner', text: 'Accordatore', label: 'Accordatore cromatico', icon: 'M9 3v8a3 3 0 0 0 6 0V3M12 14v7M8 21h8' },
  { id: 'iface', text: 'Ingresso', label: 'Ingresso chitarra', icon: 'M12 3v7M8.5 10h7v4.5a3.5 3.5 0 0 1-7 0zM12 18v3' },
  { id: 'amp', text: 'Rig', label: 'Guitar Rig: amplificatore e pedaliera', icon: 'M3 6h18v12H3zM3 9.5h18M7 14h.01M11 14h.01M15 14h.01M18.5 14h.01' },
];
const METRO_ICON = 'M9 3h6l4 18H5zM12 17l4-10M7.5 13h9';

function Glyph({ d }: { readonly d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The metronome panel: the click's own channel, timbre, subdivision and meter. Same store as the mixer and the console. */
function MetronomePanel() {
  const close = useStudioUi((u) => u.setMetroOpen);
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('button, select, input')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <>
      <button type="button" className="v57-scrim" aria-label="Chiudi metronomo" tabIndex={-1} onClick={() => close(false)} />
      <div className="v6-pop v6-metro" role="dialog" aria-label="Metronomo" ref={panel} data-testid="metronome-panel">
        <h4>Metronomo</h4>
        <div className="v6-metro-row">
          <button type="button" className="v6-switch" role="switch" aria-checked={!s.muteClick} data-testid="metro-on" onClick={() => update({ muteClick: !s.muteClick })}>
            <i aria-hidden="true" />{s.muteClick ? 'Click spento' : 'Click acceso'}
          </button>
          <label className="v6-metro-vol">
            <span>Volume {Math.round(s.volClick * 100)}%</span>
            <input type="range" min={0} max={1} step={0.01} value={s.volClick} aria-label="Volume del click" data-testid="metro-volume" onChange={(e) => update({ volClick: Number(e.target.value) })} />
          </label>
        </div>
        <div className="v6-metro-row">
          <label className="v6-metro-field"><span>Timbro</span>
            <Select label="Timbro del metronomo" testId="metro-sound" value={s.clickSound} options={CLICK_SOUNDS} onChange={(clickSound) => update({ clickSound })} />
          </label>
          <label className="v6-metro-field"><span>Metrica</span><span data-slot="meter"><MeterSelectPlain /></span></label>
          <label className="v6-metro-field"><span>Suddivisione</span><ClickSelect /></label>
        </div>
        <p>Il click segue l’unico orologio audio dell’app e parte con la riproduzione. Accenti personali: tasto «Accenti» nella console.</p>
      </div>
    </>
  );
}

/** The meter select without the console's test id, so the two never collide. */
function MeterSelectPlain() {
  const lcdExpanded = useStudioUi((u) => u.lcdExpanded);
  const collapsed = useStudioUi((u) => u.consoleCollapsed);
  const meterId = useApp((s) => s.settings.meterId);
  // The console already shows the meter select when its display is extended.
  return lcdExpanded && !collapsed ? <output className="v6-metro-read">{meterId} · dalla console</output> : <MeterSelect />;
}

export function Header() {
  const ui = useStudioUi();
  const muteClick = useApp((s) => s.settings.muteClick);
  const metroKey = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !ui.metroOpen) metroKey.current?.focus({ preventScroll: true });
    wasOpen.current = ui.metroOpen;
  }, [ui.metroOpen]);
  return (
    <header className="v6-head" data-testid="studio-header">
      <div className="v6-brand" data-testid="brand">
        <strong>Guitar Theory Lab</strong>
        <small>Studio V6</small>
      </div>
      <div className="v6-tools" role="toolbar" aria-label="Strumenti globali">
        <button type="button" ref={metroKey} className="v6-tool" data-on={ui.metroOpen ? '1' : '0'} aria-haspopup="dialog" aria-expanded={ui.metroOpen} aria-label="Metronomo"
          data-testid="metronome-toggle" onClick={() => ui.setMetroOpen(!ui.metroOpen)}>
          <Glyph d={METRO_ICON} /><span>Metronomo</span><i className="v6-tool-led" data-on={muteClick ? '0' : '1'} aria-hidden="true" />
        </button>
        {TOOLS.map((tool) => (
          <button key={tool.id} type="button" className="v6-tool" data-on={ui.device === tool.id ? '1' : '0'} aria-label={tool.label} aria-pressed={ui.device === tool.id}
            data-testid={`device-${tool.id}`} title={tool.label}
            onClick={(e) => (ui.device === tool.id ? ui.closeDevice() : ui.openDevice(tool.id, e.currentTarget))}>
            <Glyph d={tool.icon} /><span>{tool.text}</span>
          </button>
        ))}
        {ui.metroOpen ? <MetronomePanel /> : null}
      </div>
    </header>
  );
}
