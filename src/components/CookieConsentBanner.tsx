"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_KEY,
  LEGAL_PATHS,
  LEGAL_VERSION,
  type CookiePreferences,
} from "@/lib/compliance/constants";

function readConsent(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookiePreferences;
  } catch {
    return null;
  }
}

function writeConsent(prefs: CookiePreferences) {
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
  document.cookie = `${COOKIE_CONSENT_KEY}=1;path=/;max-age=31536000;samesite=lax`;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!readConsent());
  }, []);

  function decide(preferences: boolean) {
    const prefs: CookiePreferences = {
      essential: true,
      preferences,
      version: LEGAL_VERSION,
      decidedAt: new Date().toISOString(),
    };
    writeConsent(prefs);
    setVisible(false);
    // Best-effort sync for signed-in users
    void fetch("/api/account/consent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookiePreferences: { preferences } }),
    }).catch(() => undefined);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs leading-relaxed text-[var(--on-surface-variant)] md:max-w-2xl">
          We use essential cookies for sign-in and language. Optional preference
          cookies stay off until you allow them. See our{" "}
          <Link href={LEGAL_PATHS.cookies} className="underline">
            Cookie Policy
          </Link>{" "}
          and{" "}
          <Link href={LEGAL_PATHS.privacy} className="underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide(false)}
            className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-xs font-semibold"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white"
          >
            Allow preferences
          </button>
        </div>
      </div>
    </div>
  );
}
