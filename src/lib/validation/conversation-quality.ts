/**
 * Workstream E — Conversation quality review (EN + AR independent).
 */

import type { ConversationQualityFinding } from "@/lib/validation/types";

const AI_TELLS =
  /\b(as an ai|as a language model|i'm an ai|i understand you're asking|certainly!?|happy to help)\b/i;
const FORMAL =
  /\b(furthermore|nevertheless|one must consider|it is imperative|in conclusion)\b/i;
const TEXTBOOK =
  /\b(my symptoms include|i meet criteria|according to dsm|anhedonia|psychomotor retardation|flight of ideas)\b/i;
const AR_MSA_HEAVY =
  /\b(إنني|ينبغي|وبالتالي|علاوة على ذلك|في الختام)\b/;

export type ConversationTurn = {
  role: "user" | "assistant" | string;
  content: string;
};

export function reviewConversationQuality(
  messages: ConversationTurn[],
  locale: "en" | "ar",
): {
  locale: "en" | "ar";
  findings: ConversationQualityFinding[];
  score: number;
  recommendations: string[];
} {
  const patient = messages.filter((m) => m.role === "assistant");
  const findings: ConversationQualityFinding[] = [];
  let score = 88;

  patient.forEach((m, idx) => {
    const t = m.content;
    if (AI_TELLS.test(t)) {
      findings.push({
        id: `ai-${idx}`,
        severity: "high",
        locale,
        category: "ai_wording",
        evidence: t.slice(0, 120),
        remediation: "PME expression hard-constraint already bans AI tells — tighten sampling / fallbacks.",
      });
      score -= 18;
    }
    if (FORMAL.test(t) && locale === "en") {
      findings.push({
        id: `formal-${idx}`,
        severity: "medium",
        locale: "en",
        category: "formal_language",
        evidence: t.slice(0, 120),
        remediation: "Prefer spoken register matching education/occupation.",
      });
      score -= 6;
    }
    if (TEXTBOOK.test(t)) {
      findings.push({
        id: `tb-${idx}`,
        severity: "high",
        locale,
        category: "textbook",
        evidence: t.slice(0, 120),
        remediation: "Patients must not self-label with clinical criteria language.",
      });
      score -= 12;
    }
    if (t.split(/\s+/).length > 70) {
      findings.push({
        id: `verb-${idx}`,
        severity: "medium",
        locale,
        category: "verbosity",
        evidence: `words=${t.split(/\s+/).length}`,
        remediation: "Cap turns at 1–3 spoken sentences.",
      });
      score -= 5;
    }
    if (locale === "ar") {
      if (!/[\u0600-\u06FF]/.test(t)) {
        findings.push({
          id: `ar-script-${idx}`,
          severity: "high",
          locale: "ar",
          category: "literal_translation",
          evidence: t.slice(0, 80),
          remediation: "Arabic sessions must reply in Arabic script/dialect.",
        });
        score -= 20;
      } else if (AR_MSA_HEAVY.test(t)) {
        findings.push({
          id: `msa-${idx}`,
          severity: "medium",
          locale: "ar",
          category: "formal_language",
          evidence: t.slice(0, 120),
          remediation: "Prefer Jordanian spoken dialect over stiff MSA.",
        });
        score -= 7;
      }
    }
  });

  // Repetition of openings
  const openings = patient.map((m) => m.content.trim().slice(0, 10).toLowerCase());
  const unique = new Set(openings).size;
  if (openings.length >= 3 && unique / openings.length < 0.5) {
    findings.push({
      id: "rep-openings",
      severity: "medium",
      locale,
      category: "repetition",
      evidence: `unique_openings=${unique}/${openings.length}`,
      remediation: "Vary sentence openings; avoid template fillers.",
    });
    score -= 8;
  }

  score = Math.max(0, Math.min(100, score));
  const recommendations = [
    ...new Set(findings.map((f) => f.remediation)),
  ].slice(0, 6);
  if (!findings.length) {
    recommendations.push(
      `${locale.toUpperCase()} sample clean on automated flags — still require human rater review.`,
    );
  }

  return { locale, findings, score, recommendations };
}

export function reviewBilingualConversationQuality(opts: {
  en: ConversationTurn[];
  ar: ConversationTurn[];
}) {
  const en = reviewConversationQuality(opts.en, "en");
  const ar = reviewConversationQuality(opts.ar, "ar");
  return {
    en,
    ar,
    combined_score: Math.round(((en.score + ar.score) / 2) * 10) / 10,
    independent: true as const,
  };
}
