import { createHash } from "crypto";
import { encryptText } from "@/lib/cqi/crypto";
import { buildFingerprint, contentHash } from "@/lib/cqi/fingerprint";
import {
  EOI_OPPORTUNITY_TYPES,
  type EoiSubmission,
} from "@/lib/eoi/types";

export type EoiValidation =
  | { ok: true; submission: EoiSubmission }
  | { ok: false; error: string };

export function validateEoiSubmission(raw: unknown): EoiValidation {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const body = raw as Partial<EoiSubmission>;
  if (!body.session_id) return { ok: false, error: "session_id required" };
  if (
    !body.opportunity_type ||
    !EOI_OPPORTUNITY_TYPES.includes(body.opportunity_type)
  ) {
    return { ok: false, error: "valid opportunity_type required" };
  }
  const impact = Number(body.educational_impact ?? 3);
  if (!Number.isFinite(impact) || impact < 1 || impact > 5) {
    return { ok: false, error: "educational_impact must be 1–5" };
  }
  const idea = (body.idea_text ?? "").trim();
  if (idea.length < 12) {
    return {
      ok: false,
      error: "idea_text must describe the teaching improvement (min 12 chars)",
    };
  }
  const extended = body as Partial<EoiSubmission> & {
    competency_tags?: string[];
  };
  const competencies = Array.isArray(extended.competencies)
    ? extended.competencies
    : Array.isArray(extended.competency_tags)
      ? extended.competency_tags
      : [];
  return {
    ok: true,
    submission: {
      session_id: body.session_id,
      anonymous: Boolean(body.anonymous),
      opportunity_type: body.opportunity_type,
      educational_impact: Math.round(impact),
      target_learners: Array.isArray(body.target_learners)
        ? body.target_learners
        : [],
      competencies,
      idea_text: idea,
      design_sketch: body.design_sketch,
      expected_learning_experience: body.expected_learning_experience,
      annotations: Array.isArray(body.annotations) ? body.annotations : [],
      context:
        body.context && typeof body.context === "object" ? body.context : {},
      evidence: body.evidence ?? {},
    },
  };
}

export function buildEoiRpcPayload(
  submission: EoiSubmission,
  enriched: {
    case_instance_id?: string | null;
    avatar_id?: string | null;
    transcript_window?: unknown[];
    platform_version?: string | null;
    release_version?: string | null;
    prompt_version?: string | null;
    language?: string | null;
    disorder_slug?: string | null;
    difficulty?: string | null;
    context: Record<string, unknown>;
  },
): Record<string, unknown> {
  const enc = encryptText(submission.idea_text);
  const fingerprint = buildFingerprint({
    category: "educational_value",
    severity: submission.educational_impact >= 4 ? "high" : "medium",
    free_text: `${submission.opportunity_type} ${submission.idea_text}`,
    disorder_slug: enriched.disorder_slug,
    language: enriched.language,
  });
  // Salt fingerprint so EOI never collides with CQI defect clusters
  const eoiFp = createHash("sha256")
    .update(`eoi::${fingerprint}::${submission.opportunity_type}`)
    .digest("hex")
    .slice(0, 32);

  const payload = {
    anonymous: Boolean(submission.anonymous),
    session_id: submission.session_id,
    case_instance_id: enriched.case_instance_id ?? null,
    avatar_id: enriched.avatar_id ?? null,
    context: {
      ...enriched.context,
      kind: "educational_opportunity",
      is_defect: false,
    },
    opportunity_type: submission.opportunity_type,
    educational_impact: submission.educational_impact,
    target_learners: submission.target_learners,
    competencies: submission.competencies,
    idea_text: enc.free_text,
    idea_text_enc: enc.free_text_enc,
    design_sketch: submission.design_sketch ?? null,
    expected_learning_experience:
      submission.expected_learning_experience ?? null,
    annotations: submission.annotations ?? [],
    transcript_window: enriched.transcript_window ?? [],
    evidence: {
      ...(submission.evidence ?? {}),
      is_defect: false,
    },
    fingerprint: eoiFp,
    platform_version: enriched.platform_version,
    release_version: enriched.release_version,
    prompt_version: enriched.prompt_version,
    language: enriched.language,
    disorder_slug: enriched.disorder_slug,
    difficulty: enriched.difficulty,
  };
  return { ...payload, content_hash: contentHash(payload) };
}
