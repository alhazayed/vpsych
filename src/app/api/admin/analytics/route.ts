import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeDbError } from "@/lib/safe-client-error";

const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/**
 * Admin analytics — counts derived from sessions / session_reports only.
 * Never fabricates metrics; never returns narratives or PHI beyond org names.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.analytics.read",
    resourceType: "analytics",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-analytics:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const url = new URL(request.url);
  const rangeKey = url.searchParams.get("range") ?? "30d";
  const rangeDays = RANGE_DAYS[rangeKey] ?? 30;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - rangeDays);
  const sinceIso = since.toISOString();

  const { supabase } = auth;

  const { data: sessions, error: sessErr } = await supabase
    .from("sessions")
    .select(
      "id, status, language, institution_id, institutions:institution_id ( name )",
    )
    .gte("created_at", sinceIso);

  if (sessErr) {
    return NextResponse.json(
      { error: sanitizeDbError(sessErr.message) },
      { status: 500 },
    );
  }

  const list = sessions ?? [];
  const sessionsStarted = list.length;
  const sessionsCompleted = list.filter((s) => s.status === "completed").length;
  const sessionsExpired = list.filter((s) => s.status === "expired").length;
  const sessionsActive = list.filter((s) => s.status === "active").length;
  const terminal = sessionsCompleted + sessionsExpired;
  const completionRate =
    terminal > 0 ? Math.round((sessionsCompleted / terminal) * 100) : null;

  const langMap = new Map<string, number>();
  const orgMap = new Map<
    string,
    { id: string | null; name: string; count: number }
  >();

  for (const s of list) {
    const lang = String(s.language ?? "unknown").toLowerCase();
    langMap.set(lang, (langMap.get(lang) ?? 0) + 1);

    const inst = s.institutions as unknown as { name: string } | null;
    const key = s.institution_id ?? "none";
    const existing = orgMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      orgMap.set(key, {
        id: s.institution_id,
        name: inst?.name ?? "Unassigned",
        count: 1,
      });
    }
  }

  const sessionIds = list.map((s) => s.id);
  let reportsCount = 0;
  let avgOverall: number | null = null;

  if (sessionIds.length > 0) {
    const chunk = sessionIds.slice(0, 500);
    const { data: reports, error: repErr } = await supabase
      .from("session_reports")
      .select("id, scores, session_id")
      .in("session_id", chunk);

    if (repErr) {
      return NextResponse.json(
        { error: sanitizeDbError(repErr.message) },
        { status: 500 },
      );
    }

    const reps = reports ?? [];
    reportsCount = reps.length;
    const scores = reps
      .map((r) => {
        const scoresObj =
          r.scores && typeof r.scores === "object"
            ? (r.scores as { overall?: number })
            : null;
        return scoresObj?.overall;
      })
      .filter((n): n is number => typeof n === "number");
    if (scores.length > 0) {
      avgOverall = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length,
      );
    }
  }

  return NextResponse.json(
    {
      rangeDays,
      sessionsStarted,
      sessionsCompleted,
      sessionsExpired,
      sessionsActive,
      completionRate,
      reportsCount,
      avgOverall,
      byLanguage: Array.from(langMap.entries())
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count),
      byInstitution: Array.from(orgMap.values()).sort(
        (a, b) => b.count - a.count,
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
