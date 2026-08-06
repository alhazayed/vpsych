"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  NOTE_FORMAT_LABELS,
  templateForFormat,
  type NoteFormat,
  type PrivateNoteEntry,
} from "@/lib/therapy-room";

const FORMATS: NoteFormat[] = ["soap", "dap", "birp", "free", "voice"];

/**
 * Private session notebook — never sent to the patient agent.
 */
export function PrivateNotebook({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const t = useTranslations("clinic.notes");
  const [format, setFormat] = useState<NoteFormat>("soap");
  const [body, setBody] = useState(() => templateForFormat("soap"));
  const [notes, setNotes] = useState<PrivateNoteEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ensureLoaded() {
    if (loaded || pending) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/notes`);
        const data = await res.json();
        if (res.ok) setNotes(data.notes ?? []);
      } catch {
        /* offline notes still local until save */
      } finally {
        setLoaded(true);
      }
    });
  }

  function changeFormat(next: NoteFormat) {
    setFormat(next);
    if (!body.trim() || body === templateForFormat(format)) {
      setBody(templateForFormat(next));
    }
  }

  async function save() {
    if (!body.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("saveFailed"));
        setSaving(false);
        return;
      }
      setNotes((prev) => [...prev, data.note]);
      setBody(templateForFormat(format));
    } catch {
      setError(t("networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside
      className="absolute bottom-24 start-4 z-40 flex max-h-[70vh] w-[min(100%-2rem,22rem)] flex-col rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-xl"
      aria-label={t("title")}
      onFocusCapture={ensureLoaded}
      onMouseEnter={ensureLoaded}
    >
      <div className="flex items-center justify-between border-b border-[var(--outline-variant)] px-4 py-3">
        <div>
          <p className="font-semibold">{t("title")}</p>
          <p className="text-xs text-[var(--on-surface-variant)]">{t("private")}</p>
        </div>
        <button type="button" aria-label={t("close")} onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto px-3 pt-3">
        {FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            className={`rounded px-2 py-1 text-xs font-semibold ${
              format === f
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
            }`}
            onClick={() => changeFormat(f)}
          >
            {NOTE_FORMAT_LABELS[f]}
          </button>
        ))}
      </div>

      <textarea
        className="mx-3 mt-3 min-h-[8rem] flex-1 resize-none rounded border border-[var(--outline-variant)] bg-[var(--background)] p-3 text-sm outline-none focus:border-[var(--primary)]"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("title")}
      />

      {error && (
        <p className="px-3 pt-2 text-xs text-[var(--error)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <button
          type="button"
          className="btn-primary h-9 px-4 text-sm"
          disabled={saving || !body.trim()}
          onClick={() => void save()}
        >
          {saving ? t("saving") : t("save")}
        </button>
        <span className="text-xs text-[var(--on-surface-variant)]">
          {t("count", { count: notes.length })}
        </span>
      </div>

      {notes.length > 0 && (
        <ul className="max-h-32 space-y-2 overflow-y-auto border-t border-[var(--outline-variant)] px-3 py-2 text-xs text-[var(--on-surface-variant)]">
          {notes.map((n) => (
            <li key={n.id}>
              <time dateTime={n.createdAt}>
                {new Date(n.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              {" · "}
              {NOTE_FORMAT_LABELS[n.format as NoteFormat] ?? n.format}
              <pre className="mt-1 whitespace-pre-wrap font-sans text-[var(--on-surface)]">
                {n.body.slice(0, 160)}
                {n.body.length > 160 ? "…" : ""}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
