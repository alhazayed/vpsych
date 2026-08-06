/**
 * Feature flags for optional product surfaces.
 *
 * Server code may read FEATURE_* directly. Client components must receive a
 * boolean from a Server Component, or use NEXT_PUBLIC_FEATURE_* when a
 * client-only gate is required.
 */

export function isTherapyRoomEnabled(): boolean {
  const server = process.env.FEATURE_THERAPY_ROOM?.trim().toLowerCase();
  const pub = process.env.NEXT_PUBLIC_FEATURE_THERAPY_ROOM?.trim().toLowerCase();
  return server === "true" || pub === "true";
}
