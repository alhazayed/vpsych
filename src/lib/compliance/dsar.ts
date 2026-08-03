import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_RETENTION_DAYS } from "@/lib/compliance/constants";

export type SubjectExportPayload = {
  exportedAt: string;
  retentionDaysDefault: number;
  subject: {
    userId: string;
    email: string | null;
    profile: Record<string, unknown> | null;
  };
  sessions: unknown[];
  messagesBySession: Record<string, unknown[]>;
  learnerProfile: Record<string, unknown> | null;
  competencies: unknown[];
  notice: string;
};

/**
 * Assemble a portable JSON export of the authenticated subject's training data
 * (GDPR Art. 20 / FERPA access-oriented). Excludes admin-only global catalogs.
 */
export async function buildSubjectExport(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<SubjectExportPayload> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, avatar_id, status, started_at, ended_at, max_duration_sec, language, created_at",
    )
    .eq("therapist_id", userId)
    .order("started_at", { ascending: false });

  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  const messagesBySession: Record<string, unknown[]> = {};

  if (sessionIds.length) {
    const { data: messages } = await supabase
      .from("session_messages")
      .select("id, session_id, role, content, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

    for (const m of messages ?? []) {
      const sid = String((m as { session_id: string }).session_id);
      if (!messagesBySession[sid]) messagesBySession[sid] = [];
      messagesBySession[sid]!.push(m);
    }
  }

  const { data: learner } = await supabase
    .from("learner_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let competencies: unknown[] = [];
  if (learner?.id) {
    const { data: comps } = await supabase
      .from("learner_competencies")
      .select("*")
      .eq("learner_id", learner.id);
    competencies = comps ?? [];
  }

  return {
    exportedAt: new Date().toISOString(),
    retentionDaysDefault:
      Number(
        (profile as { data_retention_days?: number } | null)
          ?.data_retention_days,
      ) || DEFAULT_RETENTION_DAYS,
    subject: {
      userId,
      email,
      profile: (profile as Record<string, unknown> | null) ?? null,
    },
    sessions: sessions ?? [],
    messagesBySession,
    learnerProfile: (learner as Record<string, unknown> | null) ?? null,
    competencies,
    notice:
      "This export contains your VPsych training account data. Simulated patient content is fictional. Third-party AI providers may retain transient processing copies per their DPAs — contact support for subprocessor erasure requests.",
  };
}

/**
 * Research-oriented anonymization: strip direct identifiers from a subject export.
 * Not a substitute for IRB review; for institutional secondary-use previews only.
 */
export function anonymizeExportForResearch(
  payload: SubjectExportPayload,
): Record<string, unknown> {
  const sessionIndex = new Map<string, string>();
  (payload.sessions as Array<{ id: string }>).forEach((s, i) => {
    sessionIndex.set(s.id, `session_${i + 1}`);
  });

  return {
    exportedAt: payload.exportedAt,
    researchMode: true,
    subject: {
      cohortKey: hashId(payload.subject.userId),
      email: null,
      profile: payload.subject.profile
        ? {
            role: payload.subject.profile.role,
            preferred_language: payload.subject.profile.preferred_language,
            organization: null,
            display_name: null,
          }
        : null,
    },
    sessions: (payload.sessions as Array<Record<string, unknown>>).map((s) => ({
      id: sessionIndex.get(String(s.id)),
      status: s.status,
      durationHint:
        s.ended_at && s.started_at
          ? "bounded"
          : s.status === "active"
            ? "active"
            : "unknown",
      language: s.language,
      started_at: null,
      ended_at: null,
    })),
    messageCounts: Object.fromEntries(
      Object.entries(payload.messagesBySession).map(([id, msgs]) => [
        sessionIndex.get(id) ?? "unknown",
        Array.isArray(msgs) ? msgs.length : 0,
      ]),
    ),
    competencies: (payload.competencies as Array<Record<string, unknown>>).map(
      (c) => ({
        competency_id: c.competency_id,
        score: c.score,
        samples: c.samples,
        trend: c.trend,
      }),
    ),
    notice:
      "Anonymized research preview — no display names, emails, or raw transcripts. Obtain IRB/ethics approval before secondary use.",
  };
}

function hashId(id: string): string {
  // Stable non-cryptographic cohort key (not for security).
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return `cohort_${h.toString(16)}`;
}
