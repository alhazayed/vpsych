"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { codeLabel, localizeOpsText } from "@/lib/admin/ops-text";

type EnterpriseAdminPayload = {
  enterprise_version?: string;
  ownership?: string;
  tenant_types?: string[];
  hierarchy_labels?: string[];
  roles?: string[];
  rbac?: Array<{ role: string; permission_count: number }>;
  analytics_scopes?: string[];
  performance_envelope?: {
    organizations: number;
    users: number;
    concurrent_sessions: number;
  };
  integrations?: Array<{ kind: string; status: string; notes: string }>;
  analytics?: {
    scope: string;
    kpis: Array<{ id: string; label: string; value: number; unit?: string }>;
  };
  security?: {
    sso_enabled: boolean;
    mfa_required: boolean;
    isolation_ok: boolean;
  };
  observability?: {
    health: string;
    api_latency_p95_ms: number;
    scaling_hint: string;
  };
  disclaimer?: string;
};

export function AdminEnterprisePanel() {
  const t = useTranslations("admin.enterprisePage");
  const tOps = useTranslations("admin.opsUi");
  const tText = useTranslations("admin.opsText");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EnterpriseAdminPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/enterprise");
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? tOps("loadFailed"));
          return;
        }
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(tOps("networkError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tOps]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        {tOps("loading")}
      </p>
    );
  }
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-10">
      <section>
        <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
          {t("platformVersion", { version: data.enterprise_version ?? "" })}
        </p>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface)]">
          {localizeOpsText(tText, data.ownership)}
        </p>
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
          {localizeOpsText(tText, data.disclaimer)}
        </p>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("tenantTypes")}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-3 text-sm">
          {(data.tenant_types ?? []).map((type) => (
            <li key={type} className="text-[var(--on-surface)]">
              {t.has(`tenantTypeLabels.${type}`)
                ? t(`tenantTypeLabels.${type}`)
                : type.replaceAll("_", " ")}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("hierarchy")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--on-surface-variant)]">
          {(data.hierarchy_labels ?? [])
            .map((label) => localizeOpsText(tText, label))
            .join(" · ")}
        </p>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("rbacRoles")}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                <th className="py-2 pe-4 font-medium">{t("colRole")}</th>
                <th className="py-2 font-medium">{t("colPermissions")}</th>
              </tr>
            </thead>
            <tbody>
              {(data.rbac ?? []).map((r) => (
                <tr
                  key={r.role}
                  className="border-b border-[var(--outline-variant)]"
                >
                  <td className="py-2 pe-4">
                    {codeLabel(t, "membershipRoles", r.role)}
                  </td>
                  <td className="py-2 tabular-nums">{r.permission_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("executiveAnalytics")}
        </h2>
        <ul className="mt-3 space-y-1 text-sm">
          {(data.analytics?.kpis ?? []).map((k) => (
            <li key={k.id}>
              {localizeOpsText(tText, k.label)}:{" "}
              <span className="tabular-nums">
                {k.value}
                {k.unit ?? ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
          {t("scopes", {
            scopes: (data.analytics_scopes ?? [])
              .map((scope) => codeLabel(t, "scopeLabels", scope))
              .join(t("listSeparator")),
          })}
        </p>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
            {t("securityCenter")}
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              {t("sso", {
                state: data.security?.sso_enabled ? t("ssoOn") : t("ssoOff"),
              })}
            </li>
            <li>
              {t("mfaRequired", {
                answer: data.security?.mfa_required ? tOps("yes") : tOps("no"),
              })}
            </li>
            <li>
              {t("isolation", {
                state: data.security?.isolation_ok
                  ? t("isolationVerified")
                  : t("isolationCheck"),
              })}
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
            {t("observability")}
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              {t("health", {
                health: codeLabel(
                  t,
                  "healthLabels",
                  data.observability?.health,
                ),
              })}
            </li>
            <li>
              {t("p95Latency")}{" "}
              <span className="tabular-nums">
                {data.observability?.api_latency_p95_ms} ms
              </span>
            </li>
            <li className="text-[var(--on-surface-variant)]">
              {data.observability?.scaling_hint}
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("performanceEnvelope")}
        </h2>
        <p className="mt-2 text-sm">
          {t("envelope", {
            orgs: data.performance_envelope?.organizations ?? 0,
            users: data.performance_envelope?.users ?? 0,
            sessions: data.performance_envelope?.concurrent_sessions ?? 0,
          })}
        </p>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("integrations")}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                <th className="py-2 pe-4 font-medium">{t("colKind")}</th>
                <th className="py-2 pe-4 font-medium">{t("colStatus")}</th>
                <th className="py-2 font-medium">{t("colNotes")}</th>
              </tr>
            </thead>
            <tbody>
              {(data.integrations ?? []).map((i) => (
                <tr
                  key={i.kind}
                  className="border-b border-[var(--outline-variant)]"
                >
                  <td className="py-2 pe-4 uppercase">{i.kind}</td>
                  <td className="py-2 pe-4">
                    {codeLabel(t, "integrationStatus", i.status)}
                  </td>
                  <td className="py-2 text-[var(--on-surface-variant)]">
                    {i.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
