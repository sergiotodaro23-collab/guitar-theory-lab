/**
 * Connects settings to the timeline and the timeline to audio and screen.
 * Nothing else owns a clock: the UI reads positions derived from AudioContext time.
 */
import { WebAudioSink, workerTimer } from '../audio/webAudioSink';
import {
  PPQ, TimelineScheduler, barBeatAt, trackEventAt, type ChordChangePayload, type MetronomeEvent,
  type NotePayload, type ScheduledTrackEvent, type TimeConfig, type TimelineSink,
} from '../timeline';
import { manualCompDuration, manualCompMidis, buildTracks, type ModeTracks } from './tracks';
import { BPM_MAX, BPM_MIN, meterOf, type Settings } from './settings';
import { useApp, usePlayhead, type Playhead } from './store';

export interface DebugLog {
  scheduled: { kind: string; tick: number; time: number; chord?: number; note?: number }[];
  shown: { kind: 'beat' | 'note' | 'chord'; tick: number; value: number; time: number; scheduled: number }[];
}

const configOf = (s: Settings): TimeConfig => ({ meter: meterOf(s), subdivision: s.subdivision, swing: s.swing });
const sig = (value: unknown) => JSON.stringify(value);

class Engine {
  private ctx: AudioContext | null = null;
  private audio: WebAudioSink | null = null;
  private readonly scheduler: TimelineScheduler;
  private frame = 0;
  private trackSigs: Record<string, string> = {};
  private manualChanges: { tick: number; chordIndex: number }[] = [];
  readonly debug: DebugLog | null;

  constructor() {
    const settings = useApp.getState().settings;
    this.debug = typeof location !== 'undefined' && location.search.includes('debug') ? { scheduled: [], shown: [] } : null;
    const sink: TimelineSink = {
      metronome: (event: MetronomeEvent, time: number) => {
        this.audio?.metronome(event, time);
        this.debug?.scheduled.push({ kind: event.kind, tick: event.tick, time });
      },
      trackEvent: (event: ScheduledTrackEvent, time: number) => {
        this.audio?.trackEvent(event, time);
        if (this.debug) {
          const { payload } = event;
          this.debug.scheduled.push({
            kind: payload.type,
            tick: event.tick,
            time,
            ...(payload.type === 'chord' ? { chord: payload.chordIndex } : {}),
            ...(payload.type === 'note' ? { note: payload.index } : {}),
          });
        }
      },
      cancelAfter: (time: number) => this.audio?.cancelAfter(time),
    };
    this.scheduler = new TimelineScheduler(
      { now: () => this.ctx?.currentTime ?? 0 },
      workerTimer,
      sink,
      configOf(settings),
      settings.bpm,
    );
    this.syncTracks(settings);
    useApp.subscribe((state, previous) => {
      if (state.settings !== previous.settings) this.onSettings(state.settings, previous.settings);
    });
  }

