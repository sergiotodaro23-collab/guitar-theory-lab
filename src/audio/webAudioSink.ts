/**
 * Audio output of the timeline. It receives absolute AudioContext times and
 * never decides when something plays. Synthesised on purpose: no samples to ship.
 */
import { midiToHz } from '../theory';
import type { AccentLevel, ScheduledTrackEvent } from '../timeline';
import { clickRecipe, type ClickSound } from './clickSounds';
import { drumRecipe } from './drumSounds';
import { BASS_RECIPES, COMP_RECIPES, kitRecipe, strumOffsets, type BassTimbre, type CompTimbre, type DrumKitSound, type ToneRecipe } from './instruments';

export type AudioBus = 'click' | 'notes' | 'comp' | 'bass' | 'drums';

interface Voice {
  readonly start: number;
  readonly end: number;
  readonly gain: GainNode;
  readonly sources: readonly AudioScheduledSourceNode[];
}

/** The engine's timeline sink forwards here, after deciding each click's accent. */
export class WebAudioSink {
  private readonly master: GainNode;
  private readonly buses: Record<AudioBus, GainNode>;
  private voices: Voice[] = [];
  readonly analyser: AnalyserNode;
  /** One analyser per channel, after its fader: what the mixer's channel meters read. They feed nothing. */
  private readonly taps: Record<AudioBus, AnalyserNode>;
  private readonly tapData = new Float32Array(512);

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
    this.buses = { click: bus(), notes: bus(), comp: bus(), bass: bus(), drums: bus() };
    const tap = (from: GainNode): AnalyserNode => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      from.connect(analyser);
      return analyser;
    };
    this.taps = { click: tap(this.buses.click), notes: tap(this.buses.notes), comp: tap(this.buses.comp), bass: tap(this.buses.bass), drums: tap(this.buses.drums) };
  }

  /** RMS of a channel after its fader and mute, before the master. */
  busLevel(bus: AudioBus): number {
    this.taps[bus].getFloatTimeDomainData(this.tapData);
    let sum = 0;
    for (const v of this.tapData) sum += v * v;
    return Math.sqrt(sum / this.tapData.length);
  }

  /** Where the guitar monitor connects: after the buses, before the limiter. */
  get monitorInput(): AudioNode {
    return this.master;
  }

  setMaster(value: number): void {
    this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
  }

  /** A short A4 beep straight to the master: checks the output path without any channel. */
  testTone(): void {
    const time = this.ctx.currentTime + 0.02;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.value = 440;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.3, time + 0.01);
    env.gain.setValueAtTime(0.3, time + 0.4);
    env.gain.linearRampToValueAtTime(0, time + 0.45);
    osc.connect(env).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  setVolume(bus: AudioBus, value: number): void {
    this.buses[bus].gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
  }

  /** One click of the metronome at its accent level, in the chosen timbre. */
  click(sound: ClickSound, level: AccentLevel, time: number): void {
    const recipe = clickRecipe(sound, level);
    if (recipe) this.voice('click', time, recipe.duration, recipe.level, recipe.attack, recipe.oscillators, recipe.decaying);
  }

  private timbres: { drums: DrumKitSound; bass: BassTimbre; comp: CompTimbre } = { drums: 'acoustic', bass: 'finger', comp: 'keys' };

  /** Kit and instrument sounds for the jam (D-32); they apply from the next note. */
  setTimbres(timbres: { drums: DrumKitSound; bass: BassTimbre; comp: CompTimbre }): void {
    this.timbres = timbres;
  }

  trackEvent(event: ScheduledTrackEvent, time: number): void {
    const { payload } = event;
    if (payload.type === 'drum') {
      this.drum(payload.voice, payload.velocity, time);
    } else if (payload.type === 'bass') {
      this.bassNote(payload.midi, payload.durationTicks * this.secondsPerTick(), payload.velocity, time);
    } else if (payload.type === 'note') {
      this.pluck(payload.midi, time);
    } else if (payload.type === 'comp') {
      const duration = payload.durationTicks * this.secondsPerTick();
      const recipe = COMP_RECIPES[this.timbres.comp];
      const offsets = strumOffsets(payload.midis.length, recipe);
      payload.midis.forEach((midi, i) => {
        const level = (i === 0 ? 0.3 : 0.17) * payload.velocity * recipe.gain;
        this.tone('comp', recipe, midiToHz(midi), time + (offsets[i] ?? 0), Math.max(0.03, duration - (offsets[i] ?? 0)), level);
      });
    }
  }

  /** One hit of the jam drum kit: a gliding tone and/or a filtered noise burst. */
  drum(voice: string, velocity: number, time: number): void {
    const recipe = kitRecipe(voice, this.timbres.drums, drumRecipe);
    if (!recipe || velocity <= 0) return;
    const { tone, noise } = recipe;
    const length = Math.max(tone?.decay ?? 0, noise?.decay ?? 0) + (recipe.bursts.at(-1) ?? 0) + 0.03;
    const end = time + length;
    const out = this.ctx.createGain();
    out.gain.value = velocity * 0.8;
    out.connect(this.buses.drums);
    const sources: AudioScheduledSourceNode[] = [];
    if (tone) {
      const osc = this.ctx.createOscillator();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.from, time);
      osc.frequency.exponentialRampToValueAtTime(tone.to, time + tone.decay * 0.6);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(tone.level, time);
      env.gain.exponentialRampToValueAtTime(0.0008, time + tone.decay);
      osc.connect(env).connect(out);
      osc.start(time);
      osc.stop(end);
      sources.push(osc);
    }
    if (noise) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = noise.filter;
      filter.frequency.value = noise.frequency;
      filter.Q.value = noise.q;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, time);
      for (const at of recipe.bursts) {
        env.gain.setValueAtTime(noise.level, time + at);
        env.gain.exponentialRampToValueAtTime(0.0008, time + at + (at === recipe.bursts.at(-1) ? noise.decay : 0.009));
      }
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffer();
      source.connect(filter).connect(env).connect(out);
      source.start(time);
      source.stop(end);
      sources.push(source);
    }
    const voiceEntry: Voice = { start: time, end, gain: out, sources };
    this.voices.push(voiceEntry);
    const last = sources[0];
    if (last) {
      last.onended = () => {
        out.disconnect();
        this.voices = this.voices.filter((v) => v !== voiceEntry);
      };
    }
  }

  /** A bass note in the chosen timbre. */
  bassNote(midi: number, duration: number, velocity: number, time: number): void {
    const recipe = BASS_RECIPES[this.timbres.bass];
    this.tone('bass', recipe, midiToHz(midi), time, duration, 0.55 * velocity * recipe.gain);
  }

  /**
   * One note from a recipe: partials into a low-pass that closes, an envelope
   * with attack, decay to a sustain level, and release.
   */
  private tone(bus: AudioBus, recipe: ToneRecipe, frequency: number, time: number, duration: number, peak: number): void {
    const end = time + duration + recipe.release;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(peak, time + recipe.attack);
    out.gain.setTargetAtTime(peak * recipe.sustain, time + recipe.attack, recipe.decay / 3);
    out.gain.setValueAtTime(peak * recipe.sustain, time + Math.max(recipe.attack, duration));
    out.gain.linearRampToValueAtTime(0, end);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = recipe.filter.q;
    filter.frequency.setValueAtTime(recipe.filter.from, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, recipe.filter.to), time + recipe.filter.time);
    filter.connect(out).connect(this.buses[bus]);
    const sources = recipe.partials.map((partial) => {
      const osc = this.ctx.createOscillator();
      osc.type = partial.type;
      osc.frequency.value = frequency * partial.ratio;
      if (partial.detune) osc.detune.value = partial.detune;
      const level = this.ctx.createGain();
      level.gain.value = partial.level / recipe.partials.length;
      osc.connect(level).connect(filter);
      osc.start(time);
      osc.stop(end);
      return osc;
    });
    const voiceEntry: Voice = { start: time, end, gain: out, sources };
    this.voices.push(voiceEntry);
    const first = sources[0];
    if (first) {
      first.onended = () => {
        out.disconnect();
        this.voices = this.voices.filter((v) => v !== voiceEntry);
      };
    }
  }

  private noise: AudioBuffer | null = null;

  /** One second of white noise, made once and reused by every hit. */
  private noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 1;
      for (let i = 0; i < data.length; i += 1) {
        // A small deterministic generator: the same noise every session.
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = seed / 2147483648 - 1;
      }
      this.noise = buffer;
    }
    return this.noise;
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
