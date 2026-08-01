/**
 * Seeded, serializable PRNG for the game engine.
 *
 * Algorithm: xoshiro128** — a 32-bit state variant that is:
 *   - Fast, small, and passes modern statistical tests.
 *   - Fully serializable (four uint32 words).
 *   - No dependency on Math.random or any browser/Node global.
 *
 * All public helpers are pure functions that accept and return RngState so
 * callers can sequence calls without side effects.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Serializable PRNG state: four unsigned 32-bit integers.
 * Stored as a tuple so it serializes naturally to/from JSON as a 4-element
 * number array.
 */
export type RngState = [number, number, number, number];

// ── Seed initialisation ───────────────────────────────────────────────────────

/**
 * Deterministically convert an arbitrary string seed into an initial
 * xoshiro128** state via the splitmix32 avalanche algorithm.
 *
 * The same seed always produces the same RngState.
 */
export function seedToState(seed: string): RngState {
  // Hash the seed string into a 32-bit integer using a djb2-style accumulator.
  let h = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9);
    h ^= h >>> 16;
  }

  // Use splitmix32 to generate four independent state words from h.
  function splitmix(v: number): [number, number] {
    v = (v + 0x9e3779b9) | 0;
    v = Math.imul(v ^ (v >>> 16), 0x85ebca6b);
    v = Math.imul(v ^ (v >>> 13), 0xc2b2ae35);
    v ^= v >>> 16;
    return [v >>> 0, (v + 0x9e3779b9) >>> 0];
  }

  const [s0, n1] = splitmix(h);
  const [s1, n2] = splitmix(n1);
  const [s2, n3] = splitmix(n2);
  const [s3] = splitmix(n3);

  // Guard against all-zero state (degenerate for xoshiro).
  if ((s0 | s1 | s2 | s3) === 0) {
    return [0xdeadbeef, 0xcafebabe, 0x12345678, 0x9abcdef0];
  }

  return [s0, s1, s2, s3];
}

// ── Core generator ────────────────────────────────────────────────────────────

/**
 * Advance the xoshiro128** state by one step and return the new state plus the
 * raw uint32 output.
 */
function xoshiro128ss(state: RngState): [RngState, number] {
  const [s0, s1, s2, s3] = state;

  // Result is s1 * 5, rotated left 7, multiplied by 9.
  const result =
    Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;

  const t = (s1 << 9) >>> 0;

  let ns0 = s0;
  let ns1 = s1;
  let ns2 = (s2 ^ s0) >>> 0;
  let ns3 = (s3 ^ s1) >>> 0;
  ns1 = (ns1 ^ ns2) >>> 0;
  ns0 = (ns0 ^ ns3) >>> 0;
  ns2 = (ns2 ^ t) >>> 0;
  ns3 = rotl(ns3, 11);

  return [[ns0, ns1, ns2, ns3], result];
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Return a float in [0, 1) and the next RNG state.
 */
export function nextFloat(state: RngState): [RngState, number] {
  const [next, raw] = xoshiro128ss(state);
  // Map uint32 to [0, 1) by dividing by 2^32.
  return [next, raw / 4294967296];
}

/**
 * Return an integer in [min, max] (inclusive) and the next RNG state.
 * Requires min <= max.
 */
export function nextInt(
  state: RngState,
  min: number,
  max: number,
): [RngState, number] {
  if (min > max) throw new RangeError(`nextInt: min (${min}) > max (${max})`);
  const [next, f] = nextFloat(state);
  return [next, min + Math.floor(f * (max - min + 1))];
}

/**
 * Weighted random choice: pick one item from `items` according to `weights`.
 * Weights are non-negative numbers; they need not sum to 1.
 * Returns the chosen item and the next RNG state.
 */
export function weightedChoice<T>(
  state: RngState,
  items: ReadonlyArray<T>,
  weights: ReadonlyArray<number>,
): [RngState, T] {
  if (items.length === 0) throw new RangeError("weightedChoice: empty items");
  if (items.length !== weights.length) {
    throw new RangeError("weightedChoice: items and weights length mismatch");
  }

  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new RangeError("weightedChoice: total weight <= 0");

  const [next, f] = nextFloat(state);
  let threshold = f * total;

  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i]!;
    if (threshold < 0) {
      return [next, items[i]!];
    }
  }

  // Fallback for floating-point edge case — return last item.
  return [next, items[items.length - 1]!];
}

/**
 * Fisher-Yates shuffle — returns a new shuffled array and the next RNG state.
 */
export function shuffle<T>(
  state: RngState,
  items: ReadonlyArray<T>,
): [RngState, T[]] {
  const arr = [...items];
  let s = state;

  for (let i = arr.length - 1; i > 0; i--) {
    let j: number;
    [s, j] = nextInt(s, 0, i);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }

  return [s, arr];
}

/**
 * Roll a d-sided die (1..d) and return result + next state.
 */
export function roll(state: RngState, sides: number): [RngState, number] {
  if (sides < 1) throw new RangeError(`roll: sides must be >= 1, got ${sides}`);
  return nextInt(state, 1, sides);
}