  private ensureAudio(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      const secondsPerTick = () => {
        const { meter } = this.scheduler.timeConfig;
        return 60 / this.scheduler.bpm / ((PPQ * 4) / meter.beatUnit);
      };
      this.audio = new WebAudioSink(this.ctx, secondsPerTick);
      this.applyVolumes(useApp.getState().settings);
    }
    return this.ctx;
  }

  private applyVolumes(s: Settings): void {
    this.audio?.setVolume('click', s.volClick);
    this.audio?.setVolume('notes', s.volNotes);
    this.audio?.setVolume('comp', s.volComp);
  }

  private syncTracks(s: Settings): void {
    const tracks: ModeTracks = buildTracks(s);
    const apply = (id: 'exercise' | 'chords' | 'comp', atBar: boolean) => {
      const spec = tracks[id];
      const signature = spec ? sig([spec.lengthTicks, spec.loop, spec.events]) : '';
      if (this.trackSigs[id] === signature) return;
      this.trackSigs[id] = signature;
      if (!spec) this.scheduler.removeTrack(id);
      else if (atBar) this.scheduler.swapTrackAtNextBar(spec);
      else this.scheduler.replaceTrack(spec);
    };
    apply('exercise', true);
    apply('chords', false);
    apply('comp', false);
    this.scheduler.setEnd(tracks.endTick, tracks.endTick === null ? null : () => this.stop());
  }

  private onSettings(s: Settings, previous: Settings): void {
    if (s.meterId !== previous.meterId) {
      this.scheduler.setMeter(meterOf(s));
      this.manualChanges = [];
      this.afterTransport();
    }
    if (s.bpm !== previous.bpm) this.scheduler.setBpm(s.bpm);
    if (s.subdivision !== previous.subdivision) this.scheduler.setSubdivision(s.subdivision);
    if (s.swing !== previous.swing) this.scheduler.setSwing(s.swing);
    if (s.volClick !== previous.volClick || s.volNotes !== previous.volNotes || s.volComp !== previous.volComp) this.applyVolumes(s);
    this.syncTracks(s);
    if (s.mode !== previous.mode || s.changeMode !== previous.changeMode) this.manualChanges = [];
    if (this.scheduler.transportState !== 'playing') this.publish();
  }

  async play(): Promise<void> {
    const ctx = this.ensureAudio();
    if (ctx.state !== 'running') await ctx.resume();
    if (this.scheduler.transportState === 'stopped') {
      const { settings, selectedChord } = useApp.getState();
      if (settings.mode === 'harmony' && settings.changeMode === 'manual') {
        this.manualChanges = [{ tick: 0, chordIndex: selectedChord }];
        this.queueManualComp(settings, selectedChord, 0);
      }
    }
    this.scheduler.play();
    this.afterTransport();
  }

  pause(): void {
    this.scheduler.pause();
    this.afterTransport();
  }

  stop(): void {
    this.scheduler.stop();
    this.manualChanges = [];
    this.afterTransport();
  }

  toggle(): void {
    if (this.scheduler.transportState === 'playing') this.pause();
    else void this.play();
  }

  private queueManualComp(s: Settings, chordIndex: number, tick: number): void {
    if (!s.compOn) return;
    const midis = manualCompMidis(s, chordIndex);
    if (midis.length === 0) return;
    this.scheduler.scheduleOneShot('comp', tick, { type: 'comp', midis, durationTicks: manualCompDuration(s), velocity: 0.75 });
  }

  /** Move the harmony by hand. During playback it lands on the next beat or bar line. */
  changeChord(delta: number): void {
    const { settings, selectedChord } = useApp.getState();
    const count = settings.progression.chords.length;
    if (count === 0) return;
    const current = this.scheduler.transportState === 'stopped' ? selectedChord : this.chordIndexAt(this.scheduler.positionNow()) ?? selectedChord;
    this.setChord((current + delta + count) % count);
  }

  setChord(index: number): void {
    const { settings, setSelectedChord } = useApp.getState();
    const state = this.scheduler.transportState;
    setSelectedChord(index);
    const manual = settings.mode === 'harmony' && settings.changeMode === 'manual';
    if (state === 'playing' && manual) {
      const tick = this.scheduler.nextQuantizedTick(settings.quantize);
      this.manualChanges.push({ tick, chordIndex: index });
      this.scheduler.scheduleOneShot('manual', tick, { type: 'chord', chordIndex: index });
      this.queueManualComp(settings, index, tick);
    } else if (state === 'paused' && manual) {
      this.manualChanges.push({ tick: this.scheduler.positionNow(), chordIndex: index });
    }
    if (state !== 'playing') this.publish();
  }

  previewNote(midi: number): void {
    const ctx = this.ensureAudio();
    void ctx.resume();
    this.audio?.pluck(midi, ctx.currentTime + 0.005);
  }

  /** The tick the listener is hearing now, net of output latency. */
  private audibleTick(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const latency = (ctx.outputLatency || ctx.baseLatency || 0);
    return this.scheduler.positionAt(ctx.currentTime - latency);
  }

  private chordIndexAt(tick: number): number | null {
    const { settings, selectedChord } = useApp.getState();
    if (settings.mode === 'fretboard') return null;
    if (settings.progression.chords.length === 0) return null;
    if (this.scheduler.transportState === 'stopped') return selectedChord;
    if (settings.mode === 'harmony' && settings.changeMode === 'manual') {
      let index = selectedChord;
      let found = false;
      for (const change of this.manualChanges) {
        if (change.tick <= tick) {
          index = change.chordIndex;
          found = true;
        }
      }
      return found ? index : (this.manualChanges[0]?.chordIndex ?? selectedChord);
    }
    const track = this.scheduler.trackAt('chords', tick);
    if (!track) return selectedChord;
    const event = trackEventAt(track as typeof track & { events: readonly { tick: number; payload: ChordChangePayload }[] }, tick);
    return event ? event.payload.chordIndex : selectedChord;
  }

  private afterTransport(): void {
    cancelAnimationFrame(this.frame);
    this.publish();
    if (this.scheduler.transportState === 'playing') {
      const loop = () => {
        this.publish();
        this.frame = requestAnimationFrame(loop);
      };
      this.frame = requestAnimationFrame(loop);
    }
  }

  private publish(): void {
    const state = this.scheduler.transportState;
    const tick = state === 'stopped' ? 0 : this.audibleTick();
    const position = barBeatAt(Math.max(tick, 0), this.scheduler.timeConfig);
    const started = state !== 'stopped' && tick > 0;

    let note: Playhead['note'] = null;
    let phase: Playhead['phase'] = null;
    let trail: Playhead['trail'] = [];
    const track = this.scheduler.trackAt('exercise', tick);
    if (started && track) {
      const event = trackEventAt(track as typeof track & { events: readonly { tick: number; payload: NotePayload }[] }, tick);
      // The phase holds through the rests that close it, so the shape stays put.
      phase = event?.payload.phase ?? null;
      if (event && tick < event.tick + event.payload.durationTicks * 4) {
        const p = event.payload;
        note = { string: p.string, fret: p.fret, midi: p.midi, index: p.index };
        const events = track.events as readonly { payload: NotePayload }[];
        trail = [1, 2, 3].flatMap((back) => {
          const previous = events[p.index - back];
          return previous ? [{ string: previous.payload.string, fret: previous.payload.fret }] : [];
        });
      }
    }

    const next: Playhead = {
      state,
      bar: position.bar,
      beat: position.beat,
      subdivision: position.subdivision,
      chordIndex: this.chordIndexAt(tick),
      phase,
      note,
      trail,
    };
    const current = usePlayhead.getState();
    const changed = current.state !== next.state || current.bar !== next.bar || current.beat !== next.beat
      || current.subdivision !== next.subdivision || current.chordIndex !== next.chordIndex || current.phase !== next.phase
      || current.note?.index !== next.note?.index;
    if (!changed) return;
    if (this.debug && this.ctx && state === 'playing') {
      const perBeat = (PPQ * 4) / this.scheduler.timeConfig.meter.beatUnit;
      const time = this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0);
      if (current.beat !== next.beat || current.bar !== next.bar) {
        const beatTick = Math.floor(tick / perBeat) * perBeat;
        this.debug.shown.push({ kind: 'beat', tick: beatTick, value: next.beat, time, scheduled: this.scheduler.timeOf(beatTick) });
      }
      if (next.note && current.note?.index !== next.note.index) {
        const event = track ? trackEventAt(track, tick) : null;
        if (event) this.debug.shown.push({ kind: 'note', tick: event.tick, value: next.note.index, time, scheduled: this.scheduler.timeOf(event.tick) });
      }
      if (current.chordIndex !== next.chordIndex && next.chordIndex !== null) {
        const chords = this.scheduler.trackAt('chords', tick);
        const event = chords ? trackEventAt(chords, tick) : null;
        if (event) this.debug.shown.push({ kind: 'chord', tick: event.tick, value: next.chordIndex, time, scheduled: this.scheduler.timeOf(event.tick) });
      }
    }
    usePlayhead.setState(next);
  }

  /** Root-mean-square level at the output, for checking that sound really comes out. */
  outputLevel(): number {
    const analyser = this.audio?.analyser;
    if (!analyser) return 0;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
  }

  /** The last samples sent to the output, with the audio time of the buffer's end. */
  outputSnapshot(): { samples: number[]; endTime: number; sampleRate: number } | null {
    const analyser = this.audio?.analyser;
    if (!analyser || !this.ctx) return null;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return { samples: Array.from(data), endTime: this.ctx.currentTime, sampleRate: this.ctx.sampleRate };
  }

  get contextState(): string {
    return this.ctx?.state ?? 'none';
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  nudgeBpm(delta: number): void {
    const { settings, update } = useApp.getState();
    update({ bpm: Math.min(BPM_MAX, Math.max(BPM_MIN, settings.bpm + delta)) });
  }
}

export const engine = new Engine();

declare global {
  interface Window {
    __gtl?: { engine: Engine; debug: DebugLog };
  }
}

if (engine.debug) window.__gtl = { engine, debug: engine.debug };
