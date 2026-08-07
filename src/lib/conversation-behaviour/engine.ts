/**
 * Conversation Behaviour Engine — turn planner.
 *
 * Engines decide; the model speaks. Selection is seeded and deterministic.
 */

import { createRng } from "@/lib/case-engine/generator";
import { catalogEntry } from "./catalog";
import {
  disclosureGateFromRapport,
  estimateRapport,
} from "./rapport";
import {
  classifySensitiveTopic,
  classifyTherapistMove,
} from "./therapist-move";
import type {
  ConversationBehaviourInput,
  ConversationBehaviourKind,
  ConversationBehaviourPlan,
  DisclosureGate,
  TherapistMoveKind,
} from "./types";

/** Feature flag — default on. Set CBE_ENABLED=false to disable injection. */
export function isConversationBehaviourEnabled(): boolean {
  const raw = process.env.CBE_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}

function pickWeighted(
  rng: () => number,
  items: Array<{ kind: ConversationBehaviourKind; weight: number }>,
): ConversationBehaviourKind {
  const positive = items.filter((i) => i.weight > 0);
  if (positive.length === 0) return "guardedness";
  const total = positive.reduce((s, i) => s + i.weight, 0);
  let roll = rng() * total;
  for (const item of positive) {
    roll -= item.weight;
    if (roll <= 0) return item.kind;
  }
  return positive[positive.length - 1]!.kind;
}

function disorderHints(slug?: string | null): {
  prefersCrying: boolean;
  prefersAnger: boolean;
  prefersDenial: boolean;
  prefersAvoidance: boolean;
} {
  const s = (slug ?? "").toLowerCase();
  return {
    prefersCrying: /mdd|depress|ptsd|bpd|trauma/.test(s),
    prefersAnger: /mania|bipolar|bpd|borderline|delirium/.test(s),
    prefersDenial: /alcohol|substance|aud/.test(s),
    prefersAvoidance: /ptsd|trauma|panic|gad|anxiety/.test(s),
  };
}

/**
 * Build weighted candidates for this turn. Always includes protective
 * behaviours when the gate is closed — patient must not answer everything.
 */
