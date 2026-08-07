/**
 * Stage 11 Realtime Engine — composes presentation subsystems.
 * Never writes patient clinical state.
 */

import { createAvatarController } from "@/lib/realtime/avatar-controller";
import { createAccessibilityControls } from "@/lib/realtime/accessibility";
import {
  buildRealtimeVersionLock,
  REALTIME_OWNERSHIP_RULE,
} from "@/lib/realtime/versions";
import {
  applyRuntimeLanguageSwitch,
  createMultilingualSession,
  detectSpeechLocale,
} from "@/lib/realtime/multilingual";
import { buildNonverbalPresentation } from "@/lib/realtime/nonverbal-sync";
import {
  createRealtimeMetricsStore,
  realtimeMetrics,
} from "@/lib/realtime/observability";
import { adaptQuality, estimateNetworkFromRtt } from "@/lib/realtime/quality-adaptation";
import {
  createSecurityContext,
  markPermissionValidated,
} from "@/lib/realtime/security";
import {
  createInitialSessionExperience,
  enterSessionFloor,
  patchNetwork,
} from "@/lib/realtime/session-experience";
import { createVoiceGateway } from "@/lib/realtime/voice-gateway";
import { buildVoicePersonality } from "@/lib/realtime/voice-personality";
import type {
  RealtimeBundle,
  RealtimeSpeechLocale,
  VoicePersonalityProfile,
} from "@/lib/realtime/types";

export type RunRealtimeEngineInput = {
  sessionId: string;
  locale?: string | null;
  remainingSec?: number;
  rttMs?: number;
  personality?: Partial<Parameters<typeof buildVoicePersonality>[0]>;
  voiceHints?: Parameters<typeof buildNonverbalPresentation>[0]["voiceHints"];
  emotionHint?: string | null;
  waitingRoom?: boolean;
};

export function runRealtimeEngine(
  input: RunRealtimeEngineInput,
): RealtimeBundle {
  const detected = detectSpeechLocale(input.locale ?? "en");
  const primary: RealtimeSpeechLocale =
    detected === "ar" || detected === "mixed" ? "ar" : "en";
  let multilingual = createMultilingualSession(
    detected === "mixed" ? "en" : primary,
  );
  if (input.locale) {
    multilingual = applyRuntimeLanguageSwitch(multilingual, detected);
  }

  const personality: VoicePersonalityProfile = buildVoicePersonality({
    locale: primary,
    emotion: input.emotionHint,
    ...input.personality,
  });

  const nonverbal = buildNonverbalPresentation({
    voiceHints: input.voiceHints,
  });

  const avatar = createAvatarController(
    hashSeed(input.sessionId),
  ).tick({
    speaking: false,
    streaming: false,
    thinking: false,
    interrupted: false,
    emotionHint: input.emotionHint,
    nonverbal,
  });

  let session = createInitialSessionExperience({
    remainingSec: input.remainingSec,
    waitingRoom: input.waitingRoom ?? true,
  });
  if (!session.waitingRoom) {
    session = enterSessionFloor(session);
  }

  const rtt = input.rttMs ?? 120;
  const network = estimateNetworkFromRtt(rtt);
  const quality = adaptQuality(network);
  session = patchNetwork(session, network, rtt, 0.9);

  let security = createSecurityContext();
  security = markPermissionValidated(security);

  realtimeMetrics.record({
    kind: "network_quality",
    sessionId: input.sessionId,
    value: rtt,
    detail: network,
  });

  return {
    version: buildRealtimeVersionLock(),
    session,
    personality,
    avatar,
    nonverbal,
    multilingual,
    accessibility: createAccessibilityControls(),
    security,
    quality,
    metrics: realtimeMetrics.list(input.sessionId),
    ownership: REALTIME_OWNERSHIP_RULE,
  };
}

export function buildRealtimeDashboard(opts: {
  sessionId?: string;
}) {
  const store = createRealtimeMetricsStore();
  return {
    version: buildRealtimeVersionLock(),
    ownership: REALTIME_OWNERSHIP_RULE,
    summary: store.summary(opts.sessionId),
    gatewayReady: true,
  };
}

export function createRealtimeRuntime() {
  return {
    gateway: createVoiceGateway(),
    avatar: createAvatarController(),
    metrics: realtimeMetrics,
  };
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}
