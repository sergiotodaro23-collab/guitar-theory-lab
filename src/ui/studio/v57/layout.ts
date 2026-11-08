/**
 * Studio V5.7: the pure parts of the shell. Geometry, notebook tabs per lab,
 * what the LCD reads, and the UI preferences kept in localStorage. No DOM,
 * no React: every rule here has a unit test.
 */
import type { AppMode, Settings } from '../../../app/settings';
import { numeralOf } from '../../../harmony';
import { buildScale, type Chord } from '../../../theory';

/* ---------------- geometry ---------------- */

/** Device scale in the free notebook area (handoff rule `fitS`): never above 1, never below 0.45. */
export function fitScale(canvasW: number, canvasH: number, notebookW: number, notebookH: number, hasNote: boolean): number {
  const h = notebookH - 16 - (hasNote && notebookH >= 350 ? 36 : 0);
  const fit = Math.min(1, h / canvasH, (notebookW - 20) / canvasW);
  return Math.max(0.45, Number.isFinite(fit) ? fit : 1);
}

/** 0 roomy, 1 compact, 2 tight: how much the drawer may show around the device. */
export const compactLevel = (notebookH: number): 0 | 1 | 2 => (notebookH < 350 ? 2 : notebookH < 460 ? 1 : 0);

/** Viewbox of the production fretboard (src/viz/Fretboard.tsx): the panel never stretches it. */
export const BOARD_ASPECT = 1240 / 252;
/** Toolbar, padding and borders of the fretboard panel around the board itself. */
export const FB_CHROME = 58;
export const FB_MIN = 170;
export const NB_MIN = 150;

/**
 * Height of the fretboard panel. The ratio is the share of the space under
 * the console; it is clamped so the notebook keeps room for its tabs and a
 * page, and the board never grows taller than its width allows.
 */
export function splitHeight(ratio: number, available: number, boardWidth: number): number {
  const natural = FB_CHROME + boardWidth / BOARD_ASPECT;
  const max = Math.max(FB_MIN, Math.min(natural, available - NB_MIN));
  const wanted = Math.round(available * (Number.isFinite(ratio) ? ratio : DEFAULT_SPLIT));
  return Math.round(Math.max(FB_MIN, Math.min(max, wanted)));
}

export const DEFAULT_SPLIT = 0.5;
export const clampRatio = (ratio: number): number => Math.max(0.15, Math.min(0.85, Number.isFinite(ratio) ? ratio : DEFAULT_SPLIT));

/* ---------------- notebook ---------------- */

export type TabId = 'scale' | 'chords' | 'exercise' | 'legend' | 'next' | 'harmony' | 'views' | 'arpeggio' | 'jam' | 'song' | 'drums' | 'input';

export interface TabSpec {
  readonly id: TabId;
  readonly label: string;
  /** Paper colour of the tab (V5.7 tokens; new tabs reuse the closest family). */
  readonly color: string;
}

const TAB: Readonly<Record<TabId, TabSpec>> = {
  scale: { id: 'scale', label: 'Scala', color: '#7fb2e0' },
  chords: { id: 'chords', label: 'Accordi', color: '#74c795' },
  exercise: { id: 'exercise', label: 'Esercizio', color: '#f0a05a' },
  legend: { id: 'legend', label: 'Legenda', color: '#ae92e6' },
  next: { id: 'next', label: 'Next Fretboard', color: '#dcbc4e' },
  harmony: { id: 'harmony', label: 'Progressione', color: '#74c795' },
  views: { id: 'views', label: 'Per accordo', color: '#9fc9b0' },
  arpeggio: { id: 'arpeggio', label: 'Arpeggi', color: '#74c795' },
  jam: { id: 'jam', label: 'Jam', color: '#74c795' },
  song: { id: 'song', label: 'Arrangiamento', color: '#e6b8a0' },
  drums: { id: 'drums', label: 'Batteria', color: '#d9a0a0' },
  input: { id: 'input', label: 'Ingresso', color: '#b8c4cf' },
};

