/**
 * Admin re-assessment of heuristic-fallback session reports, and admin
 * generation of a report for a finished session that never got one.
 *
 * When the AI examiner is unavailable at session end (no key, quota exhausted,
 * provider outage) `assessSession` returns a keyword heuristic and the end
 * route persists it as the session's one report. Without this path that
 * placeholder is permanent. Here an admin can re-run the *same* canonical
 * `assessSession` pipeline once the provider is back.
 *
 * A finished session can also end with no report at all (tab closed, expiry
 * cron, failed end request); `generateMissingReport` creates it through the
 * same signed `create_session_report` RPC the end route uses.
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
import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";
import { getReportWriteKey, signSessionReport } from "@/lib/report-sign";
import { createServiceClient } from "@/lib/supabase/admin";
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

type FailCode =
  | "report_not_found"
  | "report_exists"
  | "not_heuristic"
  | "session_not_found"
  | "session_active"
  | "admin_test"
  | "no_therapist_turns"
  | "ai_unavailable"
  | "concurrent_update"
  | "misconfigured"
  | "db_error";

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
      status: 404 | 409 | 422 | 500 | 503;
      code: FailCode;
      error: string;
      errorKind?: string | null;
    };

type Failure = Extract<RegenerateResult, { ok: false }>;

type Deps = {
  assess?: typeof assessSession;
  serviceClient?: () => SupabaseClient | null;
  reportWriteKey?: () => string | null;
};

type Assessed = {
  ok: true;
  session: TherapySession & { avatars: Avatar };
  assessment: Awaited<ReturnType<typeof assessSession>>;
  resolvedLocale: string;
};

function fail(
  status: Failure["status"],
  code: FailCode,
  error: string,
  errorKind?: string | null,
): Failure {
  return { ok: false, status, code, error, errorKind };
}

/** Loads the session + transcript and runs the canonical assessment. */
async function loadAndAssess(
  supabase: SupabaseClient,
  sessionId: string,
  reportLanguage: string | null,
  assess: typeof assessSession,
  opts: { requireTherapistTurn: boolean },
): Promise<Assessed | Failure> {
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("*, avatars(*, voice_profile:voice_profiles(*))")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr) {
    console.warn("[report-regenerate] session read:", sessionErr.message);
    return fail(500, "db_error", "Could not load session");
  }
  if (!session || !(session as { avatars?: unknown }).avatars) {
    return fail(404, "session_not_found", "Session not found");
  }
  const typed = session as TherapySession & { avatars: Avatar };
  if (typed.status === "active") {
    return fail(409, "session_active", "Session is still active");
  }
  if (isAdminTestSnapshot(typed.clinical_snapshot)) {
    return fail(409, "admin_test", "Admin test sessions have no report");
  }

  const { data: messages, error: msgErr } = await supabase
    .from("session_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (msgErr) {
    console.warn("[report-regenerate] messages read:", msgErr.message);
    return fail(500, "db_error", "Could not load transcript");
  }
  const rows = (messages ?? []) as Pick<
    SessionMessage,
    "role" | "content" | "created_at"
  >[];
  if (opts.requireTherapistTurn && !rows.some((m) => m.role === "user")) {
    return fail(422, "no_therapist_turns", "Session has no therapist turns to assess");
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
  const language = reportLanguage ?? typed.language ?? resolved.locale;

  const assessment = await assess({
    avatar: resolved,
    messages: rows,
    durationSec,
    language,
  });

  console.info("[report-regenerate] assessment", {
    sessionId,
    aiSource: assessment.aiSource,
    aiModel: assessment.model ?? null,
    errorKind: assessment.errorKind ?? null,
  });

  return { ok: true, session: typed, assessment, resolvedLocale: resolved.locale };
}

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
    return fail(500, "db_error", "Could not load report");
  }
  if (!report) {
    return fail(404, "report_not_found", "Report not found");
  }
  if (!isHeuristicReportScores(report.scores)) {
    return fail(409, "not_heuristic", "Only fallback reports can be regenerated");
  }

  const run = await loadAndAssess(
    supabase,
    sessionId,
    (report.language as string | null) ?? null,
    assess,
    { requireTherapistTurn: false },
  );
  if (!run.ok) return run;
  const { assessment, resolvedLocale } = run;

  if (assessment.aiSource === "persona_fallback") {
    return fail(
      503,
      "ai_unavailable",
      "AI examiner is still unavailable; the report was not changed",
      assessment.errorKind ?? null,
    );
  }

  const { data: updated, error: updateErr } = await supabase
    .from("session_reports")
    .update({
      scores: assessment.scores,
      narrative: assessment.narrative,
      excerpts: assessment.excerpts,
      language: assessment.language ?? resolvedLocale,
    })
    .eq("id", report.id)
    // CAS: the heuristic narrative is replaced by the examiner's, so a second
    // concurrent regeneration matches zero rows instead of double-writing.
    .eq("narrative", report.narrative as string)
    .select("id")
    .maybeSingle();
  if (updateErr) {
    console.warn("[report-regenerate] update:", updateErr.message);
    return fail(500, "db_error", "Could not save report");
  }
  if (!updated) {
    return fail(409, "concurrent_update", "Report changed while regenerating; reload and try again");
  }

  return {
    ok: true,
    reportId: String(updated.id),
    aiSource: assessment.aiSource,
    aiModel: assessment.model ?? null,
    overall: assessment.scores.overall,
  };
}

