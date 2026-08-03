"use client";

import { useTranslations } from "next-intl";
import { openCookiePreferences } from "@/lib/consent/cookie-consent";

export function CookiePreferencesButton({
  className = "text-xs text-[var(--on-surface-variant)] hover:text-[var(--primary)]",
}: {
  className?: string;
}) {
  const t = useTranslations("cookie");
  return (
    <button type="button" className={className} onClick={() => openCookiePreferences()}>
      {t("manage")}
    </button>
  );
}
