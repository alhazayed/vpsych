"use client";

import { useEffect, useId, useRef, useState } from "react";

type ContextualHelpProps = {
  label: string;
  help: string;
  /** denser popover for longer help */
  variant?: "tooltip" | "popover";
};

/**
 * Keyboard-accessible ⓘ help control for admin authoring surfaces.
 * Supports focus + click; Escape closes; does not rely on hover alone.
 */
export function ContextualHelp({
  label,
  help,
  variant = "tooltip",
}: ContextualHelpProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (
        panelRef.current?.contains(t) ||
        btnRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <span className="relative inline-flex items-center gap-1">
      <span>{label}</span>
      <button
        ref={btnRef}
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--outline-variant)] text-[10px] font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        aria-label={`Help: ${label}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>i</span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={`Help: ${label}`}
          className={`absolute start-0 z-30 mt-7 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] p-3 text-xs leading-relaxed text-[var(--on-surface)] shadow-md ${
            variant === "popover" ? "w-72 max-w-[80vw]" : "w-56 max-w-[75vw]"
          }`}
        >
          <p>{help}</p>
          <button
            type="button"
            className="mt-2 text-[11px] font-medium text-[var(--primary)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            onClick={() => {
              setOpen(false);
              btnRef.current?.focus();
            }}
          >
            Close
          </button>
        </div>
      ) : null}
    </span>
  );
}
