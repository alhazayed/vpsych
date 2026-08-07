"use client";

import { useEffect, useState } from "react";

export function AdminSupervisorPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    supervisor_version?: string;
    ownership?: string;
    skill_catalog?: Array<{ id: string; label: string; weight: number; category: string }>;
    n_bundles?: number;
    disclaimer?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/supervisor");
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

  if (loading) return <p className="text-sm text-[var(--on-surface-variant)]">Loading…</p>;
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
          Supervisor AI v{data.supervisor_version}
        </p>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface)]">{data.ownership}</p>
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">{data.disclaimer}</p>
        <p className="mt-4 text-sm">In-memory bundles this process: {data.n_bundles ?? 0}</p>
      </section>
      <section>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          Skill catalogue
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                <th className="py-2 pe-4 font-medium">Skill</th>
                <th className="py-2 pe-4 font-medium">Category</th>
                <th className="py-2 font-medium">Weight</th>
              </tr>
            </thead>
            <tbody>
              {(data.skill_catalog ?? []).map((s) => (
                <tr key={s.id} className="border-b border-[var(--outline-variant)]">
                  <td className="py-2 pe-4">{s.label}</td>
                  <td className="py-2 pe-4">{s.category}</td>
                  <td className="py-2 tabular-nums">{s.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