export function candidateWeights(params: {
  gate: DisclosureGate;
  move: TherapistMoveKind;
  sensitive: ReturnType<typeof classifySensitiveTopic>;
  disorderSlug?: string | null;
  therapistInterrupted?: boolean;
}): Array<{ kind: ConversationBehaviourKind; weight: number }> {
  const hints = disorderHints(params.disorderSlug);
  const weights: Record<ConversationBehaviourKind, number> = {
    avoidance: 1,
    denial: 1,
    minimization: 2,
    guardedness: 2,
    lying: 0.5,
    embarrassment: 1,
    crying: 0.5,
    anger: 0.5,
    topic_switching: 1.5,
    silence: 1,
    therapist_interruption: 0,
    rapport_disclosure: 1,
  };

  if (params.therapistInterrupted || params.move === "interruption") {
    weights.therapist_interruption = 40;
    weights.anger += 6;
    weights.silence += 4;
    weights.guardedness += 4;
  }

  switch (params.gate) {
    case "withhold":
      weights.silence += 8;
      weights.avoidance += 7;
      weights.guardedness += 7;
      weights.topic_switching += 6;
      weights.denial += 4;
      weights.minimization += 2;
      weights.rapport_disclosure = 0.2;
      break;
    case "deflect":
      weights.minimization += 6;
      weights.topic_switching += 5;
      weights.avoidance += 5;
      weights.guardedness += 4;
      weights.embarrassment += 3;
      weights.denial += 3;
      weights.silence += 3;
      weights.rapport_disclosure = 0.5;
      break;
    case "partial":
      weights.minimization += 3;
      weights.embarrassment += 3;
      weights.guardedness += 2;
      weights.rapport_disclosure += 4;
      weights.silence += 1;
      break;
    case "open":
      weights.rapport_disclosure += 8;
      weights.minimization += 1;
      weights.guardedness += 1;
      weights.silence = 0.3;
      weights.avoidance = 0.5;
      weights.denial = 0.3;
      break;
  }

  if (params.move === "confrontation") {
    weights.anger += 10;
    weights.denial += 6;
    weights.guardedness += 4;
  }
  if (params.move === "advice") {
    weights.minimization += 4;
    weights.topic_switching += 3;
    weights.anger += 2;
  }
  if (params.move === "reflection" || params.move === "validation") {
    weights.rapport_disclosure += 3;
    weights.crying += hints.prefersCrying ? 3 : 1;
    weights.silence += 1;
  }

  switch (params.sensitive) {
    case "risk":
      weights.silence += 4;
      weights.minimization += 3;
      weights.guardedness += 4;
      weights.lying += 2;
      break;
    case "trauma":
      weights.avoidance += 6;
      weights.topic_switching += 4;
      weights.silence += 3;
      weights.embarrassment += 2;
      if (hints.prefersCrying) weights.crying += 3;
      break;
    case "substance":
      weights.denial += hints.prefersDenial ? 8 : 4;
      weights.minimization += 6;
      weights.lying += 5;
      break;
    case "shame":
      weights.embarrassment += 8;
      weights.avoidance += 3;
      weights.silence += 2;
      if (hints.prefersCrying) weights.crying += 2;
      break;
    case "relationship":
      weights.guardedness += 3;
      weights.minimization += 2;
      weights.embarrassment += 2;
      break;
    default:
      break;
  }

  if (hints.prefersAnger) weights.anger += 2;
  if (hints.prefersAvoidance) weights.avoidance += 2;

  return (Object.keys(weights) as ConversationBehaviourKind[]).map((kind) => ({
    kind,
    weight: weights[kind],
  }));
}

function gateDirectives(gate: DisclosureGate): string[] {
  switch (gate) {
    case "withhold":
      return [
        "DISCLOSURE GATE — withhold: do not answer the substance of the question. Stall, minimise to emptiness, or go quiet.",
      ];
    case "deflect":
      return [
        "DISCLOSURE GATE — deflect: answer around the question (logistics, joke, adjacent fact). No mid-layer or core material.",
      ];
    case "partial":
      return [
        "DISCLOSURE GATE — partial: one concrete piece only. Stop before a neat narrative or full confession.",
      ];
    case "open":
      return [
        "DISCLOSURE GATE — open enough for surface/mid if asked plainly; still no unprompted core dump. One layer per turn.",
      ];
  }
}

function selectSecondary(
  rng: () => number,
  primary: ConversationBehaviourKind,
  weights: Array<{ kind: ConversationBehaviourKind; weight: number }>,
): ConversationBehaviourKind[] {
  const rest = weights
    .filter((w) => w.kind !== primary && w.weight >= 2)
    .sort((a, b) => b.weight - a.weight);
  const secondary: ConversationBehaviourKind[] = [];
  // Always keep rapport_disclosure as a standing directive (not as competing primary).
  if (primary !== "rapport_disclosure") {
    secondary.push("rapport_disclosure");
  }
  if (rest.length > 0 && rng() > 0.35) {
    const next = rest.find((r) => r.kind !== "rapport_disclosure");
    if (next && !secondary.includes(next.kind)) secondary.push(next.kind);
  }
  return secondary.slice(0, 2);
}

