/**
 * The pedal chain of the Guitar Rig (Studio V6, configurable order): which
 * pedals are in the chain, in which order, inside their zone. Pure: no Web
 * Audio and no DOM here.
 *
 * Two zones, as in a real rig: PRE sits before the amplifier, POST after the
 * cabinet. Amplifier and cabinet are fixed between them. A pedal belongs to
 * one zone by its type, so moving a pedal across the amplifier is not a
 * reordering and is not offered. Each pedal type appears at most once: its
 * settings are keyed by type, so a second instance would need its own id
 * (not done here).
 *
 * The chain is kept apart from the pedals' parameters and their on/off
 * state: removing a pedal from the chain keeps its knobs and switch, so
 * putting it back brings them back.
 */

export type PedalId = 'comp' | 'fuzz' | 'drive' | 'eq' | 'chorus' | 'delay' | 'reverb';
export type PedalZone = 'pre' | 'post';
export type ChainStage = PedalId | 'amp' | 'cab';

/** Every pedal type the rig has, in the order of the default chain. */
export const PEDAL_IDS: readonly PedalId[] = ['comp', 'fuzz', 'drive', 'eq', 'chorus', 'delay', 'reverb'];
export const ZONE_OF: Readonly<Record<PedalId, PedalZone>> = {
  comp: 'pre', fuzz: 'pre', drive: 'pre',
  eq: 'post', chorus: 'post', delay: 'post', reverb: 'post',
};

export interface PedalChain {
  /** Pedals before the amplifier, in signal order. */
  readonly pre: readonly PedalId[];
  /** Pedals after the cabinet, in signal order. */
  readonly post: readonly PedalId[];
}

export const DEFAULT_PRE: readonly PedalId[] = ['comp', 'fuzz', 'drive'];
export const DEFAULT_POST: readonly PedalId[] = ['eq', 'chorus', 'delay', 'reverb'];

/** A fresh copy of the factory chain: the order the rig starts with and «Catena predefinita» returns to. */
export const defaultChain = (): PedalChain => ({ pre: [...DEFAULT_PRE], post: [...DEFAULT_POST] });

export const inChain = (chain: PedalChain, id: PedalId): boolean => chain.pre.includes(id) || chain.post.includes(id);

/** The pedal types that are not in the chain, in the order of the rig: what «Aggiungi» can offer. */
export const availablePedals = (chain: PedalChain): readonly PedalId[] => PEDAL_IDS.filter((id) => !inChain(chain, id));

const sameList = (a: readonly PedalId[], b: readonly PedalId[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);
export const sameChain = (a: PedalChain, b: PedalChain): boolean => sameList(a.pre, b.pre) && sameList(a.post, b.post);
export const isDefaultChain = (chain: PedalChain): boolean => sameChain(chain, defaultChain());

/**
 * Moves a pedal one place left (-1) or right (+1) inside its zone. Anything
 * that cannot move (not in the chain, already at the edge, a bad step) gives
 * the chain back unchanged.
 */
export function movePedal(chain: PedalChain, id: PedalId, step: -1 | 1): PedalChain {
  if (step !== -1 && step !== 1) return chain;
  const zone: PedalZone = ZONE_OF[id];
  const list = chain[zone];
  const from = list.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= list.length) return chain;
  const moved = [...list];
  [moved[from], moved[to]] = [moved[to] as PedalId, moved[from] as PedalId];
  return { ...chain, [zone]: moved };
}

/** Puts a pedal at the end of its zone. A pedal already in the chain is not added twice. */
export function addPedal(chain: PedalChain, id: PedalId): PedalChain {
  if (inChain(chain, id)) return chain;
  const zone: PedalZone = ZONE_OF[id];
  return { ...chain, [zone]: [...chain[zone], id] };
}

/** Takes a pedal out of the chain. Its settings are not touched: they live with the rig, not with the chain. */
export function removePedal(chain: PedalChain, id: PedalId): PedalChain {
  if (!inChain(chain, id)) return chain;
  const zone: PedalZone = ZONE_OF[id];
  return { ...chain, [zone]: chain[zone].filter((p) => p !== id) };
}

/**
 * The stages in the order the signal reaches them: PRE pedals, amplifier,
 * cabinet, POST pedals. Each stage appears once; the audio graph connects
 * them in this sequence.
 */
export function wiredOrder(chain: PedalChain): readonly ChainStage[] {
  return [...chain.pre, 'amp', 'cab', ...chain.post];
}

const isPedalId = (value: unknown): value is PedalId => typeof value === 'string' && (PEDAL_IDS as readonly string[]).includes(value);

/**
 * Repairs a saved chain. A missing or unreadable one (sessions from before
 * the chain existed) is the factory chain. Inside a list, unknown ids are
 * dropped, repeats are kept once (the first place wins), and a pedal in the
 * wrong zone is dropped; the order of the rest is kept.
 */
export function sanitizeChain(raw: unknown): PedalChain {
  if (typeof raw !== 'object' || raw === null) return defaultChain();
  const r = raw as { pre?: unknown; post?: unknown };
  const clean = (zone: PedalZone, value: unknown): readonly PedalId[] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<PedalId>();
    const out: PedalId[] = [];
    for (const item of value) {
      if (!isPedalId(item) || ZONE_OF[item] !== zone || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
    return out;
  };
  return { pre: clean('pre', r.pre), post: clean('post', r.post) };
}
