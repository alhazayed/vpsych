"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  adminActionErrorKey,
  adminValidationIssues,
} from "@/lib/admin/admin-product-errors";

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
  const tErr = useTranslations("admin.actionErrors");
  const t = useTranslations("admin.templates");
  const tPage = useTranslations("admin.templatesPage");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
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

  async function preview() {
    setLoading(true);
    setError(null);
    setIssues([]);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) {
        await failed(res);
        return;
      }
      const data = await res.json();
      setJson(JSON.stringify(data.patient, null, 2));
    } catch {
      setError(tErr("network"));
    } finally {
      setLoading(false);
    }
  }

  async function cloneTemplate() {
    setLoading(true);
    setError(null);
    setIssues([]);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clone", templateId }),
      });
      if (!res.ok) {
        await failed(res);
        return;
      }
      const data = await res.json();
      setMsg(t("cloned", { slug: String(data.template?.slug ?? "") }));
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
    a.download = `standardized-patient-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {tPage("templateLabel")}
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
          {loading ? tPage("generating") : t("preview")}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!json}
          onClick={download}
        >
          {tPage("exportPatientJson")}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={loading || !templateId}
          onClick={() => void cloneTemplate()}
        >
          {tPage("cloneTemplate")}
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
        <pre className="max-h-[480px] overflow-auto rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-xs leading-relaxed">
          {json}
        </pre>
      )}
    </div>
  );
}
