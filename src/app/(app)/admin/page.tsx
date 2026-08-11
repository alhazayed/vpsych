import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { assessVirtualPatientCompleteness } from "@/lib/admin/virtual-patient-completeness";
import { getTranslations } from "next-intl/server";

export default async function AdminHomePage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.home");

  const [
    { data: avatars },
    { data: reports },
    feedbackRes,
    { data: recentSessions },
  ] = await Promise.all([
    supabase
      .from("avatars")
      .select(
        "id, name, disorder, is_active, human_personality, personalities, persona_prompt, voice_profile_id, voice_id, voice_id_ar, clinical_core",
      )
      .order("name"),
    supabase
      .from("session_reports")
      .select("id, session_id, created_at, scores, language")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("institutional_feedback")
      .select("id, status")
      .limit(100),
    supabase
      .from("sessions")
      .select("id, status, created_at, avatar_id")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const openFeedback = (feedbackRes.data ?? []).filter((f) => {
    const s = String(f.status ?? "");
    return s !== "resolved" && s !== "wont_fix" && s !== "duplicate";
  }).length;

  const avatarNameById = new Map(
    (avatars ?? []).map((a) => [a.id, a.name] as const),
  );

  const list = avatars ?? [];
  const activeCount = list.filter((a) => a.is_active).length;
  const incomplete = list.filter(
    (a) => !assessVirtualPatientCompleteness(a).isComplete,
  );
  const attention: Array<{ label: string; href: string }> = [];
  if (incomplete.length) {
    attention.push({
      label: t("attentionIncomplete", { count: incomplete.length }),
      href: "/admin/avatars",
    });
  }
  if (openFeedback > 0) {
    attention.push({
      label: t("attentionFeedback", { count: openFeedback }),
      href: "/admin/feedback",
    });
  }

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("statActive")} value={String(activeCount)} />
        <StatCard
          label={t("statIncomplete")}
          value={String(incomplete.length)}
          warn={incomplete.length > 0}
        />
        <StatCard label={t("statTotalPatients")} value={String(list.length)} />
        <StatCard
          label={t("statOpenFeedback")}
          value={String(openFeedback)}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("needsAttention")}
          </h2>
          {attention.length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("needsAttentionEmpty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {attention.map((item) => (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm hover:bg-[var(--surface-container-low)]"
                  >
                    <span>{item.label}</span>
                    <StatusBadge label={t("review")} tone="warning" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {incomplete.length > 0 ? (
            <ul className="mt-4 space-y-1 text-sm text-[var(--on-surface-variant)]">
              {incomplete.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/avatars/${a.id}`}
                    className="text-[var(--primary)] hover:underline"
                  >
                    {a.name}
                  </Link>
                  <span> — {a.disorder}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="clinical-card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              {t("recentReports")}
            </h2>
            <Link
              href="/admin/reports"
              className="text-xs font-medium text-[var(--primary)] hover:underline"
            >
              {t("viewAll")}
            </Link>
          </div>
          {(reports ?? []).length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("recentReportsEmpty")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(reports ?? []).map((r) => {
                const scores =
                  r.scores && typeof r.scores === "object"
                    ? (r.scores as { overall?: number })
                    : null;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/reports/${r.session_id}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2 hover:bg-[var(--surface-container-low)]"
                    >
                      <span>
                        {t("unknownPatient")} · {r.language ?? "—"}
                      </span>
                      <span className="text-xs text-[var(--on-surface-variant)]">
                        {scores?.overall != null ? `${scores.overall}` : "—"} ·{" "}
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("recentActivity")}
          </h2>
          {(recentSessions ?? []).length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("recentActivityEmpty")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(recentSessions ?? []).map((s) => {
                const name =
                  avatarNameById.get(s.avatar_id) ?? t("unknownPatient");
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2"
                  >
                    <span>
                      {name} · {s.status}
                    </span>
                    <span className="text-xs text-[var(--on-surface-variant)]">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("systemStatus")}
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span>{t("systemAuth")}</span>
              <StatusBadge label={t("statusOk")} tone="active" />
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>{t("systemAdminAccess")}</span>
              <StatusBadge label={t("statusOk")} tone="active" />
            </li>
            <li className="pt-2 text-xs text-[var(--on-surface-variant)]">
              {t("systemHint")}
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/cidp" className="btn-secondary">
              {t("openOperations")}
            </Link>
            <Link href="/admin/diagnostics" className="btn-secondary">
              {t("openDiagnostics")}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="clinical-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
        {label}
      </p>
      <p
        className={`mt-2 font-[family-name:var(--font-headline)] text-3xl font-semibold ${
          warn ? "text-[var(--secondary)]" : "text-[var(--on-surface)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
