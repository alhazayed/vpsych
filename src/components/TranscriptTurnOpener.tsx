"use client";

import { useEffect } from "react";

/**
 * Opens the collapsed transcript when a report's turn link points into it,
 * then scrolls to and focuses that turn. Browsers do not reliably open a
 * closed <details> for a fragment link, so a quote's link would otherwise
 * appear to do nothing.
 */
export function TranscriptTurnOpener() {
  useEffect(() => {
    const reveal = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      const details = target.closest("details");
      if (!details) return;
      if (!details.open) details.open = true;
      target.scrollIntoView({ block: "center" });
      target.focus({ preventScroll: true });
    };
    // A second click on the same link changes no hash, so watch clicks too.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[data-turn-link]");
      if (link) window.setTimeout(reveal, 0);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", reveal);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
