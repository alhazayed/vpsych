import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import { requireAdmin } from "@/lib/auth";
import type { SessionReport } from "@/lib/types";

type Props = { params: Promise<{ sessionId: string }> };

export default async function AdminReportDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const { supabase } = await requireAdmin();

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
        profiles ( display_name ),
        avatars ( name, disorder )
      )
    `,
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!report) notFound();

  const session = report.sessions as unknown as {
    profiles: { display_name: string } | null;
    avatars: { name: string; disorder: string } | null;
  } | null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <Link
        href="/admin/reports"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        All reports
      </Link>
      <p className="mt-4 text-sm text-[var(--on-surface-variant)]">
        Therapist: {session?.profiles?.display_name ?? "—"} · Patient:{" "}
        {session?.avatars?.name ?? "—"} ({session?.avatars?.disorder ?? "—"})
        {(report as SessionReport).language
          ? ` · Report: ${(report as SessionReport).language}`
          : ""}
      </p>
      <div className="mt-6">
        <ReportView report={report as SessionReport} />
      </div>
    </main>
  );
}
