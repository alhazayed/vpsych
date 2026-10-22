"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { codeLabel, localizeOpsText } from "@/lib/admin/ops-text";

type DashboardPayload = {
  meta?: {
    source?: string;
    validation_version?: string;
    observational?: boolean;
  };
  dashboard?: {
    n_runs: number;
    n_ratings: number;
    quality_metrics_means: Record<string, number>;
    trend: Array<{ at: string; realism_index: number; consistency_index: number }>;
    validation_history: Array<{
      id: string;
      overall_realism: number;
      created_at: string;
    }>;
    expert_ratings_summary: {
      n: number;
      domains: Record<string, { n: number; mean: number }>;
    };
    benchmark_comparisons: Array<{
      metric: string;
      vpsych: number | null;
      baseline: number | null;
      delta: number | null;
      source: string;
    }>;
    reliability_plots: Array<{
      domain: string;
      cohen_kappa: number | null;
      percent_agreement: number | null;
      icc: number | null;
      sufficient_for_inference: boolean;
    }>;
    limitations: string[];
  };
  recent_runs?: Array<{
    id: string;
    realism: number;
    consistency: number;
    created_at: string;
  }>;
};

function Bar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs text-[var(--on-surface-variant)]">
        <span>{label}</span>
        <span>{v.toFixed(1)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-[var(--surface-container)]">
        <div
          className="h-full bg-[var(--primary)] transition-[width] duration-500"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

export function ResearchValidationPanel() {
  const t = useTranslations("admin.researchPage");
  const tOps = useTranslations("admin.opsUi");
  const tText = useTranslations("admin.opsText");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/admin/validation");
        const json = (await res.json()) as DashboardPayload & { error?: string };
        if (!res.ok) {
          setError(json.error ?? t("loadFailed"));
          return;
        }
        setData(json);
      } catch {
        setError(tOps("networkError"));
      }
    });
  }

  function compute() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/admin/validation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ n: 50 }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? t("computeFailed"));
          return;
        }
        load();
      } catch {
        setError(tOps("networkError"));
      }
    });
  }

  useEffect(() => {
    load();
  }, []);

  const d = data?.dashboard;
  const means = d?.quality_metrics_means ?? {};
  const trend = d?.trend ?? [];
  const maxTrend = Math.max(1, ...trend.map((t) => t.realism_index), 100);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={load}
          disabled={pending}
          className="rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm text-[var(--on-surface)] disabled:opacity-50"
        >
          {t("refresh")}
        </button>
        <button
          type="button"
          onClick={compute}
          disabled={pending}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm text-[var(--on-primary)] disabled:opacity-50"
        >
          {t("runBatch")}
        </button>
        <a
          href="/api/admin/validation?format=package"
          className="rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          {t("exportPackage")}
        </a>
        <a
          href="/api/admin/validation?format=csv"
          className="rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          {t("exportCsv")}
        </a>
        <a
          href="/api/admin/validation?format=publication"
          className="rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          {t("publicationSupport")}
        </a>
      </div>

      {error ? (
        <p className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-[var(--on-surface-variant)]">
        {t("sourceLine", {
          source: data?.meta?.source ?? "—",
          version: data?.meta?.validation_version ?? "—",
        })}
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [t("statRuns"), d?.n_runs ?? 0],
          [t("statExpertRatings"), d?.n_ratings ?? 0],
          [t("statRealism"), means.realism_index?.toFixed?.(1) ?? "—"],
          [t("statConsistency"), means.consistency_index?.toFixed?.(1) ?? "—"],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
              {label}
            </p>
            <p className="mt-1 font-[family-name:var(--font-headline)] text-2xl text-[var(--on-surface)]">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
          {t("qualityMetrics")}
        </h2>
        <div className="max-w-xl">
          {Object.entries(means).map(([k, v]) => (
            <Bar
              key={k}
              label={
                t.has(`metrics.${k}`) ? t(`metrics.${k}`) : k.replaceAll("_", " ")
              }
              value={v}
            />
          ))}
          {!Object.keys(means).length ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("noMetrics")}
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
          {t("realismTrend")}
        </h2>
        <div className="flex h-32 items-end gap-1 overflow-x-auto">
          {trend.map((t, i) => (
            <div
              key={`${t.at}-${i}`}
              title={`${t.at}: ${t.realism_index}`}
              className="min-w-[6px] flex-1 rounded-t bg-[var(--primary)]/80 transition-all duration-300"
              style={{ height: `${(t.realism_index / maxTrend) * 100}%` }}
            />
          ))}
          {!trend.length ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("noTrend")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
            {t("reliability")}
          </h2>
          <ul className="space-y-2 text-sm text-[var(--on-surface)]">
            {(d?.reliability_plots ?? []).slice(0, 12).map((r, i) => (
              <li key={`${r.domain}-${i}`}>
                <span className="text-[var(--on-surface-variant)]">
                  {codeLabel(t, "domains", r.domain)}
                </span>
                {" · "}
                <bdi>
                  κ={r.cohen_kappa ?? "null"} · {t("agreement")}=
                  {r.percent_agreement ?? "null"} · ICC={r.icc ?? "null"}
                </bdi>
                {!r.sufficient_for_inference ? ` · ${t("underpowered")}` : ""}
              </li>
            ))}
            {!d?.reliability_plots?.length ? (
              <li className="text-[var(--on-surface-variant)]">
                {t("noReliability")}
              </li>
            ) : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
            {t("expertRatings")}
          </h2>
          <ul className="space-y-2 text-sm">
            {Object.entries(d?.expert_ratings_summary.domains ?? {}).map(
              ([domain, stats]) => (
                <li key={domain}>
                  {codeLabel(t, "domains", domain)}:{" "}
                  {t("ratingStats", { n: stats.n, mean: stats.mean.toFixed(1) })}
                </li>
              ),
            )}
            {!d?.expert_ratings_summary.n ? (
              <li className="text-[var(--on-surface-variant)]">
                {t("noRatings")}
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
          {t("benchmarks")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-start text-sm">
            <thead>
              <tr className="text-[var(--on-surface-variant)]">
                <th className="py-1 font-medium">{t("colMetric")}</th>
                <th className="py-1 font-medium">Vtraining</th>
                <th className="py-1 font-medium">{t("colBaseline")}</th>
                <th className="py-1 font-medium">Δ</th>
                <th className="py-1 font-medium">{t("colSource")}</th>
              </tr>
            </thead>
            <tbody>
              {(d?.benchmark_comparisons ?? []).slice(0, 20).map((b, i) => (
                <tr key={`${b.metric}-${i}`} className="border-t border-[var(--outline-variant)]/40">
                  <td className="py-1">
                    {t.has(`metrics.${b.metric}`)
                      ? t(`metrics.${b.metric}`)
                      : b.metric}
                  </td>
                  <td className="py-1">{b.vpsych ?? "—"}</td>
                  <td className="py-1">{b.baseline ?? "—"}</td>
                  <td className="py-1">{b.delta ?? "—"}</td>
                  <td className="py-1">{b.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
          {t("validationHistory")}
        </h2>
        <ul className="space-y-1 text-sm text-[var(--on-surface)]">
          {(data?.recent_runs ?? d?.validation_history ?? []).slice(0, 15).map((r) => (
            <li key={r.id}>
              <bdi>{r.id.slice(0, 18)}…</bdi> ·{" "}
              {t("realismValue", {
                value: "realism" in r ? r.realism : r.overall_realism,
              })}{" "}
              · <bdi>{r.created_at}</bdi>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
          {t("limitations")}
        </h2>
        <ul className="list-disc space-y-1 ps-5 text-sm text-[var(--on-surface-variant)]">
          {(d?.limitations ?? []).map((l) => (
            <li key={l}>{localizeOpsText(tText, l)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
