/**
 * MIDI input (P4-06, D-37): a MIDI guitar or keyboard gives exact pitches
 * (no detection, no guess about the octave) to the Live Monitor, and MIDI
 * Start/Stop/Continue or the sustain pedal drive the transport. Web MIDI is
 * asked for only when the user switches it on.
 */
import { create } from 'zustand';

export type MidiMessage =
  | { readonly type: 'note-on'; readonly note: number; readonly velocity: number; readonly channel: number }
  | { readonly type: 'note-off'; readonly note: number; readonly channel: number }
  | { readonly type: 'cc'; readonly controller: number; readonly value: number; readonly channel: number }
  | { readonly type: 'start' | 'stop' | 'continue' };

/** Pure: one MIDI message's bytes to a meaning; null for what the app does not use. */
export function parseMidi(data: ArrayLike<number>): MidiMessage | null {
  const status = data[0] ?? 0;
  if (status === 0xfa) return { type: 'start' };
  if (status === 0xfb) return { type: 'continue' };
  if (status === 0xfc) return { type: 'stop' };
  const kind = status & 0xf0;
  const channel = status & 0x0f;
  const a = data[1] ?? 0;
  const b = data[2] ?? 0;
  // A note-on with velocity 0 is a note-off (running-status convention).
  if (kind === 0x90) return b > 0 ? { type: 'note-on', note: a, velocity: b, channel } : { type: 'note-off', note: a, channel };
  if (kind === 0x80) return { type: 'note-off', note: a, channel };
  if (kind === 0xb0) return { type: 'cc', controller: a, value: b, channel };
  return null;
}

export interface MidiState {
  readonly status: 'off' | 'asking' | 'on' | 'unsupported' | 'denied';
  readonly inputs: readonly string[];
  /** The note held now (the last one pressed), with its velocity 0–1. */
  readonly note: { readonly midi: number; readonly velocity: number } | null;
}

export const useMidi = create<MidiState>(() => ({ status: 'off', inputs: [], note: null }));

interface Transport { toggle(): void; stop(): void; play(): Promise<void> }

class MidiInput {
  private access: MIDIAccess | null = null;
  private held: number[] = [];
  private pedalDown = false;

  async start(transport: Transport): Promise<void> {
    if (!navigator.requestMIDIAccess) { useMidi.setState({ status: 'unsupported' }); return; }
    useMidi.setState({ status: 'asking' });
    try {
      this.access = await navigator.requestMIDIAccess();
    } catch {
      useMidi.setState({ status: 'denied' });
      return;
    }
    const attach = () => {
      const names: string[] = [];
      this.access?.inputs.forEach((input) => {
        names.push(input.name ?? 'MIDI');
        input.onmidimessage = (event) => { if (event.data) this.handle(parseMidi(event.data), transport); };
      });
      useMidi.setState({ inputs: names });
    };
    attach();
    this.access.onstatechange = attach;
    useMidi.setState({ status: 'on' });
  }

  stop(): void {
    this.access?.inputs.forEach((input) => { input.onmidimessage = null; });
    if (this.access) this.access.onstatechange = null;
    this.access = null;
    this.held = [];
    useMidi.setState({ status: 'off', inputs: [], note: null });
  }

  private handle(message: MidiMessage | null, transport: Transport): void {
    if (!message) return;
    switch (message.type) {
      case 'note-on':
        this.held = [...this.held.filter((n) => n !== message.note), message.note];
        useMidi.setState({ note: { midi: message.note, velocity: message.velocity / 127 } });
        break;
      case 'note-off': {
        this.held = this.held.filter((n) => n !== message.note);
        const last = this.held.at(-1);
        useMidi.setState({ note: last === undefined ? null : { midi: last, velocity: useMidi.getState().note?.velocity ?? 0.7 } });
        break;
      }
      case 'cc':
        // Sustain pedal: each press toggles play and pause, hands stay on the guitar.
        if (message.controller === 64) {
          const down = message.value >= 64;
          if (down && !this.pedalDown) transport.toggle();
          this.pedalDown = down;
        }
        break;
      case 'start':
      case 'continue':
        void transport.play();
        break;
      case 'stop':
        transport.stop();
        break;
    }
  }
}

export const midiInput = new MidiInput();

/**
 * What the Live Monitor reads: the audio input's tracked pitch, or else the
 * MIDI note held (exact, so it is stable and fully confident).
 */
export function midiPitch(note: MidiState['note'], a4: number): { frequency: number; confidence: number; rms: number; stable: boolean } | null {
  return note ? { frequency: a4 * 2 ** ((note.midi - 69) / 12), confidence: 1, rms: 0.05 + 0.15 * note.velocity, stable: true } : null;
}
