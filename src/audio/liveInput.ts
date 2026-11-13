/**
 * The guitar input: Guitar Input → Direct Signal → Pitch Analysis, with an
 * optional Monitoring branch. The analysis always reads the dry signal after
 * the input gain. Monitoring starts off every time and is turned on only by
 * the user, to avoid feedback through speakers. Analysis runs on a worker
 * timer at about 25 Hz; it is not a musical clock and schedules no sound.
 */
import { create } from 'zustand';
import { SENSITIVITY, detectPitch, PitchTracker, type Sensitivity, type TrackedPitch } from '../pitch';
import { workerTimer } from './webAudioSink';
import { DEFAULT_RIG, type RigSettings } from '../app/rig';
import { GuitarRig, decodeImpulse, type RigState } from './guitarRig';

export type LiveState = 'off' | 'starting' | 'on' | 'error';
/** Which input channel carries the guitar. Many USB interfaces put the instrument input on channel 2. */
export type InputChannel = 'mix' | 'left' | 'right';

export interface LiveDiagnostics {
  readonly contextState: string;
  readonly sampleRate: number;
  readonly baseLatency: number | null;
  readonly outputLatency: number | null;
  readonly deviceLabel: string;
  readonly inputChannels: number | null;
  readonly trackSampleRate: number | null;
  /** How samples reach the analysis: the capture worklet, or the analyser and a timer. */
  readonly analysis: 'worklet' | 'analyser';
}

export interface LiveSnapshot {
  readonly state: LiveState;
  readonly error: string | null;
  readonly devices: readonly { readonly id: string; readonly label: string }[];
  readonly deviceId: string;
  /** Input level after the gain, RMS 0–1, and whether it clipped recently. */
  readonly level: number;
  readonly clipping: boolean;
  readonly pitch: TrackedPitch | null;
  readonly monitorOn: boolean;
  readonly diagnostics: LiveDiagnostics | null;
  /** Grows when the rig's graph changed on its own (a deferred rewiring, a model that finished loading). */
  readonly rigRevision: number;
}

export const useLive = create<LiveSnapshot>(() => ({
  state: 'off', error: null, devices: [], deviceId: '', level: 0, clipping: false, pitch: null, monitorOn: false, diagnostics: null, rigRevision: 0,
}));

/** Readable Italian messages for what getUserMedia can throw. */
export function inputErrorMessage(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Permesso al microfono negato. Consentilo dalle impostazioni del sito nel browser e riprova.';
    case 'NotFoundError':
      return 'Nessun ingresso audio trovato. Collega l’interfaccia audio o il microfono e riprova.';
    case 'NotReadableError':
      return 'L’ingresso è occupato da un’altra applicazione o non risponde.';
    case 'OverconstrainedError':
      return 'Il dispositivo scelto non è più disponibile. Scegline un altro.';
    case 'NoMediaDevices':
      return 'Questo browser non dà accesso all’ingresso audio (serve una pagina HTTPS o localhost).';
    case 'AudioSuspended':
      return 'L’audio del browser è sospeso. Premi Avvia (il trasporto) o fai clic nella pagina, poi riavvia l’ingresso.';
    default:
      return 'Non riesco ad aprire l’ingresso audio.';
  }
}

/** The analyser keeps the longest frame any mode reads; each mode takes its most recent part. */
const FRAME = 4096;

/**
 * The capture worklet (D-38): copies the dry signal in hops of N samples and
 * posts them to the page, so the analysis sees every sample, at a pace set
 * by the audio clock rather than a timer. Shipped as text: no extra file.
 */
const WORKLET = `
class GtlCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.hop = 2048;
    this.buffer = new Float32Array(8192);
    this.filled = 0;
    this.port.onmessage = (e) => { if (e.data && e.data.hop) this.hop = e.data.hop; };
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      this.buffer.set(channel, this.filled);
      this.filled += channel.length;
      if (this.filled >= this.hop) {
        this.port.postMessage(this.buffer.slice(0, this.filled));
        this.filled = 0;
      }
    }
    return true;
  }
}
registerProcessor('gtl-capture', GtlCapture);
`;

/** What the analysis uses: the sensitivity mode, and the profile's gates when one is chosen. */
export interface AnalysisSettings {
  readonly sensitivity: Sensitivity;
  readonly minRms: number;
  /** Null keeps the mode's own gate. */
  readonly minConfidence: number | null;
}

