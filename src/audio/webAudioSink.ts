/**
 * Audio output of the timeline. It receives absolute AudioContext times and
 * never decides when something plays. Synthesised on purpose: no samples to ship.
 */
import { midiToHz } from '../theory';
import type { AccentLevel, ScheduledTrackEvent } from '../timeline';
import { clickRecipe, type ClickSound } from './clickSounds';

export type AudioBus = 'click' | 'notes' | 'comp';

interface Voice {
  readonly start: number;
  readonly end: number;
  readonly gain: GainNode;
  readonly sources: readonly OscillatorNode[];
}

/** The engine's timeline sink forwards here, after deciding each click's accent. */
export class WebAudioSink {
  private readonly master: GainNode;
  private readonly buses: Record<AudioBus, GainNode>;
  private voices: Voice[] = [];
  readonly analyser: AnalyserNode;

  constructor(private readonly ctx: AudioContext, private readonly secondsPerTick: () => number) {
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    const limiter = ctx.createDynamicsCompressor();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(limiter).connect(this.analyser).connect(ctx.destination);
    const bus = (): GainNode => {
      const gain = ctx.createGain();
      gain.connect(this.master);
      return gain;
    };
    this.buses = { click: bus(), notes: bus(), comp: bus() };
  }

  setVolume(bus: AudioBus, value: number): void {
    this.buses[bus].gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
  }

  /** One click of the metronome at its accent level, in the chosen timbre. */
  click(sound: ClickSound, level: AccentLevel, time: number): void {
    const recipe = clickRecipe(sound, level);
    if (recipe) this.voice('click', time, recipe.duration, recipe.level, recipe.attack, recipe.oscillators, recipe.decaying);
  }

  trackEvent(event: ScheduledTrackEvent, time: number): void {
    const { payload } = event;
    if (payload.type === 'note') {
      this.pluck(payload.midi, time);
    } else if (payload.type === 'comp') {
      const duration = payload.durationTicks * this.secondsPerTick();
      payload.midis.forEach((midi, i) => {
        const level = (i === 0 ? 0.3 : 0.17) * payload.velocity;
        const frequency = midiToHz(midi);
        this.voice('comp', time, duration, level, 0.008, [
          { type: 'triangle', frequency },
          { type: 'sawtooth', frequency: frequency * 1.002, mix: 0.12 },
        ]);
      });
    }
  }

  pluck(midi: number, time: number): void {
    const frequency = midiToHz(midi);
    this.voice('notes', time, 0.5, 0.42, 0.003, [
      { type: 'triangle', frequency },
      { type: 'sine', frequency: frequency * 2, mix: 0.25 },
    ], true);
  }

  cancelAfter(time: number): void {
    for (const voice of this.voices) {
      if (voice.start >= time) {
        voice.sources.forEach((source) => {
          source.onended = null;
          source.stop();
          source.disconnect();
        });
        voice.gain.disconnect();
      } else if (voice.end > time) {
        // Already sounding: a short fade avoids a click.
        voice.gain.gain.cancelScheduledValues(time);
        voice.gain.gain.setTargetAtTime(0, time, 0.012);
      }
    }
    this.voices = this.voices.filter((voice) => voice.start < time && voice.end > time);
  }

  private voice(
    bus: AudioBus,
    start: number,
    duration: number,
    level: number,
    attack: number,
    oscillators: readonly { type: OscillatorType; frequency: number; mix?: number }[],
    decaying = false,
  ): void {
    const release = decaying ? 0.02 : 0.03;
    const end = start + duration + release;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + attack);
    if (decaying) {
      gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);
    } else {
      gain.gain.setValueAtTime(level, start + Math.max(attack, duration));
    }
    gain.gain.linearRampToValueAtTime(0, end);
    gain.connect(this.buses[bus]);

    const sources = oscillators.map(({ type, frequency, mix }) => {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      if (mix !== undefined) {
        const trim = this.ctx.createGain();
        trim.gain.value = mix;
        osc.connect(trim).connect(gain);
      } else {
        osc.connect(gain);
      }
      osc.start(start);
      osc.stop(end);
      return osc;
    });
    const voice: Voice = { start, end, gain, sources };
    this.voices.push(voice);
    (sources[0] as OscillatorNode).onended = () => {
      gain.disconnect();
      this.voices = this.voices.filter((v) => v !== voice);
    };
  }
}

const WORKER_SOURCE = `
let id = null;
onmessage = (e) => {
  if (id !== null) clearInterval(id);
  id = e.data > 0 ? setInterval(() => postMessage(0), e.data) : null;
};`;

/**
 * Browsers slow setInterval in background tabs to one tick a second, longer than
 * the look-ahead. A worker timer keeps the metronome steady when the tab is hidden.
 */
export const workerTimer = {
  start(callback: () => void, intervalMs: number): () => void {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return intervalTimer(callback, intervalMs);
    try {
      const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
      const worker = new Worker(url);
      URL.revokeObjectURL(url);
      let fallback: (() => void) | null = null;
      worker.onmessage = () => callback();
      // A page policy can refuse the worker after construction.
      worker.onerror = () => {
        fallback ??= intervalTimer(callback, intervalMs);
      };
      worker.postMessage(Math.max(1, intervalMs));
      return () => {
        worker.terminate();
        fallback?.();
      };
    } catch {
      return intervalTimer(callback, intervalMs);
    }
  },
};

function intervalTimer(callback: () => void, intervalMs: number): () => void {
  const id = setInterval(callback, intervalMs);
  return () => clearInterval(id);
}
