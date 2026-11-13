/**
 * Connects settings to the timeline and the timeline to audio and screen.
 * Nothing else owns a clock: the UI reads positions derived from AudioContext time.
 */
import { WebAudioSink, workerTimer } from '../audio/webAudioSink';
import { liveInput } from '../audio/liveInput';
import {
  PPQ, TimelineScheduler, accentLevel, barBeatAt, ticksPerBar, segmentAt, trackEventAt, type ChordChangePayload, type MetronomeEvent,
  type NotePayload, type ScheduledTrackEvent, type TimeConfig, type TimelineSink,
} from '../timeline';
import { manualCompDuration, manualCompMidis, buildTracks, type ModeTracks } from './tracks';
import { fileOffsetAt, loopRegion, progressionLength, sectionSpans, stepAt } from '../jam';
import { backingTrack } from '../audio/backingTrack';
import { BPM_MAX, BPM_MIN, MIX_CHANNELS, backingTrackVolume, channelVolume, meterOf, type Settings } from './settings';
import { useApp, usePlayhead, type Playhead } from './store';

export interface DebugLog {
  scheduled: { kind: string; tick: number; time: number; chord?: number; note?: number; step?: number; level?: number; voice?: string; midi?: number }[];
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
        // Read at scheduling time: a changed pattern is heard within the lookahead.
        const { clickAccents, clickSound, subdivision } = useApp.getState().settings;
        const level = accentLevel(clickAccents, event, subdivision);
        this.audio?.click(clickSound, level, time);
        this.debug?.scheduled.push({ kind: event.kind, tick: event.tick, time, step: event.step, level });
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
            ...(payload.type === 'note' ? { note: payload.index, midi: payload.midi } : {}),
            ...(payload.type === 'drum' ? { voice: payload.voice } : {}),
            ...(payload.type === 'bass' ? { midi: payload.midi } : {}),
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
    liveInput.setRig(settings.rig);
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
    for (const channel of MIX_CHANNELS) this.audio?.setVolume(channel, channelVolume(s, channel));
    this.audio?.setMaster(s.volMaster);
    this.audio?.setTimbres({ drums: s.drumSound, bass: s.bassTimbre, comp: s.compTimbre });
  }

  /** Which drum step is sounding: the sixteenth of the drum track's bar, wrapped to the 16-step grid. */
  private drumPositionAt(tick: number, started: boolean): { drumStep: number | null; drumFill: boolean } {
    const track = started ? this.scheduler.trackAt('drums', tick) : undefined;
    if (!track || tick < track.originTick || track.lengthTicks <= 0) return { drumStep: null, drumFill: false };
    const local = (tick - track.originTick) % track.lengthTicks;
    const bar = ticksPerBar(segmentAt(this.scheduler.timeConfig, tick).meter);
    const s = useApp.getState().settings;
    const fill = s.drumFillEvery > 0 && Math.floor(local / bar) === Math.round(track.lengthTicks / bar) - 1;
    return { drumStep: stepAt(Math.floor((local % bar) / (PPQ / 4))), drumFill: fill };
  }

  /** With `meterChanged`, every track restarts on the bar line where the new meter begins. */
  private syncTracks(s: Settings, meterChanged = false): void {
    const tracks: ModeTracks = buildTracks(s);
    const apply = (id: 'exercise' | 'chords' | 'comp' | 'bass' | 'drums', atBar: boolean) => {
      const spec = tracks[id];
      const signature = spec ? sig([spec.lengthTicks, spec.loop, spec.events]) : '';
      if (this.trackSigs[id] === signature) return;
      this.trackSigs[id] = signature;
      if (!spec) this.scheduler.removeTrack(id);
      else if (atBar) this.scheduler.swapTrackAtNextBar(spec);
      else this.scheduler.replaceTrack(spec);
    };
    apply('exercise', true);
    apply('chords', meterChanged);
    apply('comp', meterChanged);
    apply('bass', meterChanged);
    // A new drum pattern, fill or edit comes in on the next bar line, like a drummer would.
    apply('drums', true);
    this.scheduler.setEnd(tracks.endTick, tracks.endTick === null ? null : () => this.stop(), 'chords');
  }

  private onSettings(s: Settings, previous: Settings): void {
    const meterChanged = s.meterId !== previous.meterId;
    if (meterChanged) {
      // Playing on: the new meter starts at the next bar line, tracks restart there.
      this.scheduler.setMeter(meterOf(s));
      this.manualChanges = [];
    }
    if (s.rig !== previous.rig) liveInput.setRig(s.rig);
    if (s.bpm !== previous.bpm) this.scheduler.setBpm(s.bpm);
    if (s.subdivision !== previous.subdivision) this.scheduler.setSubdivision(s.subdivision);
    if (s.swing !== previous.swing) this.scheduler.setSwing(s.swing);
    const timbres = s.drumSound !== previous.drumSound || s.bassTimbre !== previous.bassTimbre || s.compTimbre !== previous.compTimbre;
    if (timbres || s.volMaster !== previous.volMaster || MIX_CHANNELS.some((c) => channelVolume(s, c) !== channelVolume(previous, c))) this.applyVolumes(s);
    this.syncTracks(s, meterChanged);
    const backingChanged = s.backing !== previous.backing || s.bpm !== previous.bpm || meterChanged || s.mode !== previous.mode || s.loop !== previous.loop || s.arrangement !== previous.arrangement || s.arrangementOn !== previous.arrangementOn;
    if (backingChanged) {
      // Volume alone needs no restart.
      const onlyVolume = s.backing !== previous.backing && JSON.stringify({ ...s.backing, volume: 0 }) === JSON.stringify({ ...previous.backing, volume: 0 }) && s.bpm === previous.bpm && !meterChanged;
      if (onlyVolume) backingTrack.setVolume(backingTrackVolume(s));
      else this.syncBacking();
    } else if (backingTrackVolume(s) !== backingTrackVolume(previous)) backingTrack.setVolume(backingTrackVolume(s));
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
    // A change already queued for the next beat or bar counts: N N moves two chords, not one.
    const pending = this.manualChanges.filter((c) => c.tick > this.scheduler.positionNow()).at(-1);
    const current = this.scheduler.transportState === 'stopped'
      ? selectedChord
      : pending?.chordIndex ?? this.chordIndexAt(this.scheduler.positionNow()) ?? selectedChord;
    this.setChord((current + delta + count) % count);
  }

  setChord(index: number): void {
    const { settings, setSelectedChord } = useApp.getState();
    const state = this.scheduler.transportState;
    const manual = settings.mode === 'harmony' && settings.changeMode === 'manual';
    // With automatic changes the progression drives the chord while playing: a pick would only
    // move the hidden selection and surface after stop, so it is ignored.
    if (state === 'playing' && !manual) return;
    setSelectedChord(index);
    if (state === 'playing' && manual) {
      const tick = this.scheduler.nextQuantizedTick(settings.quantize);
      // A newer pick replaces one still waiting: only the last choice lands.
      this.manualChanges = this.manualChanges.filter((c) => c.tick < tick);
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

  /**
   * The backing track follows the transport (D-34): started at the file
   * position of the tick that will sound a moment from now, on the audio
   * clock; stopped on pause and stop. Called again when its settings change.
   */
  private syncBacking(): void {
    const s = useApp.getState().settings;
    const playing = this.scheduler.transportState === 'playing';
    if (!playing || s.mode !== 'jam' || !s.backing.on || !this.ctx || !this.audio) {
      backingTrack.stop();
      return;
    }
    const meter = meterOf(s);
    const song = s.arrangementOn && s.arrangement.length > 0;
    const loopTicks = !s.loop || s.progression.chords.length === 0 ? null
      : song ? sectionSpans(s.arrangement, s.progression, meter).reduce((sum, x) => sum + x.lengthTicks, 0) : progressionLength(s.progression, meter);
    // Just started: the first tick is still ahead, so start exactly on it. Already running: join a moment from now.
    const now = this.ctx.currentTime;
    let tick = this.scheduler.positionAt(now);
    let when = this.scheduler.timeOf(tick);
    if (when < now + 0.02) {
      tick = this.scheduler.positionAt(now + 0.06);
      when = this.scheduler.timeOf(tick);
    }
    const ctx = this.ctx;
    const out = this.audio.monitorInput;
    void backingTrack.restore(ctx).then((ok) => {
      if (!ok || this.scheduler.transportState !== 'playing') return;
      backingTrack.start(ctx, out, when, fileOffsetAt(s.backing, tick, meter, loopTicks), backingTrackVolume(s), loopTicks ? loopRegion(s.backing, loopTicks, meter) : null);
    });
  }

  private afterTransport(): void {
    this.syncBacking();
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
      beatsPerBar: segmentAt(this.scheduler.timeConfig, Math.max(tick, 0)).meter.beatsPerBar,
      phase,
      note,
      trail,
      ...this.drumPositionAt(tick, state !== 'stopped'),
    };
    const current = usePlayhead.getState();
    const changed = current.state !== next.state || current.bar !== next.bar || current.beat !== next.beat
      || current.subdivision !== next.subdivision || current.chordIndex !== next.chordIndex || current.phase !== next.phase || current.beatsPerBar !== next.beatsPerBar
      || current.note?.index !== next.note?.index || current.drumStep !== next.drumStep || current.drumFill !== next.drumFill;
    if (!changed) return;
    if (this.debug && this.ctx && state === 'playing') {
      const segment = segmentAt(this.scheduler.timeConfig, tick);
      const perBeat = (PPQ * 4) / segment.meter.beatUnit;
      const time = this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0);
      if (current.beat !== next.beat || current.bar !== next.bar) {
        const beatTick = segment.tick + Math.floor((tick - segment.tick) / perBeat) * perBeat;
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
  /** The shared audio context and an input that reaches the speakers: for the guitar monitor. */
  audioOut(): { ctx: AudioContext; destination: AudioNode } {
    const ctx = this.ensureAudio();
    return { ctx, destination: (this.audio as WebAudioSink).monitorInput };
  }

  /** Plays a test beep through the master, ignoring channel faders and mutes. */
  testTone(): void {
    const ctx = this.ensureAudio();
    void ctx.resume().then(() => this.audio?.testTone());
  }

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
    __gtl?: { engine: Engine; debug: DebugLog; backing?: typeof backingTrack; live?: typeof liveInput };
  }
}

if (engine.debug) window.__gtl = { engine, debug: engine.debug, backing: backingTrack, live: liveInput };
