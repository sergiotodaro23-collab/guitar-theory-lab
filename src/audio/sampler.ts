/**
 * Loads the sampled instruments (J1, D-60) from `public/samples/<set>/`, on
 * demand. Nothing is downloaded until a jam needs it, and only the zones its
 * notes use are decoded: a full set decodes to 50–120 MB of float audio, the
 * few roots and layers a progression touches to a fraction of it. Until a
 * zone is ready the sink plays the synthesised recipe (D-32), so the clock
 * never waits on the network.
 */
import { isManifest, type SampleManifest, type SampleSetId } from './samplerMap';

export interface SampleSetStatus {
  readonly id: SampleSetId;
  readonly state: 'idle' | 'loading' | 'ready' | 'failed';
  readonly decoded: number;
  readonly zones: number;
  /** Decoded audio held in memory, in bytes (float32 per channel). */
  readonly bytes: number;
}

type Fetcher = (url: string) => Promise<Response>;

export class SampleLibrary {
  private readonly manifests = new Map<SampleSetId, SampleManifest>();
  private readonly manifestLoads = new Map<SampleSetId, Promise<SampleManifest | null>>();
  private readonly failed = new Set<SampleSetId>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly pending = new Map<string, Promise<void>>();

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly base = 'samples/',
    private readonly fetcher: Fetcher = (url) => fetch(url),
  ) {}

  /** The manifest if already loaded: the sink asks synchronously while scheduling. */
  manifestNow(id: SampleSetId): SampleManifest | undefined {
    return this.manifests.get(id);
  }

  manifest(id: SampleSetId): Promise<SampleManifest | null> {
    const known = this.manifests.get(id);
    if (known) return Promise.resolve(known);
    let load = this.manifestLoads.get(id);
    if (!load) {
      load = this.fetcher(`${this.base}${id}/manifest.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((value: unknown) => {
          if (!isManifest(value)) throw new Error(`manifest ${id}`);
          this.manifests.set(id, value);
          return value;
        })
        .catch(() => {
          this.failed.add(id);
          return null;
        });
      this.manifestLoads.set(id, load);
    }
    return load;
  }

  /** A decoded zone, or undefined while it is not loaded. */
  buffer(id: SampleSetId, file: string): AudioBuffer | undefined {
    return this.buffers.get(`${id}/${file}`);
  }

  /** Decode these files of a set, those not loaded yet; resolves when all are ready or failed. */
  async require(id: SampleSetId, files: readonly string[]): Promise<void> {
    const jobs = files.map((file) => {
      const key = `${id}/${file}`;
      if (this.buffers.has(key)) return Promise.resolve();
      let job = this.pending.get(key);
      if (!job) {
        job = this.fetcher(`${this.base}${key}`)
          .then((r) => {
            if (!r.ok) throw new Error(`${key}: ${r.status}`);
            return r.arrayBuffer();
          })
          .then((data) => this.ctx.decodeAudioData(data))
          .then((buffer) => {
            this.buffers.set(key, buffer);
          })
          .catch(() => {
            this.failed.add(id);
          })
          .finally(() => this.pending.delete(key));
        this.pending.set(key, job);
      }
      return job;
    });
    await Promise.all(jobs);
  }

  status(id: SampleSetId): SampleSetStatus {
    const manifest = this.manifests.get(id);
    let decoded = 0;
    let bytes = 0;
    for (const [key, buffer] of this.buffers) {
      if (!key.startsWith(`${id}/`)) continue;
      decoded += 1;
      bytes += buffer.length * buffer.numberOfChannels * 4;
    }
    const loading = [...this.pending.keys()].some((k) => k.startsWith(`${id}/`)) || (this.manifestLoads.has(id) && !manifest && !this.failed.has(id));
    const state = this.failed.has(id) && !decoded ? 'failed' : loading ? 'loading' : decoded ? 'ready' : 'idle';
    return { id, state, decoded, zones: manifest?.zones.length ?? 0, bytes };
  }
}
