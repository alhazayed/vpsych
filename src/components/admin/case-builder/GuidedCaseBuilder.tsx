"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ContextualHelp } from "@/components/admin/help/ContextualHelp";
import { CaseReadinessPanel } from "@/components/admin/CaseReadinessPanel";
import {
  COMMUNICATION_STYLES,
  GUIDED_STEPS,
  THERAPEUTIC_CHALLENGES,
  THERAPY_FRAMEWORKS,
  customGoal,
  emptyGuidedDraft,
  type GuidedCaseDraft,
  type GuidedStepId,
  type LibrarySymptom,
  type SessionGoalItem,
  type TrainingPresentation,
  type FrameworkOption,
} from "@/lib/admin/case-builder";
import type { CaseReadinessResult } from "@/lib/admin/virtual-patient";
import type { SymptomProfileItem } from "@/lib/types";

type CataloguesPayload = {
  presentations: TrainingPresentation[];
  goals: SessionGoalItem[];
  symptoms: LibrarySymptom[];
  frameworks: FrameworkOption[];
};

type Props = {
  voices: { id: string; voice_name: string }[];
  onSwitchAdvanced: () => void;
};

const fieldClass =
  "w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--on-surface)]";
const labelClass =
  "flex flex-col gap-1 text-xs font-medium text-[var(--outline)]";

