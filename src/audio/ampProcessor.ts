/**
 * Contract for a future amplifier processor (NAM or another DSP chain).
 * Nothing implements it yet: the Studio amplifier is a visual device whose
 * knobs change only their own state, and it says so while `connected` is
 * false. A real processor would sit on the guitar branch after the input
 * gain (see docs/STUDIO_V57_INTEGRATION.md, "NAM: punti d'ingresso"), run in
 * an AudioWorklet, and never touch the transport clock.
 */
/** The six controls of the amplifier head. */
export type AmpKnobId = 'gain' | 'bass' | 'mid' | 'treble' | 'presence' | 'out';

export interface AmpProcessorStatus {
  /** True only when audio really passes through the processor. */
  readonly connected: boolean;
  /** Name of the loaded model or chain, for the device label. */
  readonly model: string | null;
  /** Measured processing latency in ms, null when not measured. */
  readonly latencyMs: number | null;
}

export interface AmpProcessor {
  readonly status: AmpProcessorStatus;
  /** Knob positions 0–100, mapped by the processor to its own parameters. */
  setKnob(id: AmpKnobId, value: number): void;
  setPower(on: boolean): void;
  setBypass(bypass: boolean): void;
}

/** The only processor today: none. Every call is a no-op and the status says so. */
export const NO_AMP_PROCESSOR: AmpProcessor = {
  status: { connected: false, model: null, latencyMs: null },
  setKnob: () => undefined,
  setPower: () => undefined,
  setBypass: () => undefined,
};
