/**
 * Native display names for supported locales.
 *
 * Language names are always shown in their own language — never translated —
 * so a therapist browsing in English still recognises "العربية".
 */
const NATIVE_NAMES: Record<string, string> = {
  ar: "العربية",
  en: "English",
};

/** "ar-JO" -> "العربية", "en-US" -> "English". Falls back to the tag itself. */
export function localeNativeName(locale: string): string {
  const tag = locale.trim();
  if (!tag) return "";
  const base = tag.split("-")[0]?.toLowerCase() ?? "";
  return NATIVE_NAMES[base] ?? tag;
}

/**
 * Native names for an avatar's authored locales, de-duplicated and stable.
 * Returns [] when the avatar has no locale inventory.
 */
export function localeNativeNames(
  locales: string[] | null | undefined,
): string[] {
  if (!locales?.length) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const locale of locales) {
    const name = localeNativeName(locale);
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}
