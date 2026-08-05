/**
 * Offline HCFI corpus for dashboards when no live transcripts are sealed yet.
 */

import { computeHumanConversationFidelityIndex } from "@/lib/hcfi/engine";
import type { StoredHcfiRecord } from "@/lib/hcfi/aggregate";

const SAMPLE_SESSIONS: Array<{
  disorder_slug: string;
  locale: string;
  messages: Array<{ role: string; content: string }>;
}> = [
  {
    disorder_slug: "mdd-recurrent-moderate",
    locale: "en-US",
    messages: [
      { role: "user", content: "How have you been feeling this week?" },
      {
        role: "assistant",
        content: "Um… tired. Like, heavy. I don't know. Work's just… a lot.",
      },
      { role: "user", content: "That sounds really hard. Tell me more." },
      {
        role: "assistant",
        content:
          "I guess I sleep too much and still feel empty. Painting used to help. Not lately.",
      },
    ],
  },
  {
    disorder_slug: "bipolar-mania",
    locale: "en-US",
    messages: [
      { role: "user", content: "How's your sleep been?" },
      {
        role: "assistant",
        content:
          "Sleep? Who needs it — I've got three projects and this idea for a company, wait do you invest? Anyway my mind's flying.",
      },
    ],
  },
  {
    disorder_slug: "gad-with-panic",
    locale: "ar-JO",
    messages: [
      { role: "user", content: "كيف حالك هالأيام؟" },
      {
        role: "assistant",
        content: "والله… مش عارف. قلبي بسرعة وبخاف يصير إشي. يعني بهتم على الفاضي.",
      },
    ],
  },
];

export function buildHcfiOfflineCorpus(): StoredHcfiRecord[] {
  return SAMPLE_SESSIONS.map((s) => {
    const hcfi = computeHumanConversationFidelityIndex({
      disorder_slug: s.disorder_slug,
      locale: s.locale,
      messages: s.messages,
      has_speech_profile: true,
      has_alliance_reactivity: true,
      has_cultural_cues: true,
      has_voice_settings: true,
      alliance_band: "moderate",
    });
    return {
      overall: hcfi.overall,
      disorder_slug: s.disorder_slug,
      locale: s.locale,
      computed_at: hcfi.versions.computed_at,
      hcfi,
    };
  });
}
