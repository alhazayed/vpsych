import { generateText, Output } from "ai";
import {
  buildExaminerSystemPrompt,
  heuristicCopy,
  localizeRubricLabel,
  normalizeReportLanguage,
} from "@/lib/ai/report-locale";
import {
  assessmentStructuredSchema,
  parseAssessmentModelText,
  type AssessmentModelOutput,
} from "@/lib/ai/assessment-parse";
import { openAIService } from "@/lib/ai/openai";
import {
  isOpenAIServiceError,
  openaiErrorKind,
  type OpenAIErrorKind,
} from "@/lib/ai/openai/errors";
import {
  gatewayModelId,
  hasAnyAiKey,
  hasGatewayKey,
  openAiFallbackChatModel,
  preferOpenAiSdk,
  type AiSource,
} from "@/lib/ai/provider";
import type {
  ResolvedAvatar,
  RubricItem,
  ScoreEntry,
  SessionMessage,
} from "@/lib/types";

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
  reason: "unconfigured" | "unavailable",
  errorKind?: OpenAIErrorKind,
  failureDetail?: string,
) {
  const therapistTurns = messages.filter((m) => m.role === "user");
  const joined = therapistTurns.map((m) => m.content.toLowerCase()).join(" ");
  const turnCount = therapistTurns.length;
  const copy = heuristicCopy(language, turnCount, reason);

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
  console.warn("[assessment]", {
    event: "heuristic_fallback",
    aiSource: "persona_fallback",
    reason,
    errorKind: errorKind ?? null,
    failureDetail: failureDetail ?? null,
  });
  return {
    language,
    scores: { overall, items },
    narrative: turnCount === 0 ? copy.narrativeEmpty : copy.narrativeWithTurns,
    excerpts: therapistTurns.slice(0, 3).map((m) => m.content),
    aiSource: "persona_fallback" as const,
    errorKind,
    failureDetail,
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

function isRateLimitedOrQuota(err: unknown): boolean {
  const kind = openaiErrorKind(err);
  if (kind === "rate_limit" || kind === "insufficient_quota") return true;
  if (isOpenAIServiceError(err) && err.status === 429) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /rate limit|429|too many requests|insufficient.?quota/i.test(msg);
}

function errorDetails(err: unknown) {
  if (isOpenAIServiceError(err)) {
    return {
      kind: err.kind,
      code: err.code,
      status: err.status,
      providerCode: err.providerCode ?? null,
      message: err.message,
      retryable: err.retryable,
    };
  }
  return {
    kind: openaiErrorKind(err),
    message: err instanceof Error ? err.message : String(err),
  };
}

export type SessionAssessment = {
  language: "en" | "ar";
  scores: { overall: number; items: ScoreEntry[] };
  narrative: string;
  excerpts: string[];
  /** Same provenance contract as patient chat (never hide heuristic). */
  aiSource: AiSource;
  model?: string;
  errorKind?: OpenAIErrorKind;
  /** Short failure reason when aiSource is persona_fallback (ops / verification). */
  failureDetail?: string;
};

type ModelAttempt = {
  output: AssessmentModelOutput;
  model: string;
};

/**
 * Assess a completed session and generate the report directly in `language`
 * (from session.language). Uses the same OpenAI → mini → Gateway → heuristic
 * pipeline as patient conversation replies.
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

  if (!hasAnyAiKey()) {
    return heuristicAssessment(rubric, messages, language, "unconfigured");
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

  const viaOpenAi = async (model?: string): Promise<ModelAttempt> => {
    const result = await openAIService.chat({
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nRespond with a single JSON object only (no markdown). Keys: items, narrative, excerpts.`,
        },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      // Reasoning models spend completion budget on hidden tokens; keep headroom for JSON.
      maxCompletionTokens: 2500,
      model,
      json: true,
    });
    try {
      const output = parseAssessmentModelText(result.text);
      return { output, model: result.model };
    } catch (parseErr) {
      console.warn("[assessment]", {
        event: "openai_json_parse_failed",
        model: result.model,
        // Never log model output content — it is derived from session
        // transcript text and may echo clinical/PHI-adjacent detail. Length
        // alone is enough to diagnose truncation vs. malformed JSON.
        textLength: result.text.length,
        message:
          parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
      throw parseErr instanceof Error
        ? parseErr
        : new Error("assessment JSON parse failed");
    }
  };

  const viaGateway = async (): Promise<ModelAttempt> => {
    const model = gatewayModelId();
    const generated = await generateText({
      model,
      output: Output.object({ schema: assessmentStructuredSchema }),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
    });
    if (!generated.output) {
      throw new Error("gateway assessment returned empty structured output");
    }
    return { output: generated.output, model };
  };

  const toAssessment = (
    output: AssessmentModelOutput,
    aiSource: Exclude<AiSource, "persona_fallback">,
    model: string,
    errorKind?: OpenAIErrorKind,
  ): SessionAssessment => {
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

    console.info("[assessment]", {
      event: "assessment_ok",
      aiSource,
      model,
      errorKind: errorKind ?? null,
    });

    return {
      language,
      scores: { overall: weightedOverall(items), items },
      narrative: output.narrative,
      excerpts: output.excerpts.slice(0, 5),
      aiSource,
      model,
      errorKind,
    };
  };

  /**
   * Shared failover after primary GPT assessment fails.
   * Verified defect: parse/validation null used to skip mini/gateway and go
   * straight to heuristicAssessment — always try mini then gateway first.
   */
  const failoverAfterPrimary = async (
    primaryErr: unknown,
  ): Promise<SessionAssessment> => {
    const kind = openaiErrorKind(primaryErr);
    const fallbackModel = openAiFallbackChatModel();
    const details: string[] = [
      primaryErr instanceof Error
        ? `primary: ${primaryErr.message}`
        : `primary: ${String(primaryErr)}`,
    ];

    console.warn("[assessment]", {
      event: "openai_assessment_failed",
      ...errorDetails(primaryErr),
      rateLimited: isRateLimitedOrQuota(primaryErr),
      next: fallbackModel,
    });

    try {
      const result = await viaOpenAi(fallbackModel);
      return toAssessment(result.output, "gpt", result.model, kind);
    } catch (miniErr) {
      details.push(
        miniErr instanceof Error
          ? `${fallbackModel}: ${miniErr.message}`
          : `${fallbackModel}: ${String(miniErr)}`,
      );
      console.warn("[assessment]", {
        event: "openai_fallback_model_failed",
        model: fallbackModel,
        ...errorDetails(miniErr),
      });
    }

    if (hasGatewayKey()) {
      try {
        const result = await viaGateway();
        return toAssessment(result.output, "gateway", result.model, kind);
      } catch (gatewayErr) {
        details.push(
          gatewayErr instanceof Error
            ? `gateway: ${gatewayErr.message}`
            : `gateway: ${String(gatewayErr)}`,
        );
        console.warn("[assessment]", {
          event: "gateway_failed",
          ...errorDetails(gatewayErr),
          next: "persona_fallback",
        });
      }
    } else {
      details.push("gateway: not configured");
    }

    return heuristicAssessment(
      rubric,
      messages,
      language,
      "unavailable",
      kind,
      details.join(" | ").slice(0, 500),
    );
  };

  if (preferOpenAiSdk()) {
    try {
      const result = await viaOpenAi();
      return toAssessment(result.output, "gpt", result.model);
    } catch (err) {
      return failoverAfterPrimary(err);
    }
  }

  try {
    const result = await viaGateway();
    return toAssessment(result.output, "gateway", result.model);
  } catch (err) {
    const kind = openaiErrorKind(err);
    console.warn("[assessment]", {
      event: "gateway_failed",
      ...errorDetails(err),
      next: "persona_fallback",
    });
    return heuristicAssessment(
      rubric,
      messages,
      language,
      "unavailable",
      kind,
      err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
    );
  }
}
