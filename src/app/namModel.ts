/**
 * Neural Amp Modeler files (.nam), read before they reach the engine. Pure:
 * no Web Audio and no DOM here. The engine (neural-amp-modeler-wasm) parses
 * and runs the model; this module only decides whether a file is worth
 * sending to it, and describes it honestly to the user.
 *
 * What the engine does was measured on version 3.0.7 (docs/NAM_INTEGRATION.md):
 * it loads the legacy single-architecture files (WaveNet, LSTM, Linear: "A1")
 * and the SlimmableContainer files ("A2"); it does not resample, so a model
 * runs at the sample rate of the audio context whatever rate it was trained
 * at; it adds no latency; it normalises the level to −18 dB when the file
 * carries its loudness.
 */

/** A1: one legacy architecture per file. A2: a SlimmableContainer of sub-models. */
export type NamGeneration = 'A1' | 'A2';

/** Architectures registered in the engine build this app ships. ConvNet is registered but was not exercised by our tests. */
export const NAM_ARCHITECTURES: Readonly<Record<string, NamGeneration>> = {
  WaveNet: 'A1',
  LSTM: 'A1',
  ConvNet: 'A1',
  Linear: 'A1',
  SlimmableContainer: 'A2',
};

/** NAM trains at 48 kHz unless the file says otherwise. */
export const NAM_DEFAULT_SAMPLE_RATE = 48000;
/** Files above this size are refused before parsing: the text is copied to the audio thread and parsed there. A guard, not a measured limit. */
export const NAM_MAX_BYTES = 32 * 1024 * 1024;
/** Oldest file format the engine accepts (it refuses 0.3 and 0.4 itself). */
const MIN_VERSION: readonly [number, number] = [0, 5];

export interface NamModelSummary {
  readonly fileName: string;
  /** The name in the file's metadata, or the file name without its extension. */
  readonly name: string;
  readonly architecture: string;
  readonly generation: NamGeneration;
  readonly version: string;
  /** Sample rate declared by the file; null when it does not say (then 48 kHz by NAM's convention). */
  readonly sampleRate: number | null;
  /** Weights of the largest model in the file. */
  readonly weightCount: number;
  /** Sub-models of a SlimmableContainer; 1 for a legacy file. */
  readonly submodels: number;
  readonly sizeBytes: number;
  /** Loudness the file declares, dB; null when absent (then the engine does not normalise the level). */
  readonly loudness: number | null;
  readonly gearType: string;
  readonly toneType: string;
  readonly gearMake: string;
  readonly gearModel: string;
  readonly modeledBy: string;
  /** The metadata says the capture includes a cabinet (gear type with "cab"). Only a hint: metadata is often missing. */
  readonly includesCab: boolean;
}

export type NamRejection = 'empty' | 'too-large' | 'not-json' | 'not-nam' | 'architecture' | 'version' | 'no-weights';
export type NamInspection =
  | { readonly ok: true; readonly summary: NamModelSummary }
  | { readonly ok: false; readonly code: NamRejection; readonly message: string };

const reject = (code: NamRejection, message: string): NamInspection => ({ ok: false, code, message });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Text from metadata, shortened, with the trainer's "no value" placeholders dropped. */
const text = (v: unknown): string => {
  if (typeof v !== 'string') return '';
  const t = v.trim().slice(0, 80);
  return /^(t3k-null|null|none|n\/a)$/i.test(t) ? '' : t;
};
const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function versionOf(v: unknown): readonly [number, number] | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const megabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;

/**
 * Reads a .nam file's text and says whether it can go to the engine. A file
 * that passes can still be refused by the engine (a weight count that does
 * not fit its architecture, for example): only the engine's answer makes a
 * model "loaded".
 */
