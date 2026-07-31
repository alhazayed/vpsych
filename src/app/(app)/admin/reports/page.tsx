import Link from "next/link";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";

export default async function AdminReportsPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.reports");
  const tCommon = await getTranslations("common");
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

  const list = reports ?? [];
  const avg =
    list.length > 0
      ? Math.round(
          list.reduce((sum, r) => {
            const overall =
              (r.scores as { overall?: number } | null)?.overall ?? 0;
            return sum + overall;
          }, 0) / list.length,
        )
      : 0;

  return (
    <main className="mx-auto max-w-[1280px] space-y-8 px-4 py-8 md:px-8">
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="clinical-card flex flex-col justify-between p-6">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
              {t("statTotal")}
            </p>
            <h3 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
              {list.length}
            </h3>
          </div>
          <p className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--on-surface-variant)]">
            <span className="material-symbols-outlined text-sm">analytics</span>
            {t("statTotalHint")}
          </p>
        </div>
        <div className="clinical-card flex flex-col justify-between p-6">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
              {t("statAvg")}
            </p>
            <h3 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--secondary)]">
              {list.length ? avg : "—"}
              {list.length ? (
                <span className="text-lg text-[var(--on-surface-variant)]">
                  {tCommon("outOf100")}
                </span>
              ) : null}
            </h3>
          </div>
          <p className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--on-surface-variant)]">
            <span className="material-symbols-outlined text-sm">monitoring</span>
            {t("statAvgHint")}
          </p>
        </div>
        <div className="clinical-card flex flex-col justify-between p-6 sm:col-span-2 lg:col-span-1">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
              {t("statAccess")}
            </p>
            <h3 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
              {t("adminOnly")}
            </h3>
          </div>
          <p className="mt-4 text-xs text-[var(--on-surface-variant)]">
            {t("rlsNote")}
          </p>
        </div>
      </section>

      <section className="clinical-card overflow-hidden">
        <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-6 py-4">
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--on-surface)]">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            {t("subtitle")}
          </p>
        </div>
        <ul className="divide-y divide-[var(--surface-container-low)]">
          {list.map((report) => {
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
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-[var(--surface-container-low)]"
                >
                  <div>
                    <p className="font-medium text-[var(--on-surface)]">
                      {session?.profiles?.display_name ??
                        t("fallbackTherapist")}{" "}
                      · {session?.avatars?.name ?? t("fallbackAvatar")}
                    </p>
                    <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                      {session?.avatars?.disorder} ·{" "}
                      {format(new Date(report.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                  <p className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
                    {overall}
                    <span className="text-sm font-medium text-[var(--on-surface-variant)]">
                      {tCommon("outOf100")}
                    </span>
                  </p>
                </Link>
              </li>
            );
          })}
          {!list.length && (
            <li className="px-6 py-10 text-sm text-[var(--on-surface-variant)]">
              {t("empty")}
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
