export const COOKIE_CONSENT_STORAGE_KEY = "vpsych_cookie_consent_v1";
export const COOKIE_CONSENT_EVENT = "vpsych:cookie-consent";
export const COOKIE_CONSENT_OPEN_EVENT = "vpsych:cookie-consent-open";

export type CookieConsentValue = {
  essential: true;
  analytics: boolean;
  decidedAt: string;
};

export function readCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentValue;
    if (
      parsed &&
      parsed.essential === true &&
      typeof parsed.analytics === "boolean"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeCookieConsent(analytics: boolean): CookieConsentValue {
  const value: CookieConsentValue = {
    essential: true,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }),
  );
  return value;
}

export function openCookiePreferences() {
  window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT));
}
