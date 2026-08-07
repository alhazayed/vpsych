/**
 * GA Institutional Feedback Framework.
 *
 * Collects structured product feedback by role persona.
 * NEVER modifies patient behaviour, cognition, memory, emotion, adaptation,
 * case engine, clinical intelligence, validation, supervisor skill models,
 * enterprise tenancy rules, or realtime presentation ownership.
 */

export {
  FEEDBACK_VERSION,
  FEEDBACK_OWNERSHIP_RULE,
} from "./versions";
export type {
  FeedbackRolePersona,
  FeedbackCategory,
  FeedbackSeverity,
  InstitutionalFeedback,
  FeedbackSubmitInput,
} from "./types";
export {
  FEEDBACK_ROLE_PERSONAS,
  FEEDBACK_CATEGORIES,
  FEEDBACK_SEVERITIES,
} from "./types";
export {
  submitFeedback,
  createFeedbackRecord,
  validateFeedbackInput,
  sanitizeFeedbackMetadata,
} from "./engine";
export {
  listFeedback,
  feedbackSummary,
  clearFeedbackStoreForTests,
  storeFeedback,
} from "./store";
