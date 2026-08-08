"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_VIRTUAL_PATIENT_DRAFT,
  validateVirtualPatientDraft,
  type BehaviorResponse,
  type InteractionStyle,
  type TrainingCompetency,
  type VirtualPatientDraft,
  type VirtualPatientLifecycle,
  type VirtualPatientListItem,
} from "@/lib/admin/virtual-patients";
import { VoicePreviewButton } from "@/components/VoicePreviewButton";
import { StatusBadge } from "./StatusBadge";
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

const TABS = [
  "Overview",
  "Clinical",
  "Personality",
  "Behavior",
  "Voice",
  "Training",
  "Safety",
  "Test",
  "Advanced",
] as const;

type Tab = (typeof TABS)[number];
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

function cloneDraft(source: VirtualPatientDraft): VirtualPatientDraft {
  return {
    ...source,
    traits: { ...source.traits },
    comorbidities: [...source.comorbidities],
    interactionStyles: [...source.interactionStyles],
    behaviorRules: source.behaviorRules.map((r) => ({ ...r })),
    targetCompetencies: [...source.targetCompetencies],
  };
}

export function EditVirtualPatient({ id }: { id: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [item, setItem] = useState<VirtualPatientListItem | null>(null);
  const [draft, setDraft] = useState<VirtualPatientDraft | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [comorbidityText, setComorbidityText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dupOpen, setDupOpen] = useState(false);
  const [dupName, setDupName] = useState("");

  const readOnly = item?.status === "published";

  const validation = useMemo(
    () => (draft ? validateVirtualPatientDraft(draft) : null),
    [draft],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/virtual-patients/${id}`);
      const data = (await res.json()) as {
        item?: VirtualPatientListItem;
        draft?: VirtualPatientDraft;
        slug?: string | null;
        error?: string;
      };
      if (!res.ok || !data.item || !data.draft) {
        setError(data.error ?? "Virtual patient not found.");
        return;
      }
      const next = cloneDraft(data.draft);
      setItem(data.item);
      setDraft(next);
      setSlug(data.slug ?? null);
      setComorbidityText(next.comorbidities.join(", "));
      setDupName(`${data.item.displayName} (copy)`);
    } catch {
      setError("Could not load virtual patient.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof VirtualPatientDraft>(
    key: K,
    value: VirtualPatientDraft[K],
  ) {
    if (readOnly) return;
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function setTrait(key: TraitKey, value: number) {
    if (readOnly) return;
    const clamped = Math.min(5, Math.max(1, Math.round(value))) as
      | 1
      | 2
      | 3
      | 4
      | 5;
    setDraft((d) =>
      d ? { ...d, traits: { ...d.traits, [key]: clamped } } : d,
    );
  }

  function toggleStyle(style: InteractionStyle) {
    if (readOnly) return;
    setDraft((d) => {
      if (!d) return d;
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
    if (readOnly) return;
    setDraft((d) => {
      if (!d) return d;
      const has = d.targetCompetencies.includes(c);
      return {
        ...d,
        targetCompetencies: has
          ? d.targetCompetencies.filter((x) => x !== c)
          : [...d.targetCompetencies, c],
      };
    });
  }

  function save() {
    if (!draft || readOnly) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const res = await fetch(`/api/admin/virtual-patients/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft }),
        });
        const data = (await res.json()) as {
          item?: VirtualPatientListItem;
          draft?: VirtualPatientDraft;
          error?: string;
        };
        if (!res.ok || !data.item || !data.draft) {
          setError(data.error ?? "Could not save.");
          return;
        }
        setItem(data.item);
        setDraft(cloneDraft(data.draft));
        setComorbidityText(data.draft.comorbidities.join(", "));
        setMessage("Saved.");
      } catch {
        setError("Could not save.");
      }
    });
  }

  function setLifecycle(status: VirtualPatientLifecycle) {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const res = await fetch(
          `/api/admin/virtual-patients/${id}/lifecycle`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          },
        );
        const data = (await res.json()) as {
          item?: VirtualPatientListItem;
          draft?: VirtualPatientDraft;
          error?: string;
        };
        if (!res.ok || !data.item || !data.draft) {
          setError(data.error ?? "Could not update status.");
          return;
        }
        setItem(data.item);
        setDraft(cloneDraft(data.draft));
        setMessage(`Status set to ${status}.`);
      } catch {
        setError("Could not update status.");
      }
    });
  }

  function runTest() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/virtual-patients/${id}/test-session`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );
        const data = (await res.json()) as { path?: string; error?: string };
        if (!res.ok || !data.path) {
          setError(data.error ?? "Could not start test session.");
          return;
        }
        router.push(data.path);
      } catch {
        setError("Could not start test session.");
      }
    });
  }

  function submitDuplicate() {
    const name = dupName.trim();
    if (!name) {
      setError("New name is required.");
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/virtual-patients/${id}/duplicate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newName: name }),
          },
        );
        const data = (await res.json()) as {
          item?: VirtualPatientListItem;
          error?: string;
        };
        if (!res.ok || !data.item) {
          setError(data.error ?? "Duplicate failed.");
          return;
        }
        router.push(`/admin/virtual-patients/${data.item.id}`);
      } catch {
        setError("Duplicate failed.");
      }
    });
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        Loading virtual patient…
      </p>
    );
  }

  if (!item || !draft) {
    return (
      <p className="text-sm text-[var(--secondary)]">
        {error ?? "Virtual patient not found."}
      </p>
    );
  }

  const disabled = readOnly || pending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
              {item.displayName}
            </h1>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {item.diagnosis}
            {item.difficulty ? ` · ${DIFFICULTY_LABELS[item.difficulty as keyof typeof DIFFICULTY_LABELS] ?? item.difficulty}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <button
              type="button"
              className="btn-primary"
              disabled={pending}
              onClick={save}
            >
              Save
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            disabled={pending || item.status === "archived"}
            onClick={runTest}
          >
            Test Patient
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => setDupOpen(true)}
          >
            Duplicate
          </button>
        </div>
      </div>

      {readOnly ? (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-4 py-3 text-sm text-[var(--on-surface)]">
          This virtual patient is published and read-only. Duplicate it to make
          changes, then publish the new draft.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--secondary)]">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-[var(--primary)]">{message}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === t
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="clinical-card p-5 md:p-6">
        {tab === "Overview" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Display name">
                <input
                  className="field-input"
                  disabled={disabled}
                  value={draft.displayName}
                  onChange={(e) => update("displayName", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Age">
                <input
                  type="number"
                  className="field-input"
                  disabled={disabled}
                  value={draft.age}
                  onChange={(e) => update("age", Number(e.target.value) || 0)}
                />
              </FieldLabel>
              <FieldLabel label="Gender">
                <select
                  className="field-input"
                  disabled={disabled}
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
                  disabled={disabled}
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
                  disabled={disabled}
                  value={draft.dialect}
                  onChange={(e) => update("dialect", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Occupation">
                <input
                  className="field-input"
                  disabled={disabled}
                  value={draft.occupation}
                  onChange={(e) => update("occupation", e.target.value)}
                />
              </FieldLabel>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                Lifecycle
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "draft",
                    "testing",
                    "published",
                    "archived",
                  ] as VirtualPatientLifecycle[]
                ).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="btn-secondary h-8 px-3 text-xs capitalize"
                    disabled={
                      pending ||
                      item.status === status ||
                      (item.status === "published" && status !== "archived")
                    }
                    onClick={() => setLifecycle(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "Clinical" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Primary diagnosis">
                <input
                  className="field-input"
                  disabled={disabled}
                  value={draft.primaryDiagnosis}
                  onChange={(e) => update("primaryDiagnosis", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Comorbidities (comma-separated)">
                <input
                  className="field-input"
                  disabled={disabled}
                  value={comorbidityText}
                  onChange={(e) => {
                    setComorbidityText(e.target.value);
                    update(
                      "comorbidities",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    );
                  }}
                />
              </FieldLabel>
              <FieldLabel label="Severity">
                <select
                  className="field-input"
                  disabled={disabled}
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
                  disabled={disabled}
                  value={draft[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              </FieldLabel>
            ))}
          </div>
        ) : null}

        {tab === "Personality" ? (
          <div className="space-y-5">
            {(Object.keys(TRAIT_LABELS) as TraitKey[]).map((key) => (
              <FieldLabel
                key={key}
                label={`${TRAIT_LABELS[key]} (${draft.traits[key]})`}
              >
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  disabled={disabled}
                  value={draft.traits[key]}
                  onChange={(e) => setTrait(key, Number(e.target.value))}
                  className="w-full accent-[var(--primary)]"
                />
              </FieldLabel>
            ))}
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
                        disabled={disabled}
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

        {tab === "Behavior" ? (
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
                  disabled={disabled}
                  value={rule.response}
                  onChange={(e) => {
                    if (readOnly) return;
                    const response = e.target.value as BehaviorResponse;
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            behaviorRules: d.behaviorRules.map((r) =>
                              r.trigger === rule.trigger
                                ? { ...r, response }
                                : r,
                            ),
                          }
                        : d,
                    );
                  }}
                >
                  {BEHAVIOR_RESPONSES.map((r) => (
                    <option key={r} value={r}>
                      {BEHAVIOR_RESPONSE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
            {draft.behaviorRules.length === 0 ? (
              <p className="text-sm text-[var(--on-surface-variant)]">
                No behavior rules yet. Save from the create wizard defaults, or
                reset fields.
              </p>
            ) : null}
          </ul>
        ) : null}

        {tab === "Voice" ? (
          <div className="space-y-4">
            <FieldLabel label="Portrait">
              <select
                className="field-input"
                disabled={disabled}
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
                disabled={disabled}
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
                  disabled={disabled}
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
                  disabled={disabled}
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
            <VoicePreviewButton
              locale={draft.language === "ar" ? "ar" : "en"}
              voiceProfileId={draft.voiceProfileId}
              avatarId={id}
              emotion={draft.emotionalBaseline}
              label="Test Voice"
            />
          </div>
        ) : null}

        {tab === "Training" ? (
          <div className="space-y-4">
            <ul className="grid gap-2 sm:grid-cols-2">
              {COMPETENCY_KEYS.map((c) => (
                <li key={c}>
                  <label className="flex items-center gap-2 text-sm text-[var(--on-surface)]">
                    <input
                      type="checkbox"
                      disabled={disabled}
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
                  disabled={disabled}
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
                  disabled={disabled}
                  value={draft.therapyModality}
                  onChange={(e) => update("therapyModality", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Expected session minutes">
                <input
                  type="number"
                  className="field-input"
                  disabled={disabled}
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

        {tab === "Safety" ? (
          <div className="space-y-3 text-sm text-[var(--on-surface)]">
            <p>
              Safety configuration is driven by behavior rules — especially
              suicide-assessment responses.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <span
                  className={
                    validation?.checks.safety
                      ? "text-[var(--primary)]"
                      : "text-[var(--secondary)]"
                  }
                >
                  {validation?.checks.safety ? "✓" : "✗"}
                </span>
                Suicide-assessment behavior rule present
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={
                    validation?.checks.clinical
                      ? "text-[var(--primary)]"
                      : "text-[var(--secondary)]"
                  }
                >
                  {validation?.checks.clinical ? "✓" : "✗"}
                </span>
                Clinical picture complete
              </li>
            </ul>
            {draft.behaviorRules
              .filter((r) => r.trigger === "asked_about_suicide")
              .map((r) => (
                <p key={r.trigger} className="rounded-lg bg-[var(--surface-container)] px-3 py-2">
                  When asked about suicide → {BEHAVIOR_RESPONSE_LABELS[r.response]}
                </p>
              ))}
          </div>
        ) : null}

        {tab === "Test" ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--on-surface-variant)]">
              Start an admin test session. This is not a learner assessment and
              will not write a training report.
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={pending || item.status === "archived"}
              onClick={runTest}
            >
              <span className="material-symbols-outlined text-[18px]">
                science
              </span>
              Test Patient
            </button>
          </div>
        ) : null}

        {tab === "Advanced" ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--on-surface-variant)]">
              System identifiers and raw configuration links. Hidden by default
              for clinical editors.
            </p>
            {!showAdvanced ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAdvanced(true)}
              >
                Show advanced configuration
              </button>
            ) : (
              <div className="space-y-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                    Id
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--on-surface-variant)]">
                    {item.id}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                    Slug
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--on-surface-variant)]">
                    {slug ?? "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <a href="/admin/personality" className="btn-secondary h-8 px-3 text-xs">
                    Personality engine
                  </a>
                  <a href="/admin/voices" className="btn-secondary h-8 px-3 text-xs">
                    Voice management
                  </a>
                </div>
                <button
                  type="button"
                  className="btn-secondary h-8 px-3 text-xs"
                  onClick={() => setShowAdvanced(false)}
                >
                  Hide advanced
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {dupOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--on-surface)_40%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="clinical-card w-full max-w-md space-y-4 p-5">
            <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
              Duplicate virtual patient
            </h2>
            <FieldLabel label="New name">
              <input
                className="field-input"
                value={dupName}
                onChange={(e) => setDupName(e.target.value)}
              />
            </FieldLabel>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDupOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={pending}
                onClick={submitDuplicate}
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* keep DEFAULT import used for empty-rule recovery path */}
      {draft.behaviorRules.length === 0 && !readOnly ? (
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() =>
            setDraft((d) =>
              d
                ? {
                    ...d,
                    behaviorRules:
                      DEFAULT_VIRTUAL_PATIENT_DRAFT.behaviorRules.map((r) => ({
                        ...r,
                      })),
                  }
                : d,
            )
          }
        >
          Restore default behavior rules
        </button>
      ) : null}
    </div>
  );
}
