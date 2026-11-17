/**
 * Host of the Neural Amp Modeler engine (D-51, docs/NAM_INTEGRATION.md).
 *
 * The engine is `neural-amp-modeler-wasm` (TONE3000, MIT): NAM Core compiled
 * to WebAssembly, running inside an AudioWorklet. Only its headless engine
 * is used (`/engine`), loaded on demand: nothing of it is downloaded until
 * the user loads a model. Its React player is not used.
 *
 * A model goes through three steps, and is called loaded only after the last:
 *   1. the file is inspected (app/namModel.ts);
 *   2. the model is loaded and rendered in an offline context: this proves
 *      the engine accepts it and produces sound, and measures what it costs
 *      on this machine, without touching the audio that is playing;
 *   3. the model is loaded in the live node, and the engine answers.
 * A file that fails leaves the previous model in place.
 *
 * The model text is kept in memory for this visit only. Nothing here turns
 * the listening on.
 */
import { create } from 'zustand';
import { costVerdict, inspectNamModel, sampleRateNote, type NamCostVerdict, type NamModelSummary } from '../app/namModel';

export type NamPhase = 'empty' | 'checking' | 'loading' | 'ready' | 'error';

/** What the engine reported after loading the model. */
export interface NamEngineInfo {
  readonly slimmable: boolean;
  readonly hasLoudness: boolean;
  readonly loudness: number;
  readonly expectedSampleRate: number;
}

/** Measured on this machine when the model was loaded. */
export interface NamMeasure {
  /** Time the engine took to parse the model in the live node, ms. */
  readonly loadMs: number;
  /** Offline render: processing time per second of audio (1 = all of the time available). */
  readonly realtimeFactor: number;
  /** The same, as microseconds per block of 128 samples. */
  readonly microsPerBlock: number;
  /** Time available for one block at this sample rate, microseconds. */
  readonly budgetMicros: number;
  readonly verdict: NamCostVerdict;
  /** Sample rate of the audio context the model runs in. */
  readonly sampleRate: number;
}

/**
 * Where the model came from. A TONE3000 model keeps what its attribution
 * needs (tone, creator, the tone's page and picture); never a download
 * address or a token. Kept in memory with the model, not in the settings.
 */
export type NamOrigin =
  | { readonly kind: 'file' }
  | {
    readonly kind: 'tone3000'; readonly toneId: number; readonly modelId: number; readonly title: string; readonly author: string;
    readonly toneUrl: string; readonly gear: string; readonly imageUrl: string;
  };

export interface NamStatus {
  readonly phase: NamPhase;
  /** The model that is loaded in the engine now (phase 'ready'), or null. */
  readonly summary: NamModelSummary | null;
  readonly info: NamEngineInfo | null;
  readonly measure: NamMeasure | null;
  readonly origin: NamOrigin | null;
  /** Why the sample rates disagree, or null. */
  readonly rateNote: string | null;
  /** The last failure, in Italian. With phase 'ready' it is about a file that was refused while the previous model stayed. */
  readonly error: string | null;
  /** Name of the file being checked or loaded. */
  readonly pending: string;
}

const EMPTY: NamStatus = { phase: 'empty', summary: null, info: null, measure: null, origin: null, rateNote: null, error: null, pending: '' };
export const useNam = create<NamStatus>(() => EMPTY);

/** The part of the engine's node this host uses. */
interface ModelNode extends AudioNode {
  loadModel(json: string): Promise<NamEngineInfo>;
  unloadModel(): Promise<void>;
  dispose(): Promise<void>;
}
interface Engine { createNode(): Promise<ModelNode> }

const BENCH_SECONDS = 0.5;
const LOAD_TIMEOUT_MS = 15000;

async function engineFor(ctx: BaseAudioContext): Promise<Engine> {
  const { NamEngine } = await import('neural-amp-modeler-wasm/engine');
  return NamEngine.attach(ctx) as Promise<Engine>;
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(what)), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e: unknown) => { clearTimeout(timer); reject(e instanceof Error ? e : new Error(String(e))); });
  });
}

/** The engine's own words (English) under an Italian sentence. */
const engineError = (error: unknown): string => {
  const detail = error instanceof Error ? error.message : String(error);
  if (/AudioWorklet is not available/i.test(detail)) return 'Il motore NAM richiede AudioWorklet (pagina HTTPS o localhost, browser recente).';
  if (/Failed to fetch|dynamically imported module|Importing a module script failed/i.test(detail)) return 'Il motore NAM non è disponibile in questa copia dell’app (file del motore non raggiungibili).';
  if (/timeout/i.test(detail)) return 'Il motore NAM non ha risposto in tempo.';
  return `Il motore NAM ha rifiutato il modello: ${detail.slice(0, 200)}`;
};