/**
 * Creates the report for a finished learner session that has none. Persists
 * whatever the canonical assessment returns (a fallback result stays
 * flagged and can be regenerated later), exactly as the end route would.
 * Learner-side best-effort pipelines (ACE, education, supervisor) are not run.
 */
export async function generateMissingReport(
  supabase: SupabaseClient,
  sessionId: string,
  deps: Deps = {},
): Promise<RegenerateResult> {
  const assess = deps.assess ?? assessSession;
  const serviceClient = deps.serviceClient ?? createServiceClient;
  const reportWriteKey = deps.reportWriteKey ?? getReportWriteKey;

  const { data: existing, error: existingErr } = await supabase
    .from("session_reports")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existingErr) {
    console.warn("[report-generate] report read:", existingErr.message);
    return fail(500, "db_error", "Could not load report");
  }
  if (existing) {
    return fail(409, "report_exists", "This session already has a report");
  }

  const key = reportWriteKey();
  const privileged = key ? null : serviceClient();
  if (!key && !privileged) {
    return fail(503, "misconfigured", "Report writing is not configured");
  }

  const run = await loadAndAssess(supabase, sessionId, null, assess, {
    requireTherapistTurn: true,
  });
  if (!run.ok) return run;
  const { assessment, resolvedLocale } = run;
  const language = assessment.language ?? resolvedLocale;

  let reportId: string | null = null;
  if (key) {
    // Prefer the signed RPC as the admin: authorization stays in Postgres.
    const scoresJson = JSON.stringify(assessment.scores);
    const excerptsJson = JSON.stringify(assessment.excerpts);
    const sig = signSessionReport({
      sessionId,
      narrative: assessment.narrative,
      scoresJson,
      excerptsJson,
      key,
    });
    const { data, error } = await supabase.rpc("create_session_report", {
      p_session_id: sessionId,
      p_scores_json: scoresJson,
      p_narrative: assessment.narrative,
      p_excerpts_json: excerptsJson,
      p_sig: sig,
    });
    if (error) {
      console.warn("[report-generate] rpc:", error.message);
      return fail(500, "db_error", "Could not save report");
    }
    reportId = typeof data === "string" ? data : null;
  } else if (privileged) {
    const { data, error } = await privileged
      .from("session_reports")
      .insert({
        session_id: sessionId,
        scores: assessment.scores,
        narrative: assessment.narrative,
        excerpts: assessment.excerpts,
        language,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        return fail(409, "report_exists", "This session already has a report");
      }
      console.warn("[report-generate] insert:", error.message);
      return fail(500, "db_error", "Could not save report");
    }
    reportId = data?.id ? String(data.id) : null;
  }
  if (!reportId) {
    return fail(500, "db_error", "Could not save report");
  }

  return {
    ok: true,
    reportId,
    aiSource: assessment.aiSource,
    aiModel: assessment.model ?? null,
    overall: assessment.scores.overall,
  };
}
