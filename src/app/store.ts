import { create } from 'zustand';
import { PresetRepository, type StorageLike } from '../persistence/presets';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from './settings';

function browserStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
}

export const presetRepository = new PresetRepository(browserStorage());

export interface AppState {
  readonly settings: Settings;
  /** Chord shown while stopped, and the manual mode's current chord. */
  readonly selectedChord: number;
  readonly pinnedPc: number | null;
  /** Routine phase shown on the board while stopped. */
  readonly selectedPhase: number;
  readonly update: (change: Partial<Settings>) => void;
  readonly setSelectedChord: (index: number) => void;
  readonly setPinned: (pc: number | null) => void;
  readonly setSelectedPhase: (index: number) => void;
}

export const useApp = create<AppState>((set) => ({
  settings: sanitizeSettings(presetRepository.loadSession() ?? DEFAULT_SETTINGS),
  selectedChord: 0,
  pinnedPc: null,
  selectedPhase: 0,
  update: (change) => set((state) => {
    const settings = { ...state.settings, ...change };
    const last = Math.max(0, settings.progression.chords.length - 1);
    const lastPhase = Math.max(0, settings.routine.phases.length - 1);
    return { settings, selectedChord: Math.min(state.selectedChord, last), selectedPhase: Math.min(state.selectedPhase, lastPhase) };
  }),
  setSelectedChord: (selectedChord) => set({ selectedChord }),
  setPinned: (pinnedPc) => set({ pinnedPc }),
  setSelectedPhase: (selectedPhase) => set({ selectedPhase }),
}));

let saveTimer: ReturnType<typeof setTimeout> | undefined;
useApp.subscribe((state, previous) => {
  if (state.settings === previous.settings) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => presetRepository.saveSession(state.settings), 250);
});

/** What the transport is doing right now, derived from the shared timeline. */
export interface Playhead {
  readonly state: 'stopped' | 'playing' | 'paused';
  readonly bar: number;
  readonly beat: number;
  readonly subdivision: number;
  readonly chordIndex: number | null;
  /** Beats in the bar being heard: during a meter change it is the old meter until the bar line. */
  readonly beatsPerBar: number;
  /** Routine phase under the playhead; null outside routines or when stopped. */
  readonly phase: number | null;
  readonly note: { readonly string: number; readonly fret: number; readonly midi: number; readonly index: number } | null;
  readonly trail: readonly { readonly string: number; readonly fret: number }[];
}

export const usePlayhead = create<Playhead>(() => ({
  state: 'stopped', bar: 0, beat: 0, subdivision: 0, chordIndex: null, beatsPerBar: 4, phase: null, note: null, trail: [],
}));
