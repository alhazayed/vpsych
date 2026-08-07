/**
 * Human Personality Engine — public barrel.
 * Import from `@/lib/personality-engine` only (not deep paths), matching
 * other engines. Does not import ACE/CGE (no cycle risk).
 */

export * from "./types";
export * from "./validation";
export * from "./catalog";
export * from "./defaults";
export * from "./resolve";
export * from "./format-for-prompt";
export {
  loadAvatarHumanPersonalityMap,
  saveHumanPersonalityProfile,
  type PersistPersonalityResult,
} from "./persist";
export {
  freezeHumanPersonalityForCase,
  type FreezePersonalityAvatar,
} from "./freeze";
