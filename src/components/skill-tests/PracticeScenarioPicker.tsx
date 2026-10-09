"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { sessionStartErrorKey } from "@/lib/session-start-error";

export type PracticeDisorder = {
  slug: string;
  /** Avatar ids whose age and gender fit this disorder. */
  patientIds: string[];
};

export type PracticePatient = { id: string; name: string };

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;

/**
 * Practice mode: the trainee picks a disorder, a patient who can present with
 * it, and a difficulty. Starts a standalone session through the Case Engine
 * (`disorderSlug`), so it never touches an open therapy course.
 */
export function PracticeScenarioPicker({
  disorders,
  patients,
}: {
  disorders: PracticeDisorder[];
  patients: PracticePatient[];
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("skillTests.practice");
  const tStart = useTranslations("session.start");
  const tD = useTranslations("skillTests.disorders");
  const tLevel = useTranslations("skillTests.difficulty");
  const [disorder, setDisorder] = useState<string>(disorders[0]?.slug ?? "");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]>("beginner");
  const [patientId, setPatientId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = useMemo(() => {
    const ids = new Set(
      disorders.find((d) => d.slug === disorder)?.patientIds ?? [],
    );
    return patients.filter((p) => ids.has(p.id));
  }, [disorder, disorders, patients]);
  const selectedPatient =
    eligible.find((p) => p.id === patientId)?.id ?? eligible[0]?.id ?? "";

  async function start() {
    if (!selectedPatient || !disorder) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId: selectedPatient,
          disorderSlug: disorder,
          difficulty,
          locale,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        sessionId?: string;
        code?: string;
      };
      if (!res.ok || !data.sessionId) {
        setError(
          res.ok
            ? t("startFailed")
            : tStart(sessionStartErrorKey(res.status, data.code)),
        );
        setLoading(false);
        return;
      }
      router.push(`/sessions/${data.sessionId}`);
    } catch {
      setError(t("networkError"));
      setLoading(false);
    }
  }

  if (disorders.length === 0 || patients.length === 0) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">{t("empty")}</p>
    );
  }

  return (
    <div className="clinical-card space-y-5 p-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-[var(--on-surface)]">
          {t("chooseDisorder")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {disorders.map((d) => (
            <label
              key={d.slug}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                d.slug === disorder
                  ? "border-[var(--primary)] bg-[var(--surface-container)] font-semibold"
                  : "border-[var(--outline-variant)]"
              } ${d.patientIds.length === 0 ? "opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="practice-disorder"
                value={d.slug}
                checked={d.slug === disorder}
                disabled={d.patientIds.length === 0}
                onChange={() => {
                  setDisorder(d.slug);
                  setPatientId("");
                }}
              />
              {tD(d.slug)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("choosePatient")}</span>
          <select
            className="field-input w-full"
            value={selectedPatient}
            onChange={(e) => setPatientId(e.target.value)}
            disabled={eligible.length === 0}
          >
            {eligible.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {eligible.length === 0 && (
            <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
              {t("noPatientFits")}
            </span>
          )}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("chooseDifficulty")}</span>
          <select
            className="field-input w-full"
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
      </div>

      <button
        type="button"
        className="btn-primary w-full sm:w-auto"
        onClick={() => void start()}
        disabled={loading || !selectedPatient}
        aria-busy={loading}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden>
          play_circle
        </span>
        {loading ? t("starting") : t("start")}
      </button>
      <p className="text-xs text-[var(--on-surface-variant)]">{t("hint")}</p>
      {error && (
        <p role="alert" className="text-sm text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}
