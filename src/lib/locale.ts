import { cookies } from "next/headers";
import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "@/i18n/config";

export async function getStoredLocale(): Promise<AppLocale> {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  return isAppLocale(raw) ? raw : defaultLocale;
}

export function localeCookieHeader(locale: AppLocale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
