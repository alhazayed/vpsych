"use client";

import { useEffect, useRef } from "react";

/**
 * Focus handling for the room's side panels (WCAG 2.4.3).
 *
 * When a panel is opened from the control bar, focus moves to the element
 * holding the returned ref (the heading, or the notes box) so keyboard and
 * screen-reader users land inside it. When the panel closes and focus would
 * otherwise drop to the page body, it goes back to the control that opened it.
 */
export function usePanelFocus<T extends HTMLElement>(
  open: boolean,
  { always = false }: { always?: boolean } = {},
) {
  const targetRef = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    // Only act when the panel was opened from the controls (or `always`),
    // so a panel restored on page load or toggled from Settings leaves
    // focus alone.
    const opener =
      active instanceof HTMLElement && active.closest(".trm-controls")
        ? active
        : null;
    if (opener || always) targetRef.current?.focus();
    if (!opener) return;

    return () => {
      const now = document.activeElement;
      if (now && now !== document.body) return;
      if (opener.isConnected) opener.focus();
    };
  }, [open, always]);

  return targetRef;
}
