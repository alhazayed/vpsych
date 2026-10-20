"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { codeLabel, localizeOpsText } from "@/lib/admin/ops-text";

type Gate = {
  id: string;
  label: string;
  status: string;
  evidence: string;
  blocks_ga: boolean;
};

type RiskItem = {
  id: string;
  description: string;
  likelihood: string;
  impact: string;
  owner: string;
  status: string;
};

type Metric = {
  id: string;
  label: string;
  value: number;
  unit?: string;
  note?: string;
};

type Payload = {
  cert_id?: string;
  package_version?: string;
  ownership?: string;
  cidp_status?: string;
  ga_status?: string;
  disclaimer?: string;
  ga?: {
    recommendation?: string;
    pass_count?: number;
    open_count?: number;
    gates?: Gate[];
  };
  risks?: {
    total?: number;
    open?: number;
    critical_open?: number;
    executive_summary?: string;
    unresolved?: RiskItem[];
  };
  lessons?: {
    total?: number;
    items?: Array<{ id: string; title: string; category: string; status: string }>;
  };
  clinical_evidence?: { metrics?: Metric[] };
  educational_evidence?: { metrics?: Metric[] };
  research_evidence?: { metrics?: Metric[] };
  trends?: {
    series?: Array<{
      id: string;
      label: string;
      direction: string;
      delta: number | null;
    }>;
  };
};

export function Phase14ReadinessPanel() {
  const t = useTranslations("admin.opsUi");
  const tText = useTranslations("admin.opsText");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/ops/phase14");
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? t("loadFailed"));
          return;
        }
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(t("networkError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        {t("loadingPhase", { phase: 14 })}
      </p>
    );
  }
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-10 border-t border-[var(--outline-variant)] pt-10">
      <section>
        <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
          {data.cert_id} · v{data.package_version}
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("phase14Title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
          {localizeOpsText(tText, data.ownership)}
        </p>
        <p className="mt-2 text-sm">
          {t("cidpStatus", {
            status: codeLabel(t, "status", data.cidp_status ?? "GO"),
          })}{" "}
          ·{" "}
          {t("gaStatus", {
            status: codeLabel(t, "status", data.ga_status ?? "NO-GO"),
          })}{" "}
          · {t("gatesPassed", { count: data.ga?.pass_count ?? 0 })} ·{" "}
          {t("gatesOpen", { count: data.ga?.open_count ?? 0 })}
        </p>
        <p className="mt-2 text-sm text-[var(--on-surface)]">
          {localizeOpsText(tText, data.ga?.recommendation)}
        </p>
        {data.disclaimer ? (
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            {localizeOpsText(tText, data.disclaimer)}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("gaDecisionGates")}
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                <th className="py-2 pe-4 font-medium">{t("colGate")}</th>
                <th className="py-2 pe-4 font-medium">{t("colStatus")}</th>
                <th className="py-2 font-medium">{t("colEvidence")}</th>
              </tr>
            </thead>
            <tbody>
              {(data.ga?.gates ?? []).map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-[var(--outline-variant)]/60"
                >
                  <td className="py-2 pe-4">
                    {localizeOpsText(tText, g.label)}
                  </td>
                  <td className="py-2 pe-4 tabular-nums">
                    {codeLabel(t, "status", g.status)}
                  </td>
                  <td className="py-2 text-[var(--on-surface-variant)]">
                    <bdi>{localizeOpsText(tText, g.evidence)}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("riskRegister")}
        </h3>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          {localizeOpsText(tText, data.risks?.executive_summary)}
        </p>
        <p className="mt-1 text-sm">
          {t("riskTotals", {
            total: data.risks?.total ?? 0,
            open: data.risks?.open ?? 0,
            critical: data.risks?.critical_open ?? 0,
          })}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {(data.risks?.unresolved ?? []).slice(0, 8).map((r) => (
            <li key={r.id}>
              <span className="tabular-nums text-[var(--on-surface-variant)]">
                {r.id}
              </span>{" "}
              {localizeOpsText(tText, r.description)}{" "}
              <span className="text-xs text-[var(--on-surface-variant)]">
                ({codeLabel(t, "likelihood", r.likelihood)}/
                {codeLabel(t, "impact", r.impact)} ·{" "}
                {codeLabel(t, "riskStatus", r.status)} ·{" "}
                {localizeOpsText(tText, r.owner)})
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("lessonsLearned")}
        </h3>
        <ul className="mt-3 space-y-1 text-sm">
          {(data.lessons?.items ?? []).map((l) => (
            <li key={l.id}>
              {localizeOpsText(tText, l.title)}{" "}
              <span className="text-xs text-[var(--on-surface-variant)]">
                ({codeLabel(t, "lessonCategory", l.category)} ·{" "}
                {codeLabel(t, "lessonStatus", l.status)})
              </span>
            </li>
          ))}
        </ul>
      </section>

      {(
        [
          [t("clinicalEvidence"), data.clinical_evidence?.metrics],
          [t("educationalEvidence"), data.educational_evidence?.metrics],
          [t("researchEvidence"), data.research_evidence?.metrics],
        ] as const
      ).map(([title, metrics]) =>
        metrics?.length ? (
          <section key={title}>
            <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
              {title}
            </h3>
            <ul className="mt-3 space-y-1 text-sm">
              {metrics.map((m) => (
                <li key={m.id}>
                  {localizeOpsText(tText, m.label)}:{" "}
                  <span className="tabular-nums">
                    {m.value}
                    {m.unit ?? ""}
                  </span>
                  {m.note ? (
                    <span className="ms-2 text-xs text-[var(--on-surface-variant)]">
                      {localizeOpsText(tText, m.note)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}

      {data.trends?.series?.length ? (
        <section>
          <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            {t("longitudinalIndicators")}
          </h3>
          <ul className="mt-3 space-y-1 text-sm">
            {data.trends.series
              .filter((s) => s.direction !== "insufficient")
              .map((s) => (
                <li key={s.id}>
                  {localizeOpsText(tText, s.label)}:{" "}
                  {codeLabel(t, "direction", s.direction)}
                  {s.delta !== null ? ` (Δ ${s.delta})` : ""}
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            {t("insufficientSeries")}
          </p>
        </section>
      ) : null}
    </div>
  );
}
