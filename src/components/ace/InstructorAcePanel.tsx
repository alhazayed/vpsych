"use client";

import { useEffect, useState } from "react";
import { AdvancedJson } from "@/components/admin/AdvancedDetails";

type LearnerRow = {
  id: string;
  user_id: string;
  profession: string;
  training_level: string;
  institution?: string | null;
  adaptive_mode: boolean;
  curriculum_mode: string;
  completed_case_count: number;
  confidence_score: number;
  learning_velocity: number;
  certification_status: string;
  min_competency_threshold: number;
  max_difficulty: string;
};

export function InstructorAcePanel() {
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [selected, setSelected] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<unknown>(null);
  const [threshold, setThreshold] = useState(70);
  const [adaptiveMode, setAdaptiveMode] = useState(true);
  const [maxDifficulty, setMaxDifficulty] = useState("expert");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/ace/learners");
      const data = await res.json();
      if (res.ok) {
        setLearners(data.learners ?? []);
        if (data.learners?.[0]) {
          setSelected(data.learners[0].id);
          setThreshold(data.learners[0].min_competency_threshold);
          setAdaptiveMode(data.learners[0].adaptive_mode);
          setMaxDifficulty(data.learners[0].max_difficulty);
        }
      }
    })();
  }, []);

  async function saveControls() {
    setError(null);
    setMsg(null);
    if (!selected) return;
    const res = await fetch("/api/admin/ace/learners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learnerId: selected,
        adaptiveMode,
        minCompetencyThreshold: threshold,
        maxDifficulty,
        curriculumMode: adaptiveMode ? "automatic" : "manual",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Update failed");
      return;
    }
    setMsg("Instructor controls saved");
  }

  async function loadAnalytics() {
    setError(null);
    const learner = learners.find((l) => l.id === selected);
    if (!learner) return;
    const res = await fetch(
      `/api/ace/analytics?userId=${encodeURIComponent(learner.user_id)}`,
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Analytics failed");
      return;
    }
    setAnalytics(data);
  }

  return (
    <div className="space-y-6">
      <section className="clinical-card p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Learners
        </h2>
        {learners.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            No learner profiles yet. Profiles are created when a therapist
            completes an assessment with ACE enabled.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {learners.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(l.id);
                    setThreshold(l.min_competency_threshold);
                    setAdaptiveMode(l.adaptive_mode);
                    setMaxDifficulty(l.max_difficulty);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left ${
                    selected === l.id
                      ? "border-[var(--primary)] bg-[var(--surface-container)]"
                      : "border-[var(--outline-variant)]"
                  }`}
                >
                  <span className="font-medium">
                    {l.profession.replace(/_/g, " ")}
                  </span>
                  <span className="ml-2 text-[11px] text-[var(--on-surface-variant)]">
                    {l.training_level} · cases {l.completed_case_count} · conf{" "}
                    {l.confidence_score} · {l.certification_status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="clinical-card space-y-3 p-5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Instructor controls
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={adaptiveMode}
            onChange={(e) => setAdaptiveMode(e.target.checked)}
          />
          Adaptive mode ON
        </label>
        <label className="block text-sm">
          Min competency threshold
          <input
            type="number"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Max difficulty
          <select
            value={maxDifficulty}
            onChange={(e) => setMaxDifficulty(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
          >
            <option value="beginner">beginner</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
            <option value="expert">expert</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveControls}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-[var(--on-primary)]"
          >
            Save controls
          </button>
          <button
            type="button"
            onClick={loadAnalytics}
            className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm"
          >
            View analytics
          </button>
        </div>
        {msg && <p className="text-sm text-[var(--primary)]">{msg}</p>}
        {error && (
          <p className="text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}
        {analytics ? (
          <div className="space-y-3">
            <LearnerAnalyticsSummary data={analytics} />
            <AdvancedJson
              value={analytics}
              title="Advanced details (analytics JSON)"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function LearnerAnalyticsSummary({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">No analytics.</p>
    );
  }
  const rec = data as Record<string, unknown>;
  const confidence =
    typeof rec.confidence_score === "number" ? rec.confidence_score : null;
  const velocity =
    typeof rec.learning_velocity === "number" ? rec.learning_velocity : null;
  const strengths = Array.isArray(rec.strengths) ? rec.strengths : [];
  const weaknesses = Array.isArray(rec.weaknesses) ? rec.weaknesses : [];

  return (
    <div className="rounded-lg border border-[var(--outline-variant)] p-4 text-sm">
      <p className="text-xs text-[var(--on-surface-variant)]">
        Formative training estimates — not validated clinical measurements.
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
            Confidence
          </dt>
          <dd>{confidence ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
            Learning velocity
          </dt>
          <dd>{velocity ?? "—"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-[var(--on-surface-variant)]">
        Strengths:{" "}
        {strengths.length
          ? strengths.map((s) => String(s).replace(/_/g, " ")).join(", ")
          : "Insufficient evidence"}
      </p>
      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
        Focus areas:{" "}
        {weaknesses.length
          ? weaknesses.map((s) => String(s).replace(/_/g, " ")).join(", ")
          : "Insufficient evidence"}
      </p>
    </div>
  );
}
