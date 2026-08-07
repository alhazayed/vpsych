/**
 * Deterministic FNV-1a style seed helpers — never Math.random.
 * Shared contract with therapy-room `deterministicJitter`.
 */

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Integer in [0, max] inclusive. */
export function seededInt(seed: string, max: number): number {
  if (max <= 0) return 0;
  return hashSeed(seed) % (max + 1);
}

/** Float in [0, 1). */
export function seededUnit(seed: string): number {
  return hashSeed(seed) / 0xffffffff;
}

/** Pick a stable index from a non-empty list. */
export function seededPick<T>(seed: string, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("seededPick: empty list");
  }
  return items[seededInt(seed, items.length - 1)]!;
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
