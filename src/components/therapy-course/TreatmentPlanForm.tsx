"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FIVE_PS, type FivePsFormulation, type TreatmentPlan } from "@/lib/types";

const MAX_GOALS = 6;
const MAX_SESSIONS = 20;

type FieldError =
  | "formulation"
  | "goals"
  | "interventions"
  | "expected_sessions"
  | "patient_expectations"
  | "risk_formulation"
  | "five_ps";

const EMPTY_FIVE_PS: FivePsFormulation = {
  presenting: "",
  predisposing: "",
  precipitating: "",
  perpetuating: "",
  protective: "",
};

export function TreatmentPlanForm({
  courseId,
  initialPlan,
  minSessions,
}: {
  courseId: string;
  initialPlan: TreatmentPlan | null;
  minSessions: number;
}) {
  const t = useTranslations("course");
  const router = useRouter();
  const [formulation, setFormulation] = useState(initialPlan?.formulation ?? "");
  const [goals, setGoals] = useState<string[]>(
    initialPlan?.goals.length ? initialPlan.goals : [""],
  );
  const [interventions, setInterventions] = useState(
    initialPlan?.interventions ?? "",
  );
  const [expectedSessions, setExpectedSessions] = useState<number>(
    Math.max(initialPlan?.expected_sessions ?? 8, minSessions),
  );
  const [expectations, setExpectations] = useState(
    initialPlan?.patient_expectations ?? "",
  );
  const [risk, setRisk] = useState(initialPlan?.risk_formulation ?? "");
  const [fivePs, setFivePs] = useState<FivePsFormulation>(
    initialPlan?.five_ps ?? EMPTY_FIVE_PS,
  );
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/courses/${courseId}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formulation,
          goals: goals.map((g) => g.trim()).filter(Boolean),
          interventions,
          expected_sessions: expectedSessions,
          patient_expectations: expectations,
          risk_formulation: risk,
          five_ps: fivePs,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        field?: FieldError;
      };
      if (!res.ok) {
        if (data.field) {
          setFieldError(data.field);
        } else {
          setError(t(planErrorKey(res.status, data.code)));
        }
        setSaving(false);
        return;
      }
      setSaved(true);
      setSaving(false);
      router.refresh();
    } catch {
      setError(t("errors.network"));
      setSaving(false);
    }
  }

  const fieldClass = "field-input w-full";
  const err = (f: FieldError) =>
    fieldError === f ? (
      <p className="mt-1 text-sm text-[var(--error)]" role="alert">
        {t(`errors.${f}`, { min: minSessions })}
      </p>
    ) : null;

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
      <p className="text-sm text-[var(--on-surface-variant)]">
        {t("planFormIntro")}
      </p>

      <div>
        <label htmlFor="plan-formulation" className="block text-sm font-semibold">
          {t("fieldFormulation")}
        </label>
        <p className="mb-1 text-xs text-[var(--on-surface-variant)]">
          {t("fieldFormulationHint")}
        </p>
        <textarea
          id="plan-formulation"
          className={fieldClass}
          rows={4}
          maxLength={2000}
          value={formulation}
          onChange={(e) => setFormulation(e.target.value)}
          aria-invalid={fieldError === "formulation"}
          dir="auto"
        />
        {err("formulation")}
      </div>

      <fieldset>
        <legend className="block text-sm font-semibold">{t("fivePs.title")}</legend>
        <p className="mb-2 text-xs text-[var(--on-surface-variant)]">
          {t("fivePs.hint")}
        </p>
        <div className="space-y-3">
          {FIVE_PS.map((p) => (
            <div key={p}>
              <label htmlFor={`plan-5p-${p}`} className="block text-sm font-medium">
                {t(`fivePs.${p}`)}
              </label>
              <p className="mb-1 text-xs text-[var(--on-surface-variant)]">
                {t(`fivePs.${p}Hint`)}
              </p>
              <textarea
                id={`plan-5p-${p}`}
                className={fieldClass}
                rows={2}
                maxLength={600}
                value={fivePs[p]}
                onChange={(e) => {
                  const value = e.target.value;
                  setFivePs((prev) => ({ ...prev, [p]: value }));
                }}
                aria-invalid={fieldError === "five_ps" && fivePs[p].trim().length < 3}
                dir="auto"
              />
            </div>
          ))}
        </div>
        {err("five_ps")}
      </fieldset>

      <fieldset>
        <legend className="block text-sm font-semibold">{t("fieldGoals")}</legend>
        <p className="mb-1 text-xs text-[var(--on-surface-variant)]">
          {t("fieldGoalsHint")}
        </p>
        <ol className="space-y-2">
          {goals.map((goal, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="text"
                className={fieldClass}
                maxLength={300}
                placeholder={t("goalPlaceholder", { n: i + 1 })}
                aria-label={t("goalPlaceholder", { n: i + 1 })}
                value={goal}
                onChange={(e) =>
                  setGoals((g) => g.map((v, j) => (j === i ? e.target.value : v)))
                }
                aria-invalid={fieldError === "goals"}
                dir="auto"
              />
              {goals.length > 1 && (
                <button
                  type="button"
                  className="btn-secondary h-10 w-10 shrink-0 p-0"
                  onClick={() => setGoals((g) => g.filter((_, j) => j !== i))}
                  aria-label={t("removeGoal", { n: i + 1 })}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </li>
          ))}
        </ol>
        {goals.length < MAX_GOALS && (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]"
            onClick={() => setGoals((g) => [...g, ""])}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("addGoal")}
          </button>
        )}
        {err("goals")}
      </fieldset>

      <div>
        <label htmlFor="plan-interventions" className="block text-sm font-semibold">
          {t("fieldInterventions")}
        </label>
        <p className="mb-1 text-xs text-[var(--on-surface-variant)]">
          {t("fieldInterventionsHint")}
        </p>
        <textarea
          id="plan-interventions"
          className={fieldClass}
          rows={3}
          maxLength={2000}
          value={interventions}
          onChange={(e) => setInterventions(e.target.value)}
          aria-invalid={fieldError === "interventions"}
          dir="auto"
        />
        {err("interventions")}
      </div>

      <div>
        <label htmlFor="plan-sessions" className="block text-sm font-semibold">
          {t("fieldExpectedSessions")}
        </label>
        <p className="mb-1 text-xs text-[var(--on-surface-variant)]">
          {t("fieldExpectedSessionsHint", { min: minSessions, max: MAX_SESSIONS })}
        </p>
        <input
          id="plan-sessions"
          type="number"
          inputMode="numeric"
          className="field-input w-28"
          min={minSessions}
          max={MAX_SESSIONS}
          value={expectedSessions}
          onChange={(e) => setExpectedSessions(Number(e.target.value))}
          aria-invalid={fieldError === "expected_sessions"}
        />
        {err("expected_sessions")}
      </div>

      <div>
        <label htmlFor="plan-expectations" className="block text-sm font-semibold">
          {t("fieldPatientExpectations")}
        </label>
        <p className="mb-1 text-xs text-[var(--on-surface-variant)]">
          {t("fieldPatientExpectationsHint")}
        </p>
        <textarea
          id="plan-expectations"
          className={fieldClass}
          rows={3}
          maxLength={1500}
          value={expectations}
          onChange={(e) => setExpectations(e.target.value)}
          aria-invalid={fieldError === "patient_expectations"}
          dir="auto"
        />
        {err("patient_expectations")}
      </div>

      <div>
        <label htmlFor="plan-risk" className="block text-sm font-semibold">
          {t("fieldRisk")}
        </label>
        <p className="mb-1 text-xs text-[var(--on-surface-variant)]">
          {t("fieldRiskHint")}
        </p>
        <textarea
          id="plan-risk"
          className={fieldClass}
          rows={3}
          maxLength={1500}
          value={risk}
          onChange={(e) => setRisk(e.target.value)}
          aria-invalid={fieldError === "risk_formulation"}
          dir="auto"
        />
        {err("risk_formulation")}
      </div>

      <button type="submit" className="btn-primary h-11 w-full" disabled={saving}>
        <span className="material-symbols-outlined text-[20px]">assignment</span>
        {saving ? t("saving") : initialPlan ? t("savePlan") : t("submitPlan")}
      </button>
      {error && (
        <p className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm text-[var(--primary)]" role="status">
          {t("planSaved")}
        </p>
      )}
    </form>
  );
}

/** The API's error text is English; pick the learner copy from code/status. */
function planErrorKey(status: number, code?: string) {
  if (code === "course_completed") return "errors.courseCompleted" as const;
  if (code === "plan_too_early") return "errors.tooEarly" as const;
  if (status === 401) return "errors.signedOut" as const;
  if (status === 429) return "errors.rateLimited" as const;
  return "errors.generic" as const;
}
