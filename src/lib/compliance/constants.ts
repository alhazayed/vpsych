/**
 * Compliance constants — legal versions, retention defaults, cookie keys.
 * Not legal advice; product controls for institutional deployment readiness.
 */

export const LEGAL_VERSION = "2026-08-03";

export const LEGAL_PATHS = {
  privacy: "/legal/privacy",
  terms: "/legal/terms",
  cookies: "/legal/cookies",
  aiDisclosure: "/legal/ai-disclosure",
  clinicalDisclaimer: "/legal/clinical-disclaimer",
  educationalDisclaimer: "/legal/educational-disclaimer",
} as const;

export const COOKIE_CONSENT_KEY = "vpsych_cookie_consent";

export type CookiePreferences = {
  essential: true;
  /** Non-essential preference cookies (e.g. remembered marketing flags). Locale is essential. */
  preferences: boolean;
  version: string;
  decidedAt: string;
};

export const DEFAULT_COOKIE_PREFERENCES: CookiePreferences = {
  essential: true,
  preferences: false,
  version: LEGAL_VERSION,
  decidedAt: "",
};

/** Default training-data retention (days) when profile unset. */
export const DEFAULT_RETENTION_DAYS = 365;

/** Subprocessors disclosed for AI / voice training simulation. */
export const SUBPROCESSORS = [
  {
    name: "Supabase",
    purpose: "Auth, database, storage (profiles, transcripts, scores)",
    region: "Configured project region",
  },
  {
    name: "Vercel",
    purpose: "Application hosting and edge delivery",
    region: "Global edge / configured region",
  },
  {
    name: "OpenAI",
    purpose: "Patient simulation chat, assessment, speech-to-text",
    region: "Provider-managed",
  },
  {
    name: "ElevenLabs",
    purpose: "Text-to-speech for simulated patient voice",
    region: "Provider-managed",
  },
  {
    name: "Upstash (optional)",
    purpose: "Distributed rate limiting",
    region: "Provider-managed",
  },
] as const;
