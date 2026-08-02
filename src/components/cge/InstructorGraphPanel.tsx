"use client";

import { useEffect, useState } from "react";
import { CompetencyGraphView } from "./CompetencyGraphView";

type Learner = {
  id: string;
  user_id: string;
  profession: string;
  training_level: string;
  completed_case_count: number;
  confidence_score: number;
};

export function InstructorGraphPanel() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selected, setSelected] = useState("");
  const [competencyId, setCompetencyId] = useState("diagnostic_interview");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/cge");
      const data = await res.json();
      if (res.ok) {
        setLearners(data.learners ?? []);
        if (data.learners?.[0]) setSelected(data.learners[0].id);
      }
    })();
  }, []);

  async function act(
    action: "lock" | "unlock" | "approve_mastery" | "require_reassessment",
  ) {
    setError(null);
    setMsg(null);
    if (!selected) return;
    const res = await fetch("/api/admin/cge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        learnerId: selected,
        competencyId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Action failed");
      return;
    }
    setMsg(`${action} applied to ${competencyId}`);
  }

  return (
    <div className="space-y-8">
      <section className="clinical-card space-y-3 p-5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Instructor controls
        </h2>
        <label className="block text-sm">
          Learner
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
          >
            {learners.length === 0 && (
              <option value="">No learners yet</option>
            )}
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.profession} · cases {l.completed_case_count} · conf{" "}
                {l.confidence_score}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Competency id
          <input
            value={competencyId}
            onChange={(e) => setCompetencyId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => act("lock")}
            className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
          >
            Lock
          </button>
          <button
            type="button"
            onClick={() => act("unlock")}
            className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
          >
            Unlock
          </button>
          <button
            type="button"
            onClick={() => act("approve_mastery")}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm text-[var(--on-primary)]"
          >
            Approve mastery
          </button>
          <button
            type="button"
            onClick={() => act("require_reassessment")}
            className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
          >
            Require reassessment
          </button>
        </div>
        {msg && <p className="text-sm text-[var(--primary)]">{msg}</p>}
        {error && (
          <p className="text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="clinical-card p-5">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Cohort / learner competency graph
        </h2>
        <CompetencyGraphView admin />
      </section>
    </div>
  );
}
