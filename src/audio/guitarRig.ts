/**
 * Guitar Rig audio graph (D-42), built from native Web Audio nodes on the
 * guitar's listening branch: comp → drive → amp → cabinet → chorus → delay →
 * reverb. Every stage has a dry and a wet path with smooth gain changes, so
 * bypass and parameter moves never click. The analysis keeps the dry signal:
 * the rig sits after the input gain, before the monitor level.
 *
 * The amp head is a built-in DSP preamp (soft clipper and tone stack). A NAM
 * model would replace that preamp (P4-01, docs/NAM_FEASIBILITY.md); nothing
 * here claims to be NAM.
 */
import {
  CHORUS_BASE_DELAY, PEDALS, ampDrive, ampOutGain, cabinetImpulse, chorusDepth, chorusRate, compMakeup, compThreshold, delayFeedback,
  delayTime, mix01, odDrive, odLevel, odTone, presenceDb, reverbDecay, reverbImpulse, softClipCurve, toneDb, type PedalId, type RigSettings,
} from '../app/rig';

const GLIDE = 0.02;

interface Stage {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly dry: GainNode;
  readonly wet: GainNode;
}

function stage(ctx: BaseAudioContext): Stage {
  const s = { input: ctx.createGain(), output: ctx.createGain(), dry: ctx.createGain(), wet: ctx.createGain() };
  s.input.connect(s.dry).connect(s.output);
  s.wet.connect(s.output);
  s.wet.gain.value = 0;
  return s;
}

export interface RigState {
  /** Stage order, as wired. */
  readonly chain: readonly string[];
  /** Stages whose wet path is heard now. */
  readonly active: readonly string[];
  readonly ampHeard: boolean;
  readonly cab: string;
  readonly delaySeconds: number;
  readonly reverbSeconds: number;
}

export class GuitarRig {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly ctx: BaseAudioContext;
  private readonly stages: Record<PedalId | 'amp' | 'cab', Stage>;
  private readonly comp: DynamicsCompressorNode;
  private readonly compGain: GainNode;
  private readonly drive: WaveShaperNode;
  private readonly driveTone: BiquadFilterNode;
  private readonly driveLevel: GainNode;
  private readonly preamp: WaveShaperNode;
  private readonly bass: BiquadFilterNode;
  private readonly mid: BiquadFilterNode;
  private readonly treble: BiquadFilterNode;
  private readonly presence: BiquadFilterNode;
  private readonly ampOut: GainNode;
  private readonly cab: ConvolverNode;
  private readonly chorusDelay: DelayNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoDepth: GainNode;
  private readonly echo: DelayNode;
  private readonly echoFeedback: GainNode;
  private readonly reverb: ConvolverNode;
  private settings: RigSettings | null = null;
  private cabKey = '';
  private reverbKey = 0;
  private fileCab: AudioBuffer | null = null;
  private driveKey = -1;
  private preampKey = -1;
  private heard = new Set<string>();

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    const order = ['comp', 'drive', 'amp', 'cab', 'chorus', 'delay', 'reverb'] as const;
    this.stages = Object.fromEntries(order.map((id) => [id, stage(ctx)])) as Record<(typeof order)[number], Stage>;
    // Series wiring of the stages.
    let previous: AudioNode = this.input;
    for (const id of order) {
      previous.connect(this.stages[id].input);
      previous = this.stages[id].output;
    }
    previous.connect(this.output);

    // Compressor.
    this.comp = ctx.createDynamicsCompressor();
    this.comp.ratio.value = 4;
    this.comp.knee.value = 6;
    this.comp.attack.value = 0.005;
    this.comp.release.value = 0.2;
    this.compGain = ctx.createGain();
    this.stages.comp.input.connect(this.comp).connect(this.compGain).connect(this.stages.comp.wet);

    // Overdrive.
    this.drive = ctx.createWaveShaper();
    this.drive.oversample = '4x';
    this.driveTone = ctx.createBiquadFilter();
    this.driveTone.type = 'lowpass';
    this.driveLevel = ctx.createGain();
    this.stages.drive.input.connect(this.drive).connect(this.driveTone).connect(this.driveLevel).connect(this.stages.drive.wet);

    // Amp head: preamp clipper and tone stack.
    this.preamp = ctx.createWaveShaper();
    this.preamp.oversample = '4x';
    const filter = (type: BiquadFilterType, frequency: number, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = frequency;
      f.Q.value = q;
      return f;
    };
    this.bass = filter('lowshelf', 120);
    this.mid = filter('peaking', 700, 0.8);
    this.treble = filter('highshelf', 3200);
    this.presence = filter('highshelf', 5500);
    this.ampOut = ctx.createGain();
    this.stages.amp.input.connect(this.preamp).connect(this.bass).connect(this.mid).connect(this.treble).connect(this.presence).connect(this.ampOut).connect(this.stages.amp.wet);

    // Cabinet.
    this.cab = ctx.createConvolver();
    this.stages.cab.input.connect(this.cab).connect(this.stages.cab.wet);

    // Chorus: a short delay swept by an LFO (an audio-rate oscillator, not a UI timer).
    this.chorusDelay = ctx.createDelay(0.05);
    this.chorusDelay.delayTime.value = CHORUS_BASE_DELAY;
    this.lfo = ctx.createOscillator();
    this.lfoDepth = ctx.createGain();
    this.lfo.connect(this.lfoDepth).connect(this.chorusDelay.delayTime);
    this.lfo.start();
    this.stages.chorus.input.connect(this.chorusDelay).connect(this.stages.chorus.wet);

