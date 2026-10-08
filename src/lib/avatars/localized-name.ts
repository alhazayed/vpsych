/**
 * The name a patient goes by in the UI language. Each avatar personality is
 * a natively authored person with its own name (Ethan Cole is أحمد حدّاد in
 * `ar-JO`), while `avatars.name` is the canonical English name.
 */
import { normalizeAvatarLocale } from "@/lib/avatars/resolve";

/**
 * Select fragment for an `avatars(...)` embed or select: the personality's
 * `identity.display_name` for the UI locale, as `local_name`.
 */
export function avatarLocalNameSelect(uiLocale: string): string {
  const locale = normalizeAvatarLocale(uiLocale);
  // Only a plain `xx-YY` key may reach the select string.
  const key = /^[a-z]{2}-[A-Z]{2}$/.test(locale) ? locale : "en-US";
  return `local_name:personalities->${key}->identity->>display_name`;
}

/** `local_name` when the locale has one authored, else `avatars.name`. */
export function avatarDisplayName(
  avatar: { name?: string | null; local_name?: string | null } | null | undefined,
): string {
  return avatar?.local_name?.trim() || avatar?.name || "";
}
