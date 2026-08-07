"use client";

import { useEffect, useState } from "react";

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
};

export function CidpDashboardPanel() {
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
          {data.cert_id} · v{data.package_version}
        </p>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          {data.phi_policy}
        </p>
        <p className="mt-2 text-sm">
          Open critical feedback:{" "}
          <span className="tabular-nums">
            {data.open_critical_feedback ?? 0}
          </span>
        </p>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          Executive
        </h2>
        <ul className="mt-3 space-y-1 text-sm">
          {(data.executive ?? []).map((m) => (
            <li key={m.id}>
              {m.label}:{" "}
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
            {panel.title}
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {panel.metrics.map((m) => (
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
      ))}
    </div>
  );
}
