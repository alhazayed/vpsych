"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "vpsych_onboarding_dismissed_v1";

export function FirstRunOnboarding() {
  const t = useTranslations("onboarding");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  return (
    <aside
      className="mb-8 rounded-[14px] border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary-container)_12%,transparent)] p-5"
      aria-labelledby="onboarding-title"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2
            id="onboarding-title"
            className="font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--primary)]"
          >
            {t("title")}
          </h2>
          <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm leading-6 text-[var(--on-surface-variant)]">
            <li>{t("steps.select")}</li>
            <li>{t("steps.practice")}</li>
            <li>{t("steps.review")}</li>
          </ol>
          <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
            {t("helpHint")}{" "}
            <Link href="/help" className="text-[var(--primary)] underline">
              {t("helpLink")}
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0 px-4 py-2 text-sm"
          onClick={() => {
            try {
              localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              /* ignore */
            }
            setOpen(false);
          }}
        >
          {t("dismiss")}
        </button>
      </div>
    </aside>
  );
}
