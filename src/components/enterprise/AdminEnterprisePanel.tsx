"use client";

import { useEffect, useState } from "react";

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
          if (!cancelled) setError(json.error ?? "Failed to load");
          return;
        }
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-[var(--on-surface-variant)]">Loading…</p>;
  }
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-10">
      <section>
        <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
          Enterprise Platform v{data.enterprise_version}
        </p>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface)]">
          {data.ownership}
        </p>
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
          {data.disclaimer}
        </p>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          Tenant types
        </h2>
        <ul className="mt-3 flex flex-wrap gap-3 text-sm">
          {(data.tenant_types ?? []).map((t) => (
            <li key={t} className="text-[var(--on-surface)]">
              {t.replaceAll("_", " ")}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          Organization hierarchy
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--on-surface-variant)]">
          {(data.hierarchy_labels ?? []).join(" · ")}
        </p>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          RBAC roles
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                <th className="py-2 pe-4 font-medium">Role</th>
                <th className="py-2 font-medium">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {(data.rbac ?? []).map((r) => (
                <tr
                  key={r.role}
                  className="border-b border-[var(--outline-variant)]"
                >
                  <td className="py-2 pe-4">{r.role}</td>
                  <td className="py-2 tabular-nums">{r.permission_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          Executive analytics
        </h2>
        <ul className="mt-3 space-y-1 text-sm">
          {(data.analytics?.kpis ?? []).map((k) => (
            <li key={k.id}>
              {k.label}:{" "}
              <span className="tabular-nums">
                {k.value}
                {k.unit ?? ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
          Scopes: {(data.analytics_scopes ?? []).join(", ")}
        </p>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
            Security center
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>SSO: {data.security?.sso_enabled ? "enabled" : "off"}</li>
            <li>MFA required: {data.security?.mfa_required ? "yes" : "no"}</li>
            <li>
              Isolation: {data.security?.isolation_ok ? "verified" : "check"}
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
            Observability
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Health: {data.observability?.health}</li>
            <li>
              p95 latency:{" "}
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
          Performance envelope
        </h2>
        <p className="mt-2 text-sm">
          {data.performance_envelope?.organizations} orgs ·{" "}
          {data.performance_envelope?.users.toLocaleString()} users ·{" "}
          {data.performance_envelope?.concurrent_sessions.toLocaleString()}{" "}
          concurrent sessions
        </p>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          Integrations
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                <th className="py-2 pe-4 font-medium">Kind</th>
                <th className="py-2 pe-4 font-medium">Status</th>
                <th className="py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(data.integrations ?? []).map((i) => (
                <tr
                  key={i.kind}
                  className="border-b border-[var(--outline-variant)]"
                >
                  <td className="py-2 pe-4 uppercase">{i.kind}</td>
                  <td className="py-2 pe-4">{i.status}</td>
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
