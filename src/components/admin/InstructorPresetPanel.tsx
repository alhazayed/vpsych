"use client";

import { useState } from "react";
import { ClinicalPreviewSummary } from "@/components/admin/ClinicalPreviewSummary";

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
  const [presetId, setPresetId] = useState(presets[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [json, setJson] = useState("");
  const [payload, setPayload] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function preview() {
    setLoading(true);
    setError(null);
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
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? "Preview failed"),
        );
        return;
      }
      setPayload(data);
      setJson(JSON.stringify(data, null, 2));
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function clonePreset() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clone", presetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Clone failed");
        return;
      }
      setMsg(`Cloned as ${data.preset?.slug}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function archivePreset() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", presetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Archive failed");
        return;
      }
      setMsg("Preset archived");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function versionPreset() {
    setLoading(true);
    setError(null);
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Version failed");
        return;
      }
      setMsg(`Versioned to v${data.version}`);
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
    a.download = `instructor-preset-case-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Instructor preset
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
          {loading ? "Working…" : "Generate case preview"}
        </button>
        <button
          type="button"
          disabled={loading || !presetId}
          onClick={clonePreset}
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm"
        >
          Clone
        </button>
        <button
          type="button"
          disabled={loading || !presetId}
          onClick={versionPreset}
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm"
        >
          Version
        </button>
        <button
          type="button"
          disabled={loading || !presetId}
          onClick={archivePreset}
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm text-[var(--error)]"
        >
          Archive
        </button>
        <button
          type="button"
          disabled={!json}
          onClick={download}
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm"
        >
          Export JSON
        </button>
      </div>

      {error && (
        <p className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      )}
      {msg && <p className="text-sm text-[var(--primary)]">{msg}</p>}
      {payload ? (
        <ClinicalPreviewSummary
          payload={payload}
          title="Preset case summary"
        />
      ) : null}
    </div>
  );
}
