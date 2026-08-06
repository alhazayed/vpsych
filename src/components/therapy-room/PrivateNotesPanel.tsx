"use client";

import { useTranslations } from "next-intl";
import {
  NOTE_FORMAT_LABELS,
  templateForFormat,
  type NoteFormat,
} from "@/lib/therapy-room";

const FORMATS: NoteFormat[] = ["soap", "dap", "birp", "free"];

/**
 * Canonical private notes panel — persists via /api/sessions/[id]/notes.
 * Never sent to the patient agent; never shown in the live transcript.
 */
export function PrivateNotesPanel({
  open,
  value,
  format,
  onChange,
  onFormatChange,
  onClose,
}: {
  open: boolean;
  value: string;
  format: NoteFormat;
  onChange: (v: string) => void;
  onFormatChange: (f: NoteFormat) => void;
  onClose: () => void;
}) {
  const t = useTranslations("therapyRoom.notes");
  if (!open) return null;

  function changeFormat(next: NoteFormat) {
    onFormatChange(next);
    if (!value.trim() || value === templateForFormat(format)) {
      onChange(templateForFormat(next));
    }
  }

  return (
    <aside className="trm-notes" aria-label={t("title")}>
      <header className="trm-notes__header">
        <h2>{t("title")}</h2>
        <p>{t("privacy")}</p>
        <button type="button" onClick={onClose} aria-label={t("close")}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              format === f
                ? "bg-[var(--primary)] text-white"
                : "bg-white/10 text-white/70"
            }`}
            onClick={() => changeFormat(f)}
          >
            {NOTE_FORMAT_LABELS[f]}
          </button>
        ))}
      </div>
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