/** Notebook pages per laboratory, the one used most first (same order as the Simple deck). */
export function tabsFor(mode: AppMode): readonly TabSpec[] {
  const ids: readonly TabId[] = {
    fretboard: ['scale', 'chords', 'exercise', 'legend', 'next', 'input'],
    harmony: ['harmony', 'views', 'scale', 'exercise', 'legend', 'next', 'input'],
    arpeggio: ['arpeggio', 'views', 'scale', 'legend', 'next', 'input'],
    jam: ['jam', 'song', 'drums', 'views', 'scale', 'exercise', 'legend', 'input'],
  }[mode] as readonly TabId[];
  return ids.map((id) => TAB[id]);
}

/** The tab to show: the one picked for this lab if it still exists, else the first. */
export function activeTab(mode: AppMode, picked: Partial<Record<AppMode, TabId>>): TabSpec {
  const tabs = tabsFor(mode);
  return tabs.find((t) => t.id === picked[mode]) ?? (tabs[0] as TabSpec);
}

/** Roving focus for tab lists: arrows wrap, Home and End jump. Null for other keys. */
export function tabKeyTarget(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight': case 'ArrowDown': return (index + 1) % count;
    case 'ArrowLeft': case 'ArrowUp': return (index - 1 + count) % count;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return null;
  }
}

/* ---------------- LCD ---------------- */

export interface LcdModel {
  /** Key zone: tonic name and scale/mode name, then its notes. */
  readonly tonic: string;
  readonly scaleName: string;
  readonly notes: string;
  /** Chord zone: the chord heard now (or shown while stopped), its numeral in the key, and the next one. */
  readonly chord: string;
  readonly chordNone: boolean;
  readonly numeral: string;
  readonly next: string;
}

type LcdSettings = Pick<Settings, 'mode' | 'tonic' | 'scaleId' | 'harmonyKey' | 'harmonyMode' | 'arpSource'>;

/**
 * What the amber display reads. The key is the scale studied in Fretboard and
 * Arpeggios Lab, the progression's key in Harmony Lab and Jam Studio. The
 * numeral is computed from the chord and that key, never typed.
 */
export function lcdModel(s: LcdSettings, chord: Chord | null, nextChord: Chord | null, fallback: string): LcdModel {
  const harmonic = s.mode === 'harmony' || s.mode === 'jam' || (s.mode === 'arpeggio' && s.arpSource === 'progression');
  const key = harmonic ? buildScale(s.harmonyKey, s.harmonyMode) : buildScale(s.tonic, s.scaleId);
  const tonicPc = key.tones[0]?.pc ?? 0;
  return {
    tonic: key.tonicName,
    scaleName: key.definition.name,
    notes: key.tones.map((t) => t.name).join(' '),
    chord: chord?.symbol ?? fallback,
    chordNone: chord === null,
    numeral: chord ? numeralOf(chord, tonicPc) : '',
    next: nextChord?.symbol ?? '',
  };
}

/* ---------------- persisted UI preferences ---------------- */

/** Display-only preferences of the fretboard (they never change what is computed or played). */
export interface VizPrefs {
  /** Overlaid scales drawn as bars under the note (readable) or as corner dots (legacy). */
  readonly layerMarks: 'bars' | 'dots';
  /** Highlight of the note being played and of the detected note. */
  readonly anim: 'pulse' | 'glow' | 'static';
  readonly showTargets: boolean;
  readonly showPlayback: boolean;
  readonly showArrows: boolean;
  readonly showOverlays: boolean;
}

export const VIZ_DEFAULTS: VizPrefs = { layerMarks: 'bars', anim: 'pulse', showTargets: true, showPlayback: true, showArrows: true, showOverlays: true };

/** Device panel states that are not part of the musical settings. */
export interface DevicePrefs {
  /** Amplifier: visual demo only until a real DSP/NAM chain exists (processing stays false). */
  readonly ampKnobs: Readonly<Record<AmpKnobId, number>>;
  readonly ampPower: boolean;
  readonly ampBypass: boolean;
}

