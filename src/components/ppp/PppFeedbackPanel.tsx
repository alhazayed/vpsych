"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

type Props = {
  sessionId: string;
};

type Tab = "ratings" | "cqi" | "eoi";

const LIKERT = [1, 2, 3, 4, 5] as const;

/**
 * Post-session expert feedback: ratings, CQI issues, educational opportunities.
 * Simulation behaviour is unchanged — this only collects reviewer input.
 */
export function PppFeedbackPanel({ sessionId }: Props) {
  const t = useTranslations("ppp.feedback");
  const [tab, setTab] = useState<Tab>("ratings");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ratings, setRatings] = useState({
    clinicalRealism: 0,
    educationalValue: 0,
    conversationNaturalness: 0,
    therapeuticAlliance: 0,
    patientBelievability: 0,
    learningImpact: 0,
    voiceRealism: 0,
    arabicQuality: 0,
    englishQuality: 0,
    usedVoice: false,
    freeText: "",
  });

  const [cqi, setCqi] = useState({
    severity: "medium",
    category: "clinical_realism",
    title: "",
    description: "",
  });

  const [eoi, setEoi] = useState({
    opportunityType: "strong_teaching_moment",
    competencyArea: "",
    title: "",
    description: "",
  });

  function setRating(key: keyof typeof ratings, value: number | boolean | string) {
    setRatings((r) => ({ ...r, [key]: value }));
  }

  function submitRatings() {
    setError(null);
    setMessage(null);
    const required = [
      ratings.clinicalRealism,
      ratings.educationalValue,
      ratings.conversationNaturalness,
      ratings.therapeuticAlliance,
      ratings.patientBelievability,
      ratings.learningImpact,
    ];
    if (required.some((v) => v < 1)) {
      setError(t("ratingsRequired"));
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/sessions/${sessionId}/ppp-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicalRealism: ratings.clinicalRealism,
          educationalValue: ratings.educationalValue,
          conversationNaturalness: ratings.conversationNaturalness,
          therapeuticAlliance: ratings.therapeuticAlliance,
          patientBelievability: ratings.patientBelievability,
          learningImpact: ratings.learningImpact,
          voiceRealism: ratings.voiceRealism || null,
          arabicQuality: ratings.arabicQuality || null,
          englishQuality: ratings.englishQuality || null,
          usedVoice: ratings.usedVoice,
          freeText: ratings.freeText,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setError(body?.error ?? t("submitError"));
        return;
      }
      setMessage(t("ratingsSaved"));
    });
  }

  function submitCqi() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/ppp/cqi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cqi, sessionId }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setError(body?.error ?? t("submitError"));
        return;
      }
      setMessage(t("cqiSaved"));
      setCqi((c) => ({ ...c, title: "", description: "" }));
    });
  }

  function submitEoi() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/ppp/educational-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityType: eoi.opportunityType,
          competencyArea: eoi.competencyArea,
          title: eoi.title,
          description: eoi.description,
          sessionId,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setError(body?.error ?? t("submitError"));
        return;
      }
      setMessage(t("eoiSaved"));
      setEoi((e) => ({ ...e, title: "", description: "", competencyArea: "" }));
    });
  }

  const ratingFields = [
    { key: "clinicalRealism" as const, label: t("fields.clinicalRealism") },
    { key: "educationalValue" as const, label: t("fields.educationalValue") },
    {
      key: "conversationNaturalness" as const,
      label: t("fields.conversationNaturalness"),
    },
    {
      key: "therapeuticAlliance" as const,
      label: t("fields.therapeuticAlliance"),
    },
    {
      key: "patientBelievability" as const,
      label: t("fields.patientBelievability"),
    },
    { key: "learningImpact" as const, label: t("fields.learningImpact") },
  ];

  const optionalFields = [
    { key: "voiceRealism" as const, label: t("fields.voiceRealism") },
    { key: "englishQuality" as const, label: t("fields.englishQuality") },
    { key: "arabicQuality" as const, label: t("fields.arabicQuality") },
  ];

  return (
    <section className="clinical-card mb-4 overflow-hidden fade-in-up">
      <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-5 py-4">
        <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--outline-variant)] px-2 pt-2">
        {(
          [
            ["ratings", t("tabs.ratings")],
            ["cqi", t("tabs.cqi")],
            ["eoi", t("tabs.eoi")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setError(null);
              setMessage(null);
            }}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? "bg-[var(--surface)] text-[var(--primary)]"
                : "text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-5">
        {tab === "ratings" && (
          <>
            {ratingFields.map((f) => (
              <LikertRow
                key={f.key}
                label={f.label}
                value={ratings[f.key]}
                onChange={(v) => setRating(f.key, v)}
                scaleLabel={t("scale")}
              />
            ))}
            <label className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
              <input
                type="checkbox"
                checked={ratings.usedVoice}
                onChange={(e) => setRating("usedVoice", e.target.checked)}
              />
              {t("usedVoice")}
            </label>
            {optionalFields.map((f) => (
              <LikertRow
                key={f.key}
                label={`${f.label} (${t("optional")})`}
                value={ratings[f.key]}
                onChange={(v) => setRating(f.key, v)}
                scaleLabel={t("scale")}
              />
            ))}
            <textarea
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
              rows={3}
              placeholder={t("freeTextPlaceholder")}
              value={ratings.freeText}
              onChange={(e) => setRating("freeText", e.target.value)}
            />
            <button
              type="button"
              className="btn-primary h-10 px-5"
              disabled={pending}
              onClick={submitRatings}
            >
              {pending ? t("saving") : t("submitRatings")}
            </button>
          </>
        )}

        {tab === "cqi" && (
          <>
            <p className="text-sm text-[var(--on-surface-variant)]">{t("cqiHelp")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                value={cqi.severity}
                onChange={(e) =>
                  setCqi((c) => ({ ...c, severity: e.target.value }))
                }
              >
                {(["critical", "high", "medium", "wishlist"] as const).map(
                  (s) => (
                    <option key={s} value={s}>
                      {t(`severity.${s}`)}
                    </option>
                  ),
                )}
              </select>
              <select
                className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                value={cqi.category}
                onChange={(e) =>
                  setCqi((c) => ({ ...c, category: e.target.value }))
                }
              >
                {(
                  [
                    "clinical_realism",
                    "conversation",
                    "voice_tts",
                    "assessment",
                    "safety",
                    "ui_ux",
                    "bilingual",
                    "other",
                  ] as const
                ).map((c) => (
                  <option key={c} value={c}>
                    {t(`category.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <input
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
              placeholder={t("issueTitle")}
              value={cqi.title}
              onChange={(e) => setCqi((c) => ({ ...c, title: e.target.value }))}
            />
            <textarea
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
              rows={4}
              placeholder={t("issueDescription")}
              value={cqi.description}
              onChange={(e) =>
                setCqi((c) => ({ ...c, description: e.target.value }))
              }
            />
            <button
              type="button"
              className="btn-primary h-10 px-5"
              disabled={pending}
              onClick={submitCqi}
            >
              {pending ? t("saving") : t("submitCqi")}
            </button>
          </>
        )}

        {tab === "eoi" && (
          <>
            <p className="text-sm text-[var(--on-surface-variant)]">{t("eoiHelp")}</p>
            <select
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
              value={eoi.opportunityType}
              onChange={(e) =>
                setEoi((x) => ({ ...x, opportunityType: e.target.value }))
              }
            >
              {(
                [
                  "missed_teaching_moment",
                  "strong_teaching_moment",
                  "curriculum_gap",
                  "competency_focus",
                  "supervision_use_case",
                  "other",
                ] as const
              ).map((o) => (
                <option key={o} value={o}>
                  {t(`eoiType.${o}`)}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
              placeholder={t("competencyArea")}
              value={eoi.competencyArea}
              onChange={(e) =>
                setEoi((x) => ({ ...x, competencyArea: e.target.value }))
              }
            />
            <input
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
              placeholder={t("eoiTitle")}
              value={eoi.title}
              onChange={(e) => setEoi((x) => ({ ...x, title: e.target.value }))}
            />
            <textarea
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
              rows={4}
              placeholder={t("eoiDescription")}
              value={eoi.description}
              onChange={(e) =>
                setEoi((x) => ({ ...x, description: e.target.value }))
              }
            />
            <button
              type="button"
              className="btn-primary h-10 px-5"
              disabled={pending}
              onClick={submitEoi}
            >
              {pending ? t("saving") : t("submitEoi")}
            </button>
          </>
        )}

        {error ? (
          <p className="text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm font-medium text-[var(--primary)]">{message}</p>
        ) : null}
      </div>
    </section>
  );
}

function LikertRow({
  label,
  value,
  onChange,
  scaleLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  scaleLabel: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-[var(--on-surface)]">
          {label}
        </span>
        <span className="text-[11px] text-[var(--on-surface-variant)]">
          {scaleLabel}
        </span>
      </div>
      <div className="flex gap-2">
        {LIKERT.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
              value === n
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]"
            }`}
            aria-pressed={value === n}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
