"use client";

import { useEffect, useState } from "react";

type HeatCell = { id: string; score: number; level: string };
type Rec = { id: string; title: string; priority: string; practice_suggestion: string };

export function SupervisorDashboardPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    feedback?: {
      band: string;
      summary: string;
      strengths: string[];
      growth_areas: string[];
      next_actions: string[];
    };
    heatmap?: HeatCell[];
    certification?: {
      current_band: string;
      progress_pct: number;
      board_ready: boolean;
      milestones_met: string[];
      milestones_pending: string[];
    };
    portfolio?: {
      case_log: Array<{
        session_id: string;
        overall: number;
        strengths: string[];
        weaknesses: string[];
      }>;
      milestones: string[];
    };
    reflective?: {
      reflection_questions: string[];
      bias_detection: string[];
      alternative_hypotheses: string[];
    };
    recommendations?: Rec[];
    quality_gate_notes?: string[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/supervisor/summary");
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? "Failed to load supervision");
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
        Loading supervision…
      </p>
    );
  }
  if (error) {
    return <p className="text-sm text-[var(--error)]">{error}</p>;
  }
  if (!data) return null;

  const heat = data.heatmap ?? [];
  const cert = data.certification;

  return (
    <div className="space-y-10">
      <section className="fade-in-up">
        <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
          Supervision band · {data.feedback?.band?.replace(/_/g, " ") ?? "—"}
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--on-surface)]">
          {data.feedback?.summary}
        </p>
        <p className="mt-3 text-xs text-[var(--on-surface-variant)]">
          Educational supervision only. Scores are not validated clinical instruments.
          Supervisor never changes patient state.
        </p>
      </section>

      <section className="fade-in-up" style={{ animationDelay: "80ms" }}>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
          Competency heatmap
        </h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          Observable therapist skills mapped to Dreyfus levels.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {heat.map((cell) => (
            <div
              key={cell.id}
              className="border border-[var(--outline-variant)] px-3 py-2"
              style={{
                background: `color-mix(in srgb, var(--primary) ${Math.min(70, cell.score * 0.55)}%, transparent)`,
              }}
            >
              <div className="text-[11px] uppercase tracking-wide text-[var(--on-surface-variant)]">
                {cell.id.replace(/_/g, " ")}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {cell.score}
              </div>
              <div className="text-[11px] text-[var(--on-surface-variant)]">
                {cell.level.replace(/_/g, " ")}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="fade-in-up grid gap-8 md:grid-cols-2" style={{ animationDelay: "120ms" }}>
        <div>
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
            Strengths
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(data.feedback?.strengths ?? []).map((s) => (
              <li key={s} className="border-s-2 border-[var(--primary)] ps-3">
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
            Growth areas
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(data.feedback?.growth_areas ?? []).map((s) => (
              <li key={s} className="border-s-2 border-[var(--outline)] ps-3">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="fade-in-up" style={{ animationDelay: "160ms" }}>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          Certification tracker
        </h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          {cert?.progress_pct ?? 0}% · {cert?.current_band?.replace(/_/g, " ")}
          {cert?.board_ready ? " · board-ready (educational)" : ""}
        </p>
        <div className="mt-3 h-2 w-full bg-[var(--surface-container)]">
          <div
            className="h-2 bg-[var(--primary)] transition-all duration-700"
            style={{ width: `${cert?.progress_pct ?? 0}%` }}
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
              Met
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {(cert?.milestones_met ?? []).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
              Pending
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {(cert?.milestones_pending ?? []).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="fade-in-up" style={{ animationDelay: "200ms" }}>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          Learning recommendations
        </h2>
        <ul className="mt-3 space-y-3">
          {(data.recommendations ?? []).map((r) => (
            <li key={r.id} className="border-b border-[var(--outline-variant)] pb-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{r.title}</span>
                <span className="text-[11px] uppercase text-[var(--on-surface-variant)]">
                  {r.priority}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                {r.practice_suggestion}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="fade-in-up" style={{ animationDelay: "240ms" }}>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          Reflective practice
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(data.reflective?.reflection_questions ?? []).slice(0, 5).map((q) => (
            <li key={q}>· {q}</li>
          ))}
        </ul>
        {(data.reflective?.bias_detection?.length ?? 0) > 0 && (
          <div className="mt-4">
            <h3 className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
              Bias notes
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {data.reflective!.bias_detection.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="fade-in-up" style={{ animationDelay: "280ms" }}>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          Portfolio · recent cases
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(data.portfolio?.case_log ?? []).slice(-5).reverse().map((c) => (
            <li
              key={c.session_id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--outline-variant)] py-2"
            >
              <span className="font-mono text-xs text-[var(--on-surface-variant)]">
                {c.session_id.slice(0, 12)}…
              </span>
              <span className="tabular-nums">{c.overall}</span>
            </li>
          ))}
          {(data.portfolio?.case_log?.length ?? 0) === 0 && (
            <li className="text-[var(--on-surface-variant)]">
              Complete a session to populate the case log.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
