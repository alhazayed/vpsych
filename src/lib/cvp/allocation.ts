/**
 * Deterministic randomized avatar allocation for validation assignments.
 * Does not change how sessions generate cases — only which avatar is assigned.
 */

import { createHash } from "node:crypto";
import type { AllocationArm } from "./types";

export type AvatarCandidate = {
  id: string;
  disorder?: string | null;
  available_locales?: string[] | null;
};

export type AllocationPlanItem = {
  avatar_id: string;
  allocation_arm: AllocationArm;
  allocation_seed: string;
  sequence_index: number;
};

function hashSeed(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

/** Mulberry32 PRNG from hex seed. */
function prng(seedHex: string): () => number {
  let t = Number.parseInt(seedHex.slice(0, 8), 16) >>> 0;
  if (!Number.isFinite(t) || t === 0) t = 0x9e3779b9;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Allocate `count` avatar assignments with optional arm mix.
 * Default: mostly standard, one blind_challenge if count≥2, one calibration if count≥3.
 */
export function planRandomizedAllocations(input: {
  studyId: string;
  enrollmentId: string;
  avatars: AvatarCandidate[];
  count: number;
  localePrefer?: string | null;
  arms?: AllocationArm[];
}): AllocationPlanItem[] {
  if (input.avatars.length === 0 || input.count <= 0) return [];

  const seed = hashSeed(input.studyId, input.enrollmentId, "alloc-v1");
  const rand = prng(seed);

  let pool = [...input.avatars];
  if (input.localePrefer) {
    const pref = input.localePrefer.toLowerCase();
    const filtered = pool.filter((a) =>
      (a.available_locales ?? []).some((l) => l.toLowerCase().startsWith(pref.slice(0, 2))),
    );
    if (filtered.length > 0) pool = filtered;
  }

  const shuffled = shuffle(pool, rand);
  const picks: AvatarCandidate[] = [];
  for (let i = 0; i < input.count; i++) {
    picks.push(shuffled[i % shuffled.length]!);
  }

  const arms: AllocationArm[] =
    input.arms ??
    picks.map((_, i) => {
      if (i === 1 && input.count >= 2) return "blind_challenge";
      if (i === 2 && input.count >= 3) return "calibration";
      return "standard";
    });

  return picks.map((avatar, i) => ({
    avatar_id: avatar.id,
    allocation_arm: arms[i] ?? "standard",
    allocation_seed: hashSeed(seed, String(i), avatar.id),
    sequence_index: i,
  }));
}
