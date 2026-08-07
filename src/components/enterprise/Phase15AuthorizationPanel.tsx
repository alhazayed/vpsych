"use client";

import { useEffect, useState } from "react";

type Gate = {
  id: string;
  label: string;
  status: string;
  evidence: string;
  blocks_ga: boolean;
};

type Check = {
  id: string;
  label: string;
  status: string;
  evidence: string;
};

type Payload = {
  cert_id?: string;
  package_version?: string;
  ownership?: string;
  cidp_status?: string;
  ga_status?: string;
  authorized_version?: string | null;
  board_recommendation?: string;
  disclaimer?: string;
  residual_risks?: string[];
  authorization?: {
    decision?: string;
    motion?: string;
    pass_count?: number;
    fail_or_open_count?: number;
    board_gates?: Gate[];
  };
  pilot_completion?: {
    institutions?: number;
    objectives_met?: boolean;
    simulations_completed?: number;
    assessments_completed?: number;
    mean_user_satisfaction?: number;
  };
  certifications?: Record<
    string,
    { overall?: string; checks?: Check[]; workstream?: string }
  >;
};

export function Phase15AuthorizationPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/ops/phase15");
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
        Loading Phase 15…
      </p>
    );
  }
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>;
  if (!data) return null;

  const certEntries = Object.entries(data.certifications ?? {}).filter(
    ([key]) => key !== "generated_at",
  );

  return (
    <div className="space-y-10 border-t border-[var(--outline-variant)] pt-10">
      <section>
        <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
          {data.cert_id} · v{data.package_version}
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-headline)] text-xl font-semibold">
          Phase 15 — GA Authorization & Clinical Validation
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
          {data.ownership}
        </p>
        <p className="mt-2 text-sm">
          CIDP: {data.cidp_status ?? "GO"} · GA: {data.ga_status ?? "NO-GO"} ·
          Authorized version: {data.authorized_version ?? "none"} · Gates PASS:{" "}
          {data.authorization?.pass_count ?? 0} · Open:{" "}
          {data.authorization?.fail_or_open_count ?? 0}
        </p>
        <p className="mt-2 text-sm text-[var(--on-surface)]">
          {data.board_recommendation ?? data.authorization?.decision}
        </p>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          {data.authorization?.motion}
        </p>
        {data.disclaimer ? (
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            {data.disclaimer}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          Board GA gates
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
              {(data.authorization?.board_gates ?? []).map((g) => (
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
          Pilot completion
        </h3>
        <ul className="mt-3 space-y-1 text-sm">
          <li>Institutions: {data.pilot_completion?.institutions ?? 0}</li>
          <li>
            Objectives met:{" "}
            {data.pilot_completion?.objectives_met ? "yes" : "no"}
          </li>
          <li>
            Simulations completed:{" "}
            {data.pilot_completion?.simulations_completed ?? 0}
          </li>
          <li>
            Assessments completed:{" "}
            {data.pilot_completion?.assessments_completed ?? 0}
          </li>
          <li>
            Mean user satisfaction:{" "}
            {data.pilot_completion?.mean_user_satisfaction ?? 0}%
          </li>
        </ul>
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          Workstream certifications
        </h3>
        <ul className="mt-3 space-y-1 text-sm">
          {certEntries.map(([key, value]) => (
            <li key={key}>
              {value.workstream ?? key}:{" "}
              <span className="tabular-nums">{value.overall ?? "n/a"}</span>
            </li>
          ))}
        </ul>
      </section>

      {data.residual_risks?.length ? (
        <section>
          <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            Residual risks
          </h3>
          <ul className="mt-3 space-y-1 text-sm">
            {data.residual_risks.slice(0, 10).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
