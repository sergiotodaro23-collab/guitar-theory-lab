/**
 * Per-chord views (P1-14, D-26): each chord of the progression can carry its
 * own picture of the neck — only its arpeggio, or a scale with the chord's
 * functions; the scale's shape; a focus such as guide tones; extra scales and
 * arpeggio overlays. When the playing or chosen chord changes, the board
 * shows that chord's view. Keyed by the progression chord's id, so Harmony
 * Lab, Arpeggios Lab and Jam Studio read the same data. Pure, no DOM.
 */
import { CAGED_FORMS, DEFAULT_FRETS, allFretNotes, cagedPosition, rangePosition, threeNpsPosition, type CagedForm, type FretNote } from '../fretboard';
import { SCALE_IDS, TONICS, buildScale, tryParseChord, type Chord, type Scale, type ScaleId } from '../theory';
import { LAYER_COLORS, MAX_EXTRA_SCALES, newLayerId, sanitizeLayers, type LayerColor, type ScaleLayer } from './scaleLayers';
import type { HarmonyFocus, PositionType } from './settings';

/** Up to eight arpeggio overlays per chord, as the spec allows for chord layers. */
export const MAX_ARPEGGIO_LAYERS = 8;
/** Overlays carry a pip in one of four corners: at most four are drawn at once. */
export const MAX_VISIBLE_OVERLAYS = 4;

export type ViewShow = 'arpeggio' | 'scale';
/** A view's shape: the general ones, or a free stretch of frets. */
export type ViewPosition = PositionType | 'range';
/** A free stretch is at most an octave of frets: wider is the whole neck. */
export const MAX_RANGE_SPAN = 12;

export interface ArpeggioLayer {
  readonly id: string;
  readonly symbol: string;
  readonly visible: boolean;
  readonly color: LayerColor;
}

export interface ChordView {
  /** Only the chord tones, or the whole scale with the chord's functions. */
  readonly show: ViewShow;
  /** The scale that gives the shape and the spelling (also for the arpeggio). */
  readonly tonic: string;
  readonly scaleId: ScaleId;
  readonly positionType: ViewPosition;
  readonly cagedForm: CagedForm;
  readonly npsStart: number;
  /** Used with positionType "range": first and last fret, inclusive. */
  readonly rangeLow: number;
  readonly rangeHigh: number;
  readonly focus: HarmonyFocus;
  /** Extra scales, up to four: five with the view's own. */
  readonly layers: readonly ScaleLayer[];
  readonly arpeggios: readonly ArpeggioLayer[];
}

export type ChordViews = Readonly<Record<string, ChordView>>;

/**
 * The usual chord-scale for a chord on its own root: maj7 → ionian, m7 →
 * dorian, 7 → mixolydian, m7♭5 → locrian. A starting point, never a rule.
 */
export function defaultScaleFor(chord: Chord): ScaleId {
  switch (chord.family) {
    case 'major': return chord.tones.some((t) => t.degree === '#11') ? 'lydian' : 'ionian';
    case 'dominant': return 'mixolydian';
    case 'minor': return chord.tones.some((t) => t.degree === '7') ? 'melodicMinor' : chord.tones.some((t) => t.degree === 'b7' || t.degree === '6') ? 'dorian' : 'aeolian';
    case 'halfDiminished': return 'locrian';
    case 'diminished': return 'locrian';
    case 'augmented': return 'ionian';
    case 'suspended': return 'mixolydian';
  }
}

/** A fresh view for a chord: its chord-scale, an E-shape box, every function shown. */
export function defaultView(chord: Chord): ChordView {
  return {
    show: 'scale',
    tonic: chord.rootName,
    scaleId: defaultScaleFor(chord),
    positionType: 'caged',
    cagedForm: 'E',
    npsStart: 0,
    rangeLow: 5,
    rangeHigh: 9,
    focus: 'all',
    layers: [],
    arpeggios: [],
  };
}

