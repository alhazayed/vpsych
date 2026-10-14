"use client";

import { useLocale, useTranslations } from "next-intl";
import type { SessionMessage } from "@/lib/types";
import { usePanelFocus } from "@/components/therapy-room/usePanelFocus";

/** Optional live transcript — OFF by default. No speech bubbles in the room. */
export function LiveTranscript({
  open,
  messages,
  onClose,
}: {
  open: boolean;
  messages: SessionMessage[];
  onClose: () => void;
}) {
  const t = useTranslations("therapyRoom.transcript");
  const locale = useLocale();
  const headingRef = usePanelFocus<HTMLHeadingElement>(open);
  if (!open) return null;

  const visible = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <aside className="trm-transcript" aria-label={t("title")}>
      <header className="trm-transcript__header">
        <h2 ref={headingRef} tabIndex={-1}>
          {t("title")}
        </h2>
        <button type="button" onClick={onClose} aria-label={t("close")}>
          <span aria-hidden className="material-symbols-outlined">close</span>
        </button>
      </header>
      <ul className="trm-transcript__list">
        {visible.length === 0 && (
          <li className="trm-transcript__empty">{t("empty")}</li>
        )}
        {visible.map((m) => (
          <li key={m.id} className={`trm-transcript__item trm-transcript__item--${m.role}`}>
            <span className="trm-transcript__meta">
              <time className="trm-transcript__time" dateTime={m.created_at}>
                {time.format(new Date(m.created_at))}
              </time>
              <span className="trm-transcript__role">
                {m.role === "user" ? t("you") : t("patient")}
              </span>
            </span>
            <span className="trm-transcript__text" dir="auto">
              {m.content}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
