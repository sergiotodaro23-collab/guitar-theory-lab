import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RIG, PEDALS, RIG_PRESETS, addPedal, availablePedals, defaultChain, isDefaultChain, movePedal, removePedal, sanitizeChain,
  sanitizeRig, wiredOrder, type PedalChain,
} from './rig';

const chainOf = (c: PedalChain) => ({ pre: [...c.pre], post: [...c.post] });

describe('pedal chain: starting point', () => {
  it('the factory order: comp, fuzz, overdrive before the amp; EQ, chorus, delay, reverb after the cabinet', () => {
    expect(chainOf(defaultChain())).toEqual({ pre: ['comp', 'fuzz', 'drive'], post: ['eq', 'chorus', 'delay', 'reverb'] });
    expect(DEFAULT_RIG.chain).toEqual(defaultChain());
    expect(isDefaultChain(defaultChain())).toBe(true);
  });
  it('every pedal type appears exactly once in the factory chain, and none is available to add', () => {
    const order = wiredOrder(defaultChain()).filter((s) => s !== 'amp' && s !== 'cab');
    expect([...order].sort()).toEqual([...PEDALS].sort());
    expect(availablePedals(defaultChain())).toEqual([]);
  });
  it('amplifier and cabinet are fixed between the two zones, whatever the pedals do', () => {
    const c = movePedal(defaultChain(), 'drive', -1);
    const order = wiredOrder(c);
    expect(order.indexOf('amp')).toBe(c.pre.length);
    expect(order.indexOf('cab')).toBe(c.pre.length + 1);
  });
});

describe('pedal chain: reordering inside a zone', () => {
  it('moves a pedal one place left or right in its zone', () => {
    expect(chainOf(movePedal(defaultChain(), 'drive', -1)).pre).toEqual(['comp', 'drive', 'fuzz']);
    expect(chainOf(movePedal(defaultChain(), 'comp', 1)).pre).toEqual(['fuzz', 'comp', 'drive']);
    expect(chainOf(movePedal(defaultChain(), 'delay', -1)).post).toEqual(['eq', 'delay', 'chorus', 'reverb']);
  });
  it('a pedal never leaves its zone by moving', () => {
    const c = defaultChain();
    expect(movePedal(c, 'drive', 1)).toEqual(c);
    expect(movePedal(c, 'eq', -1)).toEqual(c);
    expect(movePedal(c, 'comp', -1)).toEqual(c);
  });
  it('a move at the edge, a bad step or a pedal out of the chain changes nothing', () => {
    const c = defaultChain();
    expect(movePedal(c, 'comp', -1)).toBe(c);
    expect(movePedal(c, 'reverb', 1)).toBe(c);
    expect(movePedal(c, 'fuzz', 2 as unknown as -1)).toBe(c);
    const without = removePedal(c, 'fuzz');
    expect(movePedal(without, 'fuzz', -1)).toBe(without);
  });
  it('the signal order follows the chain: a reordered overdrive is wired before the compressor', () => {
    const c = movePedal(movePedal(defaultChain(), 'drive', -1), 'drive', -1);
    expect(wiredOrder(c).slice(0, 3)).toEqual(['drive', 'comp', 'fuzz']);
  });
});

describe('pedal chain: adding and removing', () => {
  it('removing a pedal takes it out of the signal but keeps it in the zone order of the rest', () => {
    const c = removePedal(defaultChain(), 'fuzz');
    expect(chainOf(c).pre).toEqual(['comp', 'drive']);
    expect(wiredOrder(c)).not.toContain('fuzz');
    expect(availablePedals(c)).toEqual(['fuzz']);
  });
  it('adding a pedal puts it at the end of its own zone; the order of the others is kept', () => {
    const c = addPedal(removePedal(defaultChain(), 'fuzz'), 'fuzz');
    expect(chainOf(c).pre).toEqual(['comp', 'drive', 'fuzz']);
    expect(availablePedals(c)).toEqual([]);
  });
  it('a pedal cannot be added twice, and removing one that is not there changes nothing', () => {
    const c = defaultChain();
    expect(addPedal(c, 'comp')).toBe(c);
    expect(removePedal(removePedal(c, 'eq'), 'eq')).toEqual(removePedal(c, 'eq'));
    expect(wiredOrder(addPedal(c, 'chorus')).filter((s) => s === 'chorus')).toHaveLength(1);
  });
  it('the offered list follows the rig order, so the options are stable', () => {
    const c = removePedal(removePedal(defaultChain(), 'reverb'), 'comp');
    expect(availablePedals(c)).toEqual(['comp', 'reverb']);
  });
});