export const viewScale = (view: ChordView): Scale => buildScale(view.tonic, view.scaleId);

/** The notes of the view's shape: CAGED box, 3NPS pattern or the whole neck. */
export function viewShapeNotes(view: ChordView): readonly FretNote[] {
  const scale = viewScale(view);
  if (view.positionType === 'neck') {
    const pcs = new Set(scale.tones.map((t) => t.pc));
    return allFretNotes(DEFAULT_FRETS).filter((n) => pcs.has(n.pc));
  }
  if (view.positionType === '3nps') {
    const position = threeNpsPosition(scale, view.npsStart);
    if (position) return position.notes;
  }
  if (view.positionType === 'range') return rangePosition(scale, view.rangeLow, view.rangeHigh).notes;
  return cagedPosition(scale, view.cagedForm).notes;
}

/**
 * What the board draws for this chord. With `arpeggio`, only chord tones
 * inside the shape's frets (the marker layer adds those outside the scale).
 */
export function viewNotes(view: ChordView, chord: Chord): readonly FretNote[] {
  const shape = viewShapeNotes(view);
  if (view.show === 'scale') return shape;
  const chordPcs = new Set(chord.tones.map((t) => t.pc));
  if (view.positionType === 'neck') return allFretNotes(DEFAULT_FRETS).filter((n) => chordPcs.has(n.pc));
  const frets = shape.map((n) => n.fret);
  const low = view.positionType === 'range' ? view.rangeLow : Math.min(...frets);
  const high = view.positionType === 'range' ? view.rangeHigh : Math.max(...frets);
  return allFretNotes(DEFAULT_FRETS).filter((n) => chordPcs.has(n.pc) && n.fret >= low && n.fret <= high);
}

/** A chord's tones in the shape of a scale, so an arpeggio can ride the overlay machinery. */
export function chordAsScale(chord: Chord): Scale {
  return {
    tonic: chord.root,
    tonicName: chord.rootName,
    definition: { id: 'ionian', name: `arpeggio ${chord.symbol}`, formula: chord.tones.map((t) => t.degree), parentOffset: 0 },
    tones: chord.tones.map((t) => ({ degree: t.degree, note: t.note, name: t.name, pc: t.pc })),
  };
}

export interface ViewOverlay {
  readonly id: string;
  readonly kind: 'scale' | 'arpeggio';
  readonly scale: Scale;
  readonly name: string;
  readonly color: LayerColor;
  readonly opacity: number;
  readonly visible: boolean;
  readonly wholeNeck: boolean;
}

/** Extra scales then arpeggio overlays, in list order; the first four visible ones are drawn. */
export function viewOverlays(view: ChordView): readonly ViewOverlay[] {
  const scales: ViewOverlay[] = view.layers.map((l) => {
    const scale = buildScale(l.tonic, l.scaleId);
    return { id: l.id, kind: 'scale', scale, name: `${scale.tonicName} ${scale.definition.name}`, color: l.color, opacity: l.opacity, visible: l.visible, wholeNeck: l.region === 'neck' };
  });
  const arps: ViewOverlay[] = view.arpeggios.flatMap((a) => {
    const chord = tryParseChord(a.symbol);
    return chord ? [{ id: a.id, kind: 'arpeggio' as const, scale: chordAsScale(chord), name: `Arpeggio ${chord.symbol}`, color: a.color, opacity: 1, visible: a.visible, wholeNeck: false }] : [];
  });
  return [...scales, ...arps];
}

export const visibleOverlayCount = (view: ChordView): number =>
  view.layers.filter((l) => l.visible).length + view.arpeggios.filter((a) => a.visible).length;

/** A new arpeggio overlay: visible only while the four pip corners last. */
export function addArpeggio(view: ChordView, symbol: string, id = newLayerId()): ChordView {
  if (view.arpeggios.length >= MAX_ARPEGGIO_LAYERS) return view;
  const used = new Set([...view.layers.map((l) => l.color), ...view.arpeggios.map((a) => a.color)]);
  const color = LAYER_COLORS.find((c) => !used.has(c)) ?? 'sky';
  return { ...view, arpeggios: [...view.arpeggios, { id, symbol, visible: visibleOverlayCount(view) < MAX_VISIBLE_OVERLAYS, color }] };
}

