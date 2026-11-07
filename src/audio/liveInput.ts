/**
 * The guitar input: Guitar Input → Direct Signal → Pitch Analysis, with an
 * optional Monitoring branch. The analysis always reads the dry signal after
 * the input gain. Monitoring starts off every time and is turned on only by
 * the user, to avoid feedback through speakers. Analysis runs on a worker
 * timer at about 25 Hz; it is not a musical clock and schedules no sound.
 */
import { create } from 'zustand';
import { detectPitch, PitchTracker, type TrackedPitch } from '../pitch';
import { workerTimer } from './webAudioSink';

export type LiveState = 'off' | 'starting' | 'on' | 'error';

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
}

export const useLive = create<LiveSnapshot>(() => ({
  state: 'off', error: null, devices: [], deviceId: '', level: 0, clipping: false, pitch: null, monitorOn: false,
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
    default:
      return 'Non riesco ad aprire l’ingresso audio.';
  }
}

const FRAME = 2048;

class LiveInput {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private monitor: GainNode | null = null;
  private stopTimer: (() => void) | null = null;
  private tracker = new PitchTracker();
  private buffer = new Float32Array(FRAME);
  private clipUntil = 0;
  private inputGain = 1;
  private monitorLevel = 0.6;

  async start(out: () => { ctx: AudioContext; destination: AudioNode }, deviceId: string): Promise<void> {
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
      this.gain = ctx.createGain();
      this.gain.gain.value = this.inputGain;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = FRAME;
      this.monitor = ctx.createGain();
      this.monitor.gain.value = 0;
      this.source.connect(this.gain);
      this.gain.connect(this.analyser);
      this.gain.connect(this.monitor).connect(destination);
      const sampleRate = ctx.sampleRate;
      this.stopTimer = workerTimer.start(() => this.analyse(sampleRate), 40);
      const devices = (await navigator.mediaDevices.enumerateDevices())
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ id: d.deviceId, label: d.label || `Ingresso ${i + 1}` }));
      const track = this.stream.getAudioTracks()[0];
      track?.addEventListener('ended', () => this.fail(Object.assign(new Error('ended'), { name: 'NotReadableError' })));
      useLive.setState({ state: 'on', devices, deviceId: track?.getSettings().deviceId ?? deviceId, monitorOn: false });
    } catch (error) {
      this.fail(error);
    }
  }

  stop(): void {
    this.stopTimer?.();
    this.stopTimer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    for (const node of [this.source, this.gain, this.analyser, this.monitor]) node?.disconnect();
    this.stream = null;
    this.source = this.gain = this.analyser = this.monitor = null;
    this.tracker.reset();
    useLive.setState({ state: 'off', level: 0, clipping: false, pitch: null, monitorOn: false });
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
    const reading = detectPitch(this.buffer, sampleRate);
    const pitch = this.tracker.push(reading);
    const level = reading?.rms ?? Math.sqrt(this.buffer.reduce((sum, v) => sum + v * v, 0) / this.buffer.length);
    useLive.setState({ level, clipping: now < this.clipUntil, pitch });
  }
}

export const liveInput = new LiveInput();
