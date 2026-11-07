/**
 * Plays the user's backing track in time with the transport (D-34). The file
 * is decoded in the browser and kept in this browser's IndexedDB so it is
 * there after a reload; it is never sent anywhere. Storage can be missing
 * (private windows): then the track lives until the page closes.
 */
import { create } from 'zustand';

const DB = 'gtl-backing';
const STORE = 'files';
const KEY = 'current';

export interface BackingState {
  readonly loaded: boolean;
  readonly duration: number;
  readonly error: string | null;
  readonly playing: boolean;
}

export const useBacking = create<BackingState>(() => ({ loaded: false, duration: 0, error: null, playing: false }));

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function storeFile(data: ArrayBuffer): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function loadFile(): Promise<ArrayBuffer | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result instanceof ArrayBuffer ? request.result : null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

class BackingTrack {
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  /** For tests: what the last start asked for. */
  lastStart: { readonly when: number; readonly offset: number; readonly loop: { start: number; end: number } | null } | null = null;

  async load(ctx: BaseAudioContext, data: ArrayBuffer, persist = true): Promise<boolean> {
    try {
      // decodeAudioData detaches the buffer it reads: keep a copy for storage.
      const copy = data.slice(0);
      this.buffer = await ctx.decodeAudioData(data);
      useBacking.setState({ loaded: true, duration: this.buffer.duration, error: null });
      if (persist) await storeFile(copy);
      return true;
    } catch {
      useBacking.setState({ loaded: false, duration: 0, error: 'Non riesco a leggere questo file audio. Prova un WAV, MP3, OGG o M4A.' });
      return false;
    }
  }

  /** The file saved in this browser, if any. */
  async restore(ctx: BaseAudioContext): Promise<boolean> {
    if (this.buffer) return true;
    const data = await loadFile();
    return data ? this.load(ctx, data, false) : false;
  }

  start(ctx: AudioContext, out: AudioNode, when: number, offset: number, volume: number, loop: { start: number; end: number } | null): void {
    this.stop();
    if (!this.buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = this.buffer;
    if (loop && loop.end > loop.start && loop.end <= this.buffer.duration + 0.001) {
      source.loop = true;
      source.loopStart = loop.start;
      source.loopEnd = loop.end;
    }
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(out);
    source.start(Math.max(ctx.currentTime, when), Math.min(offset, Math.max(0, this.buffer.duration - 0.01)));
    source.onended = () => { if (this.source === source) useBacking.setState({ playing: false }); };
    this.source = source;
    this.gain = gain;
    this.lastStart = { when, offset, loop: source.loop ? loop : null };
    useBacking.setState({ playing: true });
  }

  setVolume(volume: number): void {
    this.gain?.gain.setTargetAtTime(volume, this.gain.context.currentTime, 0.02);
  }

  stop(): void {
    if (this.source) {
      this.source.onended = null;
      try { this.source.stop(); } catch { /* already stopped */ }
      this.source.disconnect();
    }
    this.gain?.disconnect();
    this.source = null;
    this.gain = null;
    useBacking.setState({ playing: false });
  }
}

export const backingTrack = new BackingTrack();
