"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type FormTrainee = { id: string; displayName: string; email: string };
export type FormPatient = { id: string; name: string };
export type FormDisorder = {
  slug: string;
  allowedComorbidities: string[];
  patientIds: string[];
};

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;
const SEVERITIES = ["", "subclinical", "mild", "moderate", "severe"] as const;
const MAX_COMORBIDITIES = 2;

/** Supervisor designs a test patient and assigns it to one trainee. */
export function SkillTestForm({
  trainees,
  patients,
  disorders,
}: {
  trainees: FormTrainee[];
  patients: FormPatient[];
  disorders: FormDisorder[];
}) {
  const router = useRouter();
  const t = useTranslations("skillTests.form");
  const tD = useTranslations("skillTests.disorders");
  const tLevel = useTranslations("skillTests.difficulty");
  const tSev = useTranslations("skillTests.severity");
  const [traineeId, setTraineeId] = useState("");
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"en-US" | "ar-JO">("en-US");
  const [disorderSlug, setDisorderSlug] = useState(disorders[0]?.slug ?? "");
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [patientId, setPatientId] = useState("");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]>("intermediate");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("");
  const [requiredSessions, setRequiredSessions] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disorder = disorders.find((d) => d.slug === disorderSlug);
  const eligiblePatients = useMemo(() => {
    const ids = new Set(disorder?.patientIds ?? []);
    return patients.filter((p) => ids.has(p.id));
  }, [disorder, patients]);
  const selectedPatient =
    eligiblePatients.find((p) => p.id === patientId)?.id ??
    eligiblePatients[0]?.id ??
    "";

  function toggleComorbidity(slug: string) {
    setComorbidities((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX_COMORBIDITIES
          ? prev
          : [...prev, slug],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/skill-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traineeId,
          avatarId: selectedPatient,
          title,
          language,
          disorderSlug,
          comorbiditySlugs: comorbidities,
          difficulty,
          severity: severity || null,
          requiredSessions,
          traineeInstructions: instructions,
          dueAt: dueAt || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.id) {
        setError(data.error ?? t("saveFailed"));
        setSaving(false);
        return;
      }
      router.push(`/supervise/${data.id}?created=1`);
      router.refresh();
    } catch {
      setError(t("networkError"));
      setSaving(false);
    }
  }

  if (trainees.length === 0) {
    return (
      <p className="clinical-card p-5 text-sm text-[var(--on-surface-variant)]">
        {t("noTrainees")}
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="clinical-card space-y-5 p-5">
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">{t("trainee")}</span>
        <select
          required
          className="field-input"
          value={traineeId}
          onChange={(e) => setTraineeId(e.target.value)}
        >
          <option value="">{t("chooseTrainee")}</option>
          {trainees.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.displayName} ({tr.email})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold">{t("title")}</span>
        <input
          required
          maxLength={120}
          className="field-input"
          value={title}
          placeholder={t("titlePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("disorder")}</legend>
        <select
          className="field-input"
          value={disorderSlug}
          onChange={(e) => {
            setDisorderSlug(e.target.value);
            setComorbidities([]);
            setPatientId("");
          }}
        >
          {disorders.map((d) => (
            <option key={d.slug} value={d.slug} disabled={d.patientIds.length === 0}>
              {tD(d.slug)}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">{t("comorbidities")}</legend>
        <p className="mb-2 text-xs text-[var(--on-surface-variant)]">
          {t("comorbiditiesHint")}
        </p>
        {disorder && disorder.allowedComorbidities.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {disorder.allowedComorbidities.map((slug) => {
              const on = comorbidities.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleComorbidity(slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    on
                      ? "border-[var(--primary)] bg-[var(--surface-container)] text-[var(--primary)]"
                      : "border-[var(--outline-variant)] text-[var(--on-surface-variant)]"
                  }`}
                >
                  {tD(slug)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[var(--on-surface-variant)]">
            {t("noComorbidities")}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("patient")}</span>
          <select
            className="field-input"
            value={selectedPatient}
            onChange={(e) => setPatientId(e.target.value)}
            disabled={eligiblePatients.length === 0}
          >
            {eligiblePatients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {eligiblePatients.length === 0 && (
            <span className="mt-1 block text-xs text-[var(--error)]">
              {t("noPatientFits")}
            </span>
          )}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("language")}</span>
          <select
            className="field-input"
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en-US" | "ar-JO")}
          >
            <option value="en-US">{t("languageEn")}</option>
            <option value="ar-JO">{t("languageAr")}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("difficulty")}</span>
          <select
            className="field-input"
            value={difficulty}
            onChange={(e) =>
              setDifficulty(e.target.value as (typeof DIFFICULTIES)[number])
            }
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {tLevel(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("severity")}</span>
          <select
            className="field-input"
            value={severity}
            onChange={(e) =>
              setSeverity(e.target.value as (typeof SEVERITIES)[number])
            }
          >
            {SEVERITIES.map((s) => (
              <option key={s || "default"} value={s}>
                {s ? tSev(s) : t("severityDefault")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("requiredSessions")}</span>
          <input
            type="number"
            min={1}
            max={12}
            required
            className="field-input"
            value={requiredSessions}
            onChange={(e) => setRequiredSessions(Number(e.target.value))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("dueAt")}</span>
          <input
            type="date"
            className="field-input"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold">{t("instructions")}</span>
        <textarea
          maxLength={1000}
          rows={3}
          className="field-input"
          value={instructions}
          placeholder={t("instructionsPlaceholder")}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
          {t("instructionsHint")}
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-[var(--error)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="btn-primary"
        disabled={saving || !selectedPatient || !traineeId}
        aria-busy={saving}
      >
        {saving ? t("saving") : t("submit")}
      </button>
    </form>
  );
}
