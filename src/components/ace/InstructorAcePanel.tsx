"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("admin.curriculum.panel");
  const tDifficulty = useTranslations("skillTests.difficulty");
  const tProfession = useTranslations("admin.catalogEnums.targetLearner");
  // Engine values are English snake_case ids; show the translated label.
  const named = (group: "trainingLevels" | "certification", id: string) =>
    t.has(`${group}.${id}`) ? t(`${group}.${id}`) : id.replace(/_/g, " ");
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [selected, setSelected] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState("");
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
      setError(data.error ?? t("updateFailed"));
      return;
    }
    setMsg(t("saved"));
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
      setError(data.error ?? t("analyticsFailed"));
      return;
    }
    setAnalytics(JSON.stringify(data, null, 2));
  }

  return (
    <div className="space-y-6">
      <section className="clinical-card p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("learners")}
        </h2>
        {learners.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("empty")}
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
                  className={`w-full rounded-lg border px-3 py-2 text-start ${
                    selected === l.id
                      ? "border-[var(--primary)] bg-[var(--surface-container)]"
                      : "border-[var(--outline-variant)]"
                  }`}
                >
                  <span className="font-medium">
                    {tProfession.has(l.profession)
                      ? tProfession(l.profession)
                      : l.profession.replace(/_/g, " ")}
                  </span>
                  <span className="ms-2 text-[11px] text-[var(--on-surface-variant)]">
                    {named("trainingLevels", l.training_level)} ·{" "}
                    {t("cases", { count: l.completed_case_count })} ·{" "}
                    {t("confidence", { score: l.confidence_score })} ·{" "}
                    {named("certification", l.certification_status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="clinical-card space-y-3 p-5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("controls")}
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={adaptiveMode}
            onChange={(e) => setAdaptiveMode(e.target.checked)}
          />
          {t("adaptiveMode")}
        </label>
        <label className="block text-sm">
          {t("minThreshold")}
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
          {t("maxDifficulty")}
          <select
            value={maxDifficulty}
            onChange={(e) => setMaxDifficulty(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
          >
            <option value="beginner">{tDifficulty("beginner")}</option>
            <option value="intermediate">{tDifficulty("intermediate")}</option>
            <option value="advanced">{tDifficulty("advanced")}</option>
            <option value="expert">{tDifficulty("expert")}</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveControls}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-[var(--on-primary)]"
          >
            {t("save")}
          </button>
          <button
            type="button"
            onClick={loadAnalytics}
            className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm"
          >
            {t("viewAnalytics")}
          </button>
        </div>
        {msg && <p className="text-sm text-[var(--primary)]">{msg}</p>}
        {error && (
          <p className="text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}
        {analytics && (
          <pre className="max-h-96 overflow-auto rounded-lg bg-[var(--surface-container-low)] p-3 text-xs">
            {analytics}
          </pre>
        )}
      </section>
    </div>
  );
}
