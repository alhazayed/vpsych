"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppLocale } from "@/i18n/config";
import { LOCALE_COOKIE } from "@/i18n/config";

function setLocaleCookie(locale: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}

export function LanguageSwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function switchLocale(next: AppLocale) {
    if (next === locale || pending) return;
    setLocaleCookie(next);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ preferred_language: next })
          .eq("id", user.id);
      }
    } catch {
      // Cookie still updates UI language for guests / offline.
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-0.5 ${
        compact ? "text-[10px]" : "text-xs"
      }`}
      role="group"
      aria-label={t("language")}
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => void switchLocale("en")}
        className={`rounded-md px-2.5 py-1.5 font-semibold transition ${
          locale === "en"
            ? "bg-[var(--primary)] text-white"
            : "text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
        } disabled:opacity-60`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => void switchLocale("ar")}
        className={`rounded-md px-2.5 py-1.5 font-semibold transition ${
          locale === "ar"
            ? "bg-[var(--primary)] text-white"
            : "text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
        } disabled:opacity-60`}
        aria-pressed={locale === "ar"}
      >
        ع
      </button>
    </div>
  );
}
