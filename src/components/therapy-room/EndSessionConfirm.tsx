"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

/**
 * Ending a session is irreversible (it marks the session complete and starts
 * the assessment), so the toolbar button and Ctrl/Cmd+E ask first.
 * Timer expiry and server-side expiry still end without asking.
 */
export function EndSessionConfirm({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("therapyRoom.endConfirm");
  const keepRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Default focus on the safe choice so a stray Enter keeps the session.
    if (open) keepRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="trm-confirm" role="presentation" onClick={onCancel}>
      <div
        className="trm-confirm__dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="trm-confirm-title"
        aria-describedby="trm-confirm-body"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="trm-confirm-title">{t("title")}</h2>
        <p id="trm-confirm-body">{t("body")}</p>
        <div className="trm-confirm__actions">
          <button
            ref={keepRef}
            type="button"
            className="trm-confirm__btn"
            onClick={onCancel}
          >
            {t("keep")}
          </button>
          <button
            type="button"
            className="trm-confirm__btn is-danger"
            onClick={onConfirm}
          >
            {t("end")}
          </button>
        </div>
      </div>
    </div>
  );
}
