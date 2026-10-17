"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { codeLabel } from "@/lib/admin/ops-text";
import { CompetencyGraphView } from "./CompetencyGraphView";

type Learner = {
  id: string;
  user_id: string;
  profession: string;
  training_level: string;
  completed_case_count: number;
  confidence_score: number;
};

type GraphAction =
  | "lock"
  | "unlock"
  | "approve_mastery"
  | "require_reassessment";

export function InstructorGraphPanel() {
  const t = useTranslations("admin.graphPage");
  const tEnums = useTranslations("admin.catalogEnums");
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

  async function act(action: GraphAction) {
    setError(null);
    setMsg(null);
    if (!selected) return;
    // These change a real trainee's competency record immediately.
    const learner = learners.find((l) => l.id === selected);
    const who = learner
      ? t("learnerDescription", {
          profession: codeLabel(tEnums, "targetLearner", learner.profession),
          count: learner.completed_case_count,
        })
      : t("thisLearner");
    const verb = t(`actions.${action}`);
    if (!window.confirm(t("confirm", { action: verb, competencyId, who }))) {
      return;
    }
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
      setError(data.error ?? t("actionFailed"));
      return;
    }
    setMsg(t("applied", { action: verb, competencyId }));
  }

  return (
    <div className="space-y-8">
      <section className="clinical-card space-y-3 p-5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("controls")}
        </h2>
        <label className="block text-sm">
          {t("learner")}
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
          >
            {learners.length === 0 && (
              <option value="">{t("noLearners")}</option>
            )}
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {t("learnerOption", {
                  profession: codeLabel(tEnums, "targetLearner", l.profession),
                  cases: l.completed_case_count,
                  confidence: l.confidence_score,
                })}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          {t("competencyId")}
          <input
            dir="ltr"
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
            {t("actions.lock")}
          </button>
          <button
            type="button"
            onClick={() => act("unlock")}
            className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
          >
            {t("actions.unlock")}
          </button>
          <button
            type="button"
            onClick={() => act("approve_mastery")}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm text-[var(--on-primary)]"
          >
            {t("actions.approve_mastery")}
          </button>
          <button
            type="button"
            onClick={() => act("require_reassessment")}
            className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
          >
            {t("actions.require_reassessment")}
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
          {t("graphTitle")}
        </h2>
        <CompetencyGraphView admin />
      </section>
    </div>
  );
}
