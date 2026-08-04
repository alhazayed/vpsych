/**
 * Calibration corpus — expert-scored session transcripts.
 *
 * A calibration case is a frozen transcript plus the scores two or more
 * qualified humans independently gave it. It is the only thing that can turn
 * "the platform produced a score" into "the score means something": the AI
 * examiner is run against the same transcript and compared to the humans.
 *
 * Corpus files live in `calibration/` at the repository root, alongside
 * `personas/`. They are clinical training artefacts, not application data, so
 * they are versioned in git rather than stored in Postgres.
 *
 * Validation is hand-written rather than Zod because corpus files are authored
 * by clinicians editing JSON directly: they need every problem in a file
 * reported at once, with the rubric id and rater named, not the first parse
 * failure.
 */

import type { MessageRole, RubricItem } from "@/lib/types";
import {
  expertConsensus,
  interRaterReliability,
  intraclassCorrelation,
  weightedOverallFromMap,
  type IccResult,
  type RaterScores,
} from "@/lib/ai/reliability";

export type CalibrationTurn = {
  role: MessageRole;
  content: string;
};

export type CalibrationExpertRating = {
  /** Stable pseudonymous rater id (initials or code) — never a patient name. */
  raterId: string;
  /** e.g. "consultant psychiatrist", "CACREP supervisor". */
  credential?: string;
  ratedAt?: string;
  /** rubric item id → score on that item's scale. Must cover every item. */
  items: Record<string, number>;
  notes?: string;
};

export type CalibrationCase = {
  caseId: string;
  /**
   * Format-demonstration fixture. Fixtures exercise the loader and the report
   * shape; they carry invented ratings and must never contribute to a reported
   * reliability baseline. `loadCalibrationCases` excludes them by default.
   */
  fixture?: boolean;
  language: "en" | "ar";
  durationSec: number;
  avatar: {
    name: string;
    disorder: string;
    ideal_guidelines: { session_goals?: string[]; ideal_approach?: string };
    rubric: RubricItem[];
  };
  transcript: CalibrationTurn[];
  expertRatings: CalibrationExpertRating[];
};

const MESSAGE_ROLES: MessageRole[] = ["user", "assistant", "system"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateRubric(raw: unknown, errors: string[]): RubricItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push("avatar.rubric must be a non-empty array");
    return [];
  }

  const rubric: RubricItem[] = [];
  const seen = new Set<string>();

  raw.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      errors.push(`avatar.rubric[${index}] must be an object`);
      return;
    }
    const { id, label, weight, max } = entry;
    if (typeof id !== "string" || !id.trim()) {
      errors.push(`avatar.rubric[${index}].id must be a non-empty string`);
      return;
    }
    if (seen.has(id)) {
      errors.push(`avatar.rubric duplicate id "${id}"`);
      return;
    }
    seen.add(id);
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
      errors.push(`avatar.rubric["${id}"].weight must be a positive number`);
      return;
    }
    if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) {
      errors.push(`avatar.rubric["${id}"].max must be a positive number`);
      return;
    }
    rubric.push({
      id,
      label: typeof label === "string" && label.trim() ? label : id,
      weight,
      max,
    });
  });

  return rubric;
}

function validateTranscript(raw: unknown, errors: string[]): CalibrationTurn[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push("transcript must be a non-empty array");
    return [];
  }

  const turns: CalibrationTurn[] = [];
  raw.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      errors.push(`transcript[${index}] must be an object`);
      return;
    }
    const { role, content } = entry;
    if (typeof role !== "string" || !MESSAGE_ROLES.includes(role as MessageRole)) {
      errors.push(
        `transcript[${index}].role must be one of ${MESSAGE_ROLES.join(" | ")}`,
      );
      return;
    }
    if (typeof content !== "string" || !content.trim()) {
      errors.push(`transcript[${index}].content must be a non-empty string`);
      return;
    }
    turns.push({ role: role as MessageRole, content });
  });

  if (turns.length && !turns.some((t) => t.role === "user")) {
    errors.push("transcript contains no therapist (user) turns");
  }

  return turns;
}

function validateRatings(
  raw: unknown,
  rubric: RubricItem[],
  errors: string[],
): CalibrationExpertRating[] {
  if (!Array.isArray(raw)) {
    errors.push("expertRatings must be an array");
    return [];
  }
  if (raw.length < 2) {
    errors.push(
      "expertRatings needs at least two independent raters — a single rater cannot establish inter-rater reliability",
    );
  }

  const ratings: CalibrationExpertRating[] = [];
  const seen = new Set<string>();

  raw.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      errors.push(`expertRatings[${index}] must be an object`);
      return;
    }
    const raterId = entry.raterId;
    if (typeof raterId !== "string" || !raterId.trim()) {
      errors.push(`expertRatings[${index}].raterId must be a non-empty string`);
      return;
    }
    if (seen.has(raterId)) {
      errors.push(`expertRatings duplicate raterId "${raterId}"`);
      return;
    }
    seen.add(raterId);

    if (!isPlainObject(entry.items)) {
      errors.push(`expertRatings["${raterId}"].items must be an object`);
      return;
    }

    const items: Record<string, number> = {};
    for (const r of rubric) {
      const value = (entry.items as Record<string, unknown>)[r.id];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(
          `expertRatings["${raterId}"].items is missing a numeric score for rubric item "${r.id}"`,
        );
        continue;
      }
      if (value < 0 || value > r.max) {
        errors.push(
          `expertRatings["${raterId}"].items["${r.id}"] = ${value} is outside the 0–${r.max} scale`,
        );
        continue;
      }
      items[r.id] = value;
    }

    ratings.push({
      raterId,
      credential:
        typeof entry.credential === "string" ? entry.credential : undefined,
      ratedAt: typeof entry.ratedAt === "string" ? entry.ratedAt : undefined,
      items,
      notes: typeof entry.notes === "string" ? entry.notes : undefined,
    });
  });

  return ratings;
}

