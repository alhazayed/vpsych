import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { expireStaleSessionsForTherapist } from "@/lib/session-expiry";
import type { TherapySession } from "@/lib/types";
import { format } from "date-fns";

export default async function SessionsListPage() {
  const { supabase, user } = await requireProfile();
  const t = await getTranslations("sessions");

  // Abandoned rooms past max_duration_sec should not linger as "active".
  await expireStaleSessionsForTherapist(supabase, user.id);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, status, started_at, ended_at, avatars(name, disorder)")
    .eq("therapist_id", user.id)
    .order("started_at", { ascending: false });

  const list =
    (sessions as
      | (Pick<TherapySession, "id" | "status" | "started_at" | "ended_at"> & {
          avatars: { name: string; disorder: string };
        })[]
      | null) ?? [];

  function statusLabel(status: string) {
    if (status === "active") return t("status.active");
    if (status === "completed") return t("status.completed");
    if (status === "expired") return t("status.expired");
    return status;
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </section>

      <section className="clinical-card overflow-hidden">
        <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {t("history")}
          </p>
        </div>
        <ul className="divide-y divide-[var(--surface-container-low)]">
          {list.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-[var(--surface-container-low)]"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--on-surface)]">
                  {s.avatars?.name} · {s.avatars?.disorder}
                </p>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  {format(new Date(s.started_at), "MMM d, yyyy · HH:mm")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`status-chip ${
                    s.status === "active"
                      ? "status-chip-warn"
                      : "status-chip-done"
                  }`}
                >
                  {statusLabel(s.status)}
                </span>
                <Link
                  href={
                    s.status === "active"
                      ? `/sessions/${s.id}`
                      : `/sessions/${s.id}/complete`
                  }
                  className="text-sm font-medium text-[var(--primary)] hover:underline"
                >
                  {s.status === "active" ? t("resume") : t("details")}
                </Link>
              </div>
            </li>
          ))}
          {!list.length && (
            <li className="px-6 py-10 text-sm text-[var(--on-surface-variant)]">
              {t("empty")}{" "}
              <Link
                href="/avatars"
                className="font-medium text-[var(--primary)] underline"
              >
                {t("emptyCta")}
              </Link>
              .
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
