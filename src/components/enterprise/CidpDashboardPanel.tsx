"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { codeLabel, localizeOpsText } from "@/lib/admin/ops-text";

type Metric = {
  id: string;
  label: string;
  value: number;
  unit?: string;
  note?: string;
};

type Panel = {
  id: string;
  title: string;
  metrics: Metric[];
};

type Payload = {
  cert_id?: string;
  package_version?: string;
  phi_policy?: string;
  panels?: Panel[];
  executive?: Metric[];
  open_critical_feedback?: number;
  open_high_feedback?: number;
  ga_status?: string;
  cidp_status?: string;
  success_metrics?: {
    overall_health?: string;
    metrics?: Metric[];
  };
  weekly_reports_path?: string;
};

export function CidpDashboardPanel() {
  const t = useTranslations("admin.opsUi");
  const tText = useTranslations("admin.opsText");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/ops/cidp");
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
      <p className="text-sm text-[var(--on-surface-variant)]">{t("loading")}</p>
    );
  }
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-10">
      <section>
        <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
          {data.cert_id} · v{data.package_version}
        </p>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          {localizeOpsText(tText, data.phi_policy)}
        </p>
        <p className="mt-2 text-sm">
          {t("cidpStatus", {
            status: codeLabel(t, "status", data.cidp_status ?? "GO"),
          })}{" "}
          ·{" "}
          {t("gaStatus", {
            status: codeLabel(t, "status", data.ga_status ?? "NO-GO"),
          })}{" "}
          ·{" "}
          {t("health", {
            health: data.success_metrics?.overall_health
              ? codeLabel(t, "healthLevels", data.success_metrics.overall_health)
              : t("notAvailable"),
          })}
        </p>
        <p className="mt-2 text-sm">
          {t("openCriticalFeedback")}{" "}
          <span className="tabular-nums">
            {data.open_critical_feedback ?? 0}
          </span>
          {" · "}
          {t("openHigh")}{" "}
          <span className="tabular-nums">{data.open_high_feedback ?? 0}</span>
        </p>
        {data.weekly_reports_path ? (
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            {t("weeklyReports")}{" "}
            <span dir="ltr">{data.weekly_reports_path}</span>
          </p>
        ) : null}
      </section>

      {data.success_metrics?.metrics?.length ? (
        <section>
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
            {t("successMetrics")}
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {data.success_metrics.metrics.map((m) => (
              <li key={m.id}>
                {localizeOpsText(tText, m.label)}:{" "}
                <span className="tabular-nums">
                  {m.value}
                  {m.unit ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("executive")}
        </h2>
        <ul className="mt-3 space-y-1 text-sm">
          {(data.executive ?? []).map((m) => (
            <li key={m.id}>
              {localizeOpsText(tText, m.label)}:{" "}
              <span className="tabular-nums">
                {m.value}
                {m.unit ?? ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {(data.panels ?? []).map((panel) => (
        <section key={panel.id}>
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
            {localizeOpsText(tText, panel.title)}
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {panel.metrics.map((m) => (
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
      ))}
    </div>
  );
}
