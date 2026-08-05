/**
 * Offline demo corpus for Quality Ledger dashboard when DB is empty.
 */

import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import { DISORDER_IDS } from "@/lib/case-engine/catalog";
import { buildLedgerFromAssessment } from "@/lib/quality-ledger/from-assessment";
import {
  appendQualityLedgerMemory,
  clearQualityLedgerMemoryForTests,
  listQualityLedgers,
  qualityLedgerMemoryCount,
} from "@/lib/quality-ledger/store";
import type { QualityLedgerEntry } from "@/lib/quality-ledger/types";
import type { SessionAssessment } from "@/lib/ai/assessment";

const demoPersona: PersonaRow = {
  id: "persona-ql",
  avatar_id: "avatar-ql",
  slug: "ledger-demo",
  display_name: "Ledger Demo",
  identity: { age: 30, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: DISORDER_IDS.mdd,
  is_active: true,
};

function fakeAssessment(overall: number, heuristic = false): SessionAssessment {
  const items = [
    {
      id: "empathy",
      label: "Empathy",
      score: Math.min(5, overall / 20),
      max: 5,
      weight: 1,
      feedback: "Solid rapport built during the session.",
    },
    {
      id: "risk",
      label: "Risk",
      score: Math.min(5, overall / 20),
      max: 5,
      weight: 1,
      feedback: "Safety and risk factors were explored.",
    },
    {
      id: "formulation",
      label: "Formulation",
      score: Math.min(5, overall / 22),
      max: 5,
      weight: 1,
      feedback: "Formulation was adequate for training.",
    },
  ];
  return {
    language: "en",
    scores: {
      overall,
      items,
    },
    narrative:
      "Demo educational assessment narrative for Quality Ledger corpus.",
    excerpts: [
      "Therapist explored mood and sleep.",
      "Patient disclosed worry.",
    ],
    aiSource: heuristic ? "persona_fallback" : "gpt",
    model: heuristic ? undefined : "gpt-4.1-mini",
    failureDetail: heuristic ? "unconfigured" : undefined,
  };
}

/**
 * Seed a small offline corpus (idempotent within process).
 */
export function buildQualityLedgerOfflineCorpus(): QualityLedgerEntry[] {
  if (qualityLedgerMemoryCount() >= 4) {
    return listQualityLedgers({ limit: 500 });
  }
  // Do not clear if other tests appended — only seed when empty-ish
  if (qualityLedgerMemoryCount() === 0) {
    clearQualityLedgerMemoryForTests();
  }

  const disorders = BUILTIN_DISORDERS.slice(0, 3);
  const locales = ["en-US", "ar-JO"] as const;
  let i = 0;
  for (const disorder of disorders) {
    for (const locale of locales) {
      i += 1;
      const age = Math.min(
        disorder.max_age ?? 40,
        Math.max(disorder.min_age ?? 18, 28),
      );
      const gen = generateCaseInstance({
        persona: {
          ...demoPersona,
          identity: { ...demoPersona.identity, age },
          default_disorder_id: disorder.id,
        },
        avatarId: "avatar-ql",
        primaryDisorder: disorder,
        difficulty: "intermediate",
        therapyModality: "cbt",
        locale,
        seed: `ql-corpus-${disorder.slug}-${locale}`,
      });
      if (!gen.ok) continue;
      const overall = 72 + (i % 5) * 3;
      const entry = buildLedgerFromAssessment({
        sessionId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        learnerId: `00000000-0000-4000-8001-${String(i).padStart(12, "0")}`,
        assessment: fakeAssessment(overall, i === 2),
        clinicalSnapshot: gen.snapshot,
        durationSec: 900 + i * 30,
        messages: [
          { role: "user", content: "How have you been sleeping lately?" },
          { role: "assistant", content: "Not well. I wake at three." },
          { role: "user", content: "Tell me more about your mood." },
        ],
        language: locale.startsWith("ar") ? "ar" : "en",
        locale,
        templateId: gen.snapshot.template?.id ?? `tmpl-${disorder.slug}`,
        templateVersion: gen.snapshot.template?.version ?? 1,
        personaId: gen.snapshot.persona.id,
        institutionId: "demo-institution",
        competencyBefore: { mean: 60 },
        competencyAfter: { mean: 60 + (i % 4) * 2, mastery: 0.4 },
      });
      try {
        appendQualityLedgerMemory(entry);
      } catch {
        /* duplicate seed */
      }
    }
  }
  return listQualityLedgers({ limit: 500 });
}
