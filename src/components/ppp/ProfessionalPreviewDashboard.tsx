"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PppDashboard } from "@/lib/ppp";

type ApiResponse = {
  dashboard: PppDashboard;
  source?: string;
  warning?: string;
  warnings?: string[];
};

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

export function ProfessionalPreviewDashboard() {
  const t = useTranslations("admin.preview");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/ppp/dashboard");
        const body = (await res.json()) as ApiResponse & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(body.error ?? t("loadError"));
          return;
        }
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError(t("loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">{t("loading")}</p>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-[var(--error)]" role="alert">
        {error ?? t("loadError")}
      </p>
    );
  }

  const d = data.dashboard;
  const idx = d.indices;

  const monitorCards = [
    { label: t("metrics.reviewers"), value: d.reviewers.active },
    { label: t("metrics.completedSessions"), value: d.sessions.completed },
    {
      label: t("metrics.avgRealism"),
      value: fmt(d.ratings.avg_realism),
      hint: "/5",
    },
    {
      label: t("metrics.avgEducational"),
      value: fmt(d.ratings.avg_educational_value),
      hint: "/5",
    },
    { label: t("metrics.issues"), value: d.issues.total },
    {
      label: t("metrics.opportunities"),
      value: d.educational_opportunities.total,
    },
    {
      label: t("metrics.blindScores"),
      value: d.blind_scores.count,
      hint:
        d.blind_scores.avg_overall_realism != null
          ? `avg ${fmt(d.blind_scores.avg_overall_realism)}/5`
          : undefined,
    },
    {
      label: t("metrics.avgConversation"),
      value: fmt(d.sessions.avg_conversation_length, 0),
      hint: t("metrics.turns"),
    },
    {
      label: t("metrics.completionRate"),
      value:
        d.sessions.completion_rate_pct != null
          ? `${fmt(d.sessions.completion_rate_pct)}%`
          : "—",
    },
  ];

  const indexCards = [
    {
      key: "clinical_authenticity_index",
      label: t("indices.clinicalAuthenticity"),
      value: idx.clinical_authenticity_index,
    },
    {
      key: "educational_value_index",
      label: t("indices.educationalValue"),
      value: idx.educational_value_index,
    },
    {
      key: "conversation_naturalness_index",
      label: t("indices.conversationNaturalness"),
      value: idx.conversation_naturalness_index,
    },
    {
      key: "therapeutic_alliance_score",
      label: t("indices.therapeuticAlliance"),
      value: idx.therapeutic_alliance_score,
    },
    {
      key: "patient_believability_score",
      label: t("indices.patientBelievability"),
      value: idx.patient_believability_score,
    },
    {
      key: "learning_impact_score",
      label: t("indices.learningImpact"),
      value: idx.learning_impact_score,
    },
    {
      key: "voice_realism_score",
      label: t("indices.voiceRealism"),
      value: idx.voice_realism_score,
      n: idx.voice_sample_size,
    },
    {
      key: "arabic_quality_score",
      label: t("indices.arabicQuality"),
      value: idx.arabic_quality_score,
      n: idx.arabic_sample_size,
    },
    {
      key: "english_quality_score",
      label: t("indices.englishQuality"),
      value: idx.english_quality_score,
      n: idx.english_sample_size,
    },
  ];

  return (
    <div className="space-y-8">
      {(data.warning || data.source === "unavailable") && (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--secondary)_40%,transparent)] bg-[color-mix(in_srgb,var(--secondary-container)_20%,transparent)] px-4 py-3 text-sm text-[var(--on-surface)]">
          {data.warning ?? t("migrationNeeded")}
        </p>
      )}

      <p className="text-xs text-[var(--on-surface-variant)]">{d.disclaimer}</p>

      <section>
        <h2 className="mb-4 font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("monitorTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {monitorCards.map((card) => (
            <div key={card.label} className="clinical-card p-5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                {card.label}
              </p>
              <p className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
                {card.value}
                {card.hint ? (
                  <span className="ms-1 text-sm font-medium text-[var(--on-surface-variant)]">
                    {card.hint}
                  </span>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("analyticsTitle")}
        </h2>
        <p className="mb-4 text-sm text-[var(--on-surface-variant)]">
          {t("analyticsSubtitle", { n: idx.sample_size })}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {indexCards.map((card) => (
            <div key={card.key} className="clinical-card p-5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                {card.label}
              </p>
              <p className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--secondary)]">
                {card.value == null ? "—" : fmt(card.value)}
                {card.value != null ? (
                  <span className="ms-1 text-sm font-medium text-[var(--on-surface-variant)]">
                    /100
                  </span>
                ) : null}
              </p>
              {typeof card.n === "number" ? (
                <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
                  {t("sampleN", { n: card.n })}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="clinical-card p-5">
          <h3 className="font-[family-name:var(--font-headline)] text-base font-semibold">
            {t("issuesBySeverity")}
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {(
              ["critical", "high", "medium", "wishlist"] as const
            ).map((sev) => (
              <li
                key={sev}
                className="flex justify-between border-b border-[var(--outline-variant)] py-2"
              >
                <span className="capitalize text-[var(--on-surface-variant)]">
                  {sev}
                </span>
                <span className="font-semibold">{d.issues.by_severity[sev]}</span>
              </li>
            ))}
            <li className="flex justify-between py-2">
              <span className="text-[var(--on-surface-variant)]">
                {t("openIssues")}
              </span>
              <span className="font-semibold">{d.issues.open}</span>
            </li>
          </ul>
        </div>

        <div className="clinical-card p-5">
          <h3 className="font-[family-name:var(--font-headline)] text-base font-semibold">
            {t("commonRequests")}
          </h3>
          {d.feature_requests.common.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
              {t("noRequests")}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {d.feature_requests.common.map((fr) => (
                <li key={fr.theme}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium capitalize">{fr.theme}</span>
                    <span className="text-[var(--on-surface-variant)]">
                      {fr.count}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                    {fr.sample_titles.join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="text-[11px] text-[var(--outline)]">
        {t("generatedAt", { at: d.generated_at })}
        {data.source ? ` · ${data.source}` : ""}
      </p>
    </div>
  );
}
