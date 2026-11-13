/**
 * Synthetic .nam files for tests and measurements. They use the published
 * NAM file formats with pseudo-random weights from a fixed seed: they are
 * not captures of any amplifier and carry nobody's training, so they can be
 * generated and distributed freely. They sound like a filter with some
 * distortion, not like an amp: what they prove is that the engine runs the
 * same architectures, at the same cost, as real captures of the same size.
 *
 * Pure: no Web Audio and no DOM. Not imported by the app itself.
 */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded weights for a WaveNet. The last two are the head's bias and the output scale: fixed, so the level is audible and there is no offset. */
const weights = (count: number, seed: number, scale: number, outputScale: number): number[] => {
  const random = rng(seed);
  const list = Array.from({ length: count }, () => Math.round((random() * 2 - 1) * scale * 1e6) / 1e6);
  list[count - 2] = 0;
  list[count - 1] = outputScale;
  return list;
};

export interface NamFixtureMeta {
  readonly name?: string;
  readonly gearType?: string;
  readonly loudness?: number;
}

const metadata = (meta: NamFixtureMeta, fallback: string) => ({
  name: meta.name ?? fallback,
  modeled_by: 'Guitar Theory Lab (sintetico)',
  gear_type: meta.gearType ?? 'amp',
  ...(meta.loudness !== undefined ? { loudness: meta.loudness } : {}),
});

/** A one-tap Linear model: the output is the input times `gain`, with no delay. The simplest thing the engine runs. */
export function linearNam(gain = 0.5, meta: NamFixtureMeta = {}): string {
  return JSON.stringify({
    version: '0.5.4',
    metadata: metadata(meta, 'Lineare di prova'),
    architecture: 'Linear',
    config: { receptive_field: 4, bias: false },
    weights: [gain, 0, 0, 0],
    sample_rate: 48000,
  });
}

/** Weights of the legacy "standard" WaveNet (two layer arrays, 16 and 8 channels): the size of most A1 captures. */
export const A1_STANDARD_WEIGHTS = 13802;
const A1_OUT = 1;
const A2_OUT = 1;
const DILATIONS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

/** A legacy (A1) WaveNet in the "standard" size, with seeded pseudo-random weights. */
export function waveNetA1Nam(meta: NamFixtureMeta = {}, seed = 1): string {
  const layer = (input: number, channels: number, head: number, headBias: boolean) => ({
    input_size: input, condition_size: 1, head_size: head, channels, kernel_size: 3, dilations: DILATIONS, activation: 'Tanh', gated: false, head_bias: headBias,
  });
  return JSON.stringify({
    version: '0.5.1',
    metadata: metadata(meta, 'WaveNet A1 di prova'),
    architecture: 'WaveNet',
    config: { layers: [layer(1, 16, 8, false), layer(16, 8, 1, true)], head: null, head_scale: 0.02 },
    weights: weights(A1_STANDARD_WEIGHTS, seed, 0.25, A1_OUT),
  });
}

const A2_KERNELS = [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 15, 15, 6, 6, 6, 6, 6, 6, 6];
const A2_DILATIONS = [1, 3, 7, 17, 41, 101, 239, 1, 3, 7, 17, 41, 101, 239, 1, 13, 1, 3, 7, 17, 41, 101, 239];
/** Weights of an A2 sub-model with the given channel count (3 and 8 are the two sizes TONE3000 trains). */
export const A2_WEIGHTS: Readonly<Record<3 | 8, number>> = { 3: 1871, 8: 12146 };

function a2Submodel(channels: 3 | 8, seed: number) {
  const film = { active: false, shift: true, groups: 1 };
  return {
    version: '0.7.0',
    architecture: 'WaveNet',
    config: {
      layers: [{
        input_size: 1, condition_size: 1, head: { out_channels: 1, kernel_size: 16, bias: true }, channels,
        kernel_sizes: A2_KERNELS, dilations: A2_DILATIONS,
        activation: A2_KERNELS.map(() => ({ type: 'LeakyReLU', negative_slope: 0.01 })),
        bottleneck: channels, head1x1: { active: false, out_channels: 1, groups: 1 }, layer1x1: { active: true, groups: 1 },
        groups_input: 1, groups_input_mixin: 1,
        conv_pre_film: film, conv_post_film: film, input_mixin_pre_film: film, input_mixin_post_film: film,
        activation_pre_film: film, activation_post_film: film, layer1x1_post_film: film, head1x1_post_film: film,
        gating_mode: A2_KERNELS.map(() => 'none'), secondary_activation: A2_KERNELS.map(() => null), slimmable: null,
      }],
      head: null, head_scale: 0.02,
    },
    weights: weights(A2_WEIGHTS[channels], seed, 0.2, A2_OUT),
    sample_rate: 48000,
  };
}

/** An A2 file: a SlimmableContainer with the two sizes (3 and 8 channels), seeded pseudo-random weights. */
export function slimmableA2Nam(meta: NamFixtureMeta = {}, seed = 2): string {
  return JSON.stringify({
    version: '0.7.0',
    metadata: metadata(meta, 'A2 di prova'),
    architecture: 'SlimmableContainer',
    config: { submodels: [{ max_value: 0.5, model: a2Submodel(3, seed) }, { max_value: 1, model: a2Submodel(8, seed + 1) }] },
    weights: [],
    sample_rate: 48000,
  });
}