export interface NamBenchmark {
  readonly realtimeFactor: number;
  readonly microsPerBlock: number;
  readonly rms: number;
  readonly finite: boolean;
  readonly info: NamEngineInfo;
}

/**
 * Loads the model in an offline context and renders a test tone through it:
 * the engine either accepts the model and produces finite, audible samples,
 * or this throws. The render is timed: offline rendering runs the same code
 * as the live worklet, on a thread of normal priority, so the figure is an
 * estimate of the live cost on this machine, not a guarantee.
 */
export async function benchmarkNam(json: string, sampleRate: number, seconds = BENCH_SECONDS): Promise<NamBenchmark> {
  const frames = Math.round(sampleRate * seconds);
  const ctx = new OfflineAudioContext(1, frames, sampleRate);
  const engine = await engineFor(ctx);
  const node = await engine.createNode();
  try {
    const info = await node.loadModel(json);
    const buffer = ctx.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);
    // A low E with a few harmonics, at a guitar's level.
    for (let i = 0; i < frames; i += 1) {
      const t = (2 * Math.PI * 82.41 * i) / sampleRate;
      data[i] = 0.2 * Math.sin(t) + 0.08 * Math.sin(2 * t) + 0.04 * Math.sin(3 * t);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(node).connect(ctx.destination);
    source.start();
    const started = performance.now();
    const out = (await ctx.startRendering()).getChannelData(0);
    const elapsed = performance.now() - started;
    let sum = 0;
    let finite = true;
    for (let i = frames >> 1; i < frames; i += 1) {
      const v = out[i] ?? 0;
      if (!Number.isFinite(v)) finite = false;
      sum += v * v;
    }
    return {
      realtimeFactor: elapsed / (seconds * 1000),
      microsPerBlock: (elapsed * 1000) / (frames / 128),
      rms: Math.sqrt(sum / (frames - (frames >> 1))),
      finite,
      info,
    };
  } finally {
    void node.dispose().catch(() => undefined);
  }
}

/**
 * Delay the engine adds, in samples: an impulse through a one-tap model
 * (output = input), rendered offline. The impulse sits after the engine's
 * fade-in of 1024 samples.
 */
export async function namLatencySamples(sampleRate: number): Promise<number> {
  const at = 4096;
  const frames = at + 4096;
  const ctx = new OfflineAudioContext(1, frames, sampleRate);
  const engine = await engineFor(ctx);
  const node = await engine.createNode();
  try {
    await node.loadModel(JSON.stringify({ version: '0.5.4', architecture: 'Linear', config: { receptive_field: 1, bias: false }, weights: [1], sample_rate: sampleRate }));
    const buffer = ctx.createBuffer(1, frames, sampleRate);
    buffer.getChannelData(0)[at] = 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(node).connect(ctx.destination);
    source.start();
    const out = (await ctx.startRendering()).getChannelData(0);
    let peak = 0;
    let where = -1;
    for (let i = 0; i < frames; i += 1) { const v = Math.abs(out[i] ?? 0); if (v > peak) { peak = v; where = i; } }
    return peak > 0.5 ? where - at : Number.NaN;
  } finally {
    void node.dispose().catch(() => undefined);
  }
}

class NamHost {
  /** The loaded model's text, kept for this visit: a new audio context gets it again. */
  private json: string | null = null;
  private node: ModelNode | null = null;
  private nodeCtx: BaseAudioContext | null = null;
  /** The live node holds the model of `json`. */
  private loaded = false;
  private request = 0;
  /** Set by the guitar input: receives the node when a model is ready in it, null when it is not. */
  onNode: ((node: AudioNode | null) => void) | null = null;

  /** The node to connect in this context, only if the engine holds a loaded model there. */
  nodeFor(ctx: BaseAudioContext): AudioNode | null {
    return this.loaded && this.node && this.nodeCtx === ctx ? this.node : null;
  }

  /** The text of the loaded model (for tests and for a context that changed). */
  get hasModel(): boolean {
    return this.json !== null;
  }

  async loadFile(file: Blob & { readonly name?: string }, ctx: AudioContext, origin: NamOrigin = { kind: 'file' }): Promise<boolean> {
    let text: string;
    try { text = await file.text(); } catch { return this.fail('Non riesco a leggere il file.', this.request += 1); }
    return this.load(text, file.name ?? 'modello.nam', ctx, origin);
  }

