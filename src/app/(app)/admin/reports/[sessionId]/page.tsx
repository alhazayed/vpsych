import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReportView } from "@/components/ReportView";
import { requireAdmin } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/security-audit";
import { SessionPracticePanel } from "@/components/admin/SessionPracticePanel";
import {
  buildIndicativeCtsr,
  caseHasRisk,
  deriveSelfReportProfile,
  evaluateSessionPractice,
} from "@/lib/session-practice";
import type { ClinicalCore, SessionReport } from "@/lib/types";

type Props = { params: Promise<{ sessionId: string }> };

export default async function AdminReportDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.reportDetail");

  const { data: report } = await supabase
    .from("session_reports")
    .select(
      `
      *,
      sessions (
        id,
        started_at,
        ended_at,
        status,
        clinical_snapshot,
        profiles ( display_name ),
        avatars ( name, disorder )
      )
    `,
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!report) notFound();

  await logSecurityEvent({
    action: "admin.report.view",
    outcome: "success",
    resourceType: "session_report",
    resourceId: sessionId,
  });

  const session = report.sessions as unknown as {
    clinical_snapshot: { clinical_core?: ClinicalCore | null } | null;
    profiles: { display_name: string } | null;
    avatars: { name: string; disorder: string } | null;
  } | null;

  const { data: messages } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const core = session?.clinical_snapshot?.clinical_core ?? null;
  const practice = evaluateSessionPractice({
    messages: (messages ?? []) as Array<{ role: string; content: string }>,
    riskPresent: caseHasRisk(core?.risk_profile),
  });
  const ctsr = buildIndicativeCtsr({
    items: (report as SessionReport).scores?.items ?? [],
    practice,
  });
  const selfReport = core ? deriveSelfReportProfile(core) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <Link
        href="/admin/reports"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {t("back")}
      </Link>
      <p className="mt-4 text-sm text-[var(--on-surface-variant)]">
        {t("meta", {
          therapist: session?.profiles?.display_name ?? "—",
          patient: session?.avatars?.name ?? "—",
          disorder: session?.avatars?.disorder ?? "—",
        })}
        {(report as SessionReport).language
          ? ` · ${(report as SessionReport).language}`
          : ""}
      </p>
      <div className="mt-6">
        <ReportView report={report as SessionReport} />
      </div>
      <div className="mt-6">
        <SessionPracticePanel
          practice={practice}
          ctsr={ctsr}
          selfReport={selfReport}
        />
      </div>
    </main>
  );
}
