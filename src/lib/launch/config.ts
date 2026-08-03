/**
 * Public launch instrumentation config (env-driven).
 * Scripts load only when IDs are set AND cookie analytics consent is granted.
 */

export type LaunchAnalyticsConfig = {
  gaMeasurementId: string | null;
  clarityProjectId: string | null;
  metaPixelId: string | null;
  linkedInPartnerId: string | null;
  googleSiteVerification: string | null;
  bingSiteVerification: string | null;
};

function trimOrNull(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export function getLaunchAnalyticsConfig(
  env: Record<string, string | undefined> = process.env,
): LaunchAnalyticsConfig {
  return {
    gaMeasurementId: trimOrNull(env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    clarityProjectId: trimOrNull(env.NEXT_PUBLIC_CLARITY_PROJECT_ID),
    metaPixelId: trimOrNull(env.NEXT_PUBLIC_META_PIXEL_ID),
    linkedInPartnerId: trimOrNull(env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID),
    googleSiteVerification: trimOrNull(
      env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    ),
    bingSiteVerification: trimOrNull(env.NEXT_PUBLIC_BING_SITE_VERIFICATION),
  };
}

export function hasAnyOptionalAnalytics(config: LaunchAnalyticsConfig): boolean {
  return Boolean(
    config.gaMeasurementId ||
      config.clarityProjectId ||
      config.metaPixelId ||
      config.linkedInPartnerId,
  );
}
