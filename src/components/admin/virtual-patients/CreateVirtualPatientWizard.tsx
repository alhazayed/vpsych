"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_VIRTUAL_PATIENT_DRAFT,
  validateVirtualPatientDraft,
  type BehaviorResponse,
  type BehaviorTrigger,
  type InteractionStyle,
  type TrainingCompetency,
  type VirtualPatientDraft,
  type VirtualPatientListItem,
} from "@/lib/admin/virtual-patients";
import { VoicePreviewButton } from "@/components/VoicePreviewButton";
import {
  BEHAVIOR_RESPONSE_LABELS,
  BEHAVIOR_RESPONSES,
  BEHAVIOR_TRIGGER_LABELS,
  COMPETENCY_KEYS,
  COMPETENCY_LABELS,
  DIFFICULTY_LABELS,
  EMOTIONAL_BASELINE_LABELS,
  GENDER_LABELS,
  INTERACTION_STYLE_LABELS,
  INTERACTION_STYLES,
  PORTRAIT_OPTIONS,
  SEVERITY_LABELS,
  SPEAKING_SPEED_LABELS,
  TRAIT_LABELS,
} from "./labels";

const STEPS = [
  "Identity",
  "Clinical",
  "Personality",
  "Behavior",
  "Voice",
  "Training",
  "Review",
] as const;

type TraitKey = keyof VirtualPatientDraft["traits"];

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
      {label}
      <div className="mt-1.5 normal-case tracking-normal">{children}</div>
    </label>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
      {children}
    </h2>
  );
}

