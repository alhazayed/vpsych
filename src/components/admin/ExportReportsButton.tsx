"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** Downloads every session report as CSV, with visible progress and errors. */
export function ExportReportsButton() {
  const t = useTranslations("admin.reports.export");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "note"; text: string } | null>(null);

  async function download() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/reports/export");
      if (!res.ok) {
        setMessage({
          kind: "error",
          text: res.status === 429 ? t("errorRateLimited") : t("errorGeneric"),
        });
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "vpsych-reports.csv";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      const rows = Number(res.headers.get("X-Export-Rows") ?? "0");
      setMessage({
        kind: "note",
        text:
          res.headers.get("X-Export-Truncated") === "1"
            ? t("truncated", { count: rows })
            : t("done", { count: rows }),
      });
    } catch {
      setMessage({ kind: "error", text: t("errorNetwork") });
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void download()}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          download
        </span>
        {pending ? t("pending") : t("cta")}
      </button>
      {message ? (
        <span
          role={message.kind === "error" ? "alert" : "status"}
          className={`max-w-xs text-xs ${
            message.kind === "error"
              ? "text-[var(--error)]"
              : "text-[var(--on-surface-variant)]"
          }`}
        >
          {message.text}
        </span>
      ) : null}
    </span>
  );
}
