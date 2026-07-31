export const locales = ["en", "ar"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";
export const LOCALE_COOKIE = "locale";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "en" || value === "ar";
}

export function localeDirection(locale: AppLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
