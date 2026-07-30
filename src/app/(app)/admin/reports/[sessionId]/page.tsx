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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/admin/reports"
        className="text-sm text-[var(--accent)] underline"
      >
        ← All reports
      </Link>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Therapist: {session?.profiles?.display_name ?? "—"} · Patient:{" "}
        {session?.avatars?.name ?? "—"} ({session?.avatars?.disorder ?? "—"})
      </p>
      <div className="mt-6">
        <ReportView report={report as SessionReport} />
      </div>
    </main>
  );
}
