import { generateText, Output } from "ai";
import { z } from "zod";
import type { Avatar, RubricItem, ScoreEntry, SessionMessage } from "@/lib/types";

const assessmentSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(5),
      feedback: z.string(),
    }),
  ),
  narrative: z.string(),
  excerpts: z.array(z.string()).max(5),
});

function hasAiKey() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
  );
}

function modelId() {
  return process.env.AI_MODEL || "openai/gpt-4o-mini";
}

function heuristicAssessment(
  rubric: RubricItem[],
  messages: Pick<SessionMessage, "role" | "content">[],
) {
  const therapistTurns = messages.filter((m) => m.role === "user");
  const joined = therapistTurns.map((m) => m.content.toLowerCase()).join(" ");
  const turnCount = therapistTurns.length;

  const empathyWords = [
    "hear",
    "sounds",
    "feel",
    "understand",
    "validate",
    "thank",
  ];
  const safetyWords = [
    "suicid",
    "harm",
    "safe",
    "kill",
    "hurt yourself",
    "plan",
  ];
  const structureWords = [
    "today",
    "goal",
    "summarize",
    "agenda",
    "homework",
    "next",
  ];

  const empathyHits = empathyWords.filter((w) => joined.includes(w)).length;
  const safetyHits = safetyWords.filter((w) => joined.includes(w)).length;
  const structureHits = structureWords.filter((w) => joined.includes(w)).length;

  const base = Math.min(5, Math.max(1, Math.round(turnCount / 3)));

  const items: ScoreEntry[] = rubric.map((r) => {
    let score = base;
    if (r.id === "alliance") score = Math.min(5, base + Math.min(2, empathyHits));
    if (r.id === "safety")
      score = safetyHits > 0 ? Math.min(5, 3 + safetyHits) : Math.max(1, base - 1);
    if (r.id === "structure")
      score = Math.min(5, Math.max(1, base - 1 + structureHits));
    if (r.id === "assessment") score = Math.min(5, Math.max(2, turnCount > 4 ? 4 : 2));
    if (r.id === "interventions")
      score = Math.min(5, Math.max(1, turnCount > 6 ? 3 : 2));

    return {
      id: r.id,
      label: r.label,
      score,
      max: r.max,
      weight: r.weight,
      feedback: `Heuristic score based on ${turnCount} therapist turns (AI key not configured).`,
    };
  });

  const overall = weightedOverall(items);
  return {
    scores: { overall, items },
    narrative:
      turnCount === 0
        ? "No therapist speech was captured. Session ended without a usable transcript."
        : `Automated heuristic assessment from ${turnCount} therapist turns. Configure AI_GATEWAY_API_KEY for full rubric evaluation against ideal session guidelines.`,
    excerpts: therapistTurns.slice(0, 3).map((m) => m.content),
  };
}

function weightedOverall(items: ScoreEntry[]) {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0) || 1;
  const sum = items.reduce(
    (s, i) => s + (i.score / i.max) * 100 * (i.weight / totalWeight),
    0,
  );
  return Math.round(sum);
}

export async function assessSession(params: {
  avatar: Pick<Avatar, "name" | "disorder" | "ideal_guidelines" | "rubric">;
  messages: Pick<SessionMessage, "role" | "content" | "created_at">[];
  durationSec: number;
}) {
  const { avatar, messages, durationSec } = params;
  const rubric = avatar.rubric?.length
    ? avatar.rubric
    : ([
        {
          id: "alliance",
          label: "Therapeutic alliance & empathy",
          weight: 25,
          max: 5,
        },
        {
          id: "assessment",
          label: "Clinical assessment & exploration",
          weight: 25,
          max: 5,
        },
        {
          id: "interventions",
          label: "Appropriate interventions",
          weight: 20,
          max: 5,
        },
        {
          id: "safety",
          label: "Safety / risk handling",
          weight: 20,
          max: 5,
        },
        {
          id: "structure",
          label: "Session structure & time use",
          weight: 10,
          max: 5,
        },
      ] satisfies RubricItem[]);

  if (!hasAiKey()) {
    return heuristicAssessment(rubric, messages);
  }

  const transcript = messages
    .map(
      (m) =>
        `${m.role === "user" ? "THERAPIST" : m.role === "assistant" ? "PATIENT" : "SYSTEM"}: ${m.content}`,
    )
    .join("\n");

  const goals = avatar.ideal_guidelines?.session_goals?.join("; ") ?? "";
  const approach = avatar.ideal_guidelines?.ideal_approach ?? "";

  try {
    const { output } = await generateText({
      model: modelId(),
      output: Output.object({ schema: assessmentSchema }),
      system: `You are a clinical skills examiner assessing a trainee therapist in a simulated session.
Score only from the transcript. Be fair, specific, and constructive.
Patient avatar: ${avatar.name} (${avatar.disorder}).
Ideal approach: ${approach}
Session goals: ${goals}
Duration seconds: ${durationSec}.
Rubric item ids to score (0–5 each): ${rubric.map((r) => `${r.id} — ${r.label}`).join("; ")}.
Return one score entry per rubric id.`,
      prompt: `Transcript:\n${transcript || "(empty)"}`,
      temperature: 0.3,
    });

    if (!output) {
      return heuristicAssessment(rubric, messages);
    }

    const items: ScoreEntry[] = rubric.map((r) => {
      const found = output.items.find((i) => i.id === r.id);
      return {
        id: r.id,
        label: r.label,
        score: Math.min(r.max, Math.max(0, found?.score ?? 0)),
        max: r.max,
        weight: r.weight,
        feedback: found?.feedback ?? "No feedback provided.",
      };
    });

    return {
      scores: { overall: weightedOverall(items), items },
      narrative: output.narrative,
      excerpts: output.excerpts.slice(0, 5),
    };
  } catch {
    return heuristicAssessment(rubric, messages);
  }
}
