"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type MeResponse = {
  enrollments: Array<{
    id: string;
    study_id: string;
    role_in_study: string;
    baseline_completed_at: string | null;
    is_active: boolean;
    cvp_studies:
      | { id: string; slug: string; title: string; status: string }
      | { id: string; slug: string; title: string; status: string }[]
      | null;
  }>;
  assignments: Array<{
    id: string;
    enrollment_id: string;
    allocation_arm: string;
    sequence_index: number;
    status: string;
    session_id: string | null;
    due_at: string | null;
    avatars:
      | { id: string; name: string; disorder: string; portrait_url: string | null }
      | { id: string; name: string; disorder: string; portrait_url: string | null }[]
      | null;
  }>;
  snapshots: Array<{
    id: string;
    enrollment_id: string;
    captured_at: string;
    sessions_completed: number;
  }>;
  warning?: string;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function ReviewerValidationDashboard() {
  const t = useTranslations("cvp.reviewer");
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cvp/me");
        const body = (await res.json()) as MeResponse & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(body.error ?? t("loadError"));
          return;
        }
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError(t("loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (error) {
    return (
      <p className="text-sm text-[var(--error)]" role="alert">
        {error}
      </p>
    );
  }
  if (!data) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">{t("loading")}</p>
    );
  }

  return (
    <div className="space-y-8">
      {data.warning ? (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--secondary)_40%,transparent)] bg-[color-mix(in_srgb,var(--secondary-container)_20%,transparent)] px-4 py-3 text-sm">
          {data.warning}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("enrollments")}
        </h2>
        {data.enrollments.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("noEnrollments")}{" "}
            <Link href="/validation/accept" className="text-[var(--primary)] underline">
              {t("acceptInvite")}
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {data.enrollments.map((e) => {
              const study = one(e.cvp_studies);
              return (
                <li key={e.id} className="clinical-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--on-surface)]">
                        {study?.title ?? e.study_id}
                      </p>
                      <p className="text-xs text-[var(--on-surface-variant)]">
                        {e.role_in_study} · {study?.status ?? "—"}
                        {e.baseline_completed_at
                          ? ` · ${t("baselineDone")}`
                          : ` · ${t("baselinePending")}`}
                      </p>
                    </div>
                    <span
                      className={`status-chip ${e.is_active ? "status-chip-active" : ""}`}
                    >
                      {e.is_active ? t("active") : t("inactive")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("assignments")}
        </h2>
        {data.assignments.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("noAssignments")}
          </p>
        ) : (
          <ul className="space-y-3">
            {data.assignments.map((a) => {
              const avatar = one(a.avatars);
              return (
                <li key={a.id} className="clinical-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        #{a.sequence_index + 1}{" "}
                        {avatar?.name ?? t("patient")}
                      </p>
                      <p className="text-sm text-[var(--on-surface-variant)]">
                        {avatar?.disorder ?? ""} · {a.allocation_arm} · {a.status}
                      </p>
                    </div>
                    {a.status === "pending" || a.status === "active" ? (
                      <Link
                        href={
                          avatar?.id
                            ? `/avatars`
                            : "/avatars"
                        }
                        className="btn-primary h-9 px-4 text-sm"
                      >
                        {t("startAssigned")}
                      </Link>
                    ) : a.session_id ? (
                      <Link
                        href={`/sessions/${a.session_id}/complete`}
                        className="btn-secondary h-9 px-4 text-sm"
                      >
                        {t("viewComplete")}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("longitudinal")}
        </h2>
        {data.snapshots.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("noSnapshots")}
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
            {data.snapshots.slice(0, 8).map((s) => (
              <li key={s.id}>
                {new Date(s.captured_at).toLocaleString()} —{" "}
                {t("sessionsCompleted", { n: s.sessions_completed })}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
