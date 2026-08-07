/** Seeded PRNG (mulberry32) — kept local to avoid case-engine import cycles. */

export function createRng(seed: string | number): () => number {
  let h =
    typeof seed === "number"
      ? seed >>> 0
      : Array.from(String(seed)).reduce(
          (acc, ch) => (Math.imul(31, acc) + ch.charCodeAt(0)) >>> 0,
          0,
        );
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