function maybeDirectReply(params: {
  primary: ConversationBehaviourKind;
  gate: DisclosureGate;
  language?: string | null;
  rng: () => number;
}): string | undefined {
  if (params.primary !== "silence" && params.primary !== "therapist_interruption") {
    return undefined;
  }
  // Only short-circuit when gate is closed enough that silence is the point.
  if (params.gate === "open" || params.gate === "partial") {
    if (params.primary === "silence" && params.rng() > 0.45) return undefined;
    if (params.primary === "therapist_interruption") return undefined;
  }

  const entry = catalogEntry(params.primary);
  const isAr = (params.language ?? "en").toLowerCase().startsWith("ar");
  const pool =
    (isAr ? entry.silence_utterances_ar : entry.silence_utterances_en) ??
    entry.silence_utterances_en ??
    [];
  if (pool.length === 0) {
    if (params.primary === "therapist_interruption") {
      return isAr ? "…معلش، فقدت الخيط." : "…sorry, I lost where I was.";
    }
    return undefined;
  }
  return pool[Math.floor(params.rng() * pool.length)]!;
}

export function formatConversationBehaviourBlock(
  plan: Pick<
    ConversationBehaviourPlan,
    "primary" | "secondary" | "directives" | "disclosureGate" | "rapport"
  >,
): string {
  const kinds = [plan.primary, ...plan.secondary];
  return [
    "CONVERSATION BEHAVIOUR THIS TURN (enact — never name these labels):",
    `Rapport ~${plan.rapport}/100 · gate=${plan.disclosureGate} · primary=${plan.primary}`,
    ...plan.directives.map((d) => `- ${d}`),
    `Active set: ${kinds.join(", ")}. Patient must NOT immediately answer everything.`,
  ].join("\n");
}

/**
 * Plan advanced patient behaviour for one therapist turn.
 */
export function planConversationBehaviour(
  input: ConversationBehaviourInput,
): ConversationBehaviourPlan {
  const turnIndex = Math.max(0, input.turnIndex);
  const rng = createRng(`${input.sessionId}:cbe:${turnIndex}:${input.userMessage.length}`);

  const therapistMove = classifyTherapistMove(input.userMessage, {
    therapistInterrupted: input.therapistInterrupted,
  });
  const sensitiveTopic = classifySensitiveTopic(input.userMessage);
  const rapport = estimateRapport({
    history: input.history,
    turnIndex,
    difficulty: input.difficulty,
  });
  const disclosureGate = disclosureGateFromRapport({
    rapport,
    sensitiveTopic,
    therapistMove,
    difficulty: input.difficulty,
  });

  const weights = candidateWeights({
    gate: disclosureGate,
    move: therapistMove,
    sensitive: sensitiveTopic,
    disorderSlug: input.disorderSlug,
    therapistInterrupted: input.therapistInterrupted,
  });

  const primary = pickWeighted(rng, weights);
  const secondary = selectSecondary(rng, primary, weights);

  const directives: string[] = [
    ...gateDirectives(disclosureGate),
    ...catalogEntry(primary).directives,
  ];
  for (const kind of secondary) {
    // Standing rapport rule — one line; other secondaries get full directives.
    if (kind === "rapport_disclosure") {
      directives.push(catalogEntry(kind).directives[0]!);
    } else {
      directives.push(...catalogEntry(kind).directives.slice(0, 1));
    }
  }

  const planBase = {
    primary,
    secondary,
    directives,
    disclosureGate,
    rapport,
  };

  const promptBlock = formatConversationBehaviourBlock(planBase);
  const directReply = maybeDirectReply({
    primary,
    gate: disclosureGate,
    language: input.language,
    rng,
  });

  const kinds = [primary, ...secondary];

  return {
    version: "cbe-1",
    rapport,
    disclosureGate,
    therapistMove,
    sensitiveTopic,
    primary,
    secondary,
    directives,
    promptBlock,
    directReply,
    meta: {
      kinds,
      rapport,
      disclosureGate,
      therapistMove,
    },
  };
}

/**
 * Merge CBE prompt block into existing per-turn reinforcement.
 */
export function mergeBehaviourIntoReinforcement(
  existing: string | undefined,
  plan: ConversationBehaviourPlan | null | undefined,
): string {
  if (!plan?.promptBlock) return existing?.trim() ?? "";
  if (!existing?.trim()) return plan.promptBlock;
  return `${existing.trim()}\n\n${plan.promptBlock}`;
}
