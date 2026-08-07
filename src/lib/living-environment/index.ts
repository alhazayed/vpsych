/**
 * Mission 6 — Living Environment Engine barrel.
 *
 * Patient exists inside a living world (home, family, work, friends,
 * finances, medical history, daily routine, social media, education).
 * Worlds are minted once per CaseInstance and stay consistent forever.
 */

export * from "./types";
export * from "./catalog";
export * from "./rng";
export * from "./generator";
export * from "./consistency";
export * from "./prompt";
export * from "./persist";
export {
  clearLivingWorldMemoryForTests,
  getLivingWorldMemory,
  livingWorldMemoryCount,
  putLivingWorldMemory,
} from "./memory-store";
