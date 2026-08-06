"use client";

import { useCallback, useState, startTransition } from "react";
import { useTranslations } from "next-intl";

type Dash = {
  source: string;
  is_fabricated: false;
  dashboard: {
    cvl_version: string;
    notes: string[];
    studies: Array<{
      id: string;
      title: string;
      kind: string;
      status: string;
      n_assignments: number;
      n_ratings: number;
    }>;
    metrics: Array<{
      metric_id: string;
      score: number | null;
      n: number;
      insufficient_data: boolean;
    }>;
    cfl_distribution: Array<{ level: string; n: number }>;
    by_disorder: Array<{
      disorder: string;
      cri: number | null;
      hcfi: number | null;
      cfl: string | null;
      n: number;
    }>;
    reviewer_agreement: {
      icc: number | null;
      n_raters: number;
      insufficient_data: boolean;
    };
    roadmap: Array<{
      priority: string;
      title: string;
      expected_fidelity_improvement: string;
    }>;
  };
};

export function CvlAdminDashboard() {
  const t = useTranslations("admin.cvl");
  const [data, setData] = useState<Dash | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/cvl");
    if (!res.ok) return;
    const json = (await res.json()) as Dash;
    startTransition(() => setData(json));
  }, []);

  const [booted, setBooted] = useState(false);
  if (!booted) {
    setBooted(true);
    void load();
  }

  async function registerStudy() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/cvl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_study",
          study: {
            kind: "blind_psychiatrist_challenge",
            title: "BPC protocol registry",
            status: "draft",
            irb_reference: null,
            disorder_slugs: [
              "mdd-recurrent-moderate",
              "bipolar-mania",
              "ptsd",
            ],
          },
          cases: [
            {
              case_ref: "pack-mdd-01",
              disorder_slug: "mdd-recurrent-moderate",
              modality: "transcript",
            },
            {
              case_ref: "pack-mania-01",
              disorder_slug: "bipolar-mania",
              modality: "transcript",
            },
            {
              case_ref: "pack-ptsd-01",
              disorder_slug: "ptsd",
              modality: "transcript",
            },
          ],
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      setMsg(
        res.ok
          ? t("studyCreated")
          : body.error || t("actionFailed"),
      );
      await load();
    } catch {
      setMsg(t("actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  const d = data?.dashboard;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-secondary h-10 px-4 text-sm"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh
        </button>
        <button
          type="button"
          className="btn-primary h-10 px-4 text-sm"
          disabled={busy}
          onClick={() => void registerStudy()}
        >
          {t("registerStudy")}
        </button>
        <a
          className="btn-secondary h-10 px-4 text-sm leading-10"
          href="/api/admin/cvl/export?format=package"
        >
          {t("exportPackage")}
        </a>
        <a
          className="btn-secondary h-10 px-4 text-sm leading-10"
          href="/api/admin/cvl/export?format=csv"
        >
          {t("exportCsv")}
        </a>
        <a
          className="btn-secondary h-10 px-4 text-sm leading-10"
          href="/api/admin/cvl/export?format=publication"
        >
          {t("exportPublication")}
        </a>
      </div>

      <p className="text-xs text-[var(--on-surface-variant)]">{t("integrityNote")}</p>
      {msg && (
        <p className="text-sm text-[var(--primary)]" role="status">
          {msg}
        </p>
      )}

      {!d ? (
        <p className="text-sm">{t("loading")}</p>
      ) : (
        <>
          <ul className="space-y-1 text-xs text-[var(--on-surface-variant)]">
            {d.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
              {t("metrics")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {d.metrics.map((m) => (
                <div
                  key={m.metric_id}
                  className="rounded-xl border border-[var(--outline-variant)] bg-white p-4"
                >
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {m.metric_id}
                  </p>
                  <p className="text-2xl font-bold text-[var(--primary)]">
                    {m.insufficient_data || m.score == null ? "—" : m.score}
                  </p>
                  <p className="text-[11px] text-[var(--on-surface-variant)]">
                    n={m.n}
                    {m.insufficient_data ? ` · ${t("insufficient")}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("studies")}
              </h2>
              {!d.studies.length ? (
                <p className="text-sm">{t("noStudies")}</p>
              ) : (
                <ul className="space-y-2">
                  {d.studies.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 text-sm"
                    >
                      <p className="font-semibold">{s.title}</p>
                      <p className="text-xs text-[var(--on-surface-variant)]">
                        {s.kind} · {s.status} · assignments {s.n_assignments} ·
                        ratings {s.n_ratings}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("cfl")}
              </h2>
              <ul className="space-y-1 text-sm">
                {d.cfl_distribution.map((c) => (
                  <li key={c.level} className="flex justify-between">
                    <span>{c.level}</span>
                    <span>{c.n}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-[var(--on-surface-variant)]">
                {t("agreement")}:{" "}
                {d.reviewer_agreement.insufficient_data
                  ? t("insufficient")
                  : `ICC ${d.reviewer_agreement.icc?.toFixed(2)} (raters ${d.reviewer_agreement.n_raters})`}
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
              {t("byDisorder")}
            </h2>
            <ul className="space-y-1 text-sm">
              {d.by_disorder.map((r) => (
                <li key={r.disorder} className="flex justify-between gap-4">
                  <span>{r.disorder}</span>
                  <span className="text-[var(--on-surface-variant)]">
                    CRI {r.cri ?? "—"} · HCFI {r.hcfi ?? "—"} · {r.cfl ?? "—"} ·
                    n={r.n}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
              {t("roadmap")}
            </h2>
            <ul className="space-y-2">
              {d.roadmap.map((r) => (
                <li
                  key={r.title}
                  className="rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 text-sm"
                >
                  <p className="font-semibold">
                    [{r.priority}] {r.title}
                  </p>
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {r.expected_fidelity_improvement}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
