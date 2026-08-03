"use client";

import { useCallback, useEffect, useState } from "react";

type Cohort = {
  generated_at: string;
  learner_count: number;
  mean_confidence: number;
  mean_velocity: number;
  mean_cases: number;
  mastery_ready_count: number;
  risk_learners: Array<{
    learner_id: string;
    profession: string;
    institution: string | null;
    confidence_score: number;
    learning_velocity: number;
    risk_score: number;
    risk_reasons: string[];
  }>;
  institutions: Array<{
    institution: string;
    learner_count: number;
    mean_confidence: number;
    mean_velocity: number;
    at_risk_count: number;
  }>;
  instructors: Array<{
    instructor_id: string;
    learner_count: number;
    mean_confidence: number;
    mean_velocity: number;
  }>;
  competency_benchmarks: Array<{
    competency_id: string;
    mean_score: number;
    assessed_learners: number;
  }>;
  longitudinal: Array<{
    learner_id: string;
    history_overall: number[];
    trend_slope: number;
  }>;
};

type Tab = "executive" | "institution" | "instructor" | "research" | "risk";

export function LearningAnalyticsDashboard() {
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [tab, setTab] = useState<Tab>("executive");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics?view=executive");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load analytics");
        return;
      }
      setCohort(data.cohort);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function exportFmt(format: string) {
    window.open(`/api/admin/analytics?format=${format}`, "_blank");
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        Loading cohort analytics…
      </p>
    );
  }
  if (error && !cohort) {
    return (
      <p className="text-sm text-[var(--error)]" role="alert">
        {error}
      </p>
    );
  }
  if (!cohort) return null;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "executive", label: "Executive" },
    { id: "institution", label: "Institution" },
    { id: "instructor", label: "Instructor" },
    { id: "risk", label: "Risk learners" },
    { id: "research", label: "Research" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--on-surface-variant)]">
          Generated {new Date(cohort.generated_at).toLocaleString()} ·{" "}
          {cohort.learner_count} learners
        </p>
        <div className="flex flex-wrap gap-2">
          {(["csv", "excel", "pdf", "research", "json"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => exportFmt(f === "json" ? "json" : f)}
              className="rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs uppercase tracking-wide"
            >
              {f}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--on-primary)]"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--outline-variant)] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-[var(--surface-container)] font-semibold text-[var(--primary)]"
                : "text-[var(--on-surface-variant)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "executive" && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Learners" value={String(cohort.learner_count)} />
          <Stat label="Mean confidence" value={String(cohort.mean_confidence)} />
          <Stat label="Mean velocity" value={String(cohort.mean_velocity)} />
          <Stat
            label="Mastery-ready"
            value={String(cohort.mastery_ready_count)}
          />
          <Stat
            label="At-risk"
            value={String(cohort.risk_learners.length)}
          />
        </section>
      )}

      {tab === "institution" && (
        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Institution comparison
          </h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[var(--on-surface-variant)]">
                <th className="py-2">Institution</th>
                <th>n</th>
                <th>Conf</th>
                <th>Vel</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {cohort.institutions.map((i) => (
                <tr
                  key={i.institution}
                  className="border-t border-[var(--outline-variant)]"
                >
                  <td className="py-2">{i.institution}</td>
                  <td>{i.learner_count}</td>
                  <td>{i.mean_confidence}</td>
                  <td>{i.mean_velocity}</td>
                  <td>{i.at_risk_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "instructor" && (
        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Instructor comparison
          </h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[var(--on-surface-variant)]">
                <th className="py-2">Instructor</th>
                <th>n</th>
                <th>Conf</th>
                <th>Vel</th>
              </tr>
            </thead>
            <tbody>
              {cohort.instructors.map((i) => (
                <tr
                  key={i.instructor_id}
                  className="border-t border-[var(--outline-variant)]"
                >
                  <td className="py-2">{i.instructor_id}</td>
                  <td>{i.learner_count}</td>
                  <td>{i.mean_confidence}</td>
                  <td>{i.mean_velocity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "risk" && (
        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Risk learners
          </h2>
          {cohort.risk_learners.length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              No learners currently meet risk thresholds.
            </p>
          ) : (
            <ul className="space-y-3">
              {cohort.risk_learners.map((r) => (
                <li
                  key={r.learner_id}
                  className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      {r.profession}
                      {r.institution ? ` · ${r.institution}` : ""}
                    </span>
                    <span className="text-[var(--error)]">
                      risk {r.risk_score}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--on-surface-variant)]">
                    conf {r.confidence_score} · vel {r.learning_velocity} ·{" "}
                    {r.risk_reasons.join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "research" && (
        <div className="space-y-6">
          <section className="clinical-card p-5">
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              Competency benchmarks (assessed only)
            </h2>
            <ul className="space-y-2">
              {cohort.competency_benchmarks
                .filter((c) => c.assessed_learners > 0)
                .sort((a, b) => a.mean_score - b.mean_score)
                .map((c) => (
                  <li key={c.competency_id}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span>{c.competency_id.replace(/_/g, " ")}</span>
                      <span>
                        {c.mean_score} · n={c.assessed_learners}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-[var(--surface-container)]">
                      <div
                        className="h-full rounded bg-[var(--primary)]"
                        style={{ width: `${Math.min(100, c.mean_score)}%` }}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </section>
          <section className="clinical-card p-5">
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              Longitudinal trends (OLS slope)
            </h2>
            <ul className="max-h-80 space-y-2 overflow-auto text-sm">
              {cohort.longitudinal
                .filter((l) => l.history_overall.length >= 2)
                .sort((a, b) => a.trend_slope - b.trend_slope)
                .slice(0, 40)
                .map((l) => (
                  <li
                    key={l.learner_id}
                    className="flex justify-between gap-2 border-b border-[var(--outline-variant)] py-1 text-[12px]"
                  >
                    <span className="truncate font-mono text-[11px]">
                      {l.learner_id.slice(0, 8)}…
                    </span>
                    <span>
                      slope {l.trend_slope} · pts{" "}
                      {l.history_overall.join("→")}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="clinical-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-semibold">
        {value}
      </p>
    </div>
  );
}
