"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ContextualHelp } from "@/components/admin/help/ContextualHelp";
import { AdvancedJson } from "@/components/admin/AdvancedDetails";
import { CaseReadinessPanel } from "@/components/admin/CaseReadinessPanel";
import {
  COMMUNICATION_STYLES,
  EDIT_GUIDED_STEPS,
  GUIDED_STEPS,
  THERAPEUTIC_CHALLENGES,
  THERAPY_FRAMEWORKS,
  buildChangeReview,
  customGoal,
  emptyGuidedDraft,
  isGuidedDraftDirty,
  listApprovedSaveFields,
  markFieldAiSuggested,
  markFieldApproved,
  markFieldChanged,
  summarizeGeneratedBundle,
  summarizeStructuredContext,
  truncateSummary,
  type ArabicAuthorshipState,
  type GuidedBuilderMode,
  type GuidedCaseDraft,
  type GuidedChangeApprovals,
  type GuidedEditableField,
  type GuidedStepId,
  type LibrarySymptom,
  type SessionGoalItem,
  type TrainingPresentation,
  type FrameworkOption,
} from "@/lib/admin/case-builder";
import { educatorAdminError } from "@/lib/admin/admin-product-errors";
import type { CaseReadinessResult } from "@/lib/admin/virtual-patient";
import type { SymptomProfileItem } from "@/lib/types";

type CataloguesPayload = {
  presentations: TrainingPresentation[];
  goals: SessionGoalItem[];
  symptoms: LibrarySymptom[];
  frameworks: FrameworkOption[];
};

export type GuidedCaseIdentity = {
  id: string;
  name: string;
  slug: string;
  lifecycleStatus: string;
};

type Props = {
  voices: { id: string; voice_name: string }[];
  onSwitchAdvanced: () => void;
  mode?: GuidedBuilderMode;
  /** Required for edit mode — existing case identity banner. */
  caseIdentity?: GuidedCaseIdentity | null;
  initialDraft?: GuidedCaseDraft | null;
  initialReadiness?: CaseReadinessResult | null;
  arabicAuthorship?: ArabicAuthorshipState;
  presentationUnresolved?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
};

const fieldClass =
  "w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--on-surface)]";
const labelClass =
  "flex flex-col gap-1 text-xs font-medium text-[var(--outline)]";

