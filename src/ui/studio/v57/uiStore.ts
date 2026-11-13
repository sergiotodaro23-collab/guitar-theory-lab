/**
 * Studio V5.7 interface state: panels, drawer, picked notebook pages and the
 * display preferences. Nothing musical lives here; the musical state stays in
 * the app store, shared with Semplificata.
 */
import { create } from 'zustand';
import type { AppMode } from '../../../app/settings';
import { loadPrefs, savePref, type KeyValueStore, type TabId, type UiPrefs, type VizPrefs } from './layout';

export type DeviceId = 'mixer' | 'amp' | 'tuner' | 'iface';

function storage(): KeyValueStore {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
}

export interface StudioUi extends UiPrefs {
  /** One device at a time in the drawer; null when closed. */
  readonly device: DeviceId | null;
  /** The control that opened the drawer: focus goes back to it on close. */
  readonly launcher: HTMLElement | null;
  readonly pickedTab: Partial<Record<AppMode, TabId>>;
  readonly settingsOpen: boolean;
  readonly vizOpen: boolean;
  /** Studio V6: the metronome panel of the global header. */
  readonly metroOpen: boolean;
  /** Tuner footswitch and the last reference tone pressed: never restored on reload. */
  readonly tunerOn: boolean;
  readonly referencePc: number | null;
  readonly setSplit: (split: number) => void;
  readonly setRail: (railExpanded: boolean) => void;
  readonly setLcd: (lcdExpanded: boolean) => void;
  readonly setConsoleCollapsed: (consoleCollapsed: boolean) => void;
  readonly setMetroOpen: (open: boolean) => void;
  readonly setViz: (change: Partial<VizPrefs>) => void;
  readonly openDevice: (device: DeviceId, launcher: HTMLElement | null) => void;
  readonly closeDevice: () => void;
  readonly pickTab: (mode: AppMode, tab: TabId) => void;
  readonly setSettingsOpen: (open: boolean) => void;
  readonly setVizOpen: (open: boolean) => void;
  readonly setTuner: (change: { tunerOn?: boolean; referencePc?: number | null }) => void;
}

export const useStudioUi = create<StudioUi>((set, get) => ({
  ...loadPrefs(storage()),
  device: null,
  launcher: null,
  pickedTab: {},
  settingsOpen: false,
  vizOpen: false,
  metroOpen: false,
  tunerOn: false,
  referencePc: null,
  setSplit: (split) => { set({ split }); savePref(storage(), 'split', split); },
  setRail: (railExpanded) => { set({ railExpanded }); savePref(storage(), 'railExpanded', railExpanded); },
  setLcd: (lcdExpanded) => { set({ lcdExpanded }); savePref(storage(), 'lcdExpanded', lcdExpanded); },
  setConsoleCollapsed: (consoleCollapsed) => { set({ consoleCollapsed }); savePref(storage(), 'consoleCollapsed', consoleCollapsed); },
  setMetroOpen: (metroOpen) => set({ metroOpen, settingsOpen: false, vizOpen: false }),
  setViz: (change) => { const viz = { ...get().viz, ...change }; set({ viz }); savePref(storage(), 'viz', viz); },
  // A device replaces the open one at once (no exit animation), as in the handoff.
  openDevice: (device, launcher) => set({ device, launcher, settingsOpen: false, vizOpen: false, metroOpen: false }),
  closeDevice: () => set({ device: null }),
  pickTab: (mode, tab) => set({ pickedTab: { ...get().pickedTab, [mode]: tab } }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen, vizOpen: false, metroOpen: false }),
  setVizOpen: (vizOpen) => set({ vizOpen, settingsOpen: false, metroOpen: false }),
  setTuner: (change) => set(change),
}));
