"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Progressive disclosure for technical / JSON / diagnostic content.
 * Default collapsed so clinical administrators are not forced to read internals.
 */
export function AdvancedDetails({
  title = "Advanced details",
  children,
  defaultOpen = false,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className={`rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] ${className}`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm font-medium text-[var(--on-surface)]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[var(--on-surface-variant)]">
            {open ? "expand_less" : "expand_more"}
          </span>
          {title}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="border-t border-[var(--outline-variant)] px-4 py-3"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Pretty-print JSON inside AdvancedDetails. */
export function AdvancedJson({
  value,
  title = "Raw JSON",
}: {
  value: unknown;
  title?: string;
}) {
  const text =
    typeof value === "string"
      ? value
      : JSON.stringify(value, null, 2) ?? "";

  return (
    <AdvancedDetails title={title}>
      <pre className="max-h-[480px] overflow-auto rounded-md bg-[var(--surface-container-lowest)] p-3 text-xs leading-relaxed text-[var(--on-surface)]">
        {text || "—"}
      </pre>
    </AdvancedDetails>
  );
}