export function inspectNamModel(source: string, fileName: string): NamInspection {
  const sizeBytes = source.length;
  if (source.trim() === '') return reject('empty', 'Il file è vuoto.');
  if (sizeBytes > NAM_MAX_BYTES) return reject('too-large', `Il file pesa ${megabytes(sizeBytes)}: il limite è ${megabytes(NAM_MAX_BYTES)}.`);
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { return reject('not-json', 'Il file non è un modello NAM leggibile (non è JSON).'); }
  if (!isObject(raw) || typeof raw.architecture !== 'string' || !isObject(raw.config)) {
    return reject('not-nam', 'Il file non è un modello NAM: mancano architettura e configurazione.');
  }
  const generation = Object.hasOwn(NAM_ARCHITECTURES, raw.architecture) ? NAM_ARCHITECTURES[raw.architecture] : undefined;
  if (!generation) return reject('architecture', `Architettura «${raw.architecture.slice(0, 40)}» non supportata dal motore (supportate: ${Object.keys(NAM_ARCHITECTURES).join(', ')}).`);
  const version = versionOf(raw.version);
  if (!version) return reject('version', 'Il file non dichiara una versione del formato NAM valida.');
  if (version[0] < MIN_VERSION[0] || (version[0] === MIN_VERSION[0] && version[1] < MIN_VERSION[1])) {
    return reject('version', `Formato NAM ${String(raw.version)} troppo vecchio: il motore legge dalla 0.5 in poi.`);
  }

  // A2: the weights live in the sub-models; the largest one is what runs at full size.
  let weightCount = Array.isArray(raw.weights) ? raw.weights.length : 0;
  let submodels = 1;
  let sampleRate = finite(raw.sample_rate);
  if (generation === 'A2') {
    const list = Array.isArray(raw.config.submodels) ? raw.config.submodels : [];
    submodels = list.length;
    for (const entry of list) {
      const model = isObject(entry) && isObject(entry.model) ? entry.model : null;
      if (!model) continue;
      if (Array.isArray(model.weights)) weightCount = Math.max(weightCount, model.weights.length);
      sampleRate ??= finite(model.sample_rate);
    }
    if (submodels === 0) return reject('not-nam', 'Il modello A2 non contiene sotto-modelli.');
  }
  if (weightCount === 0) return reject('no-weights', 'Il file non contiene i pesi del modello.');

  const meta = isObject(raw.metadata) ? raw.metadata : {};
  const gearType = text(meta.gear_type);
  const base = fileName.replace(/\.nam$/i, '');
  return {
    ok: true,
    summary: {
      fileName,
      name: text(meta.name) || base || 'modello',
      architecture: raw.architecture,
      generation,
      version: String(raw.version).trim(),
      sampleRate: sampleRate !== null && sampleRate > 0 ? sampleRate : null,
      weightCount,
      submodels,
      sizeBytes,
      loudness: finite(meta.loudness),
      gearType,
      toneType: text(meta.tone_type),
      gearMake: text(meta.gear_make),
      gearModel: text(meta.gear_model),
      modeledBy: text(meta.modeled_by),
      includesCab: /cab|full[-_ ]?rig/i.test(gearType),
    },
  };
}

/**
 * The engine runs a model at the context's sample rate without resampling.
 * Null when the rates agree; otherwise what the user should know.
 */
export function sampleRateNote(modelRate: number | null, contextRate: number): string | null {
  const trained = modelRate ?? NAM_DEFAULT_SAMPLE_RATE;
  if (Math.abs(trained - contextRate) < 1) return null;
  const assumed = modelRate === null ? ' (frequenza non dichiarata: 48 kHz per convenzione NAM)' : '';
  return `Modello addestrato a ${trained} Hz${assumed}, audio a ${contextRate} Hz: il motore non ricampiona, quindi timbro e risposta cambiano. Per il suono corretto apri l’audio a ${trained} Hz.`;
}

/** How heavy a model is for this machine, from a measured render: time spent per second of audio (1 = all of it). */
export type NamCostVerdict = 'ok' | 'heavy' | 'too-heavy';
export const NAM_COST_HEAVY = 0.5;
export const NAM_COST_LIMIT = 0.85;
export function costVerdict(realtimeFactor: number): NamCostVerdict {
  if (!Number.isFinite(realtimeFactor) || realtimeFactor >= NAM_COST_LIMIT) return 'too-heavy';
  return realtimeFactor >= NAM_COST_HEAVY ? 'heavy' : 'ok';
}

/** Input trim into the model, from the amp's Gain knob: −12 … +12 dB, unity at noon (a capture expects the level it was trained at). */
export const namInputDb = (knob: number): number => -12 + (24 * Math.max(0, Math.min(100, knob))) / 100;

/** One line for the amp's tape label: what the loaded model is. */
export function describeNamModel(s: NamModelSummary): string {
  const gear = [s.gearMake, s.gearModel].filter(Boolean).join(' ');
  const parts = [s.generation, s.architecture === 'SlimmableContainer' ? `${s.submodels} taglie` : s.architecture, `${s.weightCount.toLocaleString('it-IT')} pesi`];
  if (gear) parts.push(gear);
  if (s.modeledBy) parts.push(`di ${s.modeledBy}`);
  return parts.join(' · ');
}
