import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { ResolvedAvatar } from "@/lib/types";
import type { PmeUxCues } from "@/lib/conversation/types";

/**
 * Build PME-compatible UX cues from existing session clinical surface.
 * Does NOT import or mutate PME / TRE / ACE — read-only adapter for HFTE UX.
 */
export function pmeUxCuesFromSession(params: {
  avatar: ResolvedAvatar;
  clinicalSnapshot?: CaseInstanceSnapshot | null;
  /** Optional alliance / confidence proxies from client session context. */
  alliance?: number | null;
  confidence?: number | null;
  hesitation?: number | null;
  emotion?: string | null;
}): PmeUxCues {
  const snap = params.clinicalSnapshot;
  const slug =
    snap?.primary_diagnosis?.slug ??
    snap?.clinical_core?.disorder ??
    params.avatar.disorder ??
    null;

  const behavior = speechBehaviorForDisorder(slug ?? "generic");
  const severity = snap?.clinical_core?.severity ?? null;
  const category = behavior.category;

  // Severe psychosis / active risk presentations: minimize theatrical vocalization.
  const risk = snap?.clinical_core?.risk_profile;
  const highRisk =
    risk?.suicidal_ideation === "active_with_plan" ||
    risk?.harm_to_others === true;

  const permitsVocalization = !highRisk;

  return {
    diagnosisSlug: slug,
    disorderCategory: category,
    severity,
    pace: behavior.pace,
    energy: behavior.energy,
    alliance: params.alliance ?? null,
    confidence: params.confidence ?? null,
    hesitation:
      params.hesitation ??
      (behavior.pace === "slow" ? 0.55 : behavior.pace === "pressured" ? 0.2 : 0.35),
    emotion: params.emotion ?? null,
    permitsVocalization,
  };
}
