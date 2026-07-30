import Link from "next/link";
import { format } from "date-fns";
import { requireAdmin } from "@/lib/auth";

export default async function AdminReportsPage() {
  const { supabase } = await requireAdmin();
  const { data: reports } = await supabase
    .from("session_reports")
    .select(
      `
      id,
      session_id,
      scores,
      created_at,
      sessions (
        started_at,
        ended_at,
        status,
        profiles ( display_name ),
        avatars ( name, disorder )
      )
    `,
    )
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        Session reports
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Confidential. Visible to admins only via row-level security.
      </p>

      <ul className="mt-8 space-y-3">
        {(reports ?? []).map((report) => {
          const session = report.sessions as unknown as {
            started_at: string;
            status: string;
            profiles: { display_name: string } | null;
            avatars: { name: string; disorder: string } | null;
          } | null;
          const overall =
            (report.scores as { overall?: number } | null)?.overall ?? "—";
          return (
            <li key={report.id}>
              <Link
                href={`/admin/reports/${report.session_id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4 hover:border-[var(--accent)]"
              >
                <div>
                  <p className="font-medium">
                    {session?.profiles?.display_name ?? "Therapist"} ·{" "}
                    {session?.avatars?.name ?? "Avatar"}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {session?.avatars?.disorder} ·{" "}
                    {format(new Date(report.created_at), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
                <p className="font-mono text-lg">{overall}/100</p>
              </Link>
            </li>
          );
        })}
        {!reports?.length && (
          <li className="text-sm text-[var(--muted)]">No reports yet.</li>
        )}
      </ul>
    </main>
  );
}
