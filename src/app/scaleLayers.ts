/**
 * Scales drawn on top of the main one. The main scale lives in the study
 * settings; these are the up-to-four extras. Pure and framework-free.
 */
import { SCALES, TONICS, buildScale, type Scale, type ScaleId } from '../theory';

export const MAX_SCALES = 5;
export const MAX_EXTRA_SCALES = MAX_SCALES - 1;
/** Main scale included. More can be shown, but new ones start hidden past this. */
export const DEFAULT_VISIBLE_SCALES = 2;

export const LAYER_COLORS = ['teal', 'amber', 'lime', 'coral', 'sky', 'rose'] as const;
export type LayerColor = (typeof LAYER_COLORS)[number];

export const LAYER_COLOR_NAMES: Readonly<Record<LayerColor, string>> = {
  teal: 'Verde acqua', amber: 'Ambra', lime: 'Lime', coral: 'Corallo', sky: 'Celeste', rose: 'Rosa',
};

/** Where a pip sits around a note, by position in the list: the shape tells layers apart, not only the colour. */
export const PIP_PLACES = ['in alto a destra', 'in basso a destra', 'in basso a sinistra', 'in alto a sinistra'] as const;

export type LayerRegion = 'position' | 'neck';

export interface ScaleLayer {
  readonly id: string;
  readonly tonic: string;
  readonly scaleId: ScaleId;
  readonly visible: boolean;
  readonly color: LayerColor;
  /** 0.25–1. */
  readonly opacity: number;
  /** Same frets as the main position, or the whole neck. */
  readonly region: LayerRegion;
}

export interface ShownLayer {
  readonly layer: ScaleLayer;
  /** Position in the list: picks the pip place. */
  readonly index: number;
  readonly scale: Scale;
}

export const visibleLayers = (layers: readonly ScaleLayer[]): readonly ShownLayer[] =>
  layers.flatMap((layer, index) => (layer.visible ? [{ layer, index, scale: buildScale(layer.tonic, layer.scaleId) }] : []));

/** One visible extra plus the main scale stays readable; beyond that the board gets dense. */
export const isCrowded = (layers: readonly ScaleLayer[]): boolean =>
  1 + layers.filter((l) => l.visible).length > DEFAULT_VISIBLE_SCALES;

let counter = 0;
export function newLayerId(): string {
  counter += 1;
  return `s${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * A new layer: the relative minor or major of the main key as a sensible start,
 * an unused colour, and visible only while that keeps two scales on screen.
 */
export function addLayer(layers: readonly ScaleLayer[], main: { readonly tonic: string; readonly scaleId: ScaleId }, id = newLayerId()): readonly ScaleLayer[] {
  if (layers.length >= MAX_EXTRA_SCALES) return layers;
  const mainScale = buildScale(main.tonic, main.scaleId);
  const isMinor = mainScale.tones.some((t) => t.degree === 'b3');
  const pentatonicStart = isMinor
    ? { tonic: main.tonic, scaleId: 'minorPentatonic' as const }
    : { tonic: mainScale.tones[5]?.name ?? main.tonic, scaleId: 'minorPentatonic' as const };
  const tonic = TONICS.includes(pentatonicStart.tonic) ? pentatonicStart.tonic : main.tonic;
  const used = new Set(layers.map((l) => l.color));
  const color = LAYER_COLORS.find((c) => !used.has(c)) ?? 'teal';
  const visible = 1 + layers.filter((l) => l.visible).length < DEFAULT_VISIBLE_SCALES;
  return [...layers, { id, tonic, scaleId: pentatonicStart.scaleId, visible, color, opacity: 1, region: 'position' }];
}

export function moveLayer(layers: readonly ScaleLayer[], from: number, to: number): readonly ScaleLayer[] {
  if (to < 0 || to >= layers.length || from === to) return layers;
  const next = [...layers];
  const [item] = next.splice(from, 1);
  if (item) next.splice(to, 0, item);
  return next;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const oneOf = <T,>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

/**
 * Accept saved layers; older saves had one "second scale" switch, which becomes
 * the first layer so nobody loses what they set up.
 */
export function sanitizeLayers(raw: Record<string, unknown>): readonly ScaleLayer[] {
  const scaleIds = Object.keys(SCALES) as ScaleId[];
  if (Array.isArray(raw.scaleLayers)) {
    const seen = new Set<string>();
    return raw.scaleLayers.filter(isObject).slice(0, MAX_EXTRA_SCALES).map((l, i): ScaleLayer => {
      let id = typeof l.id === 'string' && l.id ? l.id : `s${i}`;
      if (seen.has(id)) id = `${id}-${i}`;
      seen.add(id);
      return {
        id,
        tonic: oneOf(l.tonic, TONICS, 'A'),
        scaleId: oneOf(l.scaleId, scaleIds, 'minorPentatonic'),
        visible: typeof l.visible === 'boolean' ? l.visible : true,
        color: oneOf(l.color, LAYER_COLORS, LAYER_COLORS[i % LAYER_COLORS.length] ?? 'teal'),
        opacity: typeof l.opacity === 'number' && Number.isFinite(l.opacity) ? Math.min(1, Math.max(0.25, l.opacity)) : 1,
        region: oneOf(l.region, ['position', 'neck'] as const, 'position'),
      };
    });
  }
  if (raw.secondScaleOn === true) {
    return [{
      id: 'legacy-second',
      tonic: oneOf(raw.secondTonic, TONICS, 'A'),
      scaleId: oneOf(raw.secondScaleId, scaleIds, 'minorPentatonic'),
      visible: true,
      color: 'lime',
      opacity: 1,
      region: 'position',
    }];
  }
  return [];
}
