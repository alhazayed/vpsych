"use client";

import { useMemo, useState } from "react";

type AvatarOption = { id: string; name: string; slug: string | null };
type DisorderOption = {
  id: string;
  slug: string;
  name: string;
  dsm5_code: string | null;
  icd11_code: string | null;
};

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;
const THERAPIES = [
  "cbt",
  "dbt",
  "act",
  "psychodynamic",
  "supportive",
  "motivational_interviewing",
  "family_therapy",
  "crisis_intervention",
] as const;
const LOCALES = ["en-US", "ar-JO"] as const;

export function CaseEnginePanel({
  avatars,
  disorders,
}: {
  avatars: AvatarOption[];
  disorders: DisorderOption[];
}) {
  const [avatarId, setAvatarId] = useState(avatars[0]?.id ?? "");
  const [disorderSlug, setDisorderSlug] = useState(disorders[0]?.slug ?? "");
  const [comorbid, setComorbid] = useState("");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]>("intermediate");
  const [therapy, setTherapy] =
    useState<(typeof THERAPIES)[number]>("supportive");
  const [locale, setLocale] = useState<(typeof LOCALES)[number]>("en-US");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [json, setJson] = useState<string>("");

  const comorbidOptions = useMemo(
    () => disorders.filter((d) => d.slug !== disorderSlug),
    [disorders, disorderSlug],
  );

  async function preview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cases/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId,
          disorderSlug,
          comorbiditySlugs: comorbid ? [comorbid] : [],
          difficulty,
          therapyModality: therapy,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? "Preview failed"),
        );
        setJson("");
        return;
      }
      setJson(JSON.stringify(data.snapshot, null, 2));
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!json) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `case-preview-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Persona
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
            value={avatarId}
            onChange={(e) => setAvatarId(e.target.value)}
          >
            {avatars.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Primary diagnosis
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
            value={disorderSlug}
            onChange={(e) => setDisorderSlug(e.target.value)}
          >
            {disorders.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Comorbidity (optional)
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
            value={comorbid}
            onChange={(e) => setComorbid(e.target.value)}
          >
            <option value="">None</option>
            {comorbidOptions.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Difficulty
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
            value={difficulty}
            onChange={(e) =>
              setDifficulty(e.target.value as (typeof DIFFICULTIES)[number])
            }
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Therapy modality
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
            value={therapy}
            onChange={(e) =>
              setTherapy(e.target.value as (typeof THERAPIES)[number])
            }
          >
            {THERAPIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Language
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
            value={locale}
            onChange={(e) =>
              setLocale(e.target.value as (typeof LOCALES)[number])
            }
          >
            {LOCALES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={loading || !avatarId || !disorderSlug}
          onClick={() => void preview()}
        >
          {loading ? "Generating…" : "Preview case"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!json}
          onClick={download}
        >
          Export Case JSON
        </button>
      </div>

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

      {json && (
        <pre className="max-h-[480px] overflow-auto rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-xs leading-relaxed">
          {json}
        </pre>
      )}
    </div>
  );
}
