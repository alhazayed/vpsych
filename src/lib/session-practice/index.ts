/**
 * Session Practice Engine — therapy best practices observed in a session
 * (intake, consent, structure, safety planning, measures), an indicative
 * CTS-R view, and in-character PHQ-9 / GAD-7 self-report targets.
 *
 * Observes the therapist only, except `formatSelfReportForPrompt`, which the
 * avatar resolver injects as a patient fidelity block. Not validated.
 * See docs/SESSION_PRACTICE_ENGINE.md.
 */

export * from "@/lib/session-practice/types";
export { PRACTICE_PATTERNS } from "@/lib/session-practice/patterns";
export {
  SESSION_PRACTICE_LIMITATIONS,
  caseHasRisk,
  evaluateSessionPractice,
  windowRange,
} from "@/lib/session-practice/checklist";
export {
  CTSR_ITEM_ORDER,
  CTSR_LIMITATIONS,
  buildIndicativeCtsr,
} from "@/lib/session-practice/cts-r";
export {
  FREQUENCY_LABELS,
  GAD7_ITEMS,
  PHQ9_ITEMS,
  baselineCourseSelfReport,
  deriveSelfReportProfile,
  profileFromCourseSelfReport,
  formatSelfReportForPrompt,
  severityBand,
} from "@/lib/session-practice/self-report";
export {
  COURSE_CHANGE,
  COURSE_SELF_REPORT_LIMITATION,
  applyCourseChange,
  buildCourseCarryOver,
  courseChangeFactor,
  extractHomework,
  loadPreviousCourseSession,
  sessionStructureQuality,
  type PreviousCourseSession,
} from "@/lib/session-practice/course";
export {
  MIN_TURNS_FOR_EVIDENCE,
  RUBRIC_PRACTICE_GROUPS,
  STRONG_OBSERVED,
  STRONG_TURNS,
  buildScoreEvidence,
  reportAssessmentMode,
  type EvidenceLevel,
  type EvidenceReason,
  type ScoreEvidence,
} from "@/lib/session-practice/evidence";
export {
  ALLIANCE_RATING_LIMITATIONS,
  ALLIANCE_RATING_VERSION,
  RUPTURE_TRUST_DROP,
  UNREPAIRED_RUPTURE_PENALTY,
  buildAllianceRating,
  findRuptures,
  sessionTraces,
  type AllianceRating,
  type AllianceRupture,
} from "@/lib/session-practice/alliance-rating";
export {
  CRISIS_HANDLING_LIMITATIONS,
  CRISIS_HANDLING_VERSION,
  CRISIS_STEP_ORDER,
  STAYED_ENGAGED_TURNS,
  evaluateCrisisHandling,
  findDisclosure,
  type CrisisHandling,
  type CrisisStep,
  type CrisisStepId,
} from "@/lib/session-practice/crisis";
export {
  CRISIS_ESCALATION_MARKER,
  ESCALATION_REPLY,
  canEscalate,
  crisisEscalationPhase,
  formatCrisisEscalationBlock,
  injectCrisisEscalationIntoSystemPrompt,
  type CrisisEscalationPhase,
} from "@/lib/session-practice/crisis-escalation";
