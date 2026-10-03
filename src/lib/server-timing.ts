/**
 * Minimal `Server-Timing` header builder (latency diagnosis).
 *
 * Durations only — never content, identifiers or provider detail. Browsers
 * show these in DevTools → Network → Timing → "Server Timing", which splits
 * a slow request into its server-side phases without any logging.
 */

let instanceWarm = false;

export type ServerTiming = {
  /** Close the current phase (time since the previous mark) under `name`. */
  mark: (name: string) => void;
  /** Header value, e.g. `auth;dur=84, stt;dur=912, instance;desc="cold"`. */
  header: () => string;
};

/** Phase names must be plain tokens (no spaces, quotes or commas). */
function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32) || "phase";
}

export function createServerTiming(now: () => number = () => performance.now()): ServerTiming {
  // First request served by this server instance → cold start.
  const cold = !instanceWarm;
  instanceWarm = true;
  const entries: Array<[string, number]> = [];
  let last = now();
  const startedAt = last;

  return {
    mark(name) {
      const t = now();
      entries.push([safeName(name), Math.max(0, t - last)]);
      last = t;
    },
    header() {
      const parts = entries.map(([n, d]) => `${n};dur=${d.toFixed(1)}`);
      parts.push(`total;dur=${Math.max(0, now() - startedAt).toFixed(1)}`);
      parts.push(`instance;desc="${cold ? "cold" : "warm"}"`);
      return parts.join(", ");
    },
  };
}

/** Test hook: forget that this process has served a request. */
export function resetServerTimingInstance(): void {
  instanceWarm = false;
}
