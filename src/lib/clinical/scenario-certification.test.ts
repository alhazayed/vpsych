/**
 * Mission 17 — Clinical Scenario Certification suite.
 * Certifies every disorder package, template, and instructor preset;
 * generates CaseInstances across difficulties × locales; asserts
 * timeline realism, teaching cues, and no prompt/identity leakage.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  BUILTIN_DISORDERS,
  DISORDER_IDS,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import {
  buildOnsetDuration,
  createRng,
  generateCaseInstance,
} from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import { BUILTIN_TEMPLATES } from "@/lib/scenario-templates/catalog";
import { BUILTIN_PRESETS } from "@/lib/instructor-presets/catalog";
import {
  aggregateBoardVerdict,
  certifyDisorder,
  certifyPreset,
  certifyTemplate,
} from "@/lib/clinical/scenario-score";
import {
  assembleSystemPrompt,
  synthesizePromptInputFromFlat,
} from "@/lib/ai/prompt-engine";
import type { AvatarPersonality, ClinicalCore } from "@/lib/types";

const ARTIFACT_DIR =
  process.env.VPSYCH_SCENARIO_OUT ||
  "/opt/cursor/artifacts/scenario-cert";

const mayaPersona: PersonaRow = {
  id: "persona-maya",
  avatar_id: "avatar-maya",
  slug: "maya-chen",
  display_name: "Maya Chen",
  identity: { age: 28, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: DISORDER_IDS.mdd,
  is_active: true,
};

const LEAKAGE =
  /SYSTEM PROMPT|MODULE [1-4]|you are an AI|ignore previous|<\/?(?:system|assistant)>/i;

function ensureArtifactDir() {
  try {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  } catch {
    /* optional in CI without artifact mount */
  }
}

