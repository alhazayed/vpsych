"use client";

import { useEffect, useState } from "react";

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
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        Loading Phase 14…
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
          Phase 14 — Global Institutional Pilot & GA readiness
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
          {data.ownership}
        </p>
        <p className="mt-2 text-sm">
          CIDP: {data.cidp_status ?? "GO"} · GA: {data.ga_status ?? "NO-GO"} ·
          Gates PASS: {data.ga?.pass_count ?? 0} · Open:{" "}
          {data.ga?.open_count ?? 0}
        </p>
        <p className="mt-2 text-sm text-[var(--on-surface)]">
          {data.ga?.recommendation}
        </p>
        {data.disclaimer ? (
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            {data.disclaimer}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          GA decision gates
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                <th className="py-2 pe-4 font-medium">Gate</th>
                <th className="py-2 pe-4 font-medium">Status</th>
                <th className="py-2 font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {(data.ga?.gates ?? []).map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-[var(--outline-variant)]/60"
                >
                  <td className="py-2 pe-4">{g.label}</td>
                  <td className="py-2 pe-4 tabular-nums">{g.status}</td>
                  <td className="py-2 text-[var(--on-surface-variant)]">
                    {g.evidence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          Risk register
        </h3>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          {data.risks?.executive_summary}
        </p>
        <p className="mt-1 text-sm">
          Total: {data.risks?.total ?? 0} · Open/mitigating:{" "}
          {data.risks?.open ?? 0} · Critical-tier open:{" "}
          {data.risks?.critical_open ?? 0}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {(data.risks?.unresolved ?? []).slice(0, 8).map((r) => (
            <li key={r.id}>
              <span className="tabular-nums text-[var(--on-surface-variant)]">
                {r.id}
              </span>{" "}
              {r.description}{" "}
              <span className="text-xs text-[var(--on-surface-variant)]">
                ({r.likelihood}/{r.impact} · {r.status} · {r.owner})
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          Lessons learned
        </h3>
        <ul className="mt-3 space-y-1 text-sm">
          {(data.lessons?.items ?? []).map((l) => (
            <li key={l.id}>
              {l.title}{" "}
              <span className="text-xs text-[var(--on-surface-variant)]">
                ({l.category} · {l.status})
              </span>
            </li>
          ))}
        </ul>
      </section>

      {(
        [
          ["Clinical evidence", data.clinical_evidence?.metrics],
          ["Educational evidence", data.educational_evidence?.metrics],
          ["Research evidence", data.research_evidence?.metrics],
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
                  {m.label}:{" "}
                  <span className="tabular-nums">
                    {m.value}
                    {m.unit ?? ""}
                  </span>
                  {m.note ? (
                    <span className="ms-2 text-xs text-[var(--on-surface-variant)]">
                      {m.note}
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
            Longitudinal indicators
          </h3>
          <ul className="mt-3 space-y-1 text-sm">
            {data.trends.series
              .filter((s) => s.direction !== "insufficient")
              .map((s) => (
                <li key={s.id}>
                  {s.label}: {s.direction}
                  {s.delta !== null ? ` (Δ ${s.delta})` : ""}
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            Series with insufficient samples omitted until weekly points
            accumulate.
          </p>
        </section>
      ) : null}
    </div>
  );
}
