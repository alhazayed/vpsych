import {
  CQI_VERSION,
  type CqiCaptureContext,
  type CqiTranscriptTurn,
} from "@/lib/cqi/types";
import type { ResolvedAvatar, SessionMessage, TherapySession } from "@/lib/types";

/** Prompt version — excellence stack may override via env when deployed. */
export function resolvePromptVersion(): string {
  return (
    process.env.NEXT_PUBLIC_PROMPT_VERSION?.trim() ||
    process.env.PROMPT_ENGINE_VERSION?.trim() ||
    "2.0.0"
  );
}

export function resolvePlatformVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.1.0";
}

export function resolveReleaseVersion(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.NEXT_PUBLIC_RELEASE_VERSION?.trim() ||
    "dev"
  );
}

export function resolveOptionalEngineVersions(): {
  pme_version: string | null;
  tre_version: string | null;
} {
  return {
    pme_version: process.env.NEXT_PUBLIC_PME_VERSION?.trim() || null,
    tre_version: process.env.NEXT_PUBLIC_TRE_VERSION?.trim() || null,
  };
}

/** Server-side context enrichment from session row + messages. */
export function buildServerCaptureContext(opts: {
  session: TherapySession;
  avatar: ResolvedAvatar;
  messages: SessionMessage[];
  windowSize?: number;
  browser?: CqiCaptureContext["browser"];
  patient_mind_state?: unknown;
  assessment_state?: unknown;
  llm_model?: string | null;
}): CqiCaptureContext {
  const windowSize = opts.windowSize ?? 12;
  const snap = opts.session.clinical_snapshot;
  const disorderSlug =
    snap?.primary_diagnosis?.slug ?? opts.avatar.disorder ?? null;
  const disorderName =
    snap?.primary_diagnosis?.name ?? opts.avatar.disorder ?? null;
  const turns: CqiTranscriptTurn[] = opts.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.created_at,
  }));
  const window = turns.slice(-windowSize);
  const engines = resolveOptionalEngineVersions();
  const voiceProfile = opts.avatar.voice_profile;
  return {
    session_id: opts.session.id,
    assessment_id: opts.session.id,
    patient_id: opts.session.avatar_id,
    avatar_id: opts.session.avatar_id,
    case_instance_id: opts.session.case_instance_id ?? null,
    disorder: disorderName,
    disorder_slug: disorderSlug,
    difficulty: opts.session.difficulty ?? null,
    language: opts.session.language ?? opts.avatar.language ?? null,
    voice: {
      voice_profile_id: voiceProfile?.id ?? null,
      voice_id: voiceProfile?.voice_id ?? null,
      locale: opts.avatar.language ?? null,
    },
    llm_model:
      opts.llm_model ??
      process.env.OPENAI_CHAT_MODEL?.trim() ??
      process.env.OPENAI_MODEL?.trim() ??
      "gpt-5",
    prompt_version: resolvePromptVersion(),
    pme_version: engines.pme_version,
    tre_version: engines.tre_version,
    timestamp: new Date().toISOString(),
    transcript_window: window,
    current_message: window[window.length - 1] ?? null,
    patient_mind_state: opts.patient_mind_state ?? null,
    assessment_state: opts.assessment_state ?? null,
    browser: opts.browser ?? {
      user_agent: "server",
    },
    platform_version: resolvePlatformVersion(),
    release_version: resolveReleaseVersion(),
    cqi_version: CQI_VERSION,
  };
}
