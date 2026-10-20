/**
 * Index of the tab a key press should move to, or null for other keys.
 * Arrow keys follow reading direction, so in Arabic (RTL) ArrowLeft is "next".
 */
export function tabKeyTarget(
  key: string,
  index: number,
  count: number,
  rtl: boolean,
): number | null {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key !== "ArrowRight" && key !== "ArrowLeft") return null;
  const step = (key === "ArrowRight") !== rtl ? 1 : -1;
  return (index + step + count) % count;
}
