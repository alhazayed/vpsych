import { generateText, Output } from "ai";
import { z } from "zod";
import {
  buildExaminerSystemPrompt,
  heuristicCopy,
  localizeRubricLabel,
  normalizeReportLanguage,
} from "@/lib/ai/report-locale";
import { hasOpenAIApiKey, openAIService } from "@/lib/ai/openai";
import type {
  ResolvedAvatar,
  RubricItem,
  ScoreEntry,
  SessionMessage,
} from "@/lib/types";

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

function hasGatewayKey() {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}

function hasAiKey() {
  return hasGatewayKey() || hasOpenAIApiKey();
}

function gatewayModelId() {
  return process.env.AI_MODEL || "openai/gpt-4o-mini";
}

function preferOpenAiSdk(): boolean {
  if (process.env.OPENAI_CHAT_PROVIDER?.trim().toLowerCase() === "openai") {
    return hasOpenAIApiKey();
  }
  if (process.env.OPENAI_CHAT_PROVIDER?.trim().toLowerCase() === "gateway") {
    return false;
  }
  return hasOpenAIApiKey() && !hasGatewayKey();
}

function defaultRubric(language: "en" | "ar"): RubricItem[] {
  const ids = [
    { id: "alliance", weight: 25 },
    { id: "assessment", weight: 25 },
    { id: "interventions", weight: 20 },
    { id: "safety", weight: 20 },
    { id: "structure", weight: 10 },
  ] as const;
  return ids.map((r) => ({
    id: r.id,
    label: localizeRubricLabel(r.id, r.id, language),
    weight: r.weight,
    max: 5,
  }));
}

function heuristicAssessment(
  rubric: RubricItem[],
  messages: Pick<SessionMessage, "role" | "content">[],
  language: "en" | "ar",
) {
  const therapistTurns = messages.filter((m) => m.role === "user");
  const joined = therapistTurns.map((m) => m.content.toLowerCase()).join(" ");
  const turnCount = therapistTurns.length;
  const copy = heuristicCopy(language, turnCount);

  const empathyWords = [
    "hear",
    "sounds",
    "feel",
    "understand",
    "validate",
    "thank",
    "أفهم",
    "يبدو",
    "تشعر",
    "شكرا",
  ];
  const safetyWords = [
    "suicid",
    "harm",
    "safe",
    "kill",
    "hurt yourself",
    "plan",
    "انتحار",
    "أذى",
    "آمن",
    "خطة",
  ];
  const structureWords = [
    "today",
    "goal",
    "summarize",
    "agenda",
    "homework",
    "next",
    "اليوم",
    "هدف",
    "نلخّص",
    "ملخص",
    "واجب",
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
      label: localizeRubricLabel(r.id, r.label, language),
      score,
      max: r.max,
      weight: r.weight,
      feedback: copy.feedback,
    };
  });

  const overall = weightedOverall(items);
  return {
    language,
    scores: { overall, items },
    narrative: turnCount === 0 ? copy.narrativeEmpty : copy.narrativeWithTurns,
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

export type SessionAssessment = {
  language: "en" | "ar";
  scores: { overall: number; items: ScoreEntry[] };
  narrative: string;
  excerpts: string[];
};

/**
 * Assess a completed session and generate the report directly in `language`
 * (from session.language). No translation step — compose natively.
 */
export async function assessSession(params: {
  avatar: Pick<
    ResolvedAvatar,
    "name" | "disorder" | "ideal_guidelines" | "rubric"
  >;
  messages: Pick<SessionMessage, "role" | "content" | "created_at">[];
  durationSec: number;
  /** Session / therapist language (e.g. en, ar, en-US, ar-JO). */
  language?: string | null;
}): Promise<SessionAssessment> {
  const language = normalizeReportLanguage(params.language);
  const { avatar, messages, durationSec } = params;
  const rubric = (avatar.rubric?.length ? avatar.rubric : defaultRubric(language)).map(
    (r) => ({
      ...r,
      label: localizeRubricLabel(r.id, r.label, language),
    }),
  );

  if (!hasAiKey()) {
    return heuristicAssessment(rubric, messages, language);
  }

  const therapistLabel = language === "ar" ? "المعالج" : "THERAPIST";
  const patientLabel = language === "ar" ? "المريض" : "PATIENT";
  const systemLabel = language === "ar" ? "النظام" : "SYSTEM";

  const transcript = messages
    .map((m) => {
      const who =
        m.role === "user"
          ? therapistLabel
          : m.role === "assistant"
            ? patientLabel
            : systemLabel;
      return `${who}: ${m.content}`;
    })
    .join("\n");

  const goals = avatar.ideal_guidelines?.session_goals?.join("; ") ?? "";
  const approach = avatar.ideal_guidelines?.ideal_approach ?? "";
  const rubricLines = rubric.map((r) => `${r.id} — ${r.label}`).join("; ");
  const systemPrompt = buildExaminerSystemPrompt({
    language,
    patientName: avatar.name,
    disorder: avatar.disorder,
    approach,
    goals,
    durationSec,
    rubricLines,
  });
  const userPrompt =
    language === "ar"
      ? `نص المحادثة:\n${transcript || "(فارغ)"}\n\nأرجع JSON بالمفاتيح items و narrative و excerpts فقط.`
      : `Transcript:\n${transcript || "(empty)"}\n\nReturn JSON with keys items, narrative, and excerpts only.`;

  try {
    let output: z.infer<typeof assessmentSchema> | null = null;

    if (preferOpenAiSdk()) {
      const result = await openAIService.chat({
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\n\nRespond with a single JSON object only (no markdown).`,
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        maxCompletionTokens: 1200,
      });
      const parsed = JSON.parse(result.text) as unknown;
      const validated = assessmentSchema.safeParse(parsed);
      output = validated.success ? validated.data : null;
    } else {
      const generated = await generateText({
        model: gatewayModelId(),
        output: Output.object({ schema: assessmentSchema }),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
      });
      output = generated.output ?? null;
    }

    if (!output) {
      return heuristicAssessment(rubric, messages, language);
    }

    const items: ScoreEntry[] = rubric.map((r) => {
      const found = output.items.find((i) => i.id === r.id);
      return {
        id: r.id,
        label: r.label,
        score: Math.min(r.max, Math.max(0, found?.score ?? 0)),
        max: r.max,
        weight: r.weight,
        feedback:
          found?.feedback ??
          (language === "ar" ? "لا توجد ملاحظات." : "No feedback provided."),
      };
    });

    return {
      language,
      scores: { overall: weightedOverall(items), items },
      narrative: output.narrative,
      excerpts: output.excerpts.slice(0, 5),
    };
  } catch {
    return heuristicAssessment(rubric, messages, language);
  }
}
