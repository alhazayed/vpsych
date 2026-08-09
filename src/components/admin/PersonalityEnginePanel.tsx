"use client";

import { useEffect, useState, useTransition } from "react";
import { AdvancedDetails } from "@/components/admin/AdvancedDetails";

type AvatarRow = {
  id: string;
  name: string;
  slug: string | null;
  disorder: string;
  is_active: boolean;
  locales: string[];
  profile: Record<string, unknown>;
};

const SCALE_FIELDS = [
  "resilience",
  "openness",
  "agreeableness",
  "conscientiousness",
  "neuroticism",
  "trust_level",
] as const;

const ATTACHMENT = [
  "secure",
  "anxious_preoccupied",
  "dismissive_avoidant",
  "fearful_avoidant",
  "disorganized",
] as const;

const COPING = [
  "problem_focused",
  "emotion_focused",
  "avoidant",
  "support_seeking",
  "intellectualizing",
  "withdrawal",
  "reassurance_seeking",
  "somatic",
  "mixed",
] as const;

const HUMOR = [
  "none",
  "dry",
  "self_deprecating",
  "warm",
  "deflective",
  "dark",
  "rare_soft",
] as const;

const REGULATION = [
  "expressive",
  "suppressive",
  "volatile",
  "intellectualized",
  "somatic_channel",
  "delayed_flood",
  "mixed",
] as const;