/** A short recording for the calibration: raw samples, plus the readings the analysis made meanwhile. */
export interface Capture {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  /** AudioContext time of the first sample. */
  readonly startTime: number;
  readonly levels: readonly number[];
  readonly readings: readonly { readonly rms: number; readonly confidence: number }[];
}

class LiveInput {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  /** Mono guitar signal: the chosen channel, or both averaged. */
  private mono: GainNode | null = null;
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private recorder: { samples: Float32Array; written: number; startTime: number; done: (startTime: number, samples: Float32Array) => void } | null = null;
  private sink: GainNode | null = null;
  /** The last FRAME samples, kept up to date by the worklet. */
  private ring = new Float32Array(FRAME);
  private monitor: GainNode | null = null;
  /** Guitar Rig (D-42) on the listening branch only: the analysis keeps the dry signal. */
  private rig: GuitarRig | null = null;
  private rigSettings: RigSettings = DEFAULT_RIG;
  private cabFile: AudioBuffer | null = null;
  private stopTimer: (() => void) | null = null;
  private tracker = new PitchTracker();
  private buffer = new Float32Array(FRAME);
  private clipUntil = 0;
  private inputGain = 1;
  private monitorLevel = 0.6;
  private settings: AnalysisSettings = { sensitivity: 'balanced', minRms: 0.01, minConfidence: null };
  private sampleRate = 48000;
  private capturing: { levels: number[]; readings: { rms: number; confidence: number }[] } | null = null;

