/**
 * Guitar Theory Lab — UI state & callback contracts for the hardware overlay system (V5.7 handoff).
 * These types describe what the visual components NEED from the real application.
 * Nothing here implements audio, DSP, device access or pitch detection.
 */

export type DeviceId = 'mixer' | 'amp' | 'tuner' | 'iface';

/** Where a value comes from. Components must render `simulated` sources with a visible label. */
export type SignalSource = 'none' | 'input' | 'demo';

/* ---------------- Mixer ---------------- */
export type ChannelId = 'click' | 'notes' | 'chords' | 'bass' | 'drums' | 'guitar' | 'master';

export interface MixerChannel {
  id: ChannelId;
  label: string;            // live text, never baked into a raster
  /** 0..100 fader position. Prototype mapping: dB = -30 + v * 0.36, v <= 1.5 => -inf. */
  value: number;
  muted: boolean;
  /** true only when an audio bus really exists behind this channel. */
  wired: boolean;
  /** 0..1 post-fader level for the LED; 0 when not wired. */
  level: number;
}

export interface MixerProps {
  channels: MixerChannel[];          // exactly 7, in the order of ChannelId above
  onValueChange(id: ChannelId, value: number): void;
  onMuteToggle(id: ChannelId): void;
  /** Solo is not implemented in the product: the button must stay disabled until this exists. */
  onSoloToggle?: (id: ChannelId) => void;
  scale: number;                     // 0.45..1, computed from the free notebook area
  onClose(): void;
}

/* ---------------- Amplifier (design demo, no DSP) ---------------- */
export type AmpKnobId = 'gain' | 'bass' | 'mid' | 'treble' | 'presence' | 'out';
export interface AmpState {
  knobs: Record<AmpKnobId, number>;  // 0..100
  power: boolean;                    // visual state only
  bypass: boolean;                   // visual state only
  /** Must stay false until a real NAM/DSP chain is connected. Drives the honesty label. */
  processingConnected: boolean;
}
export interface AmpProps extends AmpState {
  onKnobChange(id: AmpKnobId, value: number): void;
  onPowerToggle(): void;
  onBypassToggle(): void;
  scale: number;
  onClose(): void;
}

/* ---------------- Tuner ---------------- */
export interface PitchReading { midi: number; cents: number; source: Exclude<SignalSource, 'none'> }
export interface TunerProps {
  enabled: boolean;                  // footswitch
  reading: PitchReading | null;      // null = no signal. Never invent a reading.
  calibrationHz: number;             // 435..445
  referencePc: number | null;        // last reference tone pressed (0..11)
  onToggle(): void;
  onCalibrationChange(hz: number): void;
  /** Plays a reference tone. Real audio in the prototype (WebAudio sine). */
  onReferenceTone(pc: number): void;
  scale: number;
  onClose(): void;
}

/* ---------------- Audio interface ---------------- */
export interface AudioInterfaceProps {
  deviceConnected: boolean;          // false in the prototype — show "Nessun dispositivo reale"
  inputChannel: 1 | 2;
  inputGain: number;                 // 0..100 (prototype readout: +gain*0.2 dB)
  liveMonitor: boolean;              // must default to false; opening the panel never enables it
  demoSignal: boolean;               // declared simulation
  inputLevel: number;                // 0..1, from input or demo
  statusText: string;
  pathText: string;
  detectedText: string;
  onChannelChange(ch: 1 | 2): void;
  onGainChange(v: number): void;
  onLiveMonitorToggle(): void;
  onDemoToggle(): void;
  scale: number;
  onClose(): void;
}

/* ---------------- Visualization preferences (display only) ---------------- */
export interface VizPrefs {
  scale: boolean; chord: boolean; arp: boolean;
  overlap: 'chord' | 'split';
  target: boolean; play: boolean; det: boolean;
  anim: 'pulse' | 'glow' | 'static';
  lstyle: 'bars' | 'dots';
}
export const VIZ_DEFAULTS: VizPrefs = { scale: true, chord: true, arp: false, overlap: 'chord', target: true, play: true, det: true, anim: 'pulse', lstyle: 'bars' };

/** Persisted UI keys used by the prototype (localStorage, always in try/catch). */
export const STORAGE_KEYS = {
  dividerRatio: 'gtl.v5.fbR', railExpanded: 'gtl.v5.railX', density: 'gtl.v5.dens',
  lcdExpanded: 'gtl.v5.lcdX', viz: 'gtl.v5.vz', devices: 'gtl.v5.dev'
} as const;