export function GuidedCaseBuilder({ voices, onSwitchAdvanced }: Props) {
  const t = useTranslations("admin.caseBuilder");
  const tReady = useTranslations("admin.avatars.readiness");
  const [draft, setDraft] = useState<GuidedCaseDraft>(() =>
    emptyGuidedDraft({
      voiceProfileId: voices[0]?.id ?? null,
    }),
  );
  const [catalogues, setCatalogues] = useState<CataloguesPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchPresentation, setSearchPresentation] = useState("");
  const [searchGoal, setSearchGoal] = useState("");
  const [searchSymptom, setSearchSymptom] = useState("");
  const [selectedAiSymptoms, setSelectedAiSymptoms] = useState<Set<string>>(
    new Set(),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<CaseReadinessResult | null>(null);
  const [, startTransition] = useTransition();

  const readinessLabels = useMemo(
    () => ({
      title: tReady("title"),
      statusComplete: tReady("statusComplete"),
      statusWarning: tReady("statusWarning"),
      statusBlocked: tReady("statusBlocked"),
      readyToPublish: tReady("readyToPublish"),
      notReady: tReady("notReady"),
      publishUnavailable: tReady("publishUnavailable"),
      published: tReady("published"),
      archived: tReady("archived"),
      nextAction: tReady("nextAction"),
      reviewReadiness: tReady("reviewReadiness"),
      blockedCount: tReady("blockedCount"),
      arabicStubNote: tReady("arabicStubNote"),
      loading: tReady("loading"),
      loadFailed: tReady("loadFailed"),
    }),
    [tReady],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/case-builder/catalogues");
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
          };
          if (!cancelled) {
            setLoadError(
              data.code === "MFA_REQUIRED"
                ? t("mfaRequired")
                : data.error || t("cataloguesFailed"),
            );
          }
          return;
        }
        const data = (await res.json()) as CataloguesPayload;
        if (!cancelled) setCatalogues(data);
      } catch {
        if (!cancelled) setLoadError(t("cataloguesFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const stepIndex = GUIDED_STEPS.indexOf(draft.step);

  const filteredPresentations = useMemo(() => {
    const q = searchPresentation.trim().toLowerCase();
    const list = catalogues?.presentations ?? [];
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        p.categoryLabel.toLowerCase().includes(q) ||
        (p.dsm5_code ?? "").includes(q) ||
        (p.icd11_code ?? "").toLowerCase().includes(q),
    );
  }, [catalogues, searchPresentation]);

  const groupedPresentations = useMemo(() => {
    const map = new Map<string, TrainingPresentation[]>();
    for (const p of filteredPresentations) {
      const key = p.categoryLabel;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [filteredPresentations]);

  function patch(partial: Partial<GuidedCaseDraft>) {
    setDraft((d) => ({ ...d, ...partial, lastError: null }));
  }

  function go(step: GuidedStepId) {
    patch({ step });
  }

  function selectPresentation(p: TrainingPresentation) {
    patch({
      presentationId: p.id,
      presentationSlug: p.slug,
      presentationName: p.name,
      dsm5Code: p.dsm5_code,
      icd11Code: p.icd11_code,
      disclosureRules: p.disclosureRules ?? [],
      symptoms:
        draft.symptoms.length > 0
          ? draft.symptoms
          : (p.symptoms ?? []).slice(0, 6),
      goals:
        draft.goals.length > 0
          ? draft.goals
          : (p.sessionGoals ?? []).slice(0, 4).map((label, i) => ({
              id: `seed-${p.slug}-${i}`,
              label,
              category: "assessment" as const,
            })),
      sectionApprovals: { ...draft.sectionApprovals, presentation: true },
    });
  }

  async function runGenerate(kind: "symptoms" | "context" | "framework" | "case") {
    setBusy(kind);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/case-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, draft }),
      });
      const data = (await res.json()) as {
        error?: string;
        manualFallback?: boolean;
        result?: {
          kind: string;
          suggestions?: SymptomProfileItem[];
          structured?: GuidedCaseDraft["structuredContext"];
          primary?: GuidedCaseDraft["primaryFramework"];
          supporting?: GuidedCaseDraft["supportingFrameworks"];
          rationale?: string;
          generated?: GuidedCaseDraft["generated"];
        };
      };
      if (!res.ok) {
        setStatus(
          data.manualFallback
            ? `${data.error ?? t("aiUnavailable")} ${t("continueManually")}`
            : data.error || t("aiFailed"),
        );
        return;
      }
      const r = data.result;
      if (!r) {
        setStatus(t("aiFailed"));
        return;
      }
      if (r.kind === "symptoms" && r.suggestions) {
        patch({ aiSymptomSuggestions: r.suggestions });
        setSelectedAiSymptoms(new Set(r.suggestions.map((s) => s.id)));
        setStatus(t("aiSymptomsReady"));
      } else if (r.kind === "context" && r.structured) {
        patch({
          structuredContext: r.structured,
          structuredContextApproved: false,
        });
        setStatus(t("aiContextReady"));
      } else if (r.kind === "framework" && r.primary) {
        patch({
          primaryFramework: r.primary,
          supportingFrameworks: r.supporting ?? [],
          frameworkRationale: r.rationale ?? "",
        });
        setStatus(t("aiFrameworkReady"));
      } else if (r.kind === "case" && r.generated) {
        patch({
          generated: r.generated,
          sectionApprovals: {
            ...draft.sectionApprovals,
            generated: false,
          },
        });
        setStatus(t("aiCaseReady"));
      }
    } catch {
      setStatus(`${t("aiUnavailable")} ${t("continueManually")}`);
    } finally {
      setBusy(null);
    }
  }

  async function createPatient(skipApprovals = false) {
    setBusy("create");
    setStatus(null);
    try {
      const res = await fetch("/api/admin/case-builder/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, skipApprovals }),
      });
      const data = (await res.json()) as {
        error?: string;
        issues?: { message: string }[];
        avatarId?: string;
        slug?: string;
        fictionalNotice?: string;
      };
      if (!res.ok) {
        const detail = data.issues?.map((i) => i.message).join(" · ");
        setStatus(detail || data.error || t("createFailed"));
        return;
      }
      const newId = data.avatarId ?? null;
      setCreatedId(newId);
      patch({ avatarId: newId, slug: data.slug ?? draft.slug });
      setStatus(
        `${t("createSuccess")} ${data.fictionalNotice ?? t("fictionalBanner")}`,
      );
      if (newId) {
        try {
          const readyRes = await fetch(`/api/admin/avatars/${newId}/readiness`);
          if (readyRes.ok) {
            const readyData = (await readyRes.json()) as {
              readiness?: CaseReadinessResult;
            };
            if (readyData.readiness) setReadiness(readyData.readiness);
          }
        } catch {
          /* readiness panel stays empty; detail page still authoritative */
        }
      }
    } catch {
      setStatus(t("createFailed"));
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <div className="clinical-card space-y-3 p-6" role="alert">
        <p className="text-sm text-[var(--on-surface)]">{loadError}</p>
        <button type="button" className="btn-secondary" onClick={onSwitchAdvanced}>
          {t("useAdvanced")}
        </button>
      </div>
    );
  }

  if (!catalogues) {
    return (
      <div className="clinical-card p-6 text-sm text-[var(--on-surface-variant)]">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-3 text-sm text-[var(--on-surface)]"
        role="status"
      >
        {t("fictionalBanner")}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("stepsNav")} className="flex flex-wrap gap-1">
          {GUIDED_STEPS.map((id, i) => (
            <button
              key={id}
              type="button"
              aria-current={draft.step === id ? "step" : undefined}
              className={`rounded-md px-2 py-1 text-xs ${
                draft.step === id
                  ? "bg-[var(--primary)] text-[var(--on-primary)]"
                  : i < stepIndex
                    ? "bg-[var(--surface-container-high)] text-[var(--on-surface)]"
                    : "text-[var(--on-surface-variant)]"
              }`}
              onClick={() => go(id)}
            >
              {i + 1}. {t(`steps.${id}`)}
            </button>
          ))}
        </nav>
        <button type="button" className="btn-secondary text-xs" onClick={onSwitchAdvanced}>
          {t("advancedMode")}
        </button>
      </div>

      <div className="clinical-card space-y-5 p-6">
        {draft.step === "presentation" && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--on-surface)]">
              <ContextualHelp
                label={t("steps.presentation")}
                help={t("help.presentation")}
                variant="popover"
              />
            </h2>
            <label className={labelClass}>
              {t("searchPresentation")}
              <input
                className={fieldClass}
                value={searchPresentation}
                onChange={(e) => setSearchPresentation(e.target.value)}
              />
            </label>
            <div className="max-h-80 space-y-4 overflow-y-auto">
              {groupedPresentations.map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">
                    {cat}
                  </h3>
                  <ul className="space-y-1">
                    {items.map((p) => {
                      const selected = draft.presentationId === p.id;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            className={`w-full rounded-lg border px-3 py-2 text-start text-sm ${
                              selected
                                ? "border-[var(--primary)] bg-[var(--primary)]/10"
                                : "border-[var(--outline-variant)]"
                            }`}
                            onClick={() => selectPresentation(p)}
                          >
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-[var(--on-surface-variant)]">
                              {p.dsm5_code ? `DSM-5 ${p.dsm5_code}` : "DSM optional"}
                              {p.icd11_code ? ` · ICD-11 ${p.icd11_code}` : ""}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {draft.step === "profile" && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              <ContextualHelp label={t("steps.profile")} help={t("help.profile")} />
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ["displayName", "displayName"],
                  ["age", "age"],
                  ["occupation", "occupation"],
                  ["education", "education"],
                  ["relationshipStatus", "relationshipStatus"],
                  ["livingSituation", "livingSituation"],
                  ["culturalContext", "culturalContext"],
                  ["city", "city"],
                  ["country", "country"],
                ] as const
              ).map(([key, labelKey]) => (
                <label key={key} className={labelClass}>
                  {t(`profile.${labelKey}`)}
                  <input
                    className={fieldClass}
                    type={key === "age" ? "number" : "text"}
                    value={
                      key === "age"
                        ? String(draft.profile.age)
                        : draft.profile[key]
                    }
                    onChange={(e) =>
                      patch({
                        profile: {
                          ...draft.profile,
                          [key]:
                            key === "age"
                              ? Number(e.target.value) || 0
                              : e.target.value,
                        },
                        sectionApprovals: {
                          ...draft.sectionApprovals,
                          profile: true,
                        },
                      })
                    }
                  />
                </label>
              ))}
              <label className={labelClass}>
                {t("profile.gender")}
                <select
                  className={fieldClass}
                  value={draft.profile.gender}
                  onChange={(e) =>
                    patch({
                      profile: {
                        ...draft.profile,
                        gender: e.target.value as GuidedCaseDraft["profile"]["gender"],
                      },
                      sectionApprovals: {
                        ...draft.sectionApprovals,
                        profile: true,
                      },
                    })
                  }
                >
                  {["female", "male", "non-binary", "unspecified"].map((g) => (
                    <option key={g} value={g}>
                      {t(`gender.${g}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        {draft.step === "goals" && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              <ContextualHelp label={t("steps.goals")} help={t("help.goals")} variant="popover" />
            </h2>
            <input
              className={fieldClass}
              placeholder={t("searchGoals")}
              value={searchGoal}
              onChange={(e) => setSearchGoal(e.target.value)}
            />
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {catalogues.goals
                .filter((g) =>
                  g.label.toLowerCase().includes(searchGoal.trim().toLowerCase()),
                )
                .map((g) => {
                  const checked = draft.goals.some((x) => x.id === g.id || x.label === g.label);
                  return (
                    <label
                      key={g.id}
                      className="flex items-start gap-2 text-sm text-[var(--on-surface)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? draft.goals.filter(
                                (x) => x.id !== g.id && x.label !== g.label,
                              )
                            : [...draft.goals, g];
                          patch({
                            goals: next,
                            sectionApprovals: {
                              ...draft.sectionApprovals,
                              goals: next.length > 0,
                            },
                          });
                        }}
                      />
                      <span>
                        {g.label}
                        {g.custom ? (
                          <span className="ms-1 text-xs text-[var(--outline)]">
                            ({t("custom")})
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className={`${fieldClass} max-w-md`}
                value={draft.customGoalDraft}
                placeholder={t("customGoalPlaceholder")}
                onChange={(e) => patch({ customGoalDraft: e.target.value })}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (!draft.customGoalDraft.trim()) return;
                  const g = customGoal(draft.customGoalDraft);
                  patch({
                    goals: [...draft.goals, g],
                    customGoalDraft: "",
                    sectionApprovals: {
                      ...draft.sectionApprovals,
                      goals: true,
                    },
                  });
                }}
              >
                {t("addCustomGoal")}
              </button>
            </div>
          </section>
        )}

        {draft.step === "symptoms" && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              <ContextualHelp
                label={t("steps.symptoms")}
                help={t("help.symptoms")}
                variant="popover"
              />
            </h2>
            <input
              className={fieldClass}
              placeholder={t("searchSymptoms")}
              value={searchSymptom}
              onChange={(e) => setSearchSymptom(e.target.value)}
            />
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {catalogues.symptoms
                .filter((s) =>
                  s.description
                    .toLowerCase()
                    .includes(searchSymptom.trim().toLowerCase()),
                )
                .slice(0, 40)
                .map((s) => {
                  const checked = draft.symptoms.some((x) => x.id === s.id);
                  return (
                    <label key={s.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? draft.symptoms.filter((x) => x.id !== s.id)
                            : [
                                ...draft.symptoms,
                                {
                                  id: s.id,
                                  description: s.description,
                                  domain: s.domain,
                                  salience: s.salience,
                                },
                              ];
                          patch({
                            symptoms: next,
                            sectionApprovals: {
                              ...draft.sectionApprovals,
                              symptoms: next.length > 0,
                            },
                          });
                        }}
                      />
                      <span>
                        {s.description}{" "}
                        <span className="text-xs text-[var(--outline)]">
                          ({s.uiCategory}
                          {s.salience ? ` · ${s.salience}` : ""})
                        </span>
                      </span>
                    </label>
                  );
                })}
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={busy === "symptoms"}
              onClick={() => void runGenerate("symptoms")}
            >
              <ContextualHelp
                label={busy === "symptoms" ? t("generating") : t("aiBuildSymptoms")}
                help={t("help.aiSymptoms")}
              />
            </button>
            {draft.aiSymptomSuggestions.length > 0 && (
              <div className="space-y-2 rounded-lg border border-dashed border-[var(--outline-variant)] p-3">
                <p className="text-xs font-semibold uppercase text-[var(--outline)]">
                  {t("suggestedByAi")}
                </p>
                {draft.aiSymptomSuggestions.map((s) => (
                  <label key={s.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedAiSymptoms.has(s.id)}
                      onChange={() => {
                        const next = new Set(selectedAiSymptoms);
                        if (next.has(s.id)) next.delete(s.id);
                        else next.add(s.id);
                        setSelectedAiSymptoms(next);
                      }}
                    />
                    <span>{s.description}</span>
                  </label>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      const accepted = draft.aiSymptomSuggestions.filter((s) =>
                        selectedAiSymptoms.has(s.id),
                      );
                      const merged = [...draft.symptoms];
                      for (const s of accepted) {
                        if (!merged.some((x) => x.id === s.id)) merged.push(s);
                      }
                      patch({
                        symptoms: merged,
                        aiSymptomSuggestions: [],
                        sectionApprovals: {
                          ...draft.sectionApprovals,
                          symptoms: true,
                        },
                      });
                      setSelectedAiSymptoms(new Set());
                    }}
                  >
                    {t("acceptSelected")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      patch({ aiSymptomSuggestions: [] });
                      setSelectedAiSymptoms(new Set());
                    }}
                  >
                    {t("rejectAll")}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {draft.step === "context" && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              <ContextualHelp label={t("steps.context")} help={t("help.context")} />
            </h2>
            <label className={labelClass}>
              {t("contextNarrative")}
              <textarea
                className={`${fieldClass} min-h-28`}
                value={draft.contextNarrative}
                onChange={(e) =>
                  patch({
                    contextNarrative: e.target.value,
                    sectionApprovals: {
                      ...draft.sectionApprovals,
                      context: e.target.value.trim().length > 0,
                    },
                  })
                }
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={busy === "context" || !draft.contextNarrative.trim()}
              onClick={() => void runGenerate("context")}
            >
              {busy === "context" ? t("generating") : t("aiStructureContext")}
            </button>
            {draft.structuredContext && (
              <div className="space-y-2 rounded-lg border border-[var(--outline-variant)] p-3 text-sm">
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(draft.structuredContext, null, 2)}
                </pre>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() =>
                    patch({
                      structuredContextApproved: true,
                      sectionApprovals: {
                        ...draft.sectionApprovals,
                        context: true,
                      },
                    })
                  }
                >
                  {t("approveStructured")}
                </button>
              </div>
            )}
          </section>
        )}

        {draft.step === "framework" && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              <ContextualHelp
                label={t("steps.framework")}
                help={t("help.framework")}
                variant="popover"
              />
            </h2>
            <div className="space-y-2">
              {THERAPY_FRAMEWORKS.map((f) => (
                <label
                  key={f.modality}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--outline-variant)] p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="primaryFramework"
                    checked={draft.primaryFramework === f.modality}
                    onChange={() =>
                      patch({
                        primaryFramework: f.modality,
                        sectionApprovals: {
                          ...draft.sectionApprovals,
                          framework: true,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium">{f.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--on-surface-variant)]">
                      {f.summary}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy === "framework"}
              onClick={() => void runGenerate("framework")}
            >
              {busy === "framework" ? t("generating") : t("aiRecommendFramework")}
            </button>
            {draft.frameworkRationale ? (
              <p className="text-sm text-[var(--on-surface-variant)]">
                <strong>{t("whySuggested")}</strong> {draft.frameworkRationale}
              </p>
            ) : null}
          </section>
        )}

        {draft.step === "interaction" && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              <ContextualHelp
                label={t("steps.interaction")}
                help={t("help.interaction")}
              />
            </h2>
            <label className={labelClass}>
              {t("communicationStyle")}
              <select
                className={fieldClass}
                value={draft.communicationStyle ?? ""}
                onChange={(e) =>
                  patch({
                    communicationStyle: (e.target.value ||
                      null) as GuidedCaseDraft["communicationStyle"],
                    sectionApprovals: {
                      ...draft.sectionApprovals,
                      interaction: Boolean(e.target.value),
                    },
                  })
                }
              >
                <option value="">{t("selectPlaceholder")}</option>
                {COMMUNICATION_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {t(`communication.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-[var(--outline)]">
                {t("therapeuticChallenges")}
              </legend>
              <div className="grid gap-2 md:grid-cols-2">
                {THERAPEUTIC_CHALLENGES.map((c) => {
                  const checked = draft.therapeuticChallenges.includes(c);
                  return (
                    <label key={c} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? draft.therapeuticChallenges.filter((x) => x !== c)
                            : [...draft.therapeuticChallenges, c];
                          patch({ therapeuticChallenges: next });
                        }}
                      />
                      {t(`challenges.${c}`)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className={labelClass}>
              {t("voice")}
              <select
                className={fieldClass}
                value={draft.voiceProfileId ?? ""}
                onChange={(e) =>
                  patch({ voiceProfileId: e.target.value || null })
                }
              >
                <option value="">{t("voiceOptional")}</option>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.voice_name}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}

        {draft.step === "generate" && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              <ContextualHelp
                label={t("steps.generate")}
                help={t("help.generate")}
                variant="popover"
              />
            </h2>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("generateHint")}
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={busy === "case"}
              onClick={() => void runGenerate("case")}
            >
              {busy === "case" ? t("generating") : t("aiBuildCase")}
            </button>
            {draft.generated ? (
              <pre className="max-h-80 overflow-auto rounded-lg bg-[var(--surface-container)] p-3 text-xs">
                {JSON.stringify(draft.generated, null, 2)}
              </pre>
            ) : null}
          </section>
        )}

        {draft.step === "review" && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("steps.review")}</h2>
            {(
              [
                "presentation",
                "profile",
                "goals",
                "symptoms",
                "context",
                "framework",
                "interaction",
                "generated",
              ] as const
            ).map((key) => (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
              >
                <span>{t(`steps.${key === "generated" ? "generate" : key}`)}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() =>
                      go(key === "generated" ? "generate" : key)
                    }
                  >
                    {t("edit")}
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={() =>
                      patch({
                        sectionApprovals: {
                          ...draft.sectionApprovals,
                          [key]: true,
                        },
                      })
                    }
                  >
                    {draft.sectionApprovals[key] ? t("approved") : t("approve")}
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                startTransition(() => {
                  patch({
                    sectionApprovals: {
                      presentation: true,
                      profile: true,
                      goals: true,
                      symptoms: true,
                      context: true,
                      framework: true,
                      interaction: true,
                      generated: Boolean(draft.generated),
                    },
                  });
                })
              }
            >
              {t("approveAll")}
            </button>
          </section>
        )}

        {draft.step === "create" && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("steps.create")}</h2>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("createHint")}
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={busy === "create"}
              onClick={() => void createPatient(false)}
            >
              {busy === "create" ? t("creating") : t("createTrainingPatient")}
            </button>
            {createdId ? (
              <Link
                className="btn-secondary inline-flex"
                href={`/admin/avatars/${createdId}`}
              >
                {t("openDetail")}
              </Link>
            ) : null}
            {createdId ? (
              <div className="pt-2">
                <p className="mb-2 text-xs text-[var(--on-surface-variant)]">
                  {t("readinessAfterCreate")}
                </p>
                <CaseReadinessPanel
                  readiness={readiness}
                  labels={readinessLabels}
                />
              </div>
            ) : null}
          </section>
        )}

        {status ? (
          <p className="text-sm text-[var(--on-surface)]" role="status">
            {status}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-[var(--outline-variant)] pt-4">
          <button
            type="button"
            className="btn-secondary"
            disabled={stepIndex === 0}
            onClick={() => go(GUIDED_STEPS[Math.max(0, stepIndex - 1)]!)}
          >
            {t("back")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={stepIndex >= GUIDED_STEPS.length - 1}
            onClick={() =>
              go(GUIDED_STEPS[Math.min(GUIDED_STEPS.length - 1, stepIndex + 1)]!)
            }
          >
            {t("next")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy === "create"}
            onClick={() => void createPatient(true)}
          >
            {t("saveDraft")}
          </button>
          <Link href="/admin/avatars" className="btn-secondary">
            {t("cancel")}
          </Link>
        </div>
      </div>
    </div>
  );
}
