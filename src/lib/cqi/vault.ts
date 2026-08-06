import { encryptText } from "@/lib/cqi/crypto";
import { buildFingerprint, contentHash } from "@/lib/cqi/fingerprint";
import {
  CQI_CATEGORIES,
  CQI_CONFIDENCES,
  CQI_SEVERITIES,
  type CqiFlagSubmission,
  type CqiQualityScores,
} from "@/lib/cqi/types";

function clampScore(n: unknown): number | undefined {
  if (typeof n !== "number" || Number.isNaN(n)) return undefined;
  return Math.max(1, Math.min(10, Math.round(n)));
}

export function normalizeScores(
  scores?: CqiQualityScores | null,
): CqiQualityScores {
  if (!scores) return {};
  return {
    clinical_realism: clampScore(scores.clinical_realism),
    conversation_realism: clampScore(scores.conversation_realism),
    educational_usefulness: clampScore(scores.educational_usefulness),
    voice_realism: clampScore(scores.voice_realism),
    assessment_quality: clampScore(scores.assessment_quality),
    overall_confidence: clampScore(scores.overall_confidence),
  };
}

export type VaultValidation =
  | { ok: true; submission: CqiFlagSubmission }
  | { ok: false; error: string };

export function validateFlagSubmission(raw: unknown): VaultValidation {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const body = raw as Partial<CqiFlagSubmission>;
  if (!body.session_id || typeof body.session_id !== "string") {
    return { ok: false, error: "session_id required" };
  }
  if (!body.category || !CQI_CATEGORIES.includes(body.category)) {
    return { ok: false, error: "valid category required" };
  }
  if (!body.severity || !CQI_SEVERITIES.includes(body.severity)) {
    return { ok: false, error: "valid severity required" };
  }
  if (!body.confidence || !CQI_CONFIDENCES.includes(body.confidence)) {
    return { ok: false, error: "valid confidence required" };
  }
  const free = (body.free_text ?? "").trim();
  if (free.length < 8) {
    return { ok: false, error: "free_text must be at least 8 characters" };
  }
  if (free.length > 8000) {
    return { ok: false, error: "free_text too long" };
  }
  if (!body.context || typeof body.context !== "object") {
    return { ok: false, error: "context required" };
  }
  return {
    ok: true,
    submission: {
      ...body,
      session_id: body.session_id,
      category: body.category,
      severity: body.severity,
      confidence: body.confidence,
      free_text: free,
      scores: normalizeScores(body.scores),
      annotations: Array.isArray(body.annotations) ? body.annotations : [],
      context: body.context,
    } as CqiFlagSubmission,
  };
}

/** Build RPC payload for cqi_submit_flag — never loses fields. */
export function buildVaultRpcPayload(
  submission: CqiFlagSubmission,
  enrichedContext: CqiFlagSubmission["context"],
): Record<string, unknown> {
  const enc = encryptText(submission.free_text);
  const fingerprint = buildFingerprint({
    category: submission.category,
    severity: submission.severity,
    free_text: submission.free_text,
    disorder_slug: enrichedContext.disorder_slug,
    language: enrichedContext.language,
  });
  const payload = {
    anonymous: Boolean(submission.anonymous),
    session_id: submission.session_id,
    assessment_id: enrichedContext.assessment_id,
    case_instance_id: enrichedContext.case_instance_id,
    avatar_id: enrichedContext.avatar_id,
    context: enrichedContext,
    category: submission.category,
    severity: submission.severity,
    confidence: submission.confidence,
    free_text: enc.free_text,
    free_text_enc: enc.free_text_enc,
    suggested_improvement: submission.suggested_improvement ?? null,
    expected_behaviour: submission.expected_behaviour ?? null,
    reduces_educational_quality:
      submission.reduces_educational_quality ?? null,
    usable_in_residency: submission.usable_in_residency ?? null,
    scores: normalizeScores(submission.scores),
    would_recommend: submission.would_recommend ?? null,
    annotations: submission.annotations ?? [],
    transcript_window: enrichedContext.transcript_window,
    fingerprint,
    platform_version: enrichedContext.platform_version,
    release_version: enrichedContext.release_version,
    prompt_version: enrichedContext.prompt_version,
    pme_version: enrichedContext.pme_version,
    tre_version: enrichedContext.tre_version,
    ai_model: enrichedContext.llm_model,
    language: enrichedContext.language,
    disorder_slug: enrichedContext.disorder_slug,
    evidence: {
      ...(submission.evidence ?? {}),
      attachment_ids: submission.attachment_ids ?? [],
      voice: enrichedContext.voice,
    },
  };
  return {
    ...payload,
    content_hash: contentHash(payload),
  };
}
