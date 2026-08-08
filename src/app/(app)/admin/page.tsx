import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();
  const since = startOfTodayIso();

  const [
    sessionsTodayRes,
    sessionsTodayTherapistsRes,
    publishedVpRes,
    pendingVpRes,
    recentReportsRes,
    recentSessionsRes,
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("started_at", since),
    supabase
      .from("sessions")
      .select("therapist_id")
      .gte("started_at", since),
    supabase
      .from("avatars")
      .select("id", { count: "exact", head: true })
      .eq("lifecycle_status", "published"),
    supabase
      .from("avatars")
      .select("id", { count: "exact", head: true })
      .in("lifecycle_status", ["draft", "testing"]),
    supabase
      .from("session_reports")
      .select(
        `
        id,
        session_id,
        created_at,
        scores,
        sessions (
          profiles ( display_name ),
          avatars ( name )
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("sessions")
      .select(
        `
        id,
        status,
        started_at,
        profiles ( display_name ),
        avatars ( name )
      `,
      )
      .order("started_at", { ascending: false })
      .limit(8),
  ]);

  const sessionsToday = sessionsTodayRes.count ?? 0;
  const therapistIds = new Set(
    (sessionsTodayTherapistsRes.data ?? [])
      .map((r) => r.therapist_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );
  const activeClinicians = therapistIds.size;
  const publishedVp = publishedVpRes.count ?? 0;
  const pendingVp = pendingVpRes.count ?? 0;
  const recentReports = recentReportsRes.data ?? [];
  const recentSessions = recentSessionsRes.data ?? [];

  return (
    <main className="mx-auto max-w-[1280px] space-y-8 px-4 py-8 md:px-8">
      <section className="fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          Admin Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          What needs attention today — sessions, clinicians, virtual patients,
          reports, and system health.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Sessions today"
          value={String(sessionsToday)}
          hint="Started since midnight"
          icon="event"
        />
        <StatCard
          label="Active clinicians"
          value={String(activeClinicians)}
          hint="Distinct therapists today"
          icon="groups"
        />
        <StatCard
          label="Published patients"
          value={String(publishedVp)}
          hint="Ready for learners"
          icon="person"
        />
        <StatCard
          label="Pending review"
          value={String(pendingVp)}
          hint="Draft + testing"
          icon="pending_actions"
        />
        <StatCard
          label="System health"
          value="Operational"
          hint="Core services"
          icon="health_and_safety"
        />
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/admin/virtual-patients/new" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create Virtual Patient
        </Link>
        <Link href="/admin/cases" className="btn-secondary">
          <span className="material-symbols-outlined text-[18px]">biotech</span>
          Create Case
        </Link>
        <Link href="/admin/reports" className="btn-secondary">
          <span className="material-symbols-outlined text-[18px]">
            folder_shared
          </span>
          View Reports
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="clinical-card p-5">
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Recent reports
          </h2>
          {recentReports.length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              No reports yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentReports.map((r) => {
                const session = r.sessions as unknown as {
                  profiles?: { display_name?: string | null } | null;
                  avatars?: { name?: string | null } | null;
                } | null;
                const overall =
                  (r.scores as { overall?: number } | null)?.overall ?? null;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/reports/${r.session_id}`}
                      className="block rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 transition hover:border-[color-mix(in_srgb,var(--primary)_35%,var(--outline-variant))]"
                    >
                      <div className="font-medium text-[var(--on-surface)]">
                        {session?.avatars?.name ?? "Patient"} ·{" "}
                        {session?.profiles?.display_name ?? "Therapist"}
                      </div>
                      <div className="mt-1 text-xs text-[var(--on-surface-variant)]">
                        {overall != null ? `Score ${overall}` : "Score —"} ·{" "}
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="clinical-card p-5">
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Recent activity
          </h2>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              No recent sessions.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentSessions.map((s) => {
                const profile = s.profiles as unknown as {
                  display_name?: string | null;
                } | null;
                const avatar = s.avatars as unknown as {
                  name?: string | null;
                } | null;
                return (
                  <li
                    key={s.id}
                    className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 text-sm"
                  >
                    <div className="font-medium text-[var(--on-surface)]">
                      {avatar?.name ?? "Patient"} with{" "}
                      {profile?.display_name ?? "Therapist"}
                    </div>
                    <div className="mt-1 text-xs text-[var(--on-surface-variant)]">
                      {s.status} ·{" "}
                      {s.started_at
                        ? new Date(s.started_at).toLocaleString()
                        : "—"}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: string;
}) {
  return (
    <div className="clinical-card flex flex-col justify-between p-5">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
          {label}
        </p>
        <h3 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[var(--primary)]">
          {value}
        </h3>
      </div>
      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--on-surface-variant)]">
        <span className="material-symbols-outlined text-sm">{icon}</span>
        {hint}
      </p>
    </div>
  );
}
