/**
 * Audio output of the timeline. It receives absolute AudioContext times and
 * never decides when something plays. The jam's acoustic kit, electric bass,
 * double bass and piano play recorded samples (J1, D-60) once loaded; every
 * other sound, and these until their zones are decoded, is synthesised (D-32).
 */
import { midiToHz } from '../theory';
import type { AccentLevel, ScheduledTrackEvent, TrackPayload } from '../timeline';
import { SampleLibrary } from './sampler';
import {
  SLIDE_SECONDS, bassArticulation, drumVoiceFor, slideRate, pickDrum, pickPitched, zonesForDrum, zonesForPitched,
  type DrumZone, type PitchedZone, type RoundRobin, type SampleSetId,
} from './samplerMap';
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

  readonly samples: SampleLibrary;
  private readonly roundRobin: RoundRobin = new Map();
  /** The jam's notes, so a change of sound loads what the new one needs. */
  private prepared: readonly TrackPayload[] = [];
  /** Open hi-hats still ringing: the next closed or pedal hat chokes them, as a drummer's foot does. */
  private openHats: Voice[] = [];
  private readonly faded = new WeakSet<Voice>();
  /** Recorded notes played per channel since the start: what the tests read to tell samples from synthesis. */
  readonly sampledCount: Record<AudioBus, number> = { click: 0, notes: 0, comp: 0, bass: 0, drums: 0 };

  constructor(private readonly ctx: AudioContext, private readonly secondsPerTick: () => number, samplesBase = 'samples/') {
    this.samples = new SampleLibrary(ctx, samplesBase);
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
    const changed = timbres.drums !== this.timbres.drums || timbres.bass !== this.timbres.bass || timbres.comp !== this.timbres.comp;
    this.timbres = timbres;
    if (changed) void this.loadPrepared();
  }

  /** The sampled set each channel plays with the current sounds, or null for a synthesised one. */
  sampleSets(): { drums: SampleSetId | null; bass: SampleSetId | null; comp: SampleSetId | null } {
    const { drums, bass, comp } = this.timbres;
    return {
      drums: drums === 'acoustic' ? 'drums' : null,
      bass: bass === 'finger' || bass === 'pick' ? 'ebass' : bass === 'upright' ? 'upright' : null,
      comp: comp === 'keys' ? 'piano' : null,
    };
  }

  /** Load ahead the zones these notes will use; resolves when they are decoded (or failed). */
  prepare(payloads: readonly TrackPayload[]): Promise<void> {
    this.prepared = payloads;
    return this.loadPrepared();
  }

  private async loadPrepared(): Promise<void> {
    const payloads = this.prepared;
    const sets = this.sampleSets();
    const jobs: Promise<void>[] = [];
    const need = async (id: SampleSetId, files: (manifestZones: readonly (DrumZone | PitchedZone)[]) => Iterable<string>) => {
      const manifest = await this.samples.manifest(id);
      if (manifest) await this.samples.require(id, [...new Set(files(manifest.zones))]);
    };
    const seconds = this.secondsPerTick();
    if (sets.drums) {
      jobs.push(need(sets.drums, function* (zones) {
        for (const p of payloads) {
          if (p.type !== 'drum') continue;
          const voice = drumVoiceFor(p.voice, p.velocity);
          if (voice) for (const z of zonesForDrum(zones as DrumZone[], voice, p.velocity)) yield z.file;
        }
      }));
    }
    const bassSet = sets.bass;
    if (bassSet) {
      jobs.push(need(bassSet, function* (zones) {
        for (const p of payloads) {
          if (p.type !== 'bass') continue;
          for (const z of zonesForPitched(zones as PitchedZone[], bassArticulation(bassSet, p.durationTicks * seconds, p.articulation), p.midi, p.velocity)) yield z.file;
        }
      }));
    }
    if (sets.comp) {
      jobs.push(need(sets.comp, function* (zones) {
        for (const p of payloads) {
          if (p.type !== 'comp') continue;
          for (const [i, midi] of p.midis.entries()) for (const z of zonesForPitched(zones as PitchedZone[], 'sustain', midi, compVelocity(p.velocity, i))) yield z.file;
        }
      }));
    }
    await Promise.all(jobs);
  }

  trackEvent(event: ScheduledTrackEvent, time: number): void {
    const { payload } = event;
    if (payload.type === 'drum') {
      this.drum(payload.voice, payload.velocity, time);
    } else if (payload.type === 'bass') {
      this.bassNote(payload.midi, payload.durationTicks * this.secondsPerTick(), payload.velocity, time, payload.articulation, payload.slideFrom);
    } else if (payload.type === 'note') {
      this.pluck(payload.midi, time, payload.accent ? 0.62 : 0.42);
    } else if (payload.type === 'comp') {
      const duration = payload.durationTicks * this.secondsPerTick();
      if (this.sampledChord(payload.midis, duration, payload.velocity, time)) return;
      const recipe = COMP_RECIPES[this.timbres.comp];
      const offsets = strumOffsets(payload.midis.length, recipe);
      payload.midis.forEach((midi, i) => {
        const level = (i === 0 ? 0.3 : 0.17) * payload.velocity * recipe.gain;
        this.tone('comp', recipe, midiToHz(midi), time + (offsets[i] ?? 0), Math.max(0.03, duration - (offsets[i] ?? 0)), level);
      });
    }
  }

  /** Piano chord from the samples: every note or none, so a chord never mixes sampled and synthesised notes. */
  private sampledChord(midis: readonly number[], duration: number, velocity: number, time: number): boolean {
    const id = this.sampleSets().comp;
    const manifest = id ? this.samples.manifestNow(id) : undefined;
    if (!id || !manifest) return false;
    const zones = manifest.zones as PitchedZone[];
    const notes = midis.map((midi, i) => {
      const note = pickPitched(zones, 'sustain', midi, compVelocity(velocity, i), this.roundRobin, manifest.normalized);
      const buffer = note && this.samples.buffer(id, note.zone.file);
      return note && buffer ? { note, buffer } : null;
    });
    if (notes.some((n) => !n)) {
      void this.samples.require(id, midis.flatMap((midi, i) => zonesForPitched(zones, 'sustain', midi, compVelocity(velocity, i)).map((z) => z.file)));
      return false;
    }
    // Four or five piano notes add up: each sits about 10 dB under a solo note. Dampers fall in 0.3 s.
    for (const n of notes) if (n) this.sample('comp', n.buffer, time, n.note.rate, n.note.gain * SAMPLE_TRIM.piano, duration, 0.3);
    return true;
  }

  /** One hit of the jam drum kit: a recorded hit, or a gliding tone and/or a filtered noise burst. */
  drum(voice: string, velocity: number, time: number): void {
    if (velocity > 0 && this.sampledDrum(voice, velocity, time)) return;
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
    // The same hi-hat choke as the recorded kit: a closed hat or the pedal cuts the open one.
    if (voice === 'hat' || voice === 'pedal') this.chokeHats(time);
    if (voice === 'open') this.openHats.push(voiceEntry);
    const last = sources[0];
    if (last) {
      last.onended = () => {
        out.disconnect();
        this.voices = this.voices.filter((v) => v !== voiceEntry);
      };
    }
  }

  private sampledDrum(voice: string, velocity: number, time: number): boolean {
    const id = this.sampleSets().drums;
    const manifest = id ? this.samples.manifestNow(id) : undefined;
    const recorded = drumVoiceFor(voice, velocity);
    if (!id || !manifest || !recorded) return false;
    const zones = manifest.zones as DrumZone[];
    const hit = pickDrum(zones, recorded, velocity, this.roundRobin);
    const buffer = hit && this.samples.buffer(id, hit.zone.file);
    if (!hit || !buffer) {
      void this.samples.require(id, zonesForDrum(zones, recorded, velocity).map((z) => z.file));
      return false;
    }
    if (recorded === 'hhClosed' || recorded === 'hhPedal' || recorded === 'hhHalf') this.chokeHats(time);
    const played = this.sample('drums', buffer, time, 1, hit.gain * SAMPLE_TRIM.drums, null, 0);
    if (recorded === 'hhOpen') this.openHats.push(played);
    return true;
  }

  /** Past MAX_VOICES sounding at `time`, the oldest fade out in 20 ms: long cymbal and piano tails never pile up. */
  private limitVoices(time: number): void {
    const sounding = this.voices.filter((v) => v.start <= time && v.end > time && !this.faded.has(v));
    for (const voice of sounding.slice(0, Math.max(0, sounding.length - MAX_VOICES + 1))) {
      this.faded.add(voice);
      voice.gain.gain.cancelScheduledValues(time);
      voice.gain.gain.setTargetAtTime(0, time, 0.02);
    }
  }

  private chokeHats(time: number): void {
    for (const hat of this.openHats) {
      if (hat.start < time && hat.end > time) {
        hat.gain.gain.cancelScheduledValues(time);
        hat.gain.gain.setTargetAtTime(0, time, 0.02);
      }
    }
    this.openHats = this.openHats.filter((h) => h.end > time && h.start >= time);
  }

  /** A bass note in the chosen timbre. */
  bassNote(midi: number, duration: number, velocity: number, time: number, articulation?: 'ghost' | 'staccato' | 'slide', slideFrom?: number): void {
    const glide = articulation === 'slide' && slideFrom !== undefined ? { from: slideFrom, seconds: Math.min(SLIDE_SECONDS, duration * 0.4) } : null;
    if (this.sampledBass(midi, duration, velocity, time, articulation, glide)) return;
    const recipe = BASS_RECIPES[this.timbres.bass];
    // A synthesised ghost is a muffled thud: the low-pass closes at once.
    const played = articulation === 'ghost' ? { ...recipe, filter: { ...recipe.filter, from: Math.min(recipe.filter.from, 500), to: 150, time: 0.03 } } : recipe;
    this.tone('bass', played, midiToHz(midi), time, duration, 0.55 * velocity * recipe.gain, glide && { ratio: 2 ** ((glide.from - midi) / 12), seconds: glide.seconds });
  }

  private sampledBass(midi: number, duration: number, velocity: number, time: number, played?: 'ghost' | 'staccato' | 'slide', glide: { from: number; seconds: number } | null = null): boolean {
    const id = this.sampleSets().bass;
    const manifest = id ? this.samples.manifestNow(id) : undefined;
    if (!id || !manifest) return false;
    const zones = manifest.zones as PitchedZone[];
    const articulation = bassArticulation(id, duration, played);
    const note = pickPitched(zones, articulation, midi, velocity, this.roundRobin, manifest.normalized);
    const buffer = note && this.samples.buffer(id, note.zone.file);
    if (!note || !buffer) {
      void this.samples.require(id, zonesForPitched(zones, articulation, midi, velocity).map((z) => z.file));
      return false;
    }
    // With a pick the same strings sound brighter: a presence lift, no other change.
    const bright = this.timbres.bass === 'pick';
    const voice = this.sample('bass', buffer, time, note.rate, note.gain * SAMPLE_TRIM.bass, duration, played === 'ghost' ? 0.03 : 0.07, bright);
    if (glide) {
      const source = voice.sources[0] as AudioBufferSourceNode | undefined;
      source?.playbackRate.setValueAtTime(slideRate(note.rate, midi, glide.from), time);
      source?.playbackRate.exponentialRampToValueAtTime(note.rate, time + glide.seconds);
    }
    return true;
  }

  /**
   * A recorded zone: played from its start at `rate`, held for `hold` seconds
   * (null: to its natural end) and released over `release`.
   */
  private sample(bus: AudioBus, buffer: AudioBuffer, time: number, rate: number, peak: number, hold: number | null, release: number, bright = false): Voice {
    this.limitVoices(time);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(peak, time);
    let end = time + buffer.duration / rate;
    if (hold !== null && time + hold + release < end) {
      out.gain.setValueAtTime(peak, time + hold);
      out.gain.setTargetAtTime(0, time + hold, release / 4);
      end = time + hold + release;
    }
    if (bright) {
      const presence = this.ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 2200;
      presence.Q.value = 0.8;
      presence.gain.value = 6;
      source.connect(presence).connect(out);
    } else {
      source.connect(out);
    }
    out.connect(this.buses[bus]);
    this.sampledCount[bus] += 1;
    source.start(time);
    source.stop(end + 0.01);
    const voiceEntry: Voice = { start: time, end, gain: out, sources: [source] };
    this.voices.push(voiceEntry);
    source.onended = () => {
      out.disconnect();
      this.voices = this.voices.filter((v) => v !== voiceEntry);
    };
    return voiceEntry;
  }

  /**
   * One note from a recipe: partials into a low-pass that closes, an envelope
   * with attack, decay to a sustain level, and release.
   */
  private tone(bus: AudioBus, recipe: ToneRecipe, frequency: number, time: number, duration: number, peak: number, glide: { ratio: number; seconds: number } | null = null): void {
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
      if (glide) {
        osc.frequency.setValueAtTime(frequency * partial.ratio * glide.ratio, time);
        osc.frequency.exponentialRampToValueAtTime(frequency * partial.ratio, time + glide.seconds);
      }
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

  pluck(midi: number, time: number, level = 0.42): void {
    const frequency = midiToHz(midi);
    this.voice('notes', time, 0.5, level, 0.003, [
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

/**
 * Level of the recorded sets against the synthesised ones they replace, so the
 * mixer balance does not jump when the samples arrive. Measured on the bus
 * meters: within 3 dB RMS of the synthesised sound, a little under it,
 * because a recording has more dynamics (peaks) for the same loudness.
 */
const SAMPLE_TRIM = { drums: 1.2, bass: 1.4, piano: 1 } as const;

/** Polyphony of the whole output; a jam at 240 bpm with sixteenth hats and piano tails stays well under it. */
const MAX_VOICES = 64;

/** In a chord the lowest note leads a little, as a pianist's left hand does. */
const compVelocity = (velocity: number, index: number): number => velocity * (index === 0 ? 1 : 0.85);

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