function asStringArray(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join("\n");
  return "";
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function PersonalityEnginePanel({
  initialAvatars,
}: {
  initialAvatars: AvatarRow[];
}) {
  const [avatars, setAvatars] = useState(initialAvatars);
  const [avatarId, setAvatarId] = useState(initialAvatars[0]?.id ?? "");
  const [locale, setLocale] = useState(initialAvatars[0]?.locales[0] ?? "en-US");
  const [draft, setDraft] = useState<Record<string, unknown>>(
    initialAvatars[0]?.profile ?? {},
  );
  const [preferredTopics, setPreferredTopics] = useState(
    asStringArray(initialAvatars[0]?.profile?.preferred_topics),
  );
  const [avoidantTopics, setAvoidantTopics] = useState(
    asStringArray(initialAvatars[0]?.profile?.avoidant_topics),
  );
  const [intelStrengths, setIntelStrengths] = useState(
    asStringArray(
      (initialAvatars[0]?.profile?.intelligence as { strengths?: string[] })
        ?.strengths,
    ),
  );
  const [vocabMarkers, setVocabMarkers] = useState(
    asStringArray(
      (initialAvatars[0]?.profile?.vocabulary as { markers?: string[] })?.markers,
    ),
  );
  const [vocabAvoids, setVocabAvoids] = useState(
    asStringArray(
      (initialAvatars[0]?.profile?.vocabulary as { avoids?: string[] })?.avoids,
    ),
  );
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = avatars.find((a) => a.id === avatarId);

  const effectiveLocale =
    selected && selected.locales.includes(locale)
      ? locale
      : selected?.locales[0] ?? "en-US";

  useEffect(() => {
    if (!avatarId) return;
    let cancelled = false;
    startTransition(() => {
      void (async () => {
        setError(null);
        try {
          const res = await fetch("/api/admin/personality", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "load",
              avatarId,
              locale: effectiveLocale,
            }),
          });
          const data = await res.json();
          if (cancelled) return;
          if (!res.ok) {
            setError(data.error ?? "Load failed");
            return;
          }
          const profile = data.profile as Record<string, unknown>;
          setDraft(profile);
          setPreferredTopics(asStringArray(profile.preferred_topics));
          setAvoidantTopics(asStringArray(profile.avoidant_topics));
          setIntelStrengths(
            asStringArray(
              (profile.intelligence as { strengths?: string[] })?.strengths,
            ),
          );
          setVocabMarkers(
            asStringArray(
              (profile.vocabulary as { markers?: string[] })?.markers,
            ),
          );
          setVocabAvoids(
            asStringArray((profile.vocabulary as { avoids?: string[] })?.avoids),
          );
        } catch {
          if (!cancelled) setError("Network error");
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [avatarId, effectiveLocale]);

  function onAvatarChange(nextId: string) {
    setAvatarId(nextId);
    const next = avatars.find((a) => a.id === nextId);
    setLocale(next?.locales[0] ?? "en-US");
  }

  function buildProfile(): Record<string, unknown> {
    const intelligence = {
      ...((draft.intelligence as object) ?? {}),
      band: (draft.intelligence as { band?: string })?.band ?? "average",
      style: (draft.intelligence as { style?: string })?.style ?? "",
      strengths: parseLines(intelStrengths),
    };
    const vocabulary = {
      ...((draft.vocabulary as object) ?? {}),
      register: (draft.vocabulary as { register?: string })?.register ?? "everyday",
      markers: parseLines(vocabMarkers),
      avoids: parseLines(vocabAvoids),
    };
    const memory = {
      ...((draft.memory_of_therapist as object) ?? {}),
      remembers_name: Boolean(
        (draft.memory_of_therapist as { remembers_name?: boolean })
          ?.remembers_name,
      ),
      remembers_prior_sessions: Boolean(
        (draft.memory_of_therapist as { remembers_prior_sessions?: boolean })
          ?.remembers_prior_sessions,
      ),
      alliance_sensitivity: Number(
        (draft.memory_of_therapist as { alliance_sensitivity?: number })
          ?.alliance_sensitivity ?? 3,
      ),
      rupture_style:
        (draft.memory_of_therapist as { rupture_style?: string })?.rupture_style ??
        "",
      notes: (draft.memory_of_therapist as { notes?: string })?.notes ?? "",
    };

    return {
      ...draft,
      version: 1,
      locale: effectiveLocale,
      preferred_topics: parseLines(preferredTopics),
      avoidant_topics: parseLines(avoidantTopics),
      intelligence,
      vocabulary,
      memory_of_therapist: memory,
    };
  }

  async function previewPrompt() {
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/personality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: buildProfile() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.issues ?? data.error ?? "Preview failed"),
        );
        setPreview("");
        return;
      }
      setPreview(
        `${data.promptBlock}\n\n--- per-turn ---\n${data.perTurnCue}`,
      );
    } catch {
      setError("Network error");
    }
  }

  async function save() {
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/personality", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId,
          locale: effectiveLocale,
          profile: buildProfile(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.issues ?? data.error ?? "Save failed"),
        );
        return;
      }
      setMsg("Personality saved. GPT will receive this profile every turn.");
      setAvatars((prev) =>
        prev.map((a) =>
          a.id === avatarId
            ? {
                ...a,
                locales: Array.from(new Set([...a.locales, effectiveLocale])),
                profile: buildProfile(),
              }
            : a,
        ),
      );
    } catch {
      setError("Network error");
    }
  }

  function setField(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setNested(
    root: "intelligence" | "vocabulary" | "memory_of_therapist",
    key: string,
    value: unknown,
  ) {
    setDraft((d) => ({
      ...d,
      [root]: { ...((d[root] as object) ?? {}), [key]: value },
    }));
  }

  if (!selected) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        No avatars available.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-[var(--outline)]">
          Avatar
          <select
            className="min-w-[200px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--on-surface)]"
            value={avatarId}
            onChange={(e) => onAvatarChange(e.target.value)}
          >
            {avatars.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.slug ? ` (${a.slug})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-[var(--outline)]">
          Locale
          <select
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--on-surface)]"
            value={effectiveLocale}
            onChange={(e) => setLocale(e.target.value)}
          >
            {Array.from(
              new Set([...(selected.locales ?? []), "en-US", "ar-JO"]),
            ).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-sm text-[var(--on-surface-variant)]">
        {selected.disorder} · traits are independent of diagnosis — two MDD
        patients can still feel like different people.
        {pending ? " Loading…" : ""}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["temperament", "Temperament"],
            ["education", "Education"],
            ["occupation", "Occupation"],
            ["culture", "Culture"],
            ["religion", "Religion"],
            ["speech_style", "Speech style"],
            ["treatment_expectations", "Treatment expectations"],
            ["attachment_notes", "Attachment notes"],
            ["coping_notes", "Coping notes"],
            ["humor_notes", "Humor notes"],
            ["trust_notes", "Trust notes"],
            ["emotional_regulation_notes", "Emotional regulation notes"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]"
          >
            {label}
            <textarea
              className="min-h-[72px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--on-surface)]"
              value={String(draft[key] ?? "")}
              onChange={(e) => setField(key, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Attachment style
          <select
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={String(draft.attachment_style ?? "anxious_preoccupied")}
            onChange={(e) => setField("attachment_style", e.target.value)}
          >
            {ATTACHMENT.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Coping style
          <select
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={String(draft.coping_style ?? "mixed")}
            onChange={(e) => setField("coping_style", e.target.value)}
          >
            {COPING.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Humor
          <select
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={String(draft.humor ?? "none")}
            onChange={(e) => setField("humor", e.target.value)}
          >
            {HUMOR.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Emotional regulation
          <select
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={String(draft.emotional_regulation ?? "mixed")}
            onChange={(e) => setField("emotional_regulation", e.target.value)}
          >
            {REGULATION.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {SCALE_FIELDS.map((key) => (
          <label
            key={key}
            className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]"
          >
            {key.replace(/_/g, " ")} (1–5)
            <input
              type="number"
              min={1}
              max={5}
              className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
              value={Number(draft[key] ?? 3)}
              onChange={(e) => setField(key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Intelligence band
          <select
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={
              (draft.intelligence as { band?: string })?.band ?? "average"
            }
            onChange={(e) => setNested("intelligence", "band", e.target.value)}
          >
            {["average", "above_average", "high", "very_high"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Intelligence style
          <input
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={(draft.intelligence as { style?: string })?.style ?? ""}
            onChange={(e) => setNested("intelligence", "style", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Intelligence strengths (one per line)
          <textarea
            className="min-h-[72px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={intelStrengths}
            onChange={(e) => setIntelStrengths(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Vocabulary register
          <select
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={
              (draft.vocabulary as { register?: string })?.register ?? "everyday"
            }
            onChange={(e) => setNested("vocabulary", "register", e.target.value)}
          >
            {["concrete", "everyday", "educated", "technical", "mixed"].map(
              (v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Vocabulary markers (one per line)
          <textarea
            className="min-h-[72px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={vocabMarkers}
            onChange={(e) => setVocabMarkers(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Vocabulary avoids (one per line)
          <textarea
            className="min-h-[72px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={vocabAvoids}
            onChange={(e) => setVocabAvoids(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Preferred topics (one per line)
          <textarea
            className="min-h-[72px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={preferredTopics}
            onChange={(e) => setPreferredTopics(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Avoidant topics (one per line)
          <textarea
            className="min-h-[72px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={avoidantTopics}
            onChange={(e) => setAvoidantTopics(e.target.value)}
          />
        </label>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-[var(--outline-variant)] p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Memory of therapist
        </legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(
                (draft.memory_of_therapist as { remembers_name?: boolean })
                  ?.remembers_name,
              )}
              onChange={(e) =>
                setNested("memory_of_therapist", "remembers_name", e.target.checked)
              }
            />
            Remembers name
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(
                (
                  draft.memory_of_therapist as {
                    remembers_prior_sessions?: boolean;
                  }
                )?.remembers_prior_sessions,
              )}
              onChange={(e) =>
                setNested(
                  "memory_of_therapist",
                  "remembers_prior_sessions",
                  e.target.checked,
                )
              }
            />
            Remembers prior sessions
          </label>
          <label className="flex items-center gap-2">
            Alliance sensitivity
            <input
              type="number"
              min={1}
              max={5}
              className="w-16 rounded border border-[var(--outline-variant)] px-2 py-1"
              value={Number(
                (
                  draft.memory_of_therapist as {
                    alliance_sensitivity?: number;
                  }
                )?.alliance_sensitivity ?? 3,
              )}
              onChange={(e) =>
                setNested(
                  "memory_of_therapist",
                  "alliance_sensitivity",
                  Number(e.target.value),
                )
              }
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Rupture style
          <textarea
            className="min-h-[56px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={
              (draft.memory_of_therapist as { rupture_style?: string })
                ?.rupture_style ?? ""
            }
            onChange={(e) =>
              setNested("memory_of_therapist", "rupture_style", e.target.value)
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
          Memory notes
          <textarea
            className="min-h-[56px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={
              (draft.memory_of_therapist as { notes?: string })?.notes ?? ""
            }
            onChange={(e) =>
              setNested("memory_of_therapist", "notes", e.target.value)
            }
          />
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void previewPrompt()}
          className="rounded-lg bg-[var(--surface-container-high)] px-4 py-2 text-sm font-semibold text-[var(--on-surface)]"
        >
          Preview prompt block
        </button>
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
        >
          Save personality
        </button>
      </div>

      {error ? (
        <p className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="text-sm text-[var(--primary)]" role="status">
          {msg}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--outline-variant)] p-4 text-sm text-[var(--on-surface-variant)]">
            Personality prompt preview is ready. Open advanced details to read
            the full injection text used during sessions.
          </div>
          <AdvancedDetails title="Advanced details (prompt injection)">
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs text-[var(--on-surface)]">
              {preview}
            </pre>
          </AdvancedDetails>
        </div>
      ) : null}
    </div>
  );
}
