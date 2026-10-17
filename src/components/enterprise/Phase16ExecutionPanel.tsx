"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { codeLabel, localizeOpsText } from "@/lib/admin/ops-text";

type EvidenceValue = {
  label: string;
  state: string;
  value: number | null;
  unit?: string;
  note?: string;
};

type Dashboard = {
  id: string;
  title: string;
  overall_state: string;
  metrics: EvidenceValue[];
};

type Gate = {
  id: string;
  label: string;
  status: string;
  detail: string;
  evidence: string;
};

type Payload = {
  cert_id?: string;
  package_version?: string;
  ownership?: string;
  fabrication_policy?: string;
  cidp_status?: string;
  ga_status?: string;
  authorized_version?: string | null;
  board_recommendation?: string;
  disclaimer?: string;
  note_on_institutions?: string;
  institutions?: {
    registry_state?: string;
    institutions_registered?: EvidenceValue;
    aggregates?: EvidenceValue[];
    notes?: string[];
  };
  dashboards?: {
    dashboards?: Dashboard[];
  };
  ga?: {
    pass_count?: number;
    unmet?: Gate[];
    gates?: Gate[];
    decision?: string;
  };
  weekly_report?: { markdown?: string; period_ending?: string };
};

function fmt(ev: EvidenceValue | undefined, pendingLabel: string): string {
  if (!ev || ev.state === "EVIDENCE_PENDING" || ev.value === null) {
    return pendingLabel;
  }
  return `${ev.value}${ev.unit ?? ""}`;
}

export function Phase16ExecutionPanel() {
  const t = useTranslations("admin.opsUi");
  const tText = useTranslations("admin.opsText");
  const pendingLabel = codeLabel(t, "status", "EVIDENCE_PENDING");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/ops/phase16");
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
        {t("loadingPhase", { phase: 16 })}
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
          {t("phase16Title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
          {localizeOpsText(tText, data.ownership)}
        </p>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          {localizeOpsText(tText, data.fabrication_policy)}
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
          {t("authorized", {
            version: data.authorized_version ?? t("none"),
          })}{" "}
          · {t("gatesPassed", { count: data.ga?.pass_count ?? 0 })}
        </p>
        <p className="mt-2 text-sm">
          {localizeOpsText(tText, data.board_recommendation)}
        </p>
        {data.disclaimer ? (
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            {localizeOpsText(tText, data.disclaimer)}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("pilotRegistry")}
        </h3>
        <p className="mt-2 text-sm">
          {t("registryState", {
            state: data.institutions?.registry_state
              ? codeLabel(t, "status", data.institutions.registry_state)
              : t("notAvailable"),
          })}{" "}
          ·{" "}
          {t("institutionsCount", {
            value: fmt(data.institutions?.institutions_registered, pendingLabel),
          })}
        </p>
        {data.note_on_institutions ? (
          <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
            {localizeOpsText(tText, data.note_on_institutions)}
          </p>
        ) : null}
        <ul className="mt-3 space-y-1 text-sm">
          {(data.institutions?.aggregates ?? []).map((a) => (
            <li key={a.label}>
              {localizeOpsText(tText, a.label)}: {fmt(a, pendingLabel)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("unmetGates")}
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          {(data.ga?.unmet ?? data.ga?.gates?.filter((g) => g.status !== "PASS") ?? []).map(
            (g) => (
              <li key={g.id}>
                <span className="tabular-nums">
                  {codeLabel(t, "status", g.status)}
                </span>{" "}
                — {localizeOpsText(tText, g.label)}:{" "}
                {localizeOpsText(tText, g.detail)}
              </li>
            ),
          )}
        </ul>
      </section>

      {(data.dashboards?.dashboards ?? []).map((d) => (
        <section key={d.id}>
          <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            {localizeOpsText(tText, d.title)}{" "}
            <span className="text-sm font-normal text-[var(--on-surface-variant)]">
              ({codeLabel(t, "status", d.overall_state)})
            </span>
          </h3>
          <ul className="mt-3 space-y-1 text-sm">
            {d.metrics.map((m) => (
              <li key={m.label}>
                {localizeOpsText(tText, m.label)}: {fmt(m, pendingLabel)}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {data.weekly_report?.period_ending ? (
        <section>
          <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            {t("weeklyReport", { period: data.weekly_report.period_ending })}
          </h3>
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            {t("weeklyReportHint")}
          </p>
        </section>
      ) : null}
    </div>
  );
}
