/**
 * Phone bottom bar: at most five slots. When there are more destinations than
 * slots, the last slot becomes "More" and the rest move into the menu it
 * opens, so nothing the desktop sidebar offers is unreachable on a phone.
 * Pinned items (the admin console) always keep a slot in the bar.
 */
export const MOBILE_BAR_SLOTS = 5;

export function splitMobileNav<T extends { href: string }>(
  items: T[],
  pinnedHrefs: string[] = [],
  slots: number = MOBILE_BAR_SLOTS,
): { bar: T[]; overflow: T[] } {
  if (items.length <= slots) return { bar: items, overflow: [] };
  const room = slots - 1; // last slot is "More"
  const pinned = items.filter((i) => pinnedHrefs.includes(i.href)).slice(0, room);
  const rest = items.filter((i) => !pinned.includes(i));
  const leading = rest.slice(0, room - pinned.length);
  const bar = items.filter((i) => leading.includes(i) || pinned.includes(i));
  return { bar, overflow: items.filter((i) => !bar.includes(i)) };
}

/** Admin console bar on a phone; everything else sits behind "More". */
export const ADMIN_MOBILE_BAR_HREFS = [
  "/admin",
  "/admin/accounts",
  "/admin/sessions",
  "/admin/reports",
];
