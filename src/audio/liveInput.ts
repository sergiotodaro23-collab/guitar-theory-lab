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
}

export const useLive = create<LiveSnapshot>(() => ({
  state: 'off', error: null, devices: [], deviceId: '', level: 0, clipping: false, pitch: null, monitorOn: false, diagnostics: null,
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
  private monitor: GainNode | null = null;
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
      this.gain.connect(this.monitor).connect(destination);
      this.sampleRate = ctx.sampleRate;
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
    this.stream?.getTracks().forEach((t) => t.stop());
    for (const node of [this.source, this.splitter, this.mono, this.gain, this.analyser, this.monitor]) node?.disconnect();
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
    if (!this.analyser) return;
    this.stopTimer?.();
    this.stopTimer = workerTimer.start(() => this.analyse(this.sampleRate), mode.hopMs);
  }

  /**
   * Record the dry signal for a few seconds (calibration only). A script
   * processor copies the samples; its output is silent.
   */
  capture(seconds: number): Promise<Capture | null> {
    const gain = this.gain;
    if (!gain) return Promise.resolve(null);
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

  private analyse(sampleRate: number): void {
    if (!this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.buffer);
    let peak = 0;
    for (let i = 0; i < this.buffer.length; i += 1) peak = Math.max(peak, Math.abs(this.buffer[i] ?? 0));
    const now = performance.now();
    if (peak >= 0.98) this.clipUntil = now + 800;
    const mode = SENSITIVITY[this.settings.sensitivity];
    const frame = this.buffer.subarray(FRAME - mode.frame);
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
