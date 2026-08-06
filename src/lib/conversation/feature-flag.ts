/**
 * Feature flag for Hands-Free Therapy Engine.
 * Set ENABLE_HANDS_FREE_THERAPY=true (and/or NEXT_PUBLIC_… for client bundles).
 */

export function isHandsFreeTherapyEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const v =
    env.ENABLE_HANDS_FREE_THERAPY ??
    env.NEXT_PUBLIC_ENABLE_HANDS_FREE_THERAPY ??
    "";
  return v === "true" || v === "1" || v === "yes";
}