/** The view for the chord at `index`, or null when it follows the general settings. */
export function viewForChord(views: ChordViews, chordIds: readonly string[], index: number | null): ChordView | null {
  if (index === null) return null;
  const id = chordIds[index];
  return id ? views[id] ?? null : null;
}

/** Copy one chord's view to another, with fresh overlay ids. */
export function copyView(view: ChordView): ChordView {
  return { ...view, layers: view.layers.map((l) => ({ ...l, id: newLayerId() })), arpeggios: view.arpeggios.map((a) => ({ ...a, id: newLayerId() })) };
}

/** Low before high, never wider than an octave of frets. */
export function clampRange(low: number, high: number): { readonly rangeLow: number; readonly rangeHigh: number } {
  const a = Math.max(0, Math.min(DEFAULT_FRETS, Math.min(low, high)));
  const b = Math.max(0, Math.min(DEFAULT_FRETS, Math.max(low, high)));
  return { rangeLow: a, rangeHigh: Math.min(b, a + MAX_RANGE_SPAN) };
}

const FOCI: readonly HarmonyFocus[] = ['all', 'guide', 'common', 'resolution', 'targeting'];
const POSITIONS: readonly ViewPosition[] = ['caged', '3nps', 'neck', 'range'];
const fret = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= DEFAULT_FRETS ? v : fallback);

function sanitizeView(raw: unknown): ChordView | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.tonic !== 'string' || !TONICS.includes(r.tonic)) return null;
  if (typeof r.scaleId !== 'string' || !SCALE_IDS.includes(r.scaleId as ScaleId)) return null;
  const arps = Array.isArray(r.arpeggios) ? r.arpeggios : [];
  return {
    show: r.show === 'arpeggio' ? 'arpeggio' : 'scale',
    tonic: r.tonic,
    scaleId: r.scaleId as ScaleId,
    positionType: POSITIONS.includes(r.positionType as ViewPosition) ? (r.positionType as ViewPosition) : 'caged',
    cagedForm: CAGED_FORMS.includes(r.cagedForm as CagedForm) ? (r.cagedForm as CagedForm) : 'E',
    npsStart: typeof r.npsStart === 'number' && Number.isInteger(r.npsStart) && r.npsStart >= 0 && r.npsStart < 7 ? r.npsStart : 0,
    ...clampRange(fret(r.rangeLow, 5), fret(r.rangeHigh, 9)),
    focus: FOCI.includes(r.focus as HarmonyFocus) ? (r.focus as HarmonyFocus) : 'all',
    layers: sanitizeLayers({ scaleLayers: Array.isArray(r.layers) ? r.layers : [] }).slice(0, MAX_EXTRA_SCALES),
    arpeggios: arps.flatMap((a): ArpeggioLayer[] => {
      if (typeof a !== 'object' || a === null) return [];
      const x = a as Record<string, unknown>;
      if (typeof x.id !== 'string' || typeof x.symbol !== 'string' || !tryParseChord(x.symbol)) return [];
      const color = LAYER_COLORS.includes(x.color as LayerColor) ? (x.color as LayerColor) : 'sky';
      return [{ id: x.id, symbol: x.symbol.slice(0, 24), visible: x.visible !== false, color }];
    }).slice(0, MAX_ARPEGGIO_LAYERS),
  };
}

/** Keeps only valid views of chords still in the progression. */
export function sanitizeChordViews(raw: unknown, chordIds: readonly string[]): ChordViews {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Record<string, ChordView> = {};
  for (const id of chordIds) {
    const view = sanitizeView((raw as Record<string, unknown>)[id]);
    if (view) out[id] = view;
  }
  return out;
}