export function CreateVirtualPatientWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<VirtualPatientDraft>({
    ...DEFAULT_VIRTUAL_PATIENT_DRAFT,
    traits: { ...DEFAULT_VIRTUAL_PATIENT_DRAFT.traits },
    comorbidities: [...DEFAULT_VIRTUAL_PATIENT_DRAFT.comorbidities],
    interactionStyles: [...DEFAULT_VIRTUAL_PATIENT_DRAFT.interactionStyles],
    behaviorRules: DEFAULT_VIRTUAL_PATIENT_DRAFT.behaviorRules.map((r) => ({
      ...r,
    })),
    targetCompetencies: [...DEFAULT_VIRTUAL_PATIENT_DRAFT.targetCompetencies],
  });
  const [comorbidityText, setComorbidityText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const validation = useMemo(
    () => validateVirtualPatientDraft(draft),
    [draft],
  );

  function update<K extends keyof VirtualPatientDraft>(
    key: K,
    value: VirtualPatientDraft[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setTrait(key: TraitKey, value: number) {
    const clamped = Math.min(5, Math.max(1, Math.round(value))) as 1 | 2 | 3 | 4 | 5;
    setDraft((d) => ({ ...d, traits: { ...d.traits, [key]: clamped } }));
  }

  function toggleStyle(style: InteractionStyle) {
    setDraft((d) => {
      const has = d.interactionStyles.includes(style);
      const next = has
        ? d.interactionStyles.filter((s) => s !== style)
        : [...d.interactionStyles, style];
      return {
        ...d,
        interactionStyles: next.length > 0 ? next : d.interactionStyles,
      };
    });
  }

  function toggleCompetency(c: TrainingCompetency) {
    setDraft((d) => {
      const has = d.targetCompetencies.includes(c);
      return {
        ...d,
        targetCompetencies: has
          ? d.targetCompetencies.filter((x) => x !== c)
          : [...d.targetCompetencies, c],
      };
    });
  }

  function setBehaviorResponse(trigger: BehaviorTrigger, response: BehaviorResponse) {
    setDraft((d) => ({
      ...d,
      behaviorRules: d.behaviorRules.map((r) =>
        r.trigger === trigger ? { ...r, response } : r,
      ),
    }));
  }

  function syncComorbidities(text: string) {
    setComorbidityText(text);
    update(
      "comorbidities",
      text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  async function saveDraft(): Promise<VirtualPatientListItem | null> {
    setError(null);
    const payload: VirtualPatientDraft = {
      ...draft,
      lifecycleStatus: "draft",
    };
    const res = await fetch("/api/admin/virtual-patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft: payload }),
    });
    const data = (await res.json()) as {
      item?: VirtualPatientListItem;
      error?: string;
      validation?: { errors?: string[] };
    };
    if (!res.ok || !data.item) {
      const detail =
        data.validation?.errors?.join(" ") ??
        data.error ??
        "Could not save draft.";
      setError(detail);
      return null;
    }
    return data.item;
  }

  function onSaveDraft() {
    startTransition(async () => {
      const item = await saveDraft();
      if (item) router.push(`/admin/virtual-patients/${item.id}`);
    });
  }

  function onTestPatient() {
    startTransition(async () => {
      const item = await saveDraft();
      if (!item) return;
      const res = await fetch(
        `/api/admin/virtual-patients/${item.id}/test-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) {
        setError(data.error ?? "Could not start test session.");
        router.push(`/admin/virtual-patients/${item.id}`);
        return;
      }
      router.push(data.path);
    });
  }

  function onPublish() {
    startTransition(async () => {
      const item = await saveDraft();
      if (!item) return;
      const res = await fetch(
        `/api/admin/virtual-patients/${item.id}/lifecycle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not publish.");
        router.push(`/admin/virtual-patients/${item.id}`);
        return;
      }
      router.push(`/admin/virtual-patients/${item.id}`);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          Create Virtual Patient
        </h1>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          Guided setup — identity, clinical picture, personality, behavior,
          voice, and training goals.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                i === step
                  ? "bg-[var(--primary)] text-[var(--on-primary)]"
                  : i < step
                    ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]"
                    : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
              }`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="clinical-card p-5 md:p-6">
        {step === 0 ? (
          <div className="space-y-4">
            <SectionTitle>Identity</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Display name">
                <input
                  className="field-input"
                  value={draft.displayName}
                  onChange={(e) => update("displayName", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Age">
                <input
                  type="number"
                  min={12}
                  max={100}
                  className="field-input"
                  value={draft.age}
                  onChange={(e) => update("age", Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <FieldLabel label="Gender">
                <select
                  className="field-input"
                  value={draft.gender}
                  onChange={(e) =>
                    update(
                      "gender",
                      e.target.value as VirtualPatientDraft["gender"],
                    )
                  }
                >
                  {(
                    Object.keys(GENDER_LABELS) as Array<
                      keyof typeof GENDER_LABELS
                    >
                  ).map((k) => (
                    <option key={k} value={k}>
                      {GENDER_LABELS[k]}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Language">
                <select
                  className="field-input"
                  value={draft.language}
                  onChange={(e) =>
                    update("language", e.target.value as "en" | "ar")
                  }
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Dialect">
                <input
                  className="field-input"
                  value={draft.dialect}
                  onChange={(e) => update("dialect", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Occupation">
                <input
                  className="field-input"
                  value={draft.occupation}
                  onChange={(e) => update("occupation", e.target.value)}
                />
              </FieldLabel>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <SectionTitle>Clinical</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Primary diagnosis">
                <input
                  className="field-input"
                  value={draft.primaryDiagnosis}
                  onChange={(e) => update("primaryDiagnosis", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Comorbidities (comma-separated)">
                <input
                  className="field-input"
                  value={comorbidityText}
                  onChange={(e) => syncComorbidities(e.target.value)}
                  placeholder="e.g. Generalized anxiety, Insomnia"
                />
              </FieldLabel>
              <FieldLabel label="Severity">
                <select
                  className="field-input"
                  value={draft.severity}
                  onChange={(e) =>
                    update(
                      "severity",
                      e.target.value as VirtualPatientDraft["severity"],
                    )
                  }
                >
                  {(
                    Object.keys(SEVERITY_LABELS) as Array<
                      keyof typeof SEVERITY_LABELS
                    >
                  ).map((k) => (
                    <option key={k} value={k}>
                      {SEVERITY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            {(
              [
                ["presentingComplaint", "Presenting complaint"],
                ["clinicalHistory", "Clinical history"],
                ["previousTreatment", "Previous treatment"],
                ["medication", "Medication"],
                ["familyHistory", "Family history"],
                ["socialHistory", "Social history"],
                ["traumaHistory", "Trauma history"],
                ["medicalHistory", "Medical history"],
              ] as const
            ).map(([key, label]) => (
              <FieldLabel key={key} label={label}>
                <textarea
                  className="field-input min-h-[4.5rem]"
                  value={draft[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              </FieldLabel>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <SectionTitle>Personality</SectionTitle>
            <div className="space-y-4">
              {(Object.keys(TRAIT_LABELS) as TraitKey[]).map((key) => (
                <FieldLabel key={key} label={`${TRAIT_LABELS[key]} (${draft.traits[key]})`}>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={draft.traits[key]}
                    onChange={(e) => setTrait(key, Number(e.target.value))}
                    className="w-full accent-[var(--primary)]"
                  />
                </FieldLabel>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                Interaction style
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {INTERACTION_STYLES.map((style) => (
                  <li key={style}>
                    <label className="flex items-center gap-2 text-sm text-[var(--on-surface)]">
                      <input
                        type="checkbox"
                        checked={draft.interactionStyles.includes(style)}
                        onChange={() => toggleStyle(style)}
                      />
                      {INTERACTION_STYLE_LABELS[style]}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <SectionTitle>Behavior</SectionTitle>
            <p className="text-sm text-[var(--on-surface-variant)]">
              How this patient typically responds in key clinical moments.
            </p>
            <ul className="space-y-4">
              {draft.behaviorRules.map((rule) => (
                <li
                  key={rule.trigger}
                  className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3"
                >
                  <p className="text-sm font-medium text-[var(--on-surface)]">
                    {BEHAVIOR_TRIGGER_LABELS[rule.trigger]}
                  </p>
                  <select
                    className="field-input mt-2"
                    value={rule.response}
                    onChange={(e) =>
                      setBehaviorResponse(
                        rule.trigger,
                        e.target.value as BehaviorResponse,
                      )
                    }
                  >
                    {BEHAVIOR_RESPONSES.map((r) => (
                      <option key={r} value={r}>
                        {BEHAVIOR_RESPONSE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <SectionTitle>Voice</SectionTitle>
            <FieldLabel label="Portrait">
              <select
                className="field-input"
                value={draft.portraitUrl ?? ""}
                onChange={(e) =>
                  update("portraitUrl", e.target.value || null)
                }
              >
                {PORTRAIT_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Assigned voice">
              <input
                className="field-input"
                value={draft.voiceProfileId ?? ""}
                onChange={(e) =>
                  update("voiceProfileId", e.target.value.trim() || null)
                }
                placeholder="Optional voice profile id"
              />
            </FieldLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Speaking speed">
                <select
                  className="field-input"
                  value={draft.speakingSpeed}
                  onChange={(e) =>
                    update(
                      "speakingSpeed",
                      e.target.value as VirtualPatientDraft["speakingSpeed"],
                    )
                  }
                >
                  {(
                    Object.keys(SPEAKING_SPEED_LABELS) as Array<
                      keyof typeof SPEAKING_SPEED_LABELS
                    >
                  ).map((k) => (
                    <option key={k} value={k}>
                      {SPEAKING_SPEED_LABELS[k]}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Emotional baseline">
                <select
                  className="field-input"
                  value={draft.emotionalBaseline}
                  onChange={(e) =>
                    update(
                      "emotionalBaseline",
                      e.target
                        .value as VirtualPatientDraft["emotionalBaseline"],
                    )
                  }
                >
                  {(
                    Object.keys(EMOTIONAL_BASELINE_LABELS) as Array<
                      keyof typeof EMOTIONAL_BASELINE_LABELS
                    >
                  ).map((k) => (
                    <option key={k} value={k}>
                      {EMOTIONAL_BASELINE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            <div>
              {draft.voiceProfileId ? (
                <VoicePreviewButton
                  locale={draft.language === "ar" ? "ar" : "en"}
                  voiceProfileId={draft.voiceProfileId}
                  emotion={draft.emotionalBaseline}
                  label="Test Voice"
                />
              ) : (
                <p className="rounded-lg bg-[var(--surface-container)] px-3 py-2 text-sm text-[var(--on-surface-variant)]">
                  Save draft first to test voice, or assign a voice profile
                  above.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <SectionTitle>Training</SectionTitle>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
              Target competencies
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {COMPETENCY_KEYS.map((c) => (
                <li key={c}>
                  <label className="flex items-center gap-2 text-sm text-[var(--on-surface)]">
                    <input
                      type="checkbox"
                      checked={draft.targetCompetencies.includes(c)}
                      onChange={() => toggleCompetency(c)}
                    />
                    {COMPETENCY_LABELS[c]}
                  </label>
                </li>
              ))}
            </ul>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Difficulty">
                <select
                  className="field-input"
                  value={draft.difficulty}
                  onChange={(e) =>
                    update(
                      "difficulty",
                      e.target.value as VirtualPatientDraft["difficulty"],
                    )
                  }
                >
                  {(
                    Object.keys(DIFFICULTY_LABELS) as Array<
                      keyof typeof DIFFICULTY_LABELS
                    >
                  ).map((k) => (
                    <option key={k} value={k}>
                      {DIFFICULTY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Therapy modality">
                <input
                  className="field-input"
                  value={draft.therapyModality}
                  onChange={(e) => update("therapyModality", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Expected session minutes">
                <input
                  type="number"
                  min={10}
                  max={90}
                  className="field-input"
                  value={draft.expectedSessionMinutes}
                  onChange={(e) =>
                    update(
                      "expectedSessionMinutes",
                      Number(e.target.value) || 0,
                    )
                  }
                />
              </FieldLabel>
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-5">
            <SectionTitle>Review</SectionTitle>
            <ReviewBlock title="Identity">
              <p>
                {draft.displayName || "—"}, {draft.age},{" "}
                {GENDER_LABELS[draft.gender]} ·{" "}
                {draft.language === "ar" ? "Arabic" : "English"} (
                {draft.dialect || "—"}) · {draft.occupation || "—"}
              </p>
            </ReviewBlock>
            <ReviewBlock title="Clinical">
              <p>
                <strong className="font-medium">Diagnosis:</strong>{" "}
                {draft.primaryDiagnosis || "—"} ({SEVERITY_LABELS[draft.severity]}
                )
              </p>
              <p>
                <strong className="font-medium">Complaint:</strong>{" "}
                {draft.presentingComplaint || "—"}
              </p>
              {draft.comorbidities.length > 0 ? (
                <p>
                  <strong className="font-medium">Comorbidities:</strong>{" "}
                  {draft.comorbidities.join(", ")}
                </p>
              ) : null}
            </ReviewBlock>
            <ReviewBlock title="Personality">
              <p>
                {Object.entries(draft.traits)
                  .map(
                    ([k, v]) =>
                      `${TRAIT_LABELS[k as TraitKey]} ${v}/5`,
                  )
                  .join(" · ")}
              </p>
              <p>
                Styles:{" "}
                {draft.interactionStyles
                  .map((s) => INTERACTION_STYLE_LABELS[s])
                  .join(", ") || "—"}
              </p>
            </ReviewBlock>
            <ReviewBlock title="Behavior">
              <ul className="list-inside list-disc space-y-1">
                {draft.behaviorRules.map((r) => (
                  <li key={r.trigger}>
                    {BEHAVIOR_TRIGGER_LABELS[r.trigger]} →{" "}
                    {BEHAVIOR_RESPONSE_LABELS[r.response]}
                  </li>
                ))}
              </ul>
            </ReviewBlock>
            <ReviewBlock title="Voice">
              <p>
                Portrait:{" "}
                {PORTRAIT_OPTIONS.find((p) => p.value === draft.portraitUrl)
                  ?.label ?? "—"}{" "}
                · Speed: {SPEAKING_SPEED_LABELS[draft.speakingSpeed]} · Baseline:{" "}
                {EMOTIONAL_BASELINE_LABELS[draft.emotionalBaseline]}
                {draft.voiceProfileId ? " · Voice assigned" : " · No voice yet"}
              </p>
            </ReviewBlock>
            <ReviewBlock title="Training">
              <p>
                {DIFFICULTY_LABELS[draft.difficulty]} · {draft.therapyModality} ·{" "}
                {draft.expectedSessionMinutes} min
              </p>
              <p>
                {draft.targetCompetencies
                  .map((c) => COMPETENCY_LABELS[c])
                  .join(", ") || "—"}
              </p>
            </ReviewBlock>

            <div className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                Validation
              </p>
              <ul className="space-y-1 text-sm">
                {(
                  [
                    ["clinical", "Clinical picture"],
                    ["behavior", "Behavior rules"],
                    ["voice", "Voice (optional)"],
                    ["training", "Training goals"],
                    ["safety", "Safety (suicide rule)"],
                  ] as const
                ).map(([key, label]) => (
                  <li key={key} className="flex items-center gap-2">
                    <span
                      className={
                        validation.checks[key]
                          ? "text-[var(--primary)]"
                          : "text-[var(--secondary)]"
                      }
                    >
                      {validation.checks[key] ? "✓" : "✗"}
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
              {validation.errors.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-[var(--secondary)]">
                  {validation.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--primary)]">
                  Ready to save.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={onSaveDraft}
              >
                Save Draft
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={onTestPatient}
              >
                Test Patient
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={pending || !validation.ok}
                onClick={onPublish}
              >
                Publish
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-[var(--secondary)]">{error}</p>
        ) : null}

        {step < 6 ? (
          <div className="mt-6 flex justify-between border-t border-[var(--outline-variant)] pt-4">
            <button
              type="button"
              className="btn-secondary"
              disabled={step === 0 || pending}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={pending}
              onClick={() => setStep((s) => Math.min(6, s + 1))}
            >
              Continue
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
        {title}
      </h3>
      <div className="space-y-1 text-sm text-[var(--on-surface)]">{children}</div>
    </section>
  );
}
