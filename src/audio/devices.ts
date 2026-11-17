/**
 * Pure helpers for audio device selection (B1). No DOM, no store, no browser
 * calls: they take plain values so the rules can be tested on textbook cases.
 */

export type DeviceKind = 'audioinput' | 'audiooutput';

export interface DeviceLike {
  readonly kind: string;
  readonly deviceId: string;
  readonly label: string;
}

export interface DeviceOption {
  readonly id: string;
  readonly label: string;
}

/** Permission state of the microphone as the browser reports it; 'unknown' when the query is not supported. */
export type MicPermission = 'granted' | 'prompt' | 'denied' | 'unknown';

const NOUN: Record<DeviceKind, string> = { audioinput: 'Ingresso', audiooutput: 'Uscita' };

/**
 * The devices of one kind, in the browser's order. Without microphone permission
 * the browser returns empty labels: those become "Ingresso n" / "Uscita n".
 */
export function deviceOptions(list: readonly DeviceLike[], kind: DeviceKind): DeviceOption[] {
  return list
    .filter((d) => d.kind === kind)
    .map((d, i) => ({ id: d.deviceId, label: d.label.trim() || `${NOUN[kind]} ${i + 1}` }));
}

/**
 * Total latency the browser can estimate, in milliseconds: input, base and output
 * (seconds, as the Web Audio API and MediaStreamTrack report them). Null when the
 * browser gives no figure at all. This is an estimate, not a measurement.
 */
export function totalLatencyMs(parts: { readonly input: number | null; readonly base: number | null; readonly output: number | null }): number | null {
  const known = [parts.input, parts.base, parts.output].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (known.length === 0) return null;
  return Math.round(known.reduce((sum, v) => sum + v, 0) * 1000);
}

/** True when the input device runs at another rate than the context: the browser resamples. */
export function sampleRateMismatch(contextRate: number, trackRate: number | null): boolean {
  return trackRate !== null && trackRate > 0 && trackRate !== contextRate;
}

/** Whether this browser can choose the output device of an AudioContext (Chromium: yes; Safari: no). */
export function sinkSelectionSupported(audioContextProto: unknown): boolean {
  return typeof audioContextProto === 'object' && audioContextProto !== null && typeof (audioContextProto as { setSinkId?: unknown }).setSinkId === 'function';
}

/** Line for the permission state, or null when nothing needs saying. */
export function permissionHint(state: MicPermission): string | null {
  if (state === 'denied') return 'Microfono bloccato nel browser. Apri le impostazioni del sito (icona del lucchetto nella barra degli indirizzi), consenti il microfono e poi riavvia l’ingresso.';
  if (state === 'prompt') return 'Il browser chiederà il permesso al microfono quando avvii l’ingresso.';
  return null;
}
