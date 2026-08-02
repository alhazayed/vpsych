"use client";

import { useEffect, useState } from "react";

type RadarItem = { competency_id: string; score: number };

export function LearnerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    analytics?: {
      strengths: string[];
      weaknesses: string[];
      blind_spots: string[];
      learning_velocity: number;
      confidence_score: number;
      certification_readiness: number;
      radar: RadarItem[];
      learning_curve: Array<{ n: number; overall: number }>;
    };
    certifications?: Array<{
      title: string;
      status: string;
      score: number;
    }>;
    plan?: {
      primary_focus: string | null;
      goals: string[];
      estimated_sessions_to_threshold: number;
      next_cases: Array<{
        disorderSlug?: string;
        difficulty: string;
        rationale: string;
      }>;
    };
    profile?: {
      adaptive_mode: boolean;
      completed_case_count: number;
      profession: string;
      training_level: string;
    };
  } | null>(null);
  const [nextCase, setNextCase] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ace/profile");
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? "Failed to load profile");
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

  async function generateNext() {
    setError(null);
    try {
      const res = await fetch("/api/ace/adaptive-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to generate case");
        return;
      }
      setNextCase(JSON.stringify(json.case, null, 2));
    } catch {
      setError("Network error");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--on-surface-variant)]">Loading…</p>;
  }
  if (error && !data) {
    return <p className="text-sm text-[var(--error)]">{error}</p>;
  }

  const radar = data?.analytics?.radar ?? [];
  const top = [...radar].sort((a, b) => b.score - a.score).slice(0, 8);
  const weak = [...radar].sort((a, b) => a.score - b.score).slice(0, 8);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Confidence"
          value={`${data?.analytics?.confidence_score ?? 0}`}
        />
        <Stat
          label="Learning velocity"
          value={`${data?.analytics?.learning_velocity ?? 0}`}
        />
        <Stat
          label="Cases completed"
          value={`${data?.profile?.completed_case_count ?? 0}`}
        />
      </section>

      <section className="clinical-card p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Competency radar (top / gaps)
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <CompetencyBars title="Strengths" items={top} />
          <CompetencyBars title="Focus areas" items={weak} accent />
        </div>
      </section>

      <section className="clinical-card p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Learning plan
        </h2>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Primary focus:{" "}
          <span className="text-[var(--on-surface)]">
            {(data?.plan?.primary_focus ?? "—").replace(/_/g, " ")}
          </span>
          {" · "}
          ~{data?.plan?.estimated_sessions_to_threshold ?? "—"} sessions to
          threshold
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {(data?.plan?.goals ?? []).map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={generateNext}
          className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
        >
          Generate adaptive next case
        </button>
        {error && (
          <p className="mt-2 text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}
        {nextCase && (
          <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-[var(--surface-container-low)] p-3 text-xs">
            {nextCase}
          </pre>
        )}
      </section>

      <section className="clinical-card p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Achievements
        </h2>
        <ul className="space-y-2 text-sm">
          {(data?.certifications ?? []).map((c) => (
            <li
              key={c.title}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2"
            >
              <span>{c.title}</span>
              <span className="text-[11px] text-[var(--on-surface-variant)]">
                {c.status} · {c.score}
              </span>
            </li>
          ))}
        </ul>
      </section>
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

function CompetencyBars({
  title,
  items,
  accent,
}: {
  title: string;
  items: RadarItem[];
  accent?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--on-surface-variant)]">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.competency_id}>
            <div className="mb-1 flex justify-between text-[11px]">
              <span>{item.competency_id.replace(/_/g, " ")}</span>
              <span>{item.score}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-[var(--surface-container)]">
              <div
                className="h-full rounded"
                style={{
                  width: `${item.score}%`,
                  background: accent
                    ? "var(--tertiary, var(--primary))"
                    : "var(--primary)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