  async start(out: () => { ctx: AudioContext; destination: AudioNode }, deviceId: string, channel: InputChannel = 'mix'): Promise<void> {
    this.stop();
    useLive.setState({ state: 'starting', error: null });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no media devices'), { name: 'NoMediaDevices' });
      // A guitar needs the raw signal: no echo cancellation, noise suppression or automatic gain.
      const audio: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
      if (deviceId) audio.deviceId = { exact: deviceId };
      this.stream = await navigator.mediaDevices.getUserMedia({ audio });
      const { ctx, destination } = out();
      if (ctx.state !== 'running') await ctx.resume();
      this.source = ctx.createMediaStreamSource(this.stream);
      // Everything after this point is mono: the guitar plays in both ears of the monitor.
      this.mono = ctx.createGain();
      this.mono.channelCount = 1;
      this.mono.channelCountMode = 'explicit';
      this.mono.channelInterpretation = 'speakers';
      this.splitter = ctx.createChannelSplitter(2);
      this.source.connect(this.splitter);
      this.route(channel);
      this.gain = ctx.createGain();
      this.gain.gain.value = this.inputGain;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = FRAME;
      this.monitor = ctx.createGain();
      this.monitor.gain.value = 0;
      this.mono.connect(this.gain);
      this.gain.connect(this.analyser);
      this.rig = new GuitarRig(ctx);
      this.rig.onChange = () => useLive.setState((s) => ({ rigRevision: s.rigRevision + 1 }));
      this.rig.setCabFile(this.cabFile);
      this.rig.apply(this.rigSettings);
      this.gain.connect(this.rig.input);
      this.rig.output.connect(this.monitor).connect(destination);
      this.sampleRate = ctx.sampleRate;
      await this.attachWorklet(ctx);
      this.configure(this.settings);
      const devices = (await navigator.mediaDevices.enumerateDevices())
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ id: d.deviceId, label: d.label || `Ingresso ${i + 1}` }));
      const track = this.stream.getAudioTracks()[0];
      track?.addEventListener('ended', () => this.fail(Object.assign(new Error('ended'), { name: 'NotReadableError' })));
      const settings = track?.getSettings();
      const diagnostics: LiveDiagnostics = {
        contextState: ctx.state,
        sampleRate: ctx.sampleRate,
        baseLatency: typeof ctx.baseLatency === 'number' ? ctx.baseLatency : null,
        outputLatency: typeof ctx.outputLatency === 'number' ? ctx.outputLatency : null,
        deviceLabel: track?.label ?? '',
        inputChannels: settings?.channelCount ?? null,
        trackSampleRate: settings?.sampleRate ?? null,
        analysis: this.analysisPath,
      };
      if (ctx.state !== 'running') throw Object.assign(new Error('suspended'), { name: 'AudioSuspended' });
      useLive.setState({ state: 'on', devices, deviceId: settings?.deviceId ?? deviceId, monitorOn: false, diagnostics });
    } catch (error) {
      this.fail(error);
    }
  }

  stop(): void {
    this.stopTimer?.();
    this.stopTimer = null;
    if (this.worklet) this.worklet.port.onmessage = null;
    this.worklet?.disconnect();
    this.sink?.disconnect();
    this.worklet = null;
    this.sink = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    for (const node of [this.source, this.splitter, this.mono, this.gain, this.analyser, this.monitor]) node?.disconnect();
    this.rig?.dispose();
    this.rig = null;
    this.stream = null;
    this.source = this.splitter = this.mono = this.gain = this.analyser = this.monitor = null;
    this.tracker.reset();
    useLive.setState({ state: 'off', level: 0, clipping: false, pitch: null, monitorOn: false });
  }

  /** Pick the channel the guitar is on; 'mix' averages both (a mono device is the same either way). */
  route(channel: InputChannel): void {
    if (!this.splitter || !this.mono || !this.source) return;
    this.splitter.disconnect();
    this.source.disconnect();
    if (channel === 'mix') {
      this.source.connect(this.mono);
    } else {
      this.source.connect(this.splitter);
      this.splitter.connect(this.mono, channel === 'left' ? 0 : 1);
    }
  }

  /** Sensitivity and gates; restarts the analysis clock at the mode's pace. */
  configure(settings: AnalysisSettings): void {
    this.settings = settings;
    const mode = SENSITIVITY[settings.sensitivity];
    this.tracker.configure({ ...mode.tracker, minConfidence: settings.minConfidence ?? mode.tracker.minConfidence });
    this.stopTimer?.();
    this.stopTimer = null;
    const hop = Math.round((mode.hopMs / 1000) * this.sampleRate);
    if (this.worklet) {
      // The worklet sets the pace: one analysis per hop of samples.
      this.worklet.port.postMessage({ hop });
      return;
    }
    if (!this.analyser) return;
    this.stopTimer = workerTimer.start(() => this.analyse(this.sampleRate), mode.hopMs);
  }

  /**
   * Record the dry signal for a few seconds (calibration only). A script
   * processor copies the samples; its output is silent.
   */
  capture(seconds: number): Promise<Capture | null> {
    const gain = this.gain;
    if (!gain) return Promise.resolve(null);
    if (this.worklet) return this.captureFromWorklet(seconds, gain.context as AudioContext);
    const ctx = gain.context as AudioContext;
    const total = Math.round(seconds * ctx.sampleRate);
    const samples = new Float32Array(total);
    const recorder = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    gain.connect(recorder);
    recorder.connect(mute).connect(ctx.destination);
    this.capturing = { levels: [], readings: [] };
    let written = 0;
    let startTime = -1;
    return new Promise((resolve) => {
      recorder.onaudioprocess = (event) => {
        if (startTime < 0) startTime = event.playbackTime;
        const input = event.inputBuffer.getChannelData(0);
        const n = Math.min(input.length, total - written);
        samples.set(input.subarray(0, n), written);
        written += n;
        if (written >= total) {
          recorder.onaudioprocess = null;
          gain.disconnect(recorder);
          recorder.disconnect();
          mute.disconnect();
          const taken = this.capturing ?? { levels: [], readings: [] };
          this.capturing = null;
          resolve({ samples, sampleRate: ctx.sampleRate, startTime, levels: taken.levels, readings: taken.readings });
        }
      };
    });
  }

  /** With the worklet the samples already arrive: keep them for a few seconds. */
  private captureFromWorklet(seconds: number, ctx: AudioContext): Promise<Capture> {
    const total = Math.round(seconds * ctx.sampleRate);
    this.capturing = { levels: [], readings: [] };
    return new Promise((resolve) => {
      this.recorder = { samples: new Float32Array(total), written: 0, startTime: -1, done: (startTime, samples) => {
        const taken = this.capturing ?? { levels: [], readings: [] };
        this.capturing = null;
        this.recorder = null;
        resolve({ samples, sampleRate: ctx.sampleRate, startTime, levels: taken.levels, readings: taken.readings });
      } };
    });
  }

  /** Short clicks at known times on the audio clock, for the latency step; returns their times. */
  playClicks(count: number, interval: number, out: AudioNode): readonly number[] {
    const ctx = out.context;
    const first = ctx.currentTime + 0.5;
    const times = Array.from({ length: count }, (_, i) => first + i * interval);
    for (const t of times) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.frequency.value = 1500;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.5, t + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      osc.connect(env).connect(out);
      osc.start(t);
      osc.stop(t + 0.05);
    }
    return times;
  }

  setGain(value: number): void {
    this.inputGain = value;
    this.gain?.gain.setTargetAtTime(value, this.gain.context.currentTime, 0.02);
  }

  /** Rig settings from the store; applied at once when the input runs, and on the next start. */
  setRig(settings: RigSettings): void {
    this.rigSettings = settings;
    this.rig?.apply(settings);
  }

  /** A cabinet impulse response chosen by the user (kept for this visit only). */
  async loadCabinet(file: Blob, ctx: BaseAudioContext): Promise<void> {
    this.cabFile = await decodeImpulse(file, ctx);
    this.rig?.setCabFile(this.cabFile);
  }

  /** What the rig is doing now, for the device's status line and the tests; null while the input is off. */
  rigState(): RigState | null {
    return this.rig?.describe() ?? null;
  }

  /** Monitoring only on request; the level is the monitor fader. */
  setMonitor(on: boolean, level = this.monitorLevel): void {
    this.monitorLevel = level;
    if (this.monitor) this.monitor.gain.setTargetAtTime(on ? level : 0, this.monitor.context.currentTime, 0.02);
    useLive.setState({ monitorOn: on && this.monitor !== null });
  }

  private fail(error: unknown): void {
    this.stop();
    useLive.setState({ state: 'error', error: inputErrorMessage(error) });
  }

  /** Prefer the worklet; without it (old browsers) the analyser and a timer do the job. */
  private async attachWorklet(ctx: AudioContext): Promise<void> {
    if (!this.gain || typeof AudioWorkletNode === 'undefined' || !ctx.audioWorklet) return;
    try {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(ctx, 'gtl-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
      // A silent path to the output keeps the node running in every browser.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      this.gain.connect(node);
      node.connect(sink).connect(ctx.destination);
      node.port.onmessage = (event: MessageEvent<Float32Array>) => this.receive(event.data);
      this.worklet = node;
      this.sink = sink;
    } catch {
      this.worklet = null;
    }
  }

  /** A hop of fresh samples: slide the ring and analyse the newest frame. */
  private receive(chunk: Float32Array): void {
    const r = this.recorder;
    if (r) {
      // The chunk just arrived ended about now: its first sample was chunk.length samples ago.
      if (r.startTime < 0 && this.gain) r.startTime = this.gain.context.currentTime - chunk.length / this.sampleRate;
      const n = Math.min(chunk.length, r.samples.length - r.written);
      r.samples.set(chunk.subarray(0, n), r.written);
      r.written += n;
      if (r.written >= r.samples.length) r.done(r.startTime, r.samples);
    }
    const n = Math.min(chunk.length, FRAME);
    this.ring.copyWithin(0, n);
    this.ring.set(chunk.subarray(chunk.length - n), FRAME - n);
    this.analyseFrame(this.ring, this.sampleRate);
  }

  get analysisPath(): 'worklet' | 'analyser' {
    return this.worklet ? 'worklet' : 'analyser';
  }

  private analyse(sampleRate: number): void {
    if (!this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.buffer);
    this.analyseFrame(this.buffer, sampleRate);
  }

  private analyseFrame(buffer: Float32Array, sampleRate: number): void {
    const mode = SENSITIVITY[this.settings.sensitivity];
    const frame = buffer.subarray(FRAME - mode.frame);
    let peak = 0;
    for (let i = 0; i < frame.length; i += 1) peak = Math.max(peak, Math.abs(frame[i] ?? 0));
    const now = performance.now();
    if (peak >= 0.98) this.clipUntil = now + 800;
    const reading = detectPitch(frame, sampleRate, { threshold: mode.yinThreshold, minRms: this.settings.minRms });
    const pitch = this.tracker.push(reading);
    const level = reading?.rms ?? Math.sqrt(frame.reduce((sum, v) => sum + v * v, 0) / frame.length);
    if (this.capturing) {
      this.capturing.levels.push(level);
      if (reading) this.capturing.readings.push({ rms: reading.rms, confidence: reading.confidence });
    }
    useLive.setState({ level, clipping: now < this.clipUntil, pitch });
  }
}

export const liveInput = new LiveInput();
