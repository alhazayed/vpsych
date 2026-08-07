/**
 * Memory Engine (Humanization) — working recall + prior-session continuity.
 */

import type {
  MemoryEngineOutput,
  TherapistMove,
} from "@/lib/humanization/types";
import type { SessionMessage } from "@/lib/types";

function extractPatientFacts(
  history: Pick<SessionMessage, "role" | "content">[],
): string[] {
  const facts: string[] = [];
  for (const msg of history) {
    if (msg.role !== "assistant") continue;
    const text = msg.content.trim();
    if (text.length < 12 || text.length > 220) continue;
    // Prefer concrete-looking lines (contain a noun-ish token / number).
    if (/\b(I|I'm|I've|my|we|عندي|أنا|كنت)\b/i.test(text)) {
      facts.push(text.slice(0, 160));
    }
  }
  return facts.slice(-8);
}

function topicsFromText(text: string): string[] {
  const topics: string[] = [];
  const lower = text.toLowerCase();
  const map: Record<string, string> = {
    sleep: "sleep",
    work: "work",
    job: "work",
    family: "family",
    mother: "family",
    father: "family",
    panic: "anxiety",
    anxious: "anxiety",
    suicide: "risk",
    die: "risk",
    drink: "substance",
    alcohol: "substance",
    medication: "treatment",
    therapy: "treatment",
    نوم: "sleep",
    شغل: "work",
    أهل: "family",
    قلق: "anxiety",
  };
  for (const [kw, topic] of Object.entries(map)) {
    if (lower.includes(kw) && !topics.includes(topic)) topics.push(topic);
  }
  return topics;
}

function priorSessionCues(
  caseMemory: Record<string, unknown> | null | undefined,
): string[] {
  if (!caseMemory) return [];
  const cues: string[] = [];

  const hce = caseMemory.hce as
    | {
        episodic?: Array<{ fact?: string }>;
        longitudinal?: Record<string, unknown>;
      }
    | undefined;
  if (hce?.episodic?.length) {
    for (const ep of hce.episodic.slice(-5)) {
      if (ep.fact?.trim()) cues.push(ep.fact.trim().slice(0, 140));
    }
  }

  const humanization = caseMemory.humanization as
    | { prior_session_notes?: string[] }
    | undefined;
  if (humanization?.prior_session_notes?.length) {
    cues.push(
      ...humanization.prior_session_notes
        .filter((n) => typeof n === "string" && n.trim())
        .map((n) => n.trim().slice(0, 140))
        .slice(-5),
    );
  }

  const longitudinal = caseMemory.longitudinal as
    | { notes?: string[]; last_alliance?: string }
    | undefined;
  if (longitudinal?.notes?.length) {
    cues.push(
      ...longitudinal.notes
        .filter((n) => typeof n === "string" && n.trim())
        .map((n) => n.trim().slice(0, 140))
        .slice(-5),
    );
  }

  return [...new Set(cues)].slice(0, 6);
}

export function memoryTick(params: {
  history: Pick<SessionMessage, "role" | "content">[];
  userMessage: string;
  therapistMove: TherapistMove;
  caseMemory?: Record<string, unknown> | null;
}): MemoryEngineOutput {
  const recalled_facts = extractPatientFacts(params.history);
  const prior_session_cues = priorSessionCues(params.caseMemory);
  const topics_touched = [
    ...new Set([
      ...topicsFromText(params.userMessage),
      ...recalled_facts.flatMap((f) => topicsFromText(f)),
    ]),
  ].slice(0, 8);

  const directives: string[] = [
    "Memory is human: approximate weeks/months; never invent hospitals, records, or real public figures.",
  ];

  if (recalled_facts.length > 0) {
    directives.push(
      `Stay consistent with recent statements: ${recalled_facts.slice(-2).join(" | ")}`,
    );
  }
  if (prior_session_cues.length > 0) {
    directives.push(
      "Prior session continuity available — reference imperfectly if asked or if alliance is warm.",
    );
  }
  if (params.therapistMove === "closed_question") {
    directives.push("Answer the fact asked; do not dump unrelated biography.");
  }

  return {
    recalled_facts,
    prior_session_cues,
    topics_touched,
    imperfect_recall_ok: true,
    directives,
  };
}
