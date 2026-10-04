/**
 * Speech release gate for realtime streamed patient turns.
 *
 * The classic route's rule is "never persist or hand to TTS until a valid
 * utterance exists". Progressive TTS speaks sentences before the full reply
 * exists, so this gate decides which streamed sentences may be spoken early
 * without weakening that rule for anything the canonical gate checks:
 *
 *   - A sentence is released early only when the reply SO FAR has lexical
 *     content (not a bare "…" / "um…" stall) and carries no canonical-fact
 *     exposure (no digit, no authored medication name). Such text cannot,
 *     on its own, fail `validatePatientReply`.
 *   - When the therapist's own turn names an authored medication, the
 *     anaphoric check ("yes, I take it") applies to every sentence, so the
 *     whole reply is held until validated.
 *   - Once any exposure appears the gate latches: that sentence and everything
 *     after it is held until the full reply is validated and persisted.
 *
 * Released sentences are always a strict prefix of the reply, in order.
 * The gate never edits text and never replaces `validatePatientReply`, which
 * still runs on every complete draft before persistence.
 */

import {
  hasCanonicalFactExposure,
  isContentlessPatientReply,
  mentionsAnyMedicationAgent,
  type CanonicalReplyFacts,
} from "@/lib/ai/reply-validation";

export type SpeechReleaseGate = {
  /** Offer a completed sentence; returns the sentences now safe to speak. */
  offer: (sentence: string) => string[];
  /** After validation + persistence: every sentence still held, in order. */
  drain: () => string[];
  /** True once the gate holds the remainder of this draft. */
  latched: () => boolean;
};

export function createSpeechReleaseGate(
  facts: CanonicalReplyFacts | null | undefined,
): SpeechReleaseGate {
  // Digits in the therapist turn do not matter (age / dose checks read digits
  // in the REPLY); a medication the therapist names makes every sentence
  // anaphorically checkable, so hold the whole reply.
  const holdAll = mentionsAnyMedicationAgent(
    facts?.therapistMessage ?? "",
    facts ?? null,
  );
  let latched = holdAll;
  let cumulative = "";
  let pending: string[] = [];

  return {
    offer(sentence) {
      const s = sentence.trim();
      if (!s) return [];
      cumulative = cumulative ? `${cumulative} ${s}` : s;
      pending.push(s);
      if (latched) return [];
      if (hasCanonicalFactExposure(cumulative, facts ?? null)) {
        latched = true;
        return [];
      }
      if (isContentlessPatientReply(cumulative)) return [];
      const out = pending;
      pending = [];
      return out;
    },
    drain() {
      const out = pending;
      pending = [];
      return out;
    },
    latched: () => latched,
  };
}
