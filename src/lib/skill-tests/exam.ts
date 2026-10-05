/**
 * Skill tests run like a real exam: the trainee meets the patient knowing
 * nothing about the case and has to find it out. Practice scenarios are the
 * opposite: the trainee picks the disorder they want to train on.
 *
 * Everything a trainee can read is kept free of the case:
 *   - their assignment comes through `my_skill_tests()`, which returns the
 *     supervisor's spec only sealed (`sealed_spec`);
 *   - a test session row stores the full case sealed (`sealed_case`) and a
 *     `clinical_snapshot` holding nothing but the visit context and locale;
 *   - no case_instances row is written for a test session;
 *   - the session screen receives a patient stripped of prompts and labels.
 * The server opens the sealed values (see ./seal.ts) to run the Patient Agent
 * and the assessment exactly as before.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type {
  ResolvedAvatar,
  SkillTestAssignment,
  TherapyCourseSessionContext,
} from "@/lib/types";
import { openSkillTestValue, sealSkillTestValue } from "./seal";

/** The supervisor's design, sealed into `skill_test_assignments.sealed_spec`. */
export type SkillTestSpec = Pick<
  SkillTestAssignment,
  "disorder_slug" | "comorbidity_slugs" | "difficulty" | "severity"
>;

export const SKILL_TEST_SEAL_UNAVAILABLE =
  "Skill tests are not available yet: the server needs REPORT_WRITE_KEY or SUPABASE_SERVICE_ROLE_KEY.";

export function sealSkillTestSpec(
  assignmentId: string,
  spec: SkillTestSpec,
): string | null {
  return sealSkillTestValue("spec", assignmentId, {
    disorder_slug: spec.disorder_slug,
    comorbidity_slugs: spec.comorbidity_slugs,
    difficulty: spec.difficulty,
    severity: spec.severity,
  } satisfies SkillTestSpec);
}

export function openSkillTestSpec(
  assignmentId: string,
  sealed: string | null | undefined,
): SkillTestSpec | null {
  const spec = openSkillTestValue<SkillTestSpec>("spec", assignmentId, sealed);
  if (!spec || typeof spec.disorder_slug !== "string") return null;
  return spec;
}

/** Seal the case a test pins on its first session (visit context removed). */
export function sealSkillTestCase(
  assignmentId: string,
  snapshot: CaseInstanceSnapshot,
): string | null {
  const caseOnly: Partial<CaseInstanceSnapshot> = { ...snapshot };
  delete caseOnly.therapy_course;
  return sealSkillTestValue("case", assignmentId, caseOnly);
}

export function openSkillTestCase(
  assignmentId: string,
  sealed: string | null | undefined,
): CaseInstanceSnapshot | null {
  const snap = openSkillTestValue<CaseInstanceSnapshot>(
    "case",
    assignmentId,
    sealed,
  );
  if (!snap || typeof snap !== "object" || !snap.primary_diagnosis) return null;
  return snap;
}

/**
 * What a test session row stores in `clinical_snapshot`: the visit context
 * and locale only. The database rejects any other key on a test session.
 */
export function traineeVisibleSnapshot(opts: {
  locale: string;
  therapyCourse: TherapyCourseSessionContext;
}): CaseInstanceSnapshot {
  return {
    locale: opts.locale,
    therapy_course: opts.therapyCourse,
  } as unknown as CaseInstanceSnapshot;
}

type SessionWithCase = {
  skill_test_assignment_id?: string | null;
  sealed_case?: string | null;
  clinical_snapshot?: CaseInstanceSnapshot | null;
};

/**
 * Server-side view of a session with the full case. Practice sessions pass
 * through unchanged. A test session whose sealed case cannot be opened is an
 * error, never a silent run without the case.
 */
export function withSkillTestCase<T extends SessionWithCase>(
  session: T,
): { ok: true; session: T } | { ok: false } {
  if (!session.skill_test_assignment_id) return { ok: true, session };
  const full = openSkillTestCase(
    session.skill_test_assignment_id,
    session.sealed_case,
  );
  if (!full) return { ok: false };
  return {
    ok: true,
    session: {
      ...session,
      clinical_snapshot: {
        ...full,
        therapy_course: session.clinical_snapshot?.therapy_course ?? null,
      },
    },
  };
}

/** Voice pace and energy for the patient, without naming the disorder. */
export function examSpeechHint(snapshot: CaseInstanceSnapshot | null | undefined) {
  const profile = speechBehaviorForDisorder(
    snapshot?.primary_diagnosis?.slug ?? null,
  );
  return { pace: profile.pace, energy: profile.energy };
}

/**
 * The patient as the trainee's browser sees it during a test: name, portrait,
 * language and voice. Prompts, rubric, clinical core, disorder label and
 * locale case notes stay on the server.
 */
export function traineeSafeAvatar(avatar: ResolvedAvatar): ResolvedAvatar {
  return {
    id: avatar.id,
    schema_version: avatar.schema_version,
    locale: avatar.locale,
    language: avatar.language,
    direction: avatar.direction,
    name: avatar.name,
    disorder: "",
    age: avatar.age,
    gender: avatar.gender,
    portrait_url: avatar.portrait_url,
    persona_prompt: "",
    system_prompt: "",
    ideal_guidelines: {},
    rubric: [],
    dialect: avatar.dialect,
    voice_profile_id: avatar.voice_profile_id ?? null,
    voice_profile: avatar.voice_profile ?? null,
    voice_id: avatar.voice_id,
    voice_id_ar: avatar.voice_id_ar ?? null,
    stt_lang: avatar.stt_lang,
    tts_lang: avatar.tts_lang,
    tts_rate: avatar.tts_rate,
    fallback_replies: [],
    personality: undefined,
    human_personality: null,
    clinical_core: null,
  };
}

/** The test session row as the trainee's browser sees it. */
export function traineeSafeSession<T extends SessionWithCase>(session: T): T {
  return { ...session, sealed_case: null };
}