  /** The three steps. Resolves true only when the engine holds the model in the live node. */
  async load(text: string, fileName: string, ctx: AudioContext, origin: NamOrigin = { kind: 'file' }): Promise<boolean> {
    const request = (this.request += 1);
    useNam.setState({ phase: this.loaded ? 'ready' : 'checking', pending: fileName, error: null });
    const inspection = inspectNamModel(text, fileName);
    if (!inspection.ok) return this.fail(`${fileName}: ${inspection.message}`, request);

    let bench: NamBenchmark;
    try {
      bench = await withTimeout(benchmarkNam(text, ctx.sampleRate), LOAD_TIMEOUT_MS, 'timeout');
    } catch (error) {
      return this.fail(`${fileName}: ${engineError(error)}`, request);
    }
    if (request !== this.request) return false;
    if (!bench.finite) return this.fail(`${fileName}: il modello produce valori non validi. Non caricato.`, request);
    if (bench.rms < 1e-7) return this.fail(`${fileName}: il modello non produce suono sul segnale di prova. Non caricato.`, request);
    const verdict = costVerdict(bench.realtimeFactor);
    if (verdict === 'too-heavy') {
      return this.fail(`${fileName}: modello troppo pesante per questo computer (${Math.round(bench.realtimeFactor * 100)}% del tempo disponibile nella prova). Non caricato.`, request);
    }

    // From here the live node changes: close the gate first, so nothing half-loaded is heard.
    const hadModel = this.loaded;
    this.loaded = false;
    this.onNode?.(null);
    useNam.setState({ phase: 'loading', pending: fileName });
    try {
      await new Promise((resolve) => { setTimeout(resolve, 80); });
      if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
      const node = await withTimeout(this.ensureNode(ctx), LOAD_TIMEOUT_MS, 'timeout');
      const started = performance.now();
      const info = await withTimeout(node.loadModel(text), LOAD_TIMEOUT_MS, 'timeout');
      const loadMs = performance.now() - started;
      if (request !== this.request) return false;
      this.json = text;
      this.loaded = true;
      useNam.setState({
        phase: 'ready', summary: inspection.summary, info, origin, error: null, pending: '',
        rateNote: sampleRateNote(info.expectedSampleRate > 0 ? info.expectedSampleRate : inspection.summary.sampleRate, ctx.sampleRate),
        measure: {
          loadMs, realtimeFactor: bench.realtimeFactor, microsPerBlock: bench.microsPerBlock,
          budgetMicros: (128 / ctx.sampleRate) * 1e6, verdict, sampleRate: ctx.sampleRate,
        },
      });
      this.onNode?.(node);
      return true;
    } catch (error) {
      // The live node may hold nothing now: say so rather than pretend the old model survived.
      this.json = null;
      void this.node?.unloadModel().catch(() => undefined);
      useNam.setState({ ...EMPTY, phase: 'error', error: `${fileName}: ${engineError(error)}${hadModel ? ' Il modello precedente è stato scaricato.' : ''}` });
      return false;
    }
  }

  /** Removes the model: the amp goes back to its built-in preamp. */
  unload(): void {
    this.request += 1;
    this.json = null;
    this.loaded = false;
    this.onNode?.(null);
    void this.node?.unloadModel().catch(() => undefined);
    useNam.setState(EMPTY);
  }

  /**
   * Called when the guitar input starts: if a model is in memory but the
   * live node belongs to another context (or was never made), load it there.
   */
  async attach(ctx: AudioContext): Promise<void> {
    if (this.json === null || (this.loaded && this.nodeCtx === ctx)) { this.onNode?.(this.nodeFor(ctx)); return; }
    const status = useNam.getState();
    if (status.summary) await this.load(this.json, status.summary.fileName, ctx, status.origin ?? { kind: 'file' });
  }

  private async ensureNode(ctx: AudioContext): Promise<ModelNode> {
    if (this.node && this.nodeCtx === ctx) return this.node;
    if (this.node) void this.node.dispose().catch(() => undefined);
    this.node = null;
    const engine = await engineFor(ctx);
    this.node = await engine.createNode();
    this.nodeCtx = ctx;
    return this.node;
  }

  /** A refused file: the previous model, if any, stays loaded and heard. */
  private fail(message: string, request: number): boolean {
    if (request !== this.request) return false;
    useNam.setState(this.loaded ? { phase: 'ready', error: `${message} Resta caricato il modello precedente.`, pending: '' } : { ...EMPTY, phase: 'error', error: message });
    return false;
  }
}

export const namHost = new NamHost();
