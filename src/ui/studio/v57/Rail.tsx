/**
 * The physical navigation rail: the four laboratories, the four devices of
 * the drawer, settings and the collapse key, with the nameplate at the foot.
 */
import { useEffect, useRef } from 'react';
import type { AppMode } from '../../../app/settings';
import { useApp } from '../../../app/store';
import { AppFooter } from '../../AppFooter';
import { PresetsPanel } from '../../panels';
import { AppearanceToggle, withModeLabels } from '../../Transport';
import { useStudioUi, type DeviceId } from './uiStore';

const ICON: Record<AppMode | DeviceId, string> = {
  fretboard: 'M3 6h18M3 10h18M3 14h18M3 18h18M8 4v16M13 4v16M18 4v16',
  harmony: 'M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0zM9 18V5l11-2v13M20 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0z',
  arpeggio: 'M3 19l4-6 4 3 4-9 6 5M3 19h.01M7 13h.01M11 16h.01M15 7h.01M21 12h.01',
  jam: 'M4 12h2M8 7v10M12 4v16M16 8v8M20 11v2',
  iface: 'M12 3v7M8.5 10h7v4.5a3.5 3.5 0 0 1-7 0zM12 18v3',
  amp: 'M3 6h18v12H3zM3 9.5h18M7 14h.01M11 14h.01M15 14h.01M18.5 14h.01',
  tuner: 'M9 3v8a3 3 0 0 0 6 0V3M12 14v7M8 21h8',
  mixer: 'M6 3v18M12 3v18M18 3v18M4 15h4M10 8h4M16 12h4',
};
const GEAR = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z';

export const LABS: readonly { id: AppMode; label: string }[] = [
  { id: 'fretboard', label: 'Fretboard Lab' },
  { id: 'harmony', label: 'Harmony Lab' },
  { id: 'arpeggio', label: 'Arpeggios Lab' },
  { id: 'jam', label: 'Jam Studio' },
];

export const DEVICES: readonly { id: DeviceId; label: string }[] = [
  { id: 'iface', label: 'Ingresso chitarra' },
  { id: 'amp', label: 'Amplificatore e NAM' },
  { id: 'tuner', label: 'Accordatore cromatico' },
  { id: 'mixer', label: 'Mixer analogico' },
];

function Icon({ d, width = 1.8 }: { readonly d: string; readonly width?: number }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsPanel({ studioAllowed }: { readonly studioAllowed: boolean }) {
  const close = useStudioUi((u) => u.setSettingsOpen);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('button, select, input')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <>
      <button type="button" className="v57-scrim" aria-label="Chiudi impostazioni" tabIndex={-1} onClick={() => close(false)} />
      <div className="v57-setpop" role="dialog" aria-label="Impostazioni e aspetto" ref={panel} data-testid="studio-settings">
        <h4>Aspetto dell’interfaccia</h4>
        <AppearanceToggle studioAllowed={studioAllowed} current="studio" />
        <p>Semplificata è l’altra interfaccia dell’app: stessi laboratori, stesso stato e stessa riproduzione.</p>
        <div className="v57-setpop-presets"><PresetsPanel /></div>
        <AppFooter />
        <div><button type="button" className="v57-textbtn" onClick={() => close(false)}>Chiudi</button></div>
      </div>
    </>
  );
}

export function Rail({ studioAllowed }: { readonly studioAllowed: boolean }) {
  const mode = useApp((s) => s.settings.mode);
  const labelMode = useApp((s) => s.settings.labelMode);
  const update = useApp((s) => s.update);
  const ui = useStudioUi();
  const settingsKey = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // Closing the settings returns focus to the key that opened them.
  useEffect(() => {
    if (wasOpen.current && !ui.settingsOpen) settingsKey.current?.focus({ preventScroll: true });
    wasOpen.current = ui.settingsOpen;
  }, [ui.settingsOpen]);
  const expanded = ui.railExpanded;
  return (
    <nav className="v57-plate v57-rail" aria-label="Navigazione principale" data-x={expanded ? '1' : '0'} data-testid="studio-rail">
      <ul className="v57-rlist" aria-label="Laboratori">
        {LABS.map((lab) => (
          <li key={lab.id}>
            <button type="button" className="v57-rb" data-on={mode === lab.id ? '1' : '0'} aria-label={lab.label} aria-current={mode === lab.id ? 'page' : undefined}
              onClick={() => update(withModeLabels(labelMode, lab.id))}>
              <Icon d={ICON[lab.id]} /><span className="v57-rl">{lab.label}</span><span className="v57-tip" role="tooltip">{lab.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="v57-hsep" role="presentation" />
      <ul className="v57-rlist" aria-label="Dispositivi audio">
        {DEVICES.map((dev) => (
          <li key={dev.id}>
            <button type="button" className="v57-rb" data-dev="1" data-on={ui.device === dev.id ? '1' : '0'} aria-label={dev.label} aria-pressed={ui.device === dev.id}
              data-testid={`device-${dev.id}`}
              onClick={(e) => (ui.device === dev.id ? ui.closeDevice() : ui.openDevice(dev.id, e.currentTarget))}>
              <Icon d={ICON[dev.id]} /><span className="v57-rl">{dev.label}</span><span className="v57-tip" role="tooltip">{dev.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="v57-rspacer" />
      <ul className="v57-rlist" aria-label="Impostazioni">
        <li>
          <button type="button" ref={settingsKey} className="v57-rb" data-on={ui.settingsOpen ? '1' : '0'} aria-label="Impostazioni e aspetto" aria-haspopup="dialog" aria-expanded={ui.settingsOpen}
            data-testid="studio-settings-toggle" onClick={() => ui.setSettingsOpen(!ui.settingsOpen)}>
            <Icon d={GEAR} width={1.6} /><span className="v57-rl">Impostazioni e aspetto</span><span className="v57-tip" role="tooltip">Impostazioni e aspetto</span>
          </button>
        </li>
        <li>
          <button type="button" className="v57-rb v57-rtog" aria-label={expanded ? 'Comprimi barra' : 'Espandi barra'} aria-expanded={expanded} onClick={() => ui.setRail(!expanded)}>
            <Icon d="M9 6l6 6-6 6" width={2.2} /><span className="v57-rl">Comprimi barra</span><span className="v57-tip" role="tooltip">{expanded ? 'Comprimi barra' : 'Espandi barra'}</span>
          </button>
        </li>
      </ul>
      <div className="v57-np" title={`Guitar Theory Lab v${__APP_VERSION__} — by Sergio Todaro`} data-testid="nameplate">
        <span className="v57-nps"><b>GTL</b><span>v{__APP_VERSION__}</span></span>
        <span className="v57-npl"><b>Guitar Theory Lab</b><span>v{__APP_VERSION__} — by Sergio Todaro</span></span>
      </div>
      {ui.settingsOpen ? <SettingsPanel studioAllowed={studioAllowed} /> : null}
    </nav>
  );
}