export function GuidedCaseBuilder({
  voices,
  onSwitchAdvanced,
  mode = "create",
  caseIdentity = null,
  initialDraft = null,
  initialReadiness = null,
  arabicAuthorship = "missing",
  presentationUnresolved = false,
  onDirtyChange,
}: Props) {
  const t = useTranslations("admin.caseBuilder");
  const tReady = useTranslations("admin.avatars.readiness");
  const tErrors = useTranslations("admin.productErrors");
  const isEdit = mode === "edit";
  const steps = isEdit ? EDIT_GUIDED_STEPS : GUIDED_STEPS;

  function mapError(error: unknown, fallback: string): string {
    return educatorAdminError(
      error,
      (key) => tErrors(key),
      fallback,
    );
  }

  function lifecycleLabel(status: string): string {
    const key = status as "draft" | "testing" | "published" | "archived";
    try {
      return t(`lifecycleLabels.${key}`);
    } catch {
      return status;
    }
  }

  function lifecycleDescription(status: string): string {
    const key = status as "draft" | "testing" | "published" | "archived";
    try {
      return t(`lifecycleDescriptions.${key}`);
    } catch {
      return "";
    }
  }

  function arabicAuthorshipLabel(state: ArabicAuthorshipState): string {
    try {
      return t(`arabicAuthorshipStates.${state}`);
    } catch {
      return state;
    }
  }

  function frameworkLabel(modality: string | null | undefined): string {
    if (!modality) return t("reviewEmpty");
    return (
      THERAPY_FRAMEWORKS.find((f) => f.modality === modality)?.label ?? modality
    );
  }

  const [baseline, setBaseline] = useState<GuidedCaseDraft | null>(() =>
    isEdit && initialDraft ? structuredClone(initialDraft) : null,
  );
  const [draft, setDraft] = useState<GuidedCaseDraft>(() =>
    initialDraft
      ? { ...initialDraft, mode }
      : emptyGuidedDraft({
          mode,
          voiceProfileId: voices[0]?.id ?? null,
        }),
  );
  const [approvals, setApprovals] = useState<GuidedChangeApprovals>({});
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
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
  const [savedOk, setSavedOk] = useState(false);
  const [pendingFramework, setPendingFramework] = useState<{
    primary: GuidedCaseDraft["primaryFramework"];
    supporting: GuidedCaseDraft["supportingFrameworks"];
    rationale: string;
  } | null>(null);
  const [readiness, setReadiness] = useState<CaseReadinessResult | null>(
    initialReadiness,
  );
  const [, startTransition] = useTransition();

  const dirty = useMemo(() => {
    if (isEdit && baseline) return isGuidedDraftDirty(baseline, draft);
    if (!isEdit) {
      return Boolean(
        draft.presentationId ||
          draft.profile.displayName.trim() ||
          draft.goals.length ||
          draft.symptoms.length ||
          draft.contextNarrative.trim() ||
          draft.primaryFramework ||
          draft.communicationStyle,
      );
    }
    return false;
  }, [isEdit, baseline, draft]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function requestSwitchAdvanced() {
    if (dirty) {
      const ok = window.confirm(t("unsavedSwitchConfirm"));
      if (!ok) return;
    }
    onSwitchAdvanced();
  }

  function touchField(
    field: GuidedEditableField,
    source: "administrator" | "ai_suggestion_approved" = "administrator",
  ) {
    if (!isEdit) return;
    setApprovals((a) => markFieldChanged(a, field, source));
    setReviewConfirmed(false);
    setSavedOk(false);
  }

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

  const stepIndex = (steps as readonly string[]).indexOf(draft.step);

  const changeReview = useMemo(() => {
    if (!isEdit || !baseline) return [];
    return buildChangeReview(baseline, draft, approvals);
  }, [isEdit, baseline, draft, approvals]);

  const approvedSaveFields = useMemo(() => {
    if (!isEdit || !baseline) return [];
    return listApprovedSaveFields(baseline, draft, approvals);
  }, [isEdit, baseline, draft, approvals]);

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
    if (!(steps as readonly string[]).includes(step)) return;
    patch({ step });
  }

  function selectPresentation(p: TrainingPresentation) {
    const seedSymptoms =
      isEdit || draft.symptoms.length > 0
        ? draft.symptoms
        : (p.symptoms ?? []).slice(0, 6);
    const seedGoals =
      isEdit || draft.goals.length > 0
        ? draft.goals
        : (p.sessionGoals ?? []).slice(0, 4).map((label, i) => ({
            id: `seed-${p.slug}-${i}`,
            label,
            category: "assessment" as const,
          }));
    patch({
      presentationId: p.id,
      presentationSlug: p.slug,
      presentationName: p.name,
      dsm5Code: p.dsm5_code,
      icd11Code: p.icd11_code,
      disclosureRules: isEdit
        ? draft.disclosureRules
        : (p.disclosureRules ?? draft.disclosureRules),
      symptoms: seedSymptoms,
      goals: seedGoals,
      sectionApprovals: { ...draft.sectionApprovals, presentation: true },
    });
    touchField("presentation");
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
        if (isEdit) setApprovals((a) => markFieldAiSuggested(a, "symptoms"));
        setStatus(t("aiSymptomsReady"));
      } else if (r.kind === "context" && r.structured) {
        patch({
          structuredContext: r.structured,
          structuredContextApproved: false,
        });
        if (isEdit) setApprovals((a) => markFieldAiSuggested(a, "context"));
        setStatus(t("aiContextReady"));
      } else if (r.kind === "framework" && r.primary) {
        // Phase 10D: never auto-apply AI framework in create or edit — Approve/Reject.
        setPendingFramework({
          primary: r.primary,
          supporting: r.supporting ?? [],
          rationale: r.rationale ?? "",
        });
        if (isEdit) {
          setApprovals((a) => markFieldAiSuggested(a, "framework"));
        }
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
    if (isEdit) return;
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
        setStatus(
          detail ||
            mapError(data.error ?? data, t("createFailed")),
        );
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

  async function saveGuidedEdit() {
    if (!isEdit || !caseIdentity || !baseline) return;
    if (!reviewConfirmed) {
      setStatus(t("confirmReviewRequired"));
      return;
    }
    setBusy("save");
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/case-builder/${caseIdentity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          approvals,
          approvedFields: approvedSaveFields,
          confirmReview: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        issues?: { message: string }[];
        readiness?: CaseReadinessResult;
        appliedFields?: string[];
        noop?: boolean;
        message?: string;
      };
      if (!res.ok) {
        const detail = data.issues?.map((i) => i.message).join(" · ");
        setStatus(
          detail ||
            mapError(data.code ?? data.error ?? data, t("saveFailed")),
        );
        return;
      }
      if (data.readiness) setReadiness(data.readiness);
      setSavedOk(true);
      setApprovals({});
      setReviewConfirmed(false);
      const appliedLabels = (data.appliedFields ?? [])
        .map((field) => {
          try {
            return t(`fields.${field as "presentation"}`);
          } catch {
            return field;
          }
        })
        .join(", ");
      setStatus(
        data.noop
          ? t("saveNoop")
          : appliedLabels
            ? `${t("saveSuccess")} (${appliedLabels})`
            : t("saveSuccess"),
      );
      setBaseline(structuredClone(draft));
      onDirtyChange?.(false);
    } catch {
      setStatus(t("saveFailed"));
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <div className="clinical-card space-y-3 p-6" role="alert">
        <p className="text-sm text-[var(--on-surface)]">{loadError}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={requestSwitchAdvanced}
        >
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
      {isEdit ? (
        <div
          className="rounded-lg border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-3 text-sm text-[var(--on-surface)]"
          role="status"
        >
          <p className="font-semibold tracking-wide">
            {t("editingExistingBanner")}
          </p>
          {caseIdentity ? (
            <div className="mt-1 space-y-1 text-xs text-[var(--on-surface-variant)]">
              <p>
                <span className="font-medium text-[var(--on-surface)]">
                  {caseIdentity.name}
                </span>
                {" · "}
                {lifecycleLabel(caseIdentity.lifecycleStatus)}
              </p>
              {lifecycleDescription(caseIdentity.lifecycleStatus) ? (
                <p>{lifecycleDescription(caseIdentity.lifecycleStatus)}</p>
              ) : null}
              <p>
                {t("internalId")}: {caseIdentity.slug}
              </p>
            </div>
          ) : null}
          <p className="mt-1 text-xs">{t("editingMergeNotice")}</p>
          <p className="mt-1 text-xs">
            {t("arabicAuthorship", {
              state: arabicAuthorshipLabel(arabicAuthorship),
            })}
          </p>
        </div>
      ) : (
        <div
          className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-3 text-sm text-[var(--on-surface)]"
          role="status"
        >
          {t("fictionalBanner")}
        </div>
      )}

      {presentationUnresolved ? (
        <div
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-xs"
          role="status"
        >
          {t("presentationUnresolved")}
        </div>
      ) : null}

      {dirty ? (
        <p className="text-xs text-[var(--on-surface-variant)]" role="status">
          {t("unsavedChanges")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("stepsNav")} className="flex flex-wrap gap-1">
          {steps.map((id, i) => (
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
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={requestSwitchAdvanced}
        >
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
            <p className="text-xs text-[var(--on-surface-variant)]">
              {t("comorbidityAdvancedHint")}
            </p>
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
                    onChange={(e) => {
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
                      });
                      touchField("profile");
                    }}
                  />
                </label>
              ))}
              <label className={labelClass}>
                {t("profile.gender")}
                <select
                  className={fieldClass}
                  value={draft.profile.gender}
                  onChange={(e) => {
                    patch({
                      profile: {
                        ...draft.profile,
                        gender: e.target.value as GuidedCaseDraft["profile"]["gender"],
                      },
                      sectionApprovals: {
                        ...draft.sectionApprovals,
                        profile: true,
                      },
                    });
                    touchField("profile");
                  }}
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
                          touchField("goals");
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
                  touchField("goals");
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
                          touchField("symptoms");
                        }}
                      />
                      <span>
                        {s.description}{" "}
                        <span className="text-xs text-[var(--outline)]">
                          (
                          {s.salience
                            ? (() => {
                                try {
                                  return t(
                                    `salience.${s.salience as "presenting"}`,
                                  );
                                } catch {
                                  return s.salience;
                                }
                              })()
                            : s.uiCategory}
                          )
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
              <div className="space-y-3 rounded-lg border border-dashed border-[var(--outline-variant)] p-3">
                <p className="text-xs font-semibold uppercase text-[var(--outline)]">
                  {t("suggestedByAi")}
                </p>
                {isEdit ? (
                  <div className="grid gap-3 md:grid-cols-2 text-sm">
                    <div>
                      <p className="mb-1 text-xs font-semibold">{t("currentValues")}</p>
                      <ul className="list-disc ps-4">
                        {draft.symptoms.map((s) => (
                          <li key={s.id}>{s.description}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold">{t("suggestedValues")}</p>
                      {draft.aiSymptomSuggestions.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-start gap-2 py-0.5"
                        >
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
                    </div>
                  </div>
                ) : (
                  draft.aiSymptomSuggestions.map((s) => (
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
                  ))
                )}
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
                      if (isEdit && accepted.length > 0) {
                        setApprovals((a) =>
                          markFieldApproved(
                            a,
                            "symptoms",
                            "ai_suggestion_approved",
                          ),
                        );
                      }
                      setSelectedAiSymptoms(new Set());
                    }}
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      patch({ aiSymptomSuggestions: [] });
                      setSelectedAiSymptoms(new Set());
                      if (isEdit) {
                        setApprovals((a) => {
                          const next = { ...a };
                          if (next.symptoms?.status === "ai_suggested") {
                            delete next.symptoms;
                          }
                          return next;
                        });
                      }
                    }}
                  >
                    {t("reject")}
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
                onChange={(e) => {
                  patch({
                    contextNarrative: e.target.value,
                    sectionApprovals: {
                      ...draft.sectionApprovals,
                      context: e.target.value.trim().length > 0,
                    },
                  });
                  touchField("context");
                }}
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
              <div className="space-y-2 rounded-lg border border-dashed border-[var(--outline-variant)] p-3 text-sm">
                <p className="text-xs font-semibold text-[var(--primary)]">
                  {t("aiSuggestionLabel")}
                </p>
                <dl className="space-y-2">
                  {summarizeStructuredContext(draft.structuredContext).map(
                    (row) => (
                      <div key={row.label}>
                        <dt className="text-[11px] font-medium text-[var(--outline)]">
                          {row.label}
                        </dt>
                        <dd className="text-sm text-[var(--on-surface)]">
                          {truncateSummary(row.value)}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
                <AdvancedJson
                  title={t("advancedRawJson")}
                  value={draft.structuredContext}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    patch({
                      structuredContextApproved: true,
                      sectionApprovals: {
                        ...draft.sectionApprovals,
                        context: true,
                      },
                    });
                    if (isEdit) {
                      setApprovals((a) =>
                        markFieldApproved(
                          a,
                          "context",
                          a.context?.status === "ai_suggested"
                            ? "ai_suggestion_approved"
                            : "administrator",
                        ),
                      );
                    }
                  }}
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
                    onChange={() => {
                      patch({
                        primaryFramework: f.modality,
                        sectionApprovals: {
                          ...draft.sectionApprovals,
                          framework: true,
                        },
                      });
                      touchField("framework");
                    }}
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
            {draft.frameworkRationale && !pendingFramework ? (
              <p className="text-sm text-[var(--on-surface-variant)]">
                <strong>{t("whySuggested")}</strong> {draft.frameworkRationale}
              </p>
            ) : null}
            {pendingFramework ? (
              <div className="space-y-2 rounded-lg border border-dashed border-[var(--outline-variant)] p-3 text-sm">
                <p className="text-xs font-semibold text-[var(--primary)]">
                  {t("aiSuggestionLabel")}
                </p>
                <p className="text-xs font-semibold">{t("currentValues")}</p>
                <p>{frameworkLabel(draft.primaryFramework)}</p>
                <p className="text-xs font-semibold">{t("suggestedValues")}</p>
                <p>
                  {frameworkLabel(pendingFramework.primary)}
                  {pendingFramework.supporting.length
                    ? ` (+ ${pendingFramework.supporting
                        .map((m) => frameworkLabel(m))
                        .join(", ")})`
                    : ""}
                </p>
                {pendingFramework.rationale ? (
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {pendingFramework.rationale}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={() => {
                      patch({
                        primaryFramework: pendingFramework.primary,
                        supportingFrameworks: pendingFramework.supporting,
                        frameworkRationale: pendingFramework.rationale,
                        sectionApprovals: {
                          ...draft.sectionApprovals,
                          framework: true,
                        },
                      });
                      if (isEdit) {
                        setApprovals((a) =>
                          markFieldApproved(
                            a,
                            "framework",
                            "ai_suggestion_approved",
                          ),
                        );
                        setReviewConfirmed(false);
                        setSavedOk(false);
                      }
                      setPendingFramework(null);
                    }}
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setPendingFramework(null);
                      if (isEdit) {
                        setApprovals((a) => {
                          const next = { ...a };
                          if (next.framework?.status === "ai_suggested") {
                            delete next.framework;
                          }
                          return next;
                        });
                      }
                    }}
                  >
                    {t("reject")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={busy === "framework"}
                    onClick={() => void runGenerate("framework")}
                  >
                    {t("regenerate")}
                  </button>
                </div>
              </div>
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
                onChange={(e) => {
                  patch({
                    communicationStyle: (e.target.value ||
                      null) as GuidedCaseDraft["communicationStyle"],
                    sectionApprovals: {
                      ...draft.sectionApprovals,
                      interaction: Boolean(e.target.value),
                    },
                  });
                  touchField("interaction");
                }}
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
                          touchField("interaction");
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
                onChange={(e) => {
                  patch({ voiceProfileId: e.target.value || null });
                  touchField("voice");
                }}
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
              <div className="space-y-2 rounded-lg border border-dashed border-[var(--outline-variant)] p-3">
                <p className="text-xs font-semibold text-[var(--primary)]">
                  {t("aiSuggestionLabel")}
                </p>
                <dl className="max-h-80 space-y-2 overflow-auto text-sm">
                  {summarizeGeneratedBundle(draft.generated).map((row) => (
                    <div key={row.label}>
                      <dt className="text-[11px] font-medium text-[var(--outline)]">
                        {row.label}
                      </dt>
                      <dd className="text-[var(--on-surface)]">
                        {truncateSummary(row.value, 280)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <AdvancedJson
                  title={t("advancedRawJson")}
                  value={draft.generated}
                />
              </div>
            ) : null}
          </section>
        )}

        {draft.step === "review" && !isEdit && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              <ContextualHelp
                label={t("steps.review")}
                help={t("help.review")}
                variant="popover"
              />
            </h2>
            <p className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3 py-2 text-sm font-medium text-[var(--on-surface)]">
              {t("nothingPublishedYet")}
            </p>
            <div className="space-y-3 rounded-lg border border-[var(--outline-variant)] p-3">
              <h3 className="text-sm font-semibold">{t("reviewSummaryTitle")}</h3>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--outline)]">
                {t("reviewAdminContent")}
              </p>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-[11px] text-[var(--outline)]">
                    {t("steps.presentation")}
                  </dt>
                  <dd>
                    {draft.presentationName || t("reviewEmpty")}
                    {draft.dsm5Code ? ` (${draft.dsm5Code})` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--outline)]">
                    {t("profile.displayName")}
                  </dt>
                  <dd>
                    {draft.profile.displayName.trim() || t("reviewEmpty")}
                    {draft.profile.age
                      ? ` · ${draft.profile.age}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--outline)]">
                    {t("steps.goals")}
                  </dt>
                  <dd>
                    {draft.goals.length
                      ? draft.goals.map((g) => g.label).join("; ")
                      : t("reviewEmpty")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--outline)]">
                    {t("steps.symptoms")}
                  </dt>
                  <dd>
                    {draft.symptoms.length
                      ? draft.symptoms.map((s) => s.description).join("; ")
                      : t("reviewEmpty")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--outline)]">
                    {t("steps.framework")}
                  </dt>
                  <dd>{frameworkLabel(draft.primaryFramework)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--outline)]">
                    {t("communicationStyle")}
                  </dt>
                  <dd>
                    {draft.communicationStyle
                      ? t(`communication.${draft.communicationStyle}`)
                      : t("reviewEmpty")}
                  </dd>
                </div>
              </dl>
              {draft.generated || draft.structuredContext ? (
                <>
                  <p className="pt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--outline)]">
                    {t("reviewAiContent")}
                  </p>
                  <ul className="list-disc space-y-1 ps-5 text-sm text-[var(--on-surface-variant)]">
                    {draft.structuredContext ? (
                      <li>
                        {t("steps.context")}
                        {draft.structuredContextApproved
                          ? ` — ${t("approved")}`
                          : ` — ${t("aiSuggestionLabel")}`}
                      </li>
                    ) : null}
                    {draft.generated ? (
                      <li>
                        {t("steps.generate")}
                        {draft.sectionApprovals.generated
                          ? ` — ${t("approved")}`
                          : ` — ${t("aiSuggestionLabel")}`}
                      </li>
                    ) : null}
                  </ul>
                </>
              ) : null}
              <p className="text-xs text-[var(--on-surface-variant)]">
                {t("comorbidityAdvancedHint")}
              </p>
            </div>
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

        {draft.step === "reviewChanges" && isEdit && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              {t("steps.reviewChanges")}
            </h2>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("reviewChangesHint")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)] text-[var(--outline)]">
                    <th className="py-2 pe-2 font-medium">{t("reviewField")}</th>
                    <th className="py-2 pe-2 font-medium">{t("reviewCurrent")}</th>
                    <th className="py-2 pe-2 font-medium">{t("reviewNew")}</th>
                    <th className="py-2 pe-2 font-medium">{t("reviewSource")}</th>
                    <th className="py-2 font-medium">{t("reviewStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {changeReview.map((row) => (
                    <tr
                      key={row.field}
                      className={`border-b border-[var(--outline-variant)]/60 ${
                        row.changed ? "" : "opacity-60"
                      }`}
                    >
                      <td className="py-2 pe-2 align-top font-medium">
                        {t(`fields.${row.field}`)}
                      </td>
                      <td className="max-w-[12rem] py-2 pe-2 align-top break-words">
                        {row.currentValue || "—"}
                      </td>
                      <td className="max-w-[12rem] py-2 pe-2 align-top break-words">
                        {row.changed ? row.newValue || "—" : t("unchanged")}
                      </td>
                      <td className="py-2 pe-2 align-top">
                        {row.source === "ai_suggestion_approved"
                          ? t("sourceAiApproved")
                          : row.source === "administrator"
                            ? t("sourceAdministrator")
                            : row.changed
                              ? t("sourceAdministrator")
                              : "—"}
                      </td>
                      <td className="py-2 align-top">
                        {row.changed ? (
                          <button
                            type="button"
                            className={
                              row.status === "user_approved"
                                ? "btn-primary text-xs"
                                : "btn-secondary text-xs"
                            }
                            onClick={() =>
                              setApprovals((a) =>
                                markFieldApproved(
                                  a,
                                  row.field,
                                  a[row.field]?.source ===
                                    "ai_suggestion_approved"
                                    ? "ai_suggestion_approved"
                                    : "administrator",
                                ),
                              )
                            }
                          >
                            {row.status === "user_approved"
                              ? t("approved")
                              : t("approveChange")}
                          </button>
                        ) : (
                          <span>{t("unchanged")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={reviewConfirmed}
                onChange={(e) => setReviewConfirmed(e.target.checked)}
              />
              <span>{t("confirmChangesCheckbox")}</span>
            </label>
            <p className="text-xs text-[var(--on-surface-variant)]">
              {t("approvedFieldsCount", {
                count: approvedSaveFields.length,
              })}
            </p>
          </section>
        )}

        {draft.step === "create" && !isEdit && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              <ContextualHelp
                label={t("steps.create")}
                help={t("help.create")}
                variant="popover"
              />
            </h2>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("createHint")}
            </p>
            <p className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3 py-2 text-sm font-medium">
              {t("nothingPublishedYet")}
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={busy === "create"}
              onClick={() => void createPatient(false)}
            >
              {busy === "create" ? t("creating") : t("createDraftNow")}
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

        {draft.step === "save" && isEdit && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("steps.save")}</h2>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("saveHint")}
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={busy === "save" || !reviewConfirmed}
              onClick={() => void saveGuidedEdit()}
            >
              {busy === "save" ? t("saving") : t("saveMergedChanges")}
            </button>
            {caseIdentity ? (
              <Link
                className="btn-secondary inline-flex"
                href={`/admin/avatars/${caseIdentity.id}`}
              >
                {t("openDetail")}
              </Link>
            ) : null}
            {(savedOk || readiness) && (
              <div className="pt-2">
                <p className="mb-2 text-xs text-[var(--on-surface-variant)]">
                  {t("readinessAfterSave")}
                </p>
                <CaseReadinessPanel
                  readiness={readiness}
                  labels={readinessLabels}
                />
              </div>
            )}
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
            onClick={() => go(steps[Math.max(0, stepIndex - 1)]!)}
          >
            {t("back")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={stepIndex >= steps.length - 1}
            onClick={() =>
              go(steps[Math.min(steps.length - 1, stepIndex + 1)]!)
            }
          >
            {t("next")}
          </button>
          {!isEdit ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy === "create"}
              title={t("saveDraftHint")}
              onClick={() => void createPatient(true)}
            >
              {t("createDraftFooter")}
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy === "save" || !reviewConfirmed}
              onClick={() => void saveGuidedEdit()}
            >
              {t("saveMergedChanges")}
            </button>
          )}
          <Link
            href={
              isEdit && caseIdentity
                ? `/admin/avatars/${caseIdentity.id}`
                : "/admin/avatars"
            }
            className="btn-secondary"
            onClick={(e) => {
              if (dirty) {
                const ok = window.confirm(t("unsavedLeaveConfirm"));
                if (!ok) e.preventDefault();
              }
            }}
          >
            {t("cancel")}
          </Link>
        </div>
      </div>
    </div>
  );
}
