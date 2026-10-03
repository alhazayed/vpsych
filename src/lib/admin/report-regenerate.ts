/**
 * Admin re-assessment of heuristic-fallback session reports.
 *
 * When the AI examiner is unavailable at session end (no key, quota exhausted,
 * provider outage) `assessSession` returns a keyword heuristic and the end
 * route persists it as the session's one report. Without this path that
 * placeholder is permanent. Here an admin can re-run the *same* canonical
 * `assessSession` pipeline once the provider is back.
 *
 * Invariants:
 * - Only reports whose provenance says `heuristic_fallback` may be replaced.
 *   An LLM-examiner report is never overwritten (insert-once semantics hold
 *   for real assessments).
 * - If the re-run still falls back, nothing is written.
 * - The update is a compare-and-set on the previous narrative, so two
 *   concurrent regenerations cannot both write.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { assessSession } from "@/lib/ai/assessment";
import { resolveAvatar } from "@/lib/avatars/resolve";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

type ScoresLike = {
  scientific_provenance?: { assessment_mode?: unknown; ai_source?: unknown } | null;
  educational_reliability?: { assessment_mode?: unknown } | null;
} | null | undefined;

/** True when a persisted report's scores were produced by the heuristic fallback. */
export function isHeuristicReportScores(scores: unknown): boolean {
  if (!scores || typeof scores !== "object") return false;
  const s = scores as ScoresLike;
  const prov = s?.scientific_provenance;
  if (prov && typeof prov === "object") {
    if (prov.assessment_mode === "heuristic_fallback") return true;
    if (prov.ai_source === "persona_fallback") return true;
  }
  return s?.educational_reliability?.assessment_mode === "heuristic_fallback";
}

export type RegenerateResult =
  | {
      ok: true;
      reportId: string;
      aiSource: string;
      aiModel: string | null;
      overall: number;
    }
  | {
      ok: false;
      status: 404 | 409 | 500 | 503;
      code:
        | "report_not_found"
        | "not_heuristic"
        | "session_not_found"
        | "ai_unavailable"
        | "concurrent_update"
        | "db_error";
      error: string;
      errorKind?: string | null;
    };

type Deps = { assess?: typeof assessSession };

export async function regenerateHeuristicReport(
  supabase: SupabaseClient,
  sessionId: string,
  deps: Deps = {},
): Promise<RegenerateResult> {
  const assess = deps.assess ?? assessSession;

  const { data: report, error: reportErr } = await supabase
    .from("session_reports")
    .select("id, scores, narrative, language")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (reportErr) {
    console.warn("[report-regenerate] report read:", reportErr.message);
    return { ok: false, status: 500, code: "db_error", error: "Could not load report" };
  }
  if (!report) {
    return { ok: false, status: 404, code: "report_not_found", error: "Report not found" };
  }
  if (!isHeuristicReportScores(report.scores)) {
    return {
      ok: false,
      status: 409,
      code: "not_heuristic",
      error: "Only fallback reports can be regenerated",
    };
  }

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("*, avatars(*, voice_profile:voice_profiles(*))")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr) {
    console.warn("[report-regenerate] session read:", sessionErr.message);
    return { ok: false, status: 500, code: "db_error", error: "Could not load session" };
  }
  if (!session || !(session as { avatars?: unknown }).avatars) {
    return { ok: false, status: 404, code: "session_not_found", error: "Session not found" };
  }
  const typed = session as TherapySession & { avatars: Avatar };

  const { data: messages, error: msgErr } = await supabase
    .from("session_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (msgErr) {
    console.warn("[report-regenerate] messages read:", msgErr.message);
    return { ok: false, status: 500, code: "db_error", error: "Could not load transcript" };
  }

  const endedAt = typed.ended_at ?? new Date().toISOString();
  const durationSec = Math.max(
    0,
    Math.floor(
      (new Date(endedAt).getTime() - new Date(typed.started_at).getTime()) / 1000,
    ),
  );
  const resolved = resolveAvatar(typed.avatars, typed.language, {
    caseSnapshot: typed.clinical_snapshot,
  });
  // Same language precedence as the end route: report row → session → avatar.
  const language =
    (report.language as string | null) ?? typed.language ?? resolved.locale;

  const assessment = await assess({
    avatar: resolved,
    messages: (messages ?? []) as Pick<
      SessionMessage,
      "role" | "content" | "created_at"
    >[],
    durationSec,
    language,
  });

  console.info("[report-regenerate] assessment", {
    sessionId,
    aiSource: assessment.aiSource,
    aiModel: assessment.model ?? null,
    errorKind: assessment.errorKind ?? null,
  });

  if (assessment.aiSource === "persona_fallback") {
    return {
      ok: false,
      status: 503,
      code: "ai_unavailable",
      error: "AI examiner is still unavailable; the report was not changed",
      errorKind: assessment.errorKind ?? null,
    };
  }

  const { data: updated, error: updateErr } = await supabase
    .from("session_reports")
    .update({
      scores: assessment.scores,
      narrative: assessment.narrative,
      excerpts: assessment.excerpts,
      language: assessment.language ?? resolved.locale,
    })
    .eq("id", report.id)
    // CAS: the heuristic narrative is replaced by the examiner's, so a second
    // concurrent regeneration matches zero rows instead of double-writing.
    .eq("narrative", report.narrative as string)
    .select("id")
    .maybeSingle();
  if (updateErr) {
    console.warn("[report-regenerate] update:", updateErr.message);
    return { ok: false, status: 500, code: "db_error", error: "Could not save report" };
  }
  if (!updated) {
    return {
      ok: false,
      status: 409,
      code: "concurrent_update",
      error: "Report changed while regenerating; reload and try again",
    };
  }

  return {
    ok: true,
    reportId: String(updated.id),
    aiSource: assessment.aiSource,
    aiModel: assessment.model ?? null,
    overall: assessment.scores.overall,
  };
}
