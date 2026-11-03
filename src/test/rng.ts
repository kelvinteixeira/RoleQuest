import type { Rng } from "@/features/dice/dice-engine";

/**
 * Scripted dice for tests: each call returns the next value. Fails loudly
 * when a value does not fit the die or the script runs out.
 */
export function scriptedRng(...values: number[]): Rng & { remaining: () => number } {
  const queue = [...values];
  const rng = ((sides: number) => {
    const next = queue.shift();
    if (next === undefined) throw new Error(`Scripted dice ran out (asked for a d${sides}).`);
    if (next < 1 || next > sides) throw new Error(`Scripted value ${next} does not fit a d${sides}.`);
    return next;
  }) as Rng & { remaining: () => number };
  rng.remaining = () => queue.length;
  return rng;
}
