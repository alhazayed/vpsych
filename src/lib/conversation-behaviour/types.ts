/**
 * Conversation Behaviour Engine (CBE) — Mission 7 contracts.
 *
 * The engine decides how the patient engages this turn; the LLM only speaks.
 * State is derived per turn (history + difficulty + seed) — no persistence required.
 */

import type { DifficultyModifiers } from "@/lib/case-engine/types";
import type { SessionMessage } from "@/lib/types";

/** Enactable advanced patient behaviours (Mission 7). */
export type ConversationBehaviourKind =
  | "avoidance"
  | "denial"
  | "minimization"
  | "guardedness"
  | "lying"
  | "embarrassment"
  | "crying"
  | "anger"
  | "topic_switching"
  | "silence"
  | "therapist_interruption"
  | "rapport_disclosure";

/** How much the patient may reveal this turn. */
export type DisclosureGate = "withhold" | "deflect" | "partial" | "open";

/** Coarse therapist move classification for behaviour selection. */
export type TherapistMoveKind =
  | "rapport"
  | "open_question"
  | "closed_question"
  | "reflection"
  | "validation"
  | "advice"
  | "confrontation"
  | "safety_check"
  | "sensitive_probe"
  | "interruption"
  | "neutral";

export type SensitiveTopic =
  | "risk"
  | "trauma"
  | "substance"
  | "shame"
  | "relationship"
  | "none";

export type BehaviourCatalogEntry = {
  kind: ConversationBehaviourKind;
  /** Short label for logs / observability. */
  label: string;
  /** Enactable directives injected into the turn brief (never announce the label). */
  directives: string[];
  /** Optional silence / minimal utterances when this behaviour owns the turn. */
  silence_utterances_en?: string[];
  silence_utterances_ar?: string[];
};

export type ConversationBehaviourInput = {
  /** Session id — used as RNG seed with turnIndex. */
  sessionId: string;
  /** 0-based count of prior assistant turns (or user turns). */
  turnIndex: number;
  userMessage: string;
  history: Pick<SessionMessage, "role" | "content">[];
  difficulty?: Pick<
    DifficultyModifiers,
    "insight" | "resistance" | "disclosure" | "alliance" | "masking"
  > | null;
  disorderSlug?: string | null;
  /**
   * True when the therapist cut off / barge-in interrupted the patient
   * on the previous patient turn (client-reported).
   */
  therapistInterrupted?: boolean;
  /** Session UI language (`en` | `ar`). */
  language?: string | null;
};

export type ConversationBehaviourPlan = {
  version: "cbe-1";
  rapport: number;
  disclosureGate: DisclosureGate;
  therapistMove: TherapistMoveKind;
  sensitiveTopic: SensitiveTopic;
  primary: ConversationBehaviourKind;
  secondary: ConversationBehaviourKind[];
  /** Enactable lines for the model — do not announce behaviour names. */
  directives: string[];
  /** Ready-to-append turn brief block. */
  promptBlock: string;
  /**
   * When set, the route may return this text without calling the LLM
   * (silence / interruption stall). Still a patient utterance.
   */
  directReply?: string;
  /** Observability for API / logs — never clinical truth. */
  meta: {
    kinds: ConversationBehaviourKind[];
    rapport: number;
    disclosureGate: DisclosureGate;
    therapistMove: TherapistMoveKind;
  };
};
