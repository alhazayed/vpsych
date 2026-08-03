"use client";

import { useTranslations } from "next-intl";

/** First focusable control — lets keyboard users bypass chrome (WCAG 2.4.1). */
export function SkipToContent({
  targetId = "main-content",
}: {
  targetId?: string;
}) {
  const t = useTranslations("a11y");
  return (
    <a href={`#${targetId}`} className="skip-link">
      {t("skipToContent")}
    </a>
  );
}
