"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "vpsych_cookie_consent_v1";

export type CookieConsentValue = {
  essential: true;
  analytics: boolean;
  decidedAt: string;
};

function readConsent(): CookieConsentValue | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentValue;
    if (parsed && parsed.essential === true && typeof parsed.analytics === "boolean") {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeConsent(analytics: boolean) {
  const value: CookieConsentValue = {
    essential: true,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("vpsych:cookie-consent", { detail: value }));
}

export function CookieConsent() {
  const t = useTranslations("cookie");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readConsent() === null);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md md:p-5"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h2
            id="cookie-consent-title"
            className="font-[family-name:var(--font-headline)] text-base font-semibold text-[var(--primary)]"
          >
            {t("title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
            {t("body")}{" "}
            <Link href="/privacy" className="text-[var(--primary)] underline">
              {t("privacyLink")}
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-sm"
            onClick={() => {
              writeConsent(false);
              setVisible(false);
            }}
          >
            {t("essentialOnly")}
          </button>
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm"
            onClick={() => {
              writeConsent(true);
              setVisible(false);
            }}
          >
            {t("acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}
