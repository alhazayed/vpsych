/**
 * Production environment presence checks (Stage 12).
 *
 * Does not print secret values. Safe for admin ops dashboards and boot probes.
 * Critical routes still fail closed on missing keys at use-time; this module
 * surfaces configuration completeness for operators.
 */

export type EnvRequirement = "required" | "recommended" | "optional";

export type EnvCheck = {
  key: string;
  present: boolean;
  requirement: EnvRequirement;
  purpose: string;
};

function present(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

/** Either REPORT_WRITE_KEY or SUPABASE_SERVICE_ROLE_KEY enables report writes. */
function reportWriteConfigured(): boolean {
  return present("REPORT_WRITE_KEY") || present("SUPABASE_SERVICE_ROLE_KEY");
}

function aiConfigured(): boolean {
  return present("OPENAI_API_KEY") || present("AI_GATEWAY_API_KEY");
}

/** Google Cloud TTS credential presence — never reads or returns the value. */
export function googleTtsConfigured(): boolean {
  return present("GOOGLE_TTS_API_KEY") || present("GOOGLE_TTS_ACCESS_TOKEN");
}

/**
 * Evaluate production-critical and recommended environment variables.
 * Never returns secret values — only presence flags.
 */
export function validateProductionEnv(): {
  ok: boolean;
  checks: EnvCheck[];
  missingRequired: string[];
  missingRecommended: string[];
} {
  const checks: EnvCheck[] = [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      present: present("NEXT_PUBLIC_SUPABASE_URL"),
      requirement: "required",
      purpose: "Supabase project URL",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      present: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      requirement: "required",
      purpose: "Supabase anon key (public)",
    },
    {
      key: "REPORT_WRITE_KEY|SUPABASE_SERVICE_ROLE_KEY",
      present: reportWriteConfigured(),
      requirement: "required",
      purpose: "Session report persistence",
    },
    {
      key: "OPENAI_API_KEY|AI_GATEWAY_API_KEY",
      present: aiConfigured(),
      requirement: "recommended",
      purpose: "Patient replies + assessment (falls back to persona)",
    },
    {
      key: "TTS_PROVIDER",
      present: present("TTS_PROVIDER"),
      requirement: "optional",
      purpose: "TTS provider selection (google|elevenlabs; defaults to elevenlabs)",
    },
    {
      key: "ELEVENLABS_API_KEY",
      present: present("ELEVENLABS_API_KEY"),
      requirement: "recommended",
      purpose: "Voice TTS (ElevenLabs provider)",
    },
    {
      key: "GOOGLE_TTS_API_KEY|GOOGLE_TTS_ACCESS_TOKEN",
      present: googleTtsConfigured(),
      requirement: "optional",
      purpose: "Voice TTS (Google Cloud provider)",
    },
    {
      key: "UPSTASH_REDIS_REST_URL",
      present: present("UPSTASH_REDIS_REST_URL"),
      requirement: "recommended",
      purpose: "Horizontal rate limiting",
    },
    {
      key: "UPSTASH_REDIS_REST_TOKEN",
      present: present("UPSTASH_REDIS_REST_TOKEN"),
      requirement: "recommended",
      purpose: "Horizontal rate limiting",
    },
    {
      key: "NEXT_PUBLIC_APP_URL",
      present: present("NEXT_PUBLIC_APP_URL"),
      requirement: "optional",
      purpose: "Canonical public URL",
    },
  ];

  const missingRequired = checks
    .filter((c) => c.requirement === "required" && !c.present)
    .map((c) => c.key);
  const missingRecommended = checks
    .filter((c) => c.requirement === "recommended" && !c.present)
    .map((c) => c.key);

  return {
    ok: missingRequired.length === 0,
    checks,
    missingRequired,
    missingRecommended,
  };
}
