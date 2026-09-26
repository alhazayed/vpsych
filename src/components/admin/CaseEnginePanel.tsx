"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ContextualHelp } from "@/components/admin/help/ContextualHelp";
import { findDisorderBySlug } from "@/lib/case-engine/catalog";
import {
  getComorbidityCompatibility,
  listCompatibleComorbiditySlugs,
} from "@/lib/case-engine/comorbidity-compat";

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

function formatPreviewError(
  data: { error?: unknown },
  fallback: string,
): string {
  const err = data.error;
  if (typeof err === "string") return err;
  if (Array.isArray(err)) {
    return err
      .map((issue) => {
        if (issue && typeof issue === "object" && "message" in issue) {
          return String((issue as { message: string }).message);
        }
        return JSON.stringify(issue);
      })
      .join("; ");
  }
  if (err && typeof err === "object") return JSON.stringify(err);
  return fallback;
}

export function CaseEnginePanel({
  avatars,
  disorders,
}: {
  avatars: AvatarOption[];
  disorders: DisorderOption[];
}) {
  const t = useTranslations("admin.cases");
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

  // Preview uses the builtin Case Engine catalog — only offer primaries it knows.
  const previewableDisorders = useMemo(
    () => disorders.filter((d) => Boolean(findDisorderBySlug(d.slug))),
    [disorders],
  );

  const disorderBySlug = useMemo(() => {
    const m = new Map<string, DisorderOption>();
    for (const d of disorders) m.set(d.slug, d);
    return m;
  }, [disorders]);

  const activePrimary =
    previewableDisorders.some((d) => d.slug === disorderSlug)
      ? disorderSlug
      : (previewableDisorders[0]?.slug ?? "");

  const compatibleSlugs = useMemo(
    () => listCompatibleComorbiditySlugs(activePrimary),
    [activePrimary],
  );

  const compatibleOptions = useMemo(
    () =>
      compatibleSlugs
        .map((slug) => disorderBySlug.get(slug))
        .filter((d): d is DisorderOption => Boolean(d)),
    [compatibleSlugs, disorderBySlug],
  );

  const compat = useMemo(
    () => getComorbidityCompatibility(activePrimary, comorbid || null),
    [activePrimary, comorbid],
  );

  const comorbidityBlocked = Boolean(comorbid) && !compat.previewAllowed;
  const comorbidityLabel =
    disorderBySlug.get(comorbid)?.name ?? comorbid;

  function onPrimaryChange(next: string) {
    setDisorderSlug(next);
    // Keep selection if still listed; do not silently clear unsupported picks.
    setJson("");
    setError(null);
  }

  async function preview() {
    if (comorbidityBlocked) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cases/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId,
          disorderSlug: activePrimary,
          comorbiditySlugs: comorbid ? [comorbid] : [],
          difficulty,
          therapyModality: therapy,
          locale,
        }),
      });
      const data = (await res.json()) as {
        error?: unknown;
        snapshot?: unknown;
      };
      if (!res.ok) {
        setError(formatPreviewError(data, t("previewFailed")));
        setJson("");
        return;
      }
      setJson(JSON.stringify(data.snapshot, null, 2));
    } catch {
      setError(t("networkError"));
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
            {t("persona")}
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
            {t("primaryDiagnosis")}
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
            value={activePrimary}
            onChange={(e) => onPrimaryChange(e.target.value)}
          >
            {previewableDisorders.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="block text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              {t("comorbidity")}
            </span>
            <ContextualHelp
              label={t("comorbidityHelpLabel")}
              help={t("comorbidityHelp")}
              variant="popover"
            />
          </div>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
            value={
              comorbid &&
              (compatibleSlugs.includes(comorbid) || comorbidityBlocked)
                ? comorbid
                : ""
            }
            onChange={(e) => {
              setComorbid(e.target.value);
              setJson("");
              setError(null);
            }}
            aria-invalid={comorbidityBlocked || undefined}
            aria-describedby={
              comorbidityBlocked ? "case-engine-comorbidity-status" : undefined
            }
          >
            <option value="">{t("comorbidityNone")}</option>
            {compatibleOptions.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name}
              </option>
            ))}
            {/* Preserve an unsupported selection without silent clear */}
            {comorbidityBlocked && comorbid ? (
              <option value={comorbid}>
                {t("comorbidityUnsupportedOption", {
                  name: comorbidityLabel,
                })}
              </option>
            ) : null}
          </select>
          {compatibleOptions.length === 0 && !comorbidityBlocked ? (
            <p className="mt-1.5 text-xs text-[var(--on-surface-variant)]">
              {t("comorbidityNoneAvailable")}
            </p>
          ) : null}
          {comorbidityBlocked ? (
            <div
              id="case-engine-comorbidity-status"
              className="mt-2 space-y-2 rounded-lg border border-[var(--error)]/30 bg-[var(--error-container)]/40 px-3 py-2 text-sm text-[var(--on-surface)]"
              role="status"
            >
              <p>
                {compat.code === "comorbidity_incompatible"
                  ? t("comorbidityIncompatible", { name: comorbidityLabel })
                  : t("comorbidityUnavailable", { name: comorbidityLabel })}
              </p>
              <p className="text-xs text-[var(--on-surface-variant)]">
                {t("comorbidityNeedsAuthoring")}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => {
                    setComorbid("");
                    setJson("");
                    setError(null);
                  }}
                >
                  {t("comorbidityRemove")}
                </button>
                {compatibleOptions.length > 0 ? (
                  <span className="self-center text-xs text-[var(--on-surface-variant)]">
                    {t("comorbidityChooseSupported")}
                  </span>
                ) : (
                  <span className="self-center text-xs text-[var(--on-surface-variant)]">
                    {t("comorbidityPrimaryOnly")}
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <label className="block text-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("difficulty")}
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
            {t("therapyModality")}
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
            {t("language")}
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
          disabled={
            loading || !avatarId || !activePrimary || comorbidityBlocked
          }
          onClick={() => void preview()}
        >
          {loading ? t("previewLoading") : t("previewAction")}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!json}
          onClick={download}
        >
          {t("exportJson")}
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
