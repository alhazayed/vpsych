"use client";

import { useState } from "react";

type TemplateOption = {
  id: string;
  slug: string;
  name: string;
  specialty?: string;
  language?: string;
  difficulty?: string;
  enabled?: boolean;
};

export function TemplateEnginePanel({
  templates,
}: {
  templates: TemplateOption[];
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function preview() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
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
      setJson(JSON.stringify(data.patient, null, 2));
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function cloneTemplate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clone", templateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Clone failed");
        return;
      }
      setMsg(`Cloned as ${data.template?.slug}`);
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
    a.download = `standardized-patient-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          Template
        </span>
        <select
          className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.language} · {t.difficulty})
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={loading || !templateId}
          onClick={() => void preview()}
        >
          {loading ? "Generating…" : "Generate sample patient"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!json}
          onClick={download}
        >
          Export patient JSON
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={loading || !templateId}
          onClick={() => void cloneTemplate()}
        >
          Clone template
        </button>
      </div>

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--primary)]">{msg}</p>}

      {json && (
        <pre className="max-h-[480px] overflow-auto rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-xs leading-relaxed">
          {json}
        </pre>
      )}
    </div>
  );
}