export type AmpKnobId = 'gain' | 'bass' | 'mid' | 'treble' | 'presence' | 'out';
export const AMP_KNOBS: readonly (readonly [AmpKnobId, string, number])[] = [
  ['gain', 'Gain', 55], ['bass', 'Bass', 50], ['mid', 'Middle', 60], ['treble', 'Treble', 58], ['presence', 'Presence', 45], ['out', 'Output', 62],
];
export const DEVICE_DEFAULTS: DevicePrefs = {
  ampKnobs: Object.fromEntries(AMP_KNOBS.map(([id, , v]) => [id, v])) as Record<AmpKnobId, number>,
  ampPower: false,
  ampBypass: false,
};

export interface UiPrefs {
  readonly split: number;
  readonly railExpanded: boolean;
  readonly lcdExpanded: boolean;
  readonly viz: VizPrefs;
  readonly devices: DevicePrefs;
}

/** Storage keys of the handoff (`STORAGE_KEYS`). Live monitor and tuner on/off are never stored. */
export const STORAGE_KEYS = {
  split: 'gtl.v5.fbR', railExpanded: 'gtl.v5.railX', lcdExpanded: 'gtl.v5.lcdX', viz: 'gtl.v5.vz', devices: 'gtl.v5.dev',
} as const;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const pct = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);

function read(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Reads every preference, repairing anything missing or malformed with the defaults. */
export function loadPrefs(store: KeyValueStore): UiPrefs {
  const viz = (read(store, STORAGE_KEYS.viz) ?? {}) as Record<string, unknown>;
  const dev = (read(store, STORAGE_KEYS.devices) ?? {}) as Record<string, unknown>;
  const knobs = (typeof dev.ampKnobs === 'object' && dev.ampKnobs !== null ? dev.ampKnobs : {}) as Record<string, unknown>;
  const split = read(store, STORAGE_KEYS.split);
  return {
    split: clampRatio(typeof split === 'number' ? split : DEFAULT_SPLIT),
    railExpanded: bool(read(store, STORAGE_KEYS.railExpanded), false),
    lcdExpanded: bool(read(store, STORAGE_KEYS.lcdExpanded), true),
    viz: {
      layerMarks: oneOf(viz.layerMarks, ['bars', 'dots'] as const, VIZ_DEFAULTS.layerMarks),
      anim: oneOf(viz.anim, ['pulse', 'glow', 'static'] as const, VIZ_DEFAULTS.anim),
      showTargets: bool(viz.showTargets, true),
      showPlayback: bool(viz.showPlayback, true),
      showArrows: bool(viz.showArrows, true),
      showOverlays: bool(viz.showOverlays, true),
    },
    devices: {
      ampKnobs: Object.fromEntries(AMP_KNOBS.map(([id, , v]) => [id, pct(knobs[id], v)])) as Record<AmpKnobId, number>,
      ampPower: bool(dev.ampPower, false),
      ampBypass: bool(dev.ampBypass, false),
    },
  };
}

export function savePref<K extends keyof UiPrefs>(store: KeyValueStore, key: K, value: UiPrefs[K]): void {
  try {
    store.setItem(STORAGE_KEYS[key], JSON.stringify(value));
  } catch {
    // Private windows and full storage: the preference lasts for this visit only.
  }
}

/* ---------------- device value mappings ---------------- */

/** Tuner calibration knob: 0–100 over 435–445 Hz, as in the handoff. Out-of-range A4 values sit at the ends. */
export const CALIB_MIN = 435;
export const CALIB_MAX = 445;
export const hzToKnob = (hz: number): number => Math.max(0, Math.min(100, (hz - CALIB_MIN) * 10));
export const knobToHz = (v: number): number => CALIB_MIN + Math.round(Math.max(0, Math.min(100, v)) / 10);

/** Input gain knob: 0–100 over the production gain 0–4 (×). */
export const INPUT_GAIN_MAX = 4;
export const gainToKnob = (gain: number): number => Math.max(0, Math.min(100, Math.round((gain / INPUT_GAIN_MAX) * 100)));
export const knobToGain = (v: number): number => Math.round((Math.max(0, Math.min(100, v)) / 100) * INPUT_GAIN_MAX * 20) / 20;
export const gainDb = (gain: number): string => (gain <= 0 ? '−∞ dB' : `${gain >= 1 ? '+' : '−'}${Math.abs(20 * Math.log10(gain)).toFixed(1)} dB`);
