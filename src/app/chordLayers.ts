/**
 * The chords a user studies in Fretboard Lab: a main chord plus up to seven
 * more. Only the active one is drawn on the neck; the others wait as diagrams.
 * Pure and framework-free.
 */
import { chordVoicings, type Voicing } from '../fretboard';
import { diatonicSeventh, tryParseChord, type Chord, type Scale } from '../theory';

export const MAX_CHORDS = 8;

export interface ChordLayer {
  readonly id: string;
  /** Any symbol the parser accepts, slash chords included: "Am7/G". */
  readonly symbol: string;
  readonly visible: boolean;
  /** Index in `chordVoicings` of the shape drawn on the neck; null draws functions only. */
  readonly voicing: number | null;
}

export interface ResolvedChordLayer {
  readonly layer: ChordLayer;
  readonly chord: Chord | null;
  readonly voicings: readonly Voicing[];
  /** The chosen shape, if it still exists for this symbol. */
  readonly shape: Voicing | null;
}

const voicingCache = new Map<string, readonly Voicing[]>();

/** Voicings depend only on the symbol, so they are worked out once per symbol. */
export function voicingsFor(chord: Chord): readonly Voicing[] {
  const cached = voicingCache.get(chord.symbol);
  if (cached) return cached;
  const found = chordVoicings(chord);
  if (voicingCache.size > 200) voicingCache.clear();
  voicingCache.set(chord.symbol, found);
  return found;
}

export function resolveChordLayer(layer: ChordLayer): ResolvedChordLayer {
  const chord = tryParseChord(layer.symbol);
  const voicings = chord ? voicingsFor(chord) : [];
  const shape = layer.voicing === null ? null : voicings[layer.voicing] ?? null;
  return { layer, chord, voicings, shape };
}

let counter = 0;
export function newChordLayerId(): string {
  counter += 1;
  return `c${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * The next chord to add: the diatonic seventh on the next degree of the main
 * scale (I, ii, iii… in a major key), or a copy of the last chord otherwise.
 */
export function suggestChord(layers: readonly ChordLayer[], scale: Scale): string {
  const seventh = diatonicSeventh(scale, layers.length % 7);
  if (seventh) return seventh.symbol;
  return layers[layers.length - 1]?.symbol ?? `${scale.tonicName}7`;
}

export function addChordLayer(layers: readonly ChordLayer[], scale: Scale, id = newChordLayerId()): readonly ChordLayer[] {
  if (layers.length >= MAX_CHORDS) return layers;
  return [...layers, { id, symbol: suggestChord(layers, scale), visible: true, voicing: null }];
}

export function moveChordLayer(layers: readonly ChordLayer[], from: number, to: number): readonly ChordLayer[] {
  if (to < 0 || to >= layers.length || from === to) return layers;
  const next = [...layers];
  const [item] = next.splice(from, 1);
  if (item) next.splice(to, 0, item);
  return next;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Saved chords; older saves had one "overlay chord" text field, which becomes the main chord. */
export function sanitizeChordLayers(raw: Record<string, unknown>): readonly ChordLayer[] {
  if (Array.isArray(raw.chordLayers)) {
    const seen = new Set<string>();
    return raw.chordLayers.filter(isObject).slice(0, MAX_CHORDS).map((c, i): ChordLayer => {
      let id = typeof c.id === 'string' && c.id ? c.id : `c${i}`;
      if (seen.has(id)) id = `${id}-${i}`;
      seen.add(id);
      return {
        id,
        symbol: typeof c.symbol === 'string' ? c.symbol.slice(0, 24) : '',
        visible: typeof c.visible === 'boolean' ? c.visible : true,
        voicing: typeof c.voicing === 'number' && Number.isInteger(c.voicing) && c.voicing >= 0 ? c.voicing : null,
      };
    });
  }
  if (typeof raw.overlayChord === 'string' && raw.overlayChord.trim() !== '') {
    return [{ id: 'legacy-overlay', symbol: raw.overlayChord.slice(0, 24), visible: true, voicing: null }];
  }
  return [];
}

/** The active chord index, kept inside the list. */
export const clampActive = (active: unknown, layers: readonly ChordLayer[]): number =>
  typeof active === 'number' && Number.isInteger(active) ? Math.min(Math.max(0, active), Math.max(0, layers.length - 1)) : 0;
