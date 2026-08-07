/**
 * Mission 4 — Long-Term Patient Memory engine barrel.
 *
 * Patients remember prior sessions, therapist mistakes, promises, medications,
 * relationships, life events, trauma, children, occupation, and future plans.
 * History is persisted — never regenerated.
 */

export * from "./types";
export * from "./store";
export * from "./extract";
export * from "./retrieve";
export * from "./summarize";
export * from "./compress";
export * from "./prompt";
export * from "./persist";
export * from "./session-hook";
export {
  clearPatientMemoryMemoryForTests,
  getMemoryStoreMemory,
  patientMemoryMemoryCount,
  putMemoryStoreMemory,
} from "./memory-store";
