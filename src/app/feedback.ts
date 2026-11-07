/**
 * Live feedback on an exercise (D-37): what the player was asked to play
 * when the sound now detected left the guitar. A detection arrives late by
 * the measured latency (interface, browser, analysis frame), so the note to
 * compare with is the one sounding that long ago. Pure.
 */
export interface Expected {
  /** Milliseconds, on the same clock as the lookup. */
  readonly time: number;
  /** Null while no note was asked for. */
  readonly midi: number | null;
}

export type Judgement = 'giusto' | 'ottava' | 'diverso';

/** The expected note at a moment: the last change at or before it. */
export function expectedAt(history: readonly Expected[], time: number): number | null {
  let found: number | null = null;
  for (const e of history) {
    if (e.time <= time) found = e.midi;
    else break;
  }
  return found;
}

export function judge(detected: number, expected: number): Judgement {
  if (detected === expected) return 'giusto';
  return detected % 12 === expected % 12 ? 'ottava' : 'diverso';
}

/** Keep the history short: two seconds is more than any latency worth compensating. */
export function trimHistory(history: readonly Expected[], now: number, keepMs = 2000): Expected[] {
  const recent = history.filter((e) => now - e.time <= keepMs);
  // Keep the last change before the window, so a lookup at its start still has an answer.
  const before = history.filter((e) => now - e.time > keepMs).at(-1);
  return before ? [before, ...recent] : recent;
}