describe('pedal chain: saving and restoring', () => {
  it('a reordered and trimmed chain survives sanitising unchanged', () => {
    const c = removePedal(movePedal(defaultChain(), 'delay', -1), 'fuzz');
    const rig = sanitizeRig({ ...DEFAULT_RIG, chain: c });
    expect(rig.chain).toEqual(c);
    expect(sanitizeRig(JSON.parse(JSON.stringify(rig))).chain).toEqual(c);
  });
  it('removing a pedal keeps its settings; putting it back brings them back', () => {
    const tuned = { ...DEFAULT_RIG, pedals: { ...DEFAULT_RIG.pedals, fuzz: { on: true, knobs: { fuzz: 88, tone: 20, level: 30 } } } };
    const removed = sanitizeRig({ ...tuned, chain: removePedal(tuned.chain, 'fuzz') });
    expect(removed.pedals.fuzz).toEqual({ on: true, knobs: { fuzz: 88, tone: 20, level: 30 } });
    const back = sanitizeRig({ ...removed, chain: addPedal(removed.chain, 'fuzz') });
    expect(back.pedals.fuzz).toEqual({ on: true, knobs: { fuzz: 88, tone: 20, level: 30 } });
    expect(wiredOrder(back.chain)).toContain('fuzz');
  });
  it('a session saved before the chain existed gets the factory chain, with its pedals untouched', () => {
    const old = { amp: { knobs: { gain: 70 } }, pedals: { delay: { on: true, knobs: { time: 70, feedback: 20, mix: 40 } } } };
    const rig = sanitizeRig(old);
    expect(rig.chain).toEqual(defaultChain());
    expect(rig.pedals.delay).toEqual({ on: true, knobs: { time: 70, feedback: 20, mix: 40 } });
    expect(sanitizeRig(null).chain).toEqual(defaultChain());
  });
  it('a broken saved chain is repaired: unknown ids, repeats and misplaced pedals are dropped, the rest keeps its order', () => {
    expect(sanitizeChain({ pre: ['drive', 'nope', 'drive', 'eq', 'comp'], post: ['reverb', 'comp', 'delay'] })).toEqual({ pre: ['drive', 'comp'], post: ['reverb', 'delay'] });
    expect(sanitizeChain({ pre: 'comp', post: null })).toEqual({ pre: [], post: [] });
    expect(sanitizeChain('chain')).toEqual(defaultChain());
    expect(sanitizeChain({})).toEqual({ pre: [], post: [] });
  });
  it('an empty chain is a valid chain: every pedal removed, the signal goes straight through', () => {
    let c = defaultChain();
    for (const id of PEDALS) c = removePedal(c, id);
    expect(wiredOrder(c)).toEqual(['amp', 'cab']);
    expect(availablePedals(c)).toHaveLength(PEDALS.length);
  });
});

describe('pedal chain: the factory sounds still hold', () => {
  it('every starting sound carries the factory chain and survives sanitising unchanged', () => {
    for (const preset of RIG_PRESETS) {
      expect(preset.rig.chain, preset.id).toEqual(defaultChain());
      expect(sanitizeRig(preset.rig), preset.id).toEqual(preset.rig);
    }
  });
  it('a reordered rig no longer matches its starting sound, and a restored one does again', async () => {
    const { matchingRigPreset } = await import('./rig');
    const rock = RIG_PRESETS.find((p) => p.id === 'rock');
    if (!rock) throw new Error('no rock preset');
    expect(matchingRigPreset({ ...rock.rig, chain: movePedal(rock.rig.chain, 'drive', -1) })).toBeNull();
    expect(matchingRigPreset({ ...rock.rig, chain: movePedal(movePedal(rock.rig.chain, 'drive', -1), 'drive', 1) })?.id).toBe('rock');
  });
});

