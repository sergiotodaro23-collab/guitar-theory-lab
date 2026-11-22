/**
 * N5 · Which scale the Note views show over the chord being played. By
 * default the mode of the reference key built on the chord's root (G7 in C
 * major → G mixolydian), from the harmonic analysis (D-30); a secondary
 * dominant takes mixolydian on its root, a borrowed chord the mode of the
 * parallel key, a chromatic chord its usual chord-scale. The alternatives are
 * every scale on the chord's root that holds all its tones. Pure, no DOM.
 */
import { chordOrigin } from '../harmony';
import { SCALES, SCALE_IDS, buildScale, type Chord, type ScaleId } from '../theory';
import { defaultScaleFor } from './chordViews';
import type { AppMode } from './settings';
import { addLayer, type ScaleLayer } from './scaleLayers';

export interface ScaleRef {
  readonly tonic: string;
  readonly scaleId: ScaleId;
}

export type NoteScaleSource = 'context' | 'chord-scale' | 'reference';

export interface ShownScale extends ScaleRef {
  readonly source: NoteScaleSource;
  /** Italian, for the legend page: what is shown and why. */
  readonly text: string;
}

interface NoteScaleInput {
  readonly mode: AppMode;
  readonly contextScales: boolean;
  readonly harmonyKey: string;
  readonly harmonyMode: ScaleId;
  readonly tonic: string;
  readonly scaleId: ScaleId;
}

const name = (ref: ScaleRef) => `${ref.tonic} ${SCALES[ref.scaleId].name.toLowerCase()}`;

/** Labs that follow a progression of chords: there the Note views follow the chord being played. */
export const followsChords = (mode: AppMode): boolean => mode === 'harmony' || mode === 'jam';

/** The scale for the chord in play, or the lab's own scale when there is no chord or the user turned the context off. */
export function shownScaleFor(s: NoteScaleInput, chord: Chord | null): ShownScale {
  const reference: ShownScale = { tonic: s.tonic, scaleId: s.scaleId, source: 'reference', text: `Scala di riferimento: ${name({ tonic: s.tonic, scaleId: s.scaleId })}.` };
  if (!chord || !s.contextScales || !followsChords(s.mode)) return reference;
  const origin = chordOrigin(chord, s.harmonyKey, s.harmonyMode);
  if (origin.scale) return { ...origin.scale, source: 'context', text: origin.text };
  const own = { tonic: chord.rootName, scaleId: defaultScaleFor(chord) };
  return { ...own, source: 'chord-scale', text: `${origin.text} Scala dell'accordo: ${name(own)}.` };
}

export interface CompatibleScale extends ScaleRef {
  readonly name: string;
  /** The one shown now. */
  readonly current: boolean;
}

/**
 * Scales on the chord's root that contain every chord tone: the shown one
 * first, then the usual chord-scale, then the rest in catalogue order.
 */
export function compatibleScales(chord: Chord, shown: ScaleRef): readonly CompatibleScale[] {
  const chordPcs = chord.tones.map((t) => t.pc);
  const fits = SCALE_IDS.filter((id) => {
    const pcs = new Set(buildScale(chord.rootName, id).tones.map((t) => t.pc));
    return chordPcs.every((pc) => pcs.has(pc));
  });
  const usual = defaultScaleFor(chord);
  const onRoot = shown.tonic === chord.rootName;
  const rank = (id: ScaleId) => (onRoot && id === shown.scaleId ? 0 : id === usual ? 1 : 2);
  const ordered = [...fits].sort((a, b) => rank(a) - rank(b) || SCALE_IDS.indexOf(a) - SCALE_IDS.indexOf(b));
  return ordered.map((scaleId) => ({ tonic: chord.rootName, scaleId, name: name({ tonic: chord.rootName, scaleId }), current: onRoot && scaleId === shown.scaleId }));
}

/**
 * Overlay a compatible scale: a new visible layer with that tonic and scale (the usual colour and pip rules of addLayer).
 * Unchanged when the list is full or the scale is already overlaid.
 */
export function overlayScale(layers: readonly ScaleLayer[], ref: ScaleRef, main: ScaleRef, id?: string): readonly ScaleLayer[] {
  if (layers.some((l) => l.tonic === ref.tonic && l.scaleId === ref.scaleId)) return layers;
  const added = addLayer(layers, main, id);
  if (added === layers) return layers;
  const last = added[added.length - 1] as ScaleLayer;
  return [...added.slice(0, -1), { ...last, tonic: ref.tonic, scaleId: ref.scaleId, visible: true }];
}
