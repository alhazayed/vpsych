"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClinicalEducatorDashboard } from "@/lib/clinical-educator";

type RubricCatalogItem = {
  id: string;
  label: string;
  weight: number;
  max: number;
  guidance: string;
  anchors: Array<{ score: number; label: string; description: string }>;
};

export function ClinicalEducatorPanel() {
  const [dashboard, setDashboard] = useState<ClinicalEducatorDashboard | null>(
    null,
  );
  const [rubric, setRubric] = useState<RubricCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/clinical-educator");
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to load Clinical Educator dashboard");
          return;
        }
        setDashboard(data.dashboard);
        setRubric(data.rubric ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">Loading…</p>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </p>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-8">
      <p className="text-sm text-[var(--on-surface-variant)]">
        {dashboard.disclaimer}
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="clinical-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            Reports scored
          </p>
          <p className="mt-1 font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
            {dashboard.n_reports}
          </p>
        </div>
        <div className="clinical-card p-5 sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            Development priorities
          </p>
          <p className="mt-2 text-sm text-[var(--on-surface)]">
            {dashboard.weakest_dimensions.length
              ? dashboard.weakest_dimensions
                  .map(
                    (id) =>
                      dashboard.dimension_averages.find((d) => d.id === id)
                        ?.label ?? id,
                  )
                  .join(" · ")
              : "—"}
          </p>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            Relative strengths
          </p>
          <p className="mt-2 text-sm text-[var(--on-surface)]">
            {dashboard.strongest_dimensions.length
              ? dashboard.strongest_dimensions
                  .map(
                    (id) =>
                      dashboard.dimension_averages.find((d) => d.id === id)
                        ?.label ?? id,
                  )
                  .join(" · ")
              : "—"}
          </p>
        </div>
      </section>

      <section className="clinical-card overflow-hidden">
        <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-5 py-3">
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            Dimension averages
          </h2>
          <p className="text-sm text-[var(--on-surface-variant)]">
            Ten Clinical Educator competencies — not a single overall score.
          </p>
        </div>
        <ul className="divide-y divide-[var(--surface-container-low)]">
          {dashboard.dimension_averages.map((d) => (
            <li key={d.id} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-[var(--on-surface)]">
                  {d.label}
                </span>
                <span className="font-mono text-sm text-[var(--primary)]">
                  {d.n ? `${d.average_percent}%` : "—"}
                  <span className="ms-2 text-[var(--on-surface-variant)]">
                    n={d.n}
                  </span>
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-container)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--primary)]"
                  style={{
                    width: `${d.n ? Math.min(100, d.average_percent) : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="clinical-card overflow-hidden">
        <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-5 py-3">
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            Recent sessions
          </h2>
        </div>
        {dashboard.recent.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--on-surface-variant)]">
            No reports yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--surface-container-low)]">
            {dashboard.recent.map((row) => (
              <li key={row.session_id}>
                <Link
                  href={`/admin/reports/${row.session_id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-container-low)]"
                >
                  <div>
                    <p className="font-medium text-[var(--on-surface)]">
                      {row.therapist_name ?? "Therapist"} ·{" "}
                      {row.patient_name ?? "Patient"}
                    </p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {new Date(row.created_at).toLocaleString()} ·{" "}
                      {row.language ?? "en"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.dimensions.slice(0, 4).map((d) => (
                      <span
                        key={d.id}
                        className="rounded bg-[var(--surface-container)] px-2 py-0.5 font-mono text-[10px] text-[var(--on-surface-variant)]"
                      >
                        {d.id.replace(/_/g, " ")} {d.percent}%
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="clinical-card overflow-hidden">
        <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-5 py-3">
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            Rubric catalog
          </h2>
          <p className="text-sm text-[var(--on-surface-variant)]">
            Anchors 0–5 for each Clinical Educator dimension.
          </p>
        </div>
        <ul className="divide-y divide-[var(--surface-container-low)]">
          {rubric.map((r) => (
            <li key={r.id} className="px-5 py-4">
              <p className="font-medium text-[var(--on-surface)]">
                {r.label}{" "}
                <span className="font-mono text-xs text-[var(--on-surface-variant)]">
                  w{r.weight}
                </span>
              </p>
              <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                {r.guidance}
              </p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-[var(--primary)]">
                  Anchors
                </summary>
                <ul className="mt-2 space-y-1 ps-4 text-[var(--on-surface-variant)]">
                  {r.anchors.map((a) => (
                    <li key={a.score}>
                      <strong>{a.score}</strong> — {a.label}: {a.description}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
