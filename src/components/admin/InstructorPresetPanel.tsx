"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  adminActionErrorKey,
  adminValidationIssues,
} from "@/lib/admin/admin-product-errors";

type PresetOption = {
  id: string;
  slug: string;
  name: string;
  language?: string;
  difficulty?: string;
  primary_objective?: string;
  target_learner?: string;
  enabled?: boolean;
};

export function InstructorPresetPanel({
  presets,
}: {
  presets: PresetOption[];
}) {
  const tErr = useTranslations("admin.actionErrors");
  const t = useTranslations("admin.presets");
  const tPage = useTranslations("admin.presetsPage");
  const [presetId, setPresetId] = useState(presets[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  /** Localized failure; a non-JSON body (proxy timeout page) is not a network error. */
  async function failed(res: Response) {
    const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
    setError(tErr(adminActionErrorKey(res.status, body?.code)));
    setIssues(res.status === 400 ? adminValidationIssues(body) : []);
  }

  function begin() {
    setLoading(true);
    setError(null);
    setIssues([]);
  }

  async function preview() {
    begin();
    setMsg(null);
    try {
      const res = await fetch("/api/admin/presets/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId,
          generateReport: true,
        }),
      });
      if (!res.ok) {
        await failed(res);
        return;
      }
      const data = await res.json();
      setJson(JSON.stringify(data, null, 2));
    } catch {
      setError(tErr("network"));
    } finally {
      setLoading(false);
    }
  }

  async function clonePreset() {
    begin();
    try {
      const res = await fetch("/api/admin/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clone", presetId }),
      });
      if (!res.ok) {
        await failed(res);
        return;
      }
      const data = await res.json();
      setMsg(t("cloned", { slug: String(data.preset?.slug ?? "") }));
    } catch {
      setError(tErr("network"));
    } finally {
      setLoading(false);
    }
  }

  async function archivePreset() {
    begin();
    try {
      const res = await fetch("/api/admin/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", presetId }),
      });
      if (!res.ok) {
        await failed(res);
        return;
      }
      setMsg(t("archived"));
    } catch {
      setError(tErr("network"));
    } finally {
      setLoading(false);
    }
  }

  async function versionPreset() {
    begin();
    try {
      const res = await fetch("/api/admin/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "version",
          presetId,
          changeNotes: "Admin version bump",
        }),
      });
      if (!res.ok) {
        await failed(res);
        return;
      }
      const data = await res.json();
      setMsg(t("versioned", { version: String(data.version ?? "") }));
    } catch {
      setError(tErr("network"));
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
    a.download = `instructor-preset-case-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {tPage("presetLabel")}
        </span>
        <select
          className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.language} · {p.difficulty} · {p.primary_objective})
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading || !presetId}
          onClick={preview}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-50"
        >
          {loading ? tPage("working") : tPage("generatePreview")}
        </button>
        <button
          type="button"
          disabled={loading || !presetId}
          onClick={clonePreset}
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm"
        >
          {tPage("clone")}
        </button>
        <button
          type="button"
          disabled={loading || !presetId}
          onClick={versionPreset}
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm"
        >
          {tPage("version")}
        </button>
        <button
          type="button"
          disabled={loading || !presetId}
          onClick={archivePreset}
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm text-[var(--error)]"
        >
          {tPage("archive")}
        </button>
        <button
          type="button"
          disabled={!json}
          onClick={download}
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm"
        >
          {tPage("exportJson")}
        </button>
      </div>

      {error && (
        <div className="text-sm text-[var(--error)]" role="alert">
          <p>{error}</p>
          {issues.length > 0 && (
            <ul dir="ltr" className="mt-1 list-disc ps-5 text-xs">
              {issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {msg && <p className="text-sm text-[var(--primary)]">{msg}</p>}
      {json && (
        <pre className="max-h-[480px] overflow-auto rounded-lg bg-[var(--surface-container-low)] p-3 text-xs">
          {json}
        </pre>
      )}
    </div>
  );
}