export type CalibrationValidation =
  | { ok: true; value: CalibrationCase }
  | { ok: false; errors: string[] };

/** Validate one parsed corpus file, reporting every problem it contains. */
export function validateCalibrationCase(raw: unknown): CalibrationValidation {
  const errors: string[] = [];

  if (!isPlainObject(raw)) {
    return { ok: false, errors: ["calibration case must be a JSON object"] };
  }

  const caseId = raw.caseId;
  if (typeof caseId !== "string" || !caseId.trim()) {
    errors.push("caseId must be a non-empty string");
  }

  const language = raw.language;
  if (language !== "en" && language !== "ar") {
    errors.push('language must be "en" or "ar"');
  }

  const durationSec = raw.durationSec;
  if (
    typeof durationSec !== "number" ||
    !Number.isFinite(durationSec) ||
    durationSec <= 0
  ) {
    errors.push("durationSec must be a positive number");
  }

  let rubric: RubricItem[] = [];
  let avatar: CalibrationCase["avatar"] | null = null;

  if (!isPlainObject(raw.avatar)) {
    errors.push("avatar must be an object");
  } else {
    const a = raw.avatar;
    rubric = validateRubric(a.rubric, errors);
    if (typeof a.name !== "string" || !a.name.trim()) {
      errors.push("avatar.name must be a non-empty string");
    }
    if (typeof a.disorder !== "string" || !a.disorder.trim()) {
      errors.push("avatar.disorder must be a non-empty string");
    }
    const guidelines = isPlainObject(a.ideal_guidelines) ? a.ideal_guidelines : {};
    avatar = {
      name: typeof a.name === "string" ? a.name : "",
      disorder: typeof a.disorder === "string" ? a.disorder : "",
      ideal_guidelines: {
        session_goals: Array.isArray(guidelines.session_goals)
          ? guidelines.session_goals.filter(
              (g): g is string => typeof g === "string",
            )
          : undefined,
        ideal_approach:
          typeof guidelines.ideal_approach === "string"
            ? guidelines.ideal_approach
            : undefined,
      },
      rubric,
    };
  }

  const transcript = validateTranscript(raw.transcript, errors);
  const expertRatings = validateRatings(raw.expertRatings, rubric, errors);

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      caseId: caseId as string,
      fixture: raw.fixture === true,
      language: language as "en" | "ar",
      durationSec: durationSec as number,
      avatar: avatar!,
      transcript,
      expertRatings,
    },
  };
}

// ---------------------------------------------------------------------------
// Derived reference values
// ---------------------------------------------------------------------------

export type CalibrationReference = {
  caseId: string;
  /** Mean expert score per rubric item — what the model is compared against. */
  consensus: Record<string, number>;
  /** The consensus expressed on the platform's 0–100 scale. */
  consensusOverall: number;
  /** Agreement among the humans. Report this beside any AI-vs-expert number. */
  interRater: IccResult | null;
  raters: number;
};

export function calibrationReference(
  input: CalibrationCase,
): CalibrationReference {
  const ratings: RaterScores[] = input.expertRatings.map((r) => ({
    raterId: r.raterId,
    items: r.items,
  }));
  const consensus = expertConsensus(ratings, input.avatar.rubric);

  return {
    caseId: input.caseId,
    consensus,
    consensusOverall: weightedOverallFromMap(consensus, input.avatar.rubric),
    interRater: interRaterReliability(ratings, input.avatar.rubric),
    raters: ratings.length,
  };
}

/**
 * Corpus-level inter-rater reliability across every case, treating each
 * (case, rubric item) pair as a subject. A per-case ICC over five rubric lines
 * is too small to trust; this is the number worth quoting.
 *
 * Requires every case to share the same rater set, which is the design a
 * calibration study should have anyway.
 */
export function corpusInterRaterReliability(
  cases: CalibrationCase[],
): IccResult | null {
  if (cases.length === 0) return null;

  const raterIds = cases[0]!.expertRatings.map((r) => r.raterId);
  if (raterIds.length < 2) return null;

  // matrix[(case, rubric item)][rater]
  const matrix: number[][] = [];
  for (const c of cases) {
    const byId = new Map(c.expertRatings.map((r) => [r.raterId, r.items]));
    if (raterIds.some((id) => !byId.has(id))) return null;
    for (const item of c.avatar.rubric) {
      matrix.push(raterIds.map((id) => byId.get(id)![item.id] ?? 0));
    }
  }

  return intraclassCorrelation(matrix);
}
