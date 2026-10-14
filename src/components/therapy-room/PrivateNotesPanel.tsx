"use client";

import { useTranslations } from "next-intl";
import { usePanelFocus } from "@/components/therapy-room/usePanelFocus";

/**
 * Private clinical notes — never sent to the patient agent,
 * never visible in the room transcript, exported with the session on end.
 */
export function PrivateNotesPanel({
  open,
  value,
  onChange,
  onClose,
  saveFailed = false,
}: {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  /** The last autosave did not reach the server. */
  saveFailed?: boolean;
}) {
  const t = useTranslations("therapyRoom.notes");
  const inputRef = usePanelFocus<HTMLTextAreaElement>(open, {
    // The notes box always took focus on open (also via the N shortcut).
    always: true,
  });
  if (!open) return null;

  return (
    <aside className="trm-notes" aria-label={t("title")}>
      <header className="trm-notes__header">
        <h2>{t("title")}</h2>
        <p>{t("privacy")}</p>
        <button type="button" onClick={onClose} aria-label={t("close")}>
          <span aria-hidden className="material-symbols-outlined">close</span>
        </button>
      </header>
      <textarea
        ref={inputRef}
        className="trm-notes__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("placeholder")}
        maxLength={20000}
        spellCheck
      />
      {saveFailed && (
        <p role="status" className="trm-notes__warning">
          {t("saveFailed")}
        </p>
      )}
    </aside>
  );
}
