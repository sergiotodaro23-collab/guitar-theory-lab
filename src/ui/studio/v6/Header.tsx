/**
 * Studio V6 global header: the brand strip across the whole window and the
 * keys of the global tools (preset library, metronome, tuner, the rig rack). It carries
 * no transport: play, tempo and the LCD live in the console between the
 * sidebars.
 */
import { useEffect, useRef, useState } from 'react';
import { CLICK_SOUNDS } from '../../../audio/clickSounds';
import { useApp } from '../../../app/store';
import { Select } from '../../controls';
import { ClickSelect, CountInSelect, MeterSelect } from '../../Transport';
import { useStudioUi, type DeviceId } from '../v57/uiStore';
import { PresetLibrary } from './PresetLibrary';
import { StudioLogo } from './StudioLogo';

const TOOLS: readonly { id: DeviceId; text: string; label: string; icon: string }[] = [
  { id: 'tuner', text: 'Accordatore', label: 'Accordatore cromatico', icon: 'M9 3v8a3 3 0 0 0 6 0V3M12 14v7M8 21h8' },
];
const LIBRARY_ICON = 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z';
const METRO_ICON = 'M9 3h6l4 18H5zM12 17l4-10M7.5 13h9';

function Glyph({ d }: { readonly d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The metronome panel: the click's own channel, timbre, meter and
 * subdivision (the console shows them, this is where they are set). Same
 * store as the mixer and the accent grid.
 */
/**
 * The one control of a sidebar's width. The glyph is the owner's reference: a rounded frame with a short bar standing inside it,
 * near the side the key belongs to. Nothing is filled; the open state is the key's colour.
 */
function SideToggle({ side, open, label, testId, onClick }: { readonly side: 'left' | 'right'; readonly open: boolean; readonly label: string; readonly testId: string; readonly onClick: () => void }) {
  return (
    <button type="button" className="v6-side" data-side={side} aria-expanded={open} aria-label={open ? `Comprimi ${label}` : `Espandi ${label}`} title={open ? `Comprimi ${label}` : `Espandi ${label}`} data-testid={testId} onClick={onClick}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3.5" y="5" width="17" height="14" rx="3.6" data-part="frame" />
        <path d={side === 'left' ? 'M8.1 9v6' : 'M15.9 9v6'} data-part="bar" />
      </svg>
    </button>
  );
}

function MetronomePanel() {
  const close = useStudioUi((u) => u.setMetroOpen);
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('button, select, input')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    // Not modal: a press anywhere else closes the panel and still reaches what was pressed.
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!panel.current?.contains(target) && !target?.closest('[data-testid="metronome-toggle"]')) close(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown, true); };
  }, [close]);
  return (
    <>
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
          <label className="v6-metro-field"><span>Metrica</span><MeterSelect /></label>
          <label className="v6-metro-field"><span>Suddivisione</span><ClickSelect /></label>
          <label className="v6-metro-field"><span>Attacco</span><CountInSelect /></label>
        </div>
        <p>Il click segue l’unico orologio audio dell’app e parte con la riproduzione. La metrica nuova entra alla stanghetta successiva. L’attacco conta le battute scelte prima di partire da fermo, anche a click spento. Accenti personali: tasto «Accenti» nella console.</p>
      </div>
    </>
  );
}

export function Header() {
  const ui = useStudioUi();
  const muteClick = useApp((s) => s.settings.muteClick);
  const metroKey = useRef<HTMLButtonElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !ui.metroOpen) metroKey.current?.focus({ preventScroll: true });
    wasOpen.current = ui.metroOpen;
  }, [ui.metroOpen]);
  return (
    <header className="v6-head" data-testid="studio-header">
      <SideToggle side="left" open={ui.railExpanded} label="la barra di navigazione" testId="rail-toggle" onClick={() => ui.setRail(!ui.railExpanded)} />
      <div className="v6-brand" data-testid="brand">
        <StudioLogo />
        <span className="v57-sr">Guitar Theory Lab · Studio · Ver. 6.0</span>
      </div>
      <div className="v6-tools" role="toolbar" aria-label="Strumenti globali">
        <button type="button" className="v6-tool" aria-haspopup="dialog" aria-label="Preset Library" data-testid="preset-library-open" onClick={() => setLibraryOpen(true)}>
          <Glyph d={LIBRARY_ICON} /><span>Preset</span>
        </button>
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
      <i className="v6-head-sep" aria-hidden="true" />
      <SideToggle side="right" open={ui.rack === 'expanded'} label="la barra Audio e Rig" testId="rack-toggle" onClick={() => ui.setRack(ui.rack === 'expanded' ? 'compact' : 'expanded')} />
      <PresetLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </header>
  );
}
