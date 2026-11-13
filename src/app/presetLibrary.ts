/**
 * The global preset library (Studio V6): starter presets and the user's own,
 * described by what they contain so they can be searched and filtered. Pure.
 * Laboratory, key and type are read from the preset's data, never typed by
 * hand; only the level of a starter preset is editorial.
 */
import { SCALES, tryParseChord } from '../theory';
import { STUDY_PRESETS, type PresetLevel } from './builtins';
import type { AppMode, Settings } from './settings';

export type PresetType = 'Scala' | 'Intervalli' | 'Sequenza' | 'Percorso' | 'Arpeggi' | 'Armonia' | 'Jam';
export const PRESET_TYPES: readonly PresetType[] = ['Scala', 'Intervalli', 'Sequenza', 'Percorso', 'Arpeggi', 'Armonia', 'Jam'];
export const PRESET_LEVELS: readonly PresetLevel[] = ['Base', 'Intermedio', 'Avanzato'];
export const LAB_NAMES: Readonly<Record<AppMode, string>> = { fretboard: 'Scales', arpeggio: 'Arpeggios', harmony: 'Harmony', jam: 'Jam' };

export interface LibraryEntry {
  readonly id: string;
  readonly name: string;
  readonly source: 'builtin' | 'user';
  readonly lab: AppMode;
  readonly type: PresetType;
  /** Tonic of what the preset studies ('' when the preset does not fix one, e.g. a routine with its own phases). */
  readonly key: string;
  /** One line under the name: scale or progression, position, tempo. */
  readonly summary: string;
  /** Starter presets only: the user's own carry no level. */
  readonly level: PresetLevel | null;
  readonly data: Partial<Settings>;
}

type Data = Partial<Settings>;

function typeOf(d: Data, lab: AppMode): PresetType {
  if (lab === 'arpeggio') return 'Arpeggi';
  if (lab === 'jam') return 'Jam';
  if (lab === 'harmony') return 'Armonia';
  if (!d.exerciseOn) return 'Scala';
  if (d.exerciseMode === 'routine') return 'Percorso';
  return d.exerciseKind === 'custom' ? 'Sequenza' : d.exerciseKind === 'interval' ? 'Intervalli' : 'Scala';
}

/** The tonic the preset is in: the progression's first chord in the harmonic labs, the chord of a single arpeggio, else the scale's tonic. */
function keyOf(d: Data, lab: AppMode): string {
  if (lab === 'arpeggio' && d.arpSource !== 'progression') return tryParseChord(d.arpSymbol ?? '')?.rootName ?? '';
  if (lab === 'fretboard' && d.exerciseOn && d.exerciseMode === 'routine') return '';
  if (lab !== 'fretboard' && d.harmonyKey) return d.harmonyKey;
  return d.tonic ?? '';
}

function summaryOf(d: Data, lab: AppMode): string {
  const parts: string[] = [];
  const chords = d.progression?.chords.map((c) => c.symbol) ?? [];
  if (lab === 'arpeggio' && d.arpSource !== 'progression' && d.arpSymbol) parts.push(d.arpSymbol);
  else if (lab !== 'fretboard' && chords.length) parts.push(chords.slice(0, 4).join(' – ') + (chords.length > 4 ? ' …' : ''));
  else if (d.tonic && d.scaleId) parts.push(`${d.tonic} ${SCALES[d.scaleId].name}`);
  if (lab !== 'arpeggio' && d.positionType) parts.push(d.positionType === 'neck' ? 'tutta la tastiera' : d.positionType === '3nps' ? '3NPS' : `CAGED ${d.cagedForm ?? ''}`.trim());
  if (d.bpm) parts.push(`${d.bpm} BPM`);
  return parts.join(' · ');
}

export function describePreset(id: string, name: string, source: LibraryEntry['source'], data: Data, level: PresetLevel | null = null): LibraryEntry {
  const lab = data.mode ?? 'fretboard';
  return { id, name, source, lab, type: typeOf(data, lab), key: keyOf(data, lab), summary: summaryOf(data, lab), level, data };
}

/** Starter presets first, then the user's own, most recent first. */
export function buildLibrary(saved: readonly { readonly id: string; readonly name: string; readonly savedAt: string; readonly data: unknown }[]): readonly LibraryEntry[] {
  const own = [...saved].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map((p) => describePreset(p.id, p.name, 'user', p.data as Data));
  return [...STUDY_PRESETS.map((p) => describePreset(p.id, p.name, 'builtin', p.data, p.level)), ...own];
}

export interface LibraryFilter {
  readonly query: string;
  readonly lab: AppMode | '';
  readonly type: PresetType | '';
  readonly level: PresetLevel | '';
  readonly key: string;
  readonly source: LibraryEntry['source'] | '';
}

export const NO_FILTER: LibraryFilter = { query: '', lab: '', type: '', level: '', key: '', source: '' };

const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filters combine: every one that is set must match. The search reads name and summary, ignoring case and accents. */
export function filterLibrary(entries: readonly LibraryEntry[], f: LibraryFilter): readonly LibraryEntry[] {
  const words = fold(f.query).split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    if (f.lab && e.lab !== f.lab) return false;
    if (f.type && e.type !== f.type) return false;
    if (f.level && e.level !== f.level) return false;
    if (f.key && e.key !== f.key) return false;
    if (f.source && e.source !== f.source) return false;
    const text = fold(`${e.name} ${e.summary} ${e.type} ${LAB_NAMES[e.lab]}`);
    return words.every((w) => text.includes(w));
  });
}

/** The keys present in the library, in order of first appearance: the options of the key filter. */
export const libraryKeys = (entries: readonly LibraryEntry[]): readonly string[] => [...new Set(entries.map((e) => e.key).filter(Boolean))];
