/**
 * Extract durable memory candidates from real conversation text.
 * Heuristic only — never invents facts that are not grounded in the transcript
 * or authored persona seed.
 */

import type { ExtractedCandidate, MemoryCategory, MemorySource } from "./types";

type TopicRule = {
  category: MemoryCategory;
  topics: string[];
  patterns: RegExp[];
  salience: number;
  /** How to phrase the durable fact from the matched utterance. */
  format?: (utterance: string, match: RegExpMatchArray) => string;
};

const RULES: TopicRule[] = [
  {
    category: "medication",
    topics: ["medication", "meds"],
    salience: 0.92,
    patterns: [
      /\b(sertraline|zoloft|prozac|fluoxetine|lexapro|escitalopram|zoloft|xanax|alprazolam|ativan|lorazepam|prozac|wellbutrin|bupropion|lithium|abilify|risperidone|olanzapine|quetiapine|prozac|meds?|medication|pills?|prescription)\b/i,
      /\b(i('m| am) (on|taking|prescribed)|my (doctor|psychiatrist) (put|started) me on)\b/i,
    ],
    format: (u) => `Medication mentioned: ${clip(u, 160)}`,
  },
  {
    category: "children",
    topics: ["children", "kids", "family"],
    salience: 0.9,
    patterns: [
      /\b(my (son|daughter|kids?|children|child)|i have (a |two |three )?(son|daughter|kids?|children))\b/i,
    ],
    format: (u) => `Children / parenting: ${clip(u, 160)}`,
  },
  {
    category: "occupation",
    topics: ["work", "occupation", "job"],
    salience: 0.75,
    patterns: [
      /\b(i work( as)?|my job|at work|my (boss|coworker|colleagues?)|i('m| am) a [a-z]{3,})\b/i,
      /\b(graphic designer|teacher|nurse|engineer|student|unemployed|on leave)\b/i,
    ],
    format: (u) => `Occupation / work: ${clip(u, 160)}`,
  },
  {
    category: "relationship",
    topics: ["relationship", "family", "partner", "father", "mother"],
    salience: 0.8,
    patterns: [
      /\b(my (partner|husband|wife|boyfriend|girlfriend|ex|father|dad|mother|mom|brother|sister|parents?))\b/i,
      /\b(your (partner|husband|wife|boyfriend|girlfriend|ex|father|dad|mother|mom|brother|sister|parents?|family))\b/i,
      /\b(about (your|his|her) (father|dad|mother|mom|partner|family|kids?|children))\b/i,
    ],
    format: (u) => `Relationship: ${clip(u, 160)}`,
  },
  {
    category: "trauma",
    topics: ["trauma", "assault", "accident"],
    salience: 0.98,
    patterns: [
      /\b(trauma|assault|abused|abuse|accident|flashback|nightmare|the attack|that night|combat|war)\b/i,
    ],
    format: (u) => `Trauma-related disclosure: ${clip(u, 160)}`,
  },
  {
    category: "life_event",
    topics: ["life_event"],
    salience: 0.7,
    patterns: [
      /\b(moved|graduated|fired|laid off|wedding|funeral|diagnosed|hospital|surgery|got married|got divorced|broke up)\b/i,
    ],
    format: (u) => `Life event: ${clip(u, 160)}`,
  },
  {
    category: "future_plan",
    topics: ["future", "plans"],
    salience: 0.65,
    patterns: [
      /\b(i('m| am) (planning|hoping|going) to|next (week|month|year)|in the future|someday i|i want to (start|quit|move|go))\b/i,
    ],
    format: (u) => `Future plan: ${clip(u, 160)}`,
  },
  {
    category: "promise",
    topics: ["promise"],
    salience: 0.88,
    patterns: [
      /\b(you (promised|said you('d| would)|told me you('d| would))|i('ll| will) (try|come|call|do)|we (agreed|said we('d| would)))\b/i,
    ],
    format: (u) => `Promise / commitment: ${clip(u, 160)}`,
  },
  {
    category: "therapist_mistake",
    topics: ["mistake", "correction"],
    salience: 0.85,
    patterns: [
      /\b(that('s| is) not (what|true|right)|you (got that wrong|misheard|misunderstood|forgot)|i (never|didn't) say that|actually(,| it was)|no[,—-] (that|it) was)\b/i,
    ],
    format: (u) => `Patient corrected the therapist: ${clip(u, 160)}`,
  },
  {
    category: "previous_session",
    topics: ["previous_session"],
    salience: 0.8,
    patterns: [
      /\b(last (week|time|session)|you asked me (about|last)|when we (talked|spoke) (about|last)|remember when|like (i|we) (said|talked) (before|last))\b/i,
    ],
    format: (u) => `Prior-session reference: ${clip(u, 160)}`,
  },
];

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function topicsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const catalog = [
    "medication",
    "sleep",
    "work",
    "job",
    "family",
    "father",
    "dad",
    "mother",
    "mom",
    "partner",
    "children",
    "kids",
    "trauma",
    "anxiety",
    "mood",
    "suicide",
    "promise",
    "future",
    "plan",
  ];
  return catalog.filter((t) => lower.includes(t));
}

/**
 * Extract memory candidates from a single utterance grounded in its text.
 */
export function extractFromUtterance(
  utterance: string,
  opts?: {
    role?: "user" | "assistant" | string;
    turnIndex?: number | null;
    source?: MemorySource;
  },
): ExtractedCandidate[] {
  const text = utterance?.trim() ?? "";
  if (text.length < 12) return [];

  const role = opts?.role ?? "assistant";
  const turnIndex = opts?.turnIndex ?? null;
  const source = opts?.source ?? (role === "user" ? "therapist_turn" : "transcript");
  const out: ExtractedCandidate[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      // Therapist turns: only keep mistakes/promises/previous_session cues that
      // the patient would remember hearing — not the therapist's clinical notes.
      if (role === "user" && rule.category === "occupation") continue;
      if (role === "user" && rule.category === "medication") {
        // Therapist asking about meds → patient remembers being asked.
        const content = `Therapist asked about medications: ${clip(text, 140)}`;
        const key = content.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            category: "previous_session",
            content,
            salience: 0.7,
            topics: ["medication", "previous_session", ...topicsFromText(text)],
            source: "therapist_turn",
            turn_index: turnIndex,
          });
        }
        continue;
      }
      if (role === "user" && rule.category === "relationship") {
        const content = `Therapist asked about relationships / family: ${clip(text, 140)}`;
        const key = content.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            category: "previous_session",
            content,
            salience: 0.72,
            topics: [...rule.topics, "previous_session", ...topicsFromText(text)],
            source: "therapist_turn",
            turn_index: turnIndex,
          });
        }
        continue;
      }

      const content = (rule.format ?? ((u) => clip(u, 160)))(text, match);
      const key = `${rule.category}:${content.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        category: rule.category,
        content,
        salience: rule.salience,
        topics: [...rule.topics, ...topicsFromText(text)],
        source,
        turn_index: turnIndex,
      });
      break;
    }
  }

  return out;
}

/**
 * Walk a full transcript and extract grounded candidates (no invention).
 */
export function extractFromTranscript(
  messages: Array<{ role: string; content: string }>,
): ExtractedCandidate[] {
  const all: ExtractedCandidate[] = [];
  messages.forEach((m, i) => {
    const role = m.role === "user" || m.role === "assistant" ? m.role : "assistant";
    all.push(
      ...extractFromUtterance(m.content, {
        role,
        turnIndex: i,
        source: role === "user" ? "therapist_turn" : "transcript",
      }),
    );
  });
  return all;
}

/**
 * Seed durable identity facts from authored persona fields (not generated).
 */
export function seedFromPersonaIdentity(identity: {
  occupation?: string | null;
  family_context?: string | null;
  living_situation?: string | null;
  display_name?: string | null;
  city?: string | null;
}): ExtractedCandidate[] {
  const out: ExtractedCandidate[] = [];
  if (identity.occupation?.trim()) {
    out.push({
      category: "occupation",
      content: `Occupation: ${identity.occupation.trim()}`,
      salience: 0.85,
      topics: ["occupation", "work"],
      source: "persona_seed",
      turn_index: null,
    });
  }
  if (identity.family_context?.trim()) {
    const fam = identity.family_context.trim();
    const category: MemoryCategory = /\b(son|daughter|kids?|children)\b/i.test(fam)
      ? "children"
      : "relationship";
    out.push({
      category,
      content: `Family context: ${fam}`,
      salience: 0.8,
      topics: ["family", "relationship"],
      source: "persona_seed",
      turn_index: null,
    });
  }
  if (identity.living_situation?.trim()) {
    out.push({
      category: "relationship",
      content: `Living situation: ${identity.living_situation.trim()}`,
      salience: 0.7,
      topics: ["relationship", "living"],
      source: "persona_seed",
      turn_index: null,
    });
  }
  return out;
}