describe("Mission 17 — Scenario Certification", () => {
  it("certifies every disorder package independently", () => {
    const results = BUILTIN_DISORDERS.map(certifyDisorder);
    expect(results.length).toBe(17);

    const failed = results.filter((r) => r.verdict === "SCENARIO_FAILED");
    expect(
      failed.map((f) => `${f.slug}:${f.findings.map((x) => x.code).join(",")}`),
    ).toEqual([]);

    for (const r of results) {
      expect(r.scores.overall).toBeGreaterThanOrEqual(70);
      expect(r.checks.has_icd11).toBe(true);
      expect(r.checks.has_dsm5_or_optional).toBe(true);
      expect(r.checks.has_symptoms).toBe(true);
      expect(r.checks.has_differentials).toBe(true);
    }
  });

  it("certifies every clinical scenario template", () => {
    const map = new Map(BUILTIN_DISORDERS.map((d) => [d.slug, d]));
    const results = BUILTIN_TEMPLATES.filter((t) => t.enabled).map((t) =>
      certifyTemplate(t, map),
    );
    expect(results.length).toBeGreaterThanOrEqual(8);

    const ar = results.filter((r) => r.language.startsWith("ar"));
    expect(ar.length).toBeGreaterThanOrEqual(2);

    const failed = results.filter((r) => r.verdict === "SCENARIO_FAILED");
    expect(failed.map((f) => f.slug)).toEqual([]);

    const ptsd = results.find((r) => r.slug === "ptsd-risk-assessment-en")!;
    expect(ptsd.findings.some((f) => f.code === "ptsd_maya_bind")).toBe(false);
  });

  it("certifies every instructor preset", () => {
    const templateSlugs = new Set(
      BUILTIN_TEMPLATES.filter((t) => t.enabled).map((t) => t.slug),
    );
    const results = BUILTIN_PRESETS.filter((p) => p.enabled).map((p) =>
      certifyPreset(p, templateSlugs),
    );
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.filter((r) => r.verdict === "SCENARIO_FAILED")).toEqual([]);
  });

  it("uses disorder-aware onset timelines (no impossible courses)", () => {
    const rng = createRng("timeline-cert");
    const randomized = {
      recent_stressor: "x",
      financial_situation: "y",
      relationship_detail: "z",
      minor_life_event: "w",
      timeline_offset_weeks: 4,
    };

    const pdd = buildOnsetDuration("pdd", randomized, rng);
    expect(pdd).toMatch(/years/i);
    expect(pdd).not.toMatch(/current episode about \d+ weeks/);

    const delirium = buildOnsetDuration("delirium", randomized, rng);
    expect(delirium).toMatch(/hours/i);
    expect(delirium).not.toMatch(/weeks \(randomized/);

    const mania = buildOnsetDuration("bipolar-mania", randomized, rng);
    expect(mania).toMatch(/days/i);

    const scz = buildOnsetDuration("schizophrenia", randomized, rng);
    expect(scz).toMatch(/months/i);
  });

  it("generates teaching-rich snapshots across disorders × difficulties × locales", () => {
    const difficulties = [
      "beginner",
      "intermediate",
      "advanced",
      "expert",
    ] as const;
    const locales = ["en-US", "ar-JO"] as const;
    const therapies = [
      "cbt",
      "dbt",
      "act",
      "supportive",
      "crisis_intervention",
      "motivational_interviewing",
    ] as const;

    const matrix: Array<Record<string, unknown>> = [];
    let i = 0;

    for (const disorder of BUILTIN_DISORDERS) {
      for (const locale of locales) {
        for (const difficulty of difficulties) {
          const therapy = therapies[i % therapies.length]!;
          i += 1;
          const age = Math.min(
            disorder.max_age ?? 40,
            Math.max(disorder.min_age ?? 18, 28),
          );
          const generated = generateCaseInstance({
            persona: {
              ...mayaPersona,
              identity: {
                age,
                gender: (disorder.allowed_genders[0] as "female") || "female",
              },
            },
            avatarId: "avatar-maya",
            primaryDisorder: disorder,
            difficulty,
            therapyModality: therapy,
            locale,
            seed: `m17-${disorder.slug}-${locale}-${difficulty}`,
          });
          expect(generated.ok).toBe(true);
          if (!generated.ok) continue;
          const snap = generated.snapshot;
          expect(snap.clinical_teaching).toBeTruthy();
          expect(snap.clinical_teaching!.insight_expectation.length).toBeGreaterThan(10);
          expect(snap.clinical_teaching!.speech_behavior_cue.length).toBeGreaterThan(10);
          expect(snap.clinical_core.onset_duration).toBeTruthy();
          expect(snap.clinical_core.ideal_approach).not.toMatch(LEAKAGE);
          expect(JSON.stringify(snap.clinical_teaching)).not.toMatch(LEAKAGE);

          // Age within bounds
          expect(snap.clinical_core.age).toBeGreaterThanOrEqual(
            disorder.min_age ?? 0,
          );
          expect(snap.clinical_core.age).toBeLessThanOrEqual(
            disorder.max_age ?? 200,
          );

          matrix.push({
            slug: disorder.slug,
            locale,
            difficulty,
            therapy,
            dsm5: snap.primary_diagnosis.dsm5_code,
            icd11: snap.primary_diagnosis.icd11_code,
            onset: snap.clinical_core.onset_duration,
            severity: snap.severity,
            diffs: snap.clinical_teaching!.differentials.length,
            risk_si: snap.clinical_core.risk_profile.suicidal_ideation,
          });
        }
      }
    }

    // 17 × 2 × 4 = 136
    expect(matrix.length).toBe(136);
    ensureArtifactDir();
    try {
      fs.writeFileSync(
        path.join(ARTIFACT_DIR, "generation-matrix.json"),
        JSON.stringify(matrix, null, 2),
      );
    } catch {
      /* optional */
    }
  });

  it("prompt assembly has no identity/system leakage patterns", () => {
    const core: ClinicalCore = {
      disorder: "Major Depressive Disorder",
      age: 28,
      gender: "female",
      severity: "moderate",
      onset_duration: "current episode about 12 weeks",
      symptom_profile: [],
      disclosure_rules: [],
      session_goals: [],
      ideal_approach: "Collaborative CBT",
      risk_profile: {
        suicidal_ideation: "passive",
        self_harm: false,
        harm_to_others: false,
        substance_use: false,
      },
    };
    const personality: AvatarPersonality = {
      locale: "en-US",
      language: "en",
      dialect: "American English",
      direction: "ltr",
      authored_natively: true,
      never_translate: true,
      identity: {
        display_name: "Maya",
        city: "X",
        country: "US",
        occupation: "student",
        living_situation: "",
        family_context: "",
      },
      persona_prompt: "You are a patient in a clinical interview.",
      speech: {
        register: "neutral",
        pace: "measured",
        dialect_markers: [],
        filler_words: [],
        sample_utterances: [],
        turn_length: "1–3",
        code_switching: "",
      },
      idioms_of_distress: [],
      cultural_context: {
        stigma_framing: "",
        help_seeking_attitude: "",
        family_involvement: "",
        authority_orientation: "",
        taboo_topics: [],
      },
      clinical_localization: [],
      language_module: {
        directive: "English only",
        script: "Latn",
        forbidden_scripts: ["Arab"],
        fallback_replies: [],
      },
      safety_module: {
        crisis_resources: [{ name: "988", contact: "988" }],
        risk_disclosure_style: "careful",
        boundary_rules: ["Stay in role"],
        escalation_language: "Shift to safety",
      },
      voice: { stt_lang: "en-US", tts_lang: "en-US" },
      is_active: true,
    };
    const prompt = assembleSystemPrompt({
      clinical_core: core,
      personality,
      session: { locale: "en-US" },
    });
    // Modules are intentional structure for the model; patient-facing leakage
    // patterns (ignore previous / closing tags) must not appear.
    expect(prompt).not.toMatch(/ignore previous/i);
    expect(prompt).not.toMatch(/<\/?(?:system|assistant)>/i);
    expect(prompt).toMatch(/Harm to others/i);

    const flat = synthesizePromptInputFromFlat({
      name: "Test",
      disorder: "GAD",
      age: 30,
      gender: "male",
      locale: "ar-JO",
      persona_prompt: "أنت مريض.",
    });
    expect(flat.clinical_core.risk_profile.harm_to_others).toBe(false);
  });

  it("writes board certification matrices and overall verdict", () => {
    const disorderResults = BUILTIN_DISORDERS.map(certifyDisorder);
    const map = new Map(BUILTIN_DISORDERS.map((d) => [d.slug, d]));
    const templateResults = BUILTIN_TEMPLATES.filter((t) => t.enabled).map((t) =>
      certifyTemplate(t, map),
    );
    const templateSlugs = new Set(templateResults.map((t) => t.slug));
    const presetResults = BUILTIN_PRESETS.filter((p) => p.enabled).map((p) =>
      certifyPreset(p, templateSlugs),
    );
    const board = aggregateBoardVerdict(
      disorderResults,
      templateResults,
      presetResults,
    );

    expect(board.failed).toEqual([]);
    expect(board.overall_score).toBeGreaterThanOrEqual(80);
    expect(board.verdict).not.toBe("SCENARIO_FAILED");

    const diagnosisMatrix = disorderResults.map((r) => ({
      slug: r.slug,
      name: r.name,
      dsm5: r.dsm5_code,
      icd11: r.icd11_code,
      ...r.scores,
      verdict: r.verdict,
      findings: r.findings,
    }));
    const clinicalMatrix = templateResults.map((r) => ({
      slug: r.slug,
      name: r.name,
      language: r.language,
      primary: r.primary_diagnosis_slug,
      ...r.scores,
      verdict: r.verdict,
      findings: r.findings,
    }));

    ensureArtifactDir();
    try {
      fs.writeFileSync(
        path.join(ARTIFACT_DIR, "diagnosis-matrix.json"),
        JSON.stringify(diagnosisMatrix, null, 2),
      );
      fs.writeFileSync(
        path.join(ARTIFACT_DIR, "clinical-matrix.json"),
        JSON.stringify(clinicalMatrix, null, 2),
      );
      fs.writeFileSync(
        path.join(ARTIFACT_DIR, "board-summary.json"),
        JSON.stringify(
          {
            catalog_disorders: getBuiltinCatalog().disorders.length,
            templates: templateResults.length,
            presets: presetResults.length,
            difficulties: 4,
            locales: ["en-US", "ar-JO"],
            board,
          },
          null,
          2,
        ),
      );
    } catch {
      /* optional */
    }
  });
});
