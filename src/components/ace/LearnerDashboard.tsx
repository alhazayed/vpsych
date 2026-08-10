"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdvancedJson } from "@/components/admin/AdvancedDetails";
import { ClinicalPreviewSummary } from "@/components/admin/ClinicalPreviewSummary";

type RadarItem = { competency_id: string; score: number; samples?: number };

type Competency = {
  competency_id: string;
  score: number;
  samples: number;
};

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
      competencies?: Competency[];
    };
  } | null>(null);
  const [nextCase, setNextCase] = useState<unknown>(null);

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
      setNextCase(json.case ?? json);
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

  const sampleById = new Map(
    (data?.profile?.competencies ?? []).map((c) => [c.competency_id, c.samples]),
  );
  const radar = (data?.analytics?.radar ?? []).map((r) => ({
    ...r,
    samples: sampleById.get(r.competency_id) ?? 0,
  }));
  const assessed = radar.filter((r) => (r.samples ?? 0) > 0);
  const hasEvidence = assessed.length > 0;
  const top = [...(hasEvidence ? assessed : [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const weak = [...(hasEvidence ? assessed : [])]
    .sort((a, b) => a.score - b.score)
    .slice(0, 8);

  const primaryFocus = data?.plan?.primary_focus;
  const eta = data?.plan?.estimated_sessions_to_threshold;
  const showEta =
    hasEvidence && primaryFocus && typeof eta === "number" && eta > 0;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--on-surface-variant)]">
          Formative training estimates based on your practice sessions. These
          scores are not validated clinical measurements.
        </p>
        <Link
          href="/learning/graph"
          className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--surface-container-low)]"
        >
          Open competency pathway
        </Link>
      </section>

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
          Competency progress
        </h2>
        {!hasEvidence ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            Baseline — not yet assessed. Insufficient evidence until you
            complete scored practice sessions.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <CompetencyBars title="Relative strengths" items={top} />
            <CompetencyBars title="Focus areas" items={weak} accent />
          </div>
        )}
      </section>

      <section className="clinical-card p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Learning plan
        </h2>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Primary focus:{" "}
          <span className="text-[var(--on-surface)]">
            {primaryFocus
              ? primaryFocus.replace(/_/g, " ")
              : hasEvidence
                ? "Maintain practice across domains"
                : "Complete a session to generate a focus"}
          </span>
          {showEta
            ? ` · ~${eta} sessions toward threshold (estimate)`
            : null}
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
          Suggest next practice case
        </button>
        {error && (
          <p className="mt-2 text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}
        {nextCase ? (
          <div className="mt-3 space-y-3">
            <ClinicalPreviewSummary
              payload={nextCase}
              title="Suggested next case"
            />
          </div>
        ) : null}
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
        <div className="mt-4">
          <AdvancedJson
            value={data}
            title="Advanced details (profile payload)"
          />
        </div>
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
      {items.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">
          Insufficient evidence
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const samples = item.samples ?? 0;
            const label =
              samples === 0
                ? "Baseline — not yet assessed"
                : `Formative ${item.score} · ${samples} sample${samples === 1 ? "" : "s"}`;
            return (
              <li key={item.competency_id}>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span>{item.competency_id.replace(/_/g, " ")}</span>
                  <span>{label}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-[var(--surface-container)]">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${samples === 0 ? 0 : item.score}%`,
                      background: accent
                        ? "var(--tertiary, var(--primary))"
                        : "var(--primary)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
