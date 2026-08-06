"use client";

import { useTranslations } from "next-intl";

/**
 * Private clinical notes — never sent to the patient agent,
 * never visible in the room transcript, exported with the session on end.
 */
export function PrivateNotesPanel({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("therapyRoom.notes");
  if (!open) return null;

  return (
    <aside className="trm-notes" aria-label={t("title")}>
      <header className="trm-notes__header">
        <h2>{t("title")}</h2>
        <p>{t("privacy")}</p>
        <button type="button" onClick={onClose} aria-label={t("close")}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>
      <textarea
        className="trm-notes__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("placeholder")}
        maxLength={20000}
        spellCheck
        autoFocus
      />
    </aside>
  );
}
