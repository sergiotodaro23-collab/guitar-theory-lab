/**
 * Preset Persistence: versioned local storage with strict validation. Bad or
 * foreign data is dropped rather than crashing the app.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SCHEMA_VERSION = 1;
const PRESETS_KEY = 'gtl.presets';
const SESSION_KEY = 'gtl.session';

export type PresetKind = 'study' | 'progression';

export interface Preset<T = unknown> {
  readonly id: string;
  readonly name: string;
  readonly kind: PresetKind;
  readonly savedAt: string;
  readonly data: T;
}

interface Envelope {
  readonly version: number;
  readonly presets: readonly Preset[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function isPreset(value: unknown): value is Preset {
  return isObject(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && (value.kind === 'study' || value.kind === 'progression')
    && typeof value.savedAt === 'string'
    && isObject(value.data);
}

export type SaveResult = { ok: true; preset: Preset } | { ok: false; error: string };

export class PresetRepository {
  constructor(private readonly storage: StorageLike, private readonly now: () => Date = () => new Date()) {}

  list(kind?: PresetKind): readonly Preset[] {
    const presets = this.read();
    return kind ? presets.filter((preset) => preset.kind === kind) : presets;
  }

  private read(): readonly Preset[] {
    let raw: string | null;
    try {
      raw = this.storage.getItem(PRESETS_KEY);
    } catch {
      return [];
    }
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isObject(parsed) || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.presets)) return [];
      return parsed.presets.filter(isPreset);
    } catch {
      return [];
    }
  }

  private write(presets: readonly Preset[]): string | null {
    const envelope: Envelope = { version: SCHEMA_VERSION, presets };
    try {
      this.storage.setItem(PRESETS_KEY, JSON.stringify(envelope));
      return null;
    } catch {
      return 'Il browser non consente di salvare: libera spazio o esci dalla navigazione privata.';
    }
  }

  /** A preset with the same name and kind is overwritten. */
  save(name: string, kind: PresetKind, data: unknown): SaveResult {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'Dai un nome al preset.' };
    const existing = this.read();
    const previous = existing.find((p) => p.kind === kind && p.name === trimmed);
    const preset: Preset = {
      id: previous?.id ?? `p${this.now().getTime().toString(36)}${existing.length}`,
      name: trimmed,
      kind,
      savedAt: this.now().toISOString(),
      data,
    };
    const error = this.write([...existing.filter((p) => p !== previous), preset]);
    return error ? { ok: false, error } : { ok: true, preset };
  }

  remove(id: string): void {
    this.write(this.read().filter((preset) => preset.id !== id));
  }

  saveSession(data: unknown): void {
    try {
      this.storage.setItem(SESSION_KEY, JSON.stringify({ version: SCHEMA_VERSION, data }));
    } catch {
      // The last session is a convenience: losing it must never interrupt practice.
    }
  }

  loadSession(): unknown {
    try {
      const raw = this.storage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isObject(parsed) && parsed.version === SCHEMA_VERSION ? parsed.data : null;
    } catch {
      return null;
    }
  }
}

export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
}