    // Delay with feedback.
    this.echo = ctx.createDelay(1.5);
    this.echoFeedback = ctx.createGain();
    this.stages.delay.input.connect(this.echo);
    this.echo.connect(this.echoFeedback).connect(this.echo);
    this.echo.connect(this.stages.delay.wet);

    // Reverb.
    this.reverb = ctx.createConvolver();
    this.stages.reverb.input.connect(this.reverb).connect(this.stages.reverb.wet);
  }

  private set(param: AudioParam, value: number): void {
    param.setTargetAtTime(value, this.ctx.currentTime, GLIDE);
  }

  private route(id: keyof GuitarRig['stages'], dry: number, wet: number): void {
    const s = this.stages[id];
    this.set(s.dry.gain, dry);
    this.set(s.wet.gain, wet);
    if (wet > 0) this.heard.add(id); else this.heard.delete(id);
  }

  /** A cabinet impulse response loaded from a file; kept in memory only. */
  setCabFile(buffer: AudioBuffer | null): void {
    this.fileCab = buffer;
    this.cabKey = '';
    if (this.settings) this.apply(this.settings);
  }

  apply(r: RigSettings): void {
    this.settings = r;
    const k = (id: PedalId, knob: string) => r.pedals[id].knobs[knob] ?? 50;
    // Inline pedals: wet only when on.
    this.set(this.comp.threshold, compThreshold(k('comp', 'sustain')));
    this.set(this.compGain.gain, compMakeup(k('comp', 'level')));
    const driveAmount = odDrive(k('drive', 'drive'));
    if (driveAmount !== this.driveKey) { this.drive.curve = softClipCurve(driveAmount); this.driveKey = driveAmount; }
    this.set(this.driveTone.frequency, odTone(k('drive', 'tone')));
    this.set(this.driveLevel.gain, odLevel(k('drive', 'level')));
    for (const id of ['comp', 'drive'] as const) this.route(id, r.pedals[id].on ? 0 : 1, r.pedals[id].on ? 1 : 0);

    // Amp: bypass passes the signal straight through amp and cabinet; power off silences it.
    const a = r.amp.knobs;
    const pre = ampDrive(a.gain);
    if (pre !== this.preampKey) { this.preamp.curve = softClipCurve(pre); this.preampKey = pre; }
    this.set(this.bass.gain, toneDb(a.bass));
    this.set(this.mid.gain, toneDb(a.mid));
    this.set(this.treble.gain, toneDb(a.treble));
    this.set(this.presence.gain, presenceDb(a.presence));
    this.set(this.ampOut.gain, ampOutGain(a.out));
    if (r.amp.bypass) this.route('amp', 1, 0);
    else if (!r.amp.power) this.route('amp', 0, 0);
    else this.route('amp', 0, 1);

    const cabModel = r.cab.model === 'file' && !this.fileCab ? '4x12' : r.cab.model;
    const cabKey = `${cabModel}:${this.ctx.sampleRate}`;
    if (cabKey !== this.cabKey) {
      this.cabKey = cabKey;
      if (cabModel === 'file' && this.fileCab) this.cab.buffer = this.fileCab;
      else {
        const ir = cabinetImpulse(cabModel === '1x12' ? '1x12' : '4x12', this.ctx.sampleRate);
        const buffer = this.ctx.createBuffer(1, ir.length, this.ctx.sampleRate);
        buffer.copyToChannel(ir, 0);
        this.cab.buffer = buffer;
      }
    }
    const cabOn = r.cab.on && !r.amp.bypass;
    this.route('cab', cabOn ? 0 : 1, cabOn ? 1 : 0);

    // Post effects: dry always, wet added at the mix.
    this.set(this.lfo.frequency, chorusRate(k('chorus', 'rate')));
    this.set(this.lfoDepth.gain, chorusDepth(k('chorus', 'depth')));
    this.set(this.echo.delayTime, delayTime(k('delay', 'time')));
    this.set(this.echoFeedback.gain, r.pedals.delay.on ? delayFeedback(k('delay', 'feedback')) : 0);
    const decay = reverbDecay(k('reverb', 'decay'));
    if (decay !== this.reverbKey) {
      this.reverbKey = decay;
      const [left, right] = reverbImpulse(decay, this.ctx.sampleRate);
      const buffer = this.ctx.createBuffer(2, left.length, this.ctx.sampleRate);
      buffer.copyToChannel(left, 0);
      buffer.copyToChannel(right, 1);
      this.reverb.buffer = buffer;
    }
    for (const id of ['chorus', 'delay', 'reverb'] as const) this.route(id, 1, r.pedals[id].on ? mix01(k(id, 'mix')) : 0);
  }

  describe(): RigState {
    const r = this.settings;
    return {
      chain: ['comp', 'drive', 'amp', 'cab', 'chorus', 'delay', 'reverb'],
      active: [...PEDALS, 'amp', 'cab'].filter((id) => this.heard.has(id)),
      ampHeard: this.heard.has('amp'),
      cab: r ? (r.cab.model === 'file' && !this.fileCab ? '4x12' : r.cab.model) : '',
      delaySeconds: this.echo.delayTime.value,
      reverbSeconds: this.reverb.buffer ? this.reverb.buffer.duration : 0,
    };
  }

  dispose(): void {
    try { this.lfo.stop(); } catch { /* already stopped */ }
    this.input.disconnect();
    this.output.disconnect();
  }
}

/** Decodes an impulse response file (WAV, AIFF…) chosen by the user. */
export async function decodeImpulse(file: Blob, ctx: BaseAudioContext): Promise<AudioBuffer> {
  return ctx.decodeAudioData(await file.arrayBuffer());
}
