import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { ResolvedAvatar } from "@/lib/types";
import {
  examSpeechHint,
  openSkillTestCase,
  openSkillTestSpec,
  sealSkillTestCase,
  sealSkillTestSpec,
  traineeSafeAvatar,
  traineeVisibleSnapshot,
  withSkillTestCase,
} from "./exam";
import { canSealSkillTests, openSkillTestValue, sealSkillTestValue } from "./seal";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const SPEC = {
  disorder_slug: "ptsd",
  comorbidity_slugs: ["alcohol-use-disorder"],
  difficulty: "advanced" as const,
  severity: "moderate" as const,
};

const CASE = {
  version: 2,
  assessment_id: "VPSY-1",
  locale: "en-US",
  primary_diagnosis: { id: "d1", slug: "ptsd", name: "PTSD" },
  comorbidities: [],
  clinical_core: { disorder: "ptsd" },
  therapy_course: { course_id: A, session_number: 1 },
} as unknown as CaseInstanceSnapshot;

describe("skill test sealing", () => {
  beforeEach(() => {
    vi.stubEnv("REPORT_WRITE_KEY", "test-report-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips the spec and case for the same assignment", () => {
    const spec = sealSkillTestSpec(A, SPEC)!;
    expect(spec).not.toContain("ptsd");
    expect(openSkillTestSpec(A, spec)).toEqual(SPEC);

    const sealed = sealSkillTestCase(A, CASE)!;
    expect(sealed).not.toContain("ptsd");
    const opened = openSkillTestCase(A, sealed)!;
    expect(opened.primary_diagnosis.slug).toBe("ptsd");
    expect(opened.therapy_course).toBeUndefined();
  });

  it("refuses a blob moved to another assignment or used as the other kind", () => {
    const spec = sealSkillTestSpec(A, SPEC)!;
    const sealed = sealSkillTestCase(A, CASE)!;
    expect(openSkillTestSpec(B, spec)).toBeNull();
    expect(openSkillTestCase(B, sealed)).toBeNull();
    expect(openSkillTestCase(A, spec)).toBeNull();
    expect(openSkillTestSpec(A, sealed)).toBeNull();
  });

  it("refuses tampered, malformed or foreign-key blobs", () => {
    const sealed = sealSkillTestValue("case", A, { x: 1 })!;
    const parts = sealed.split(".");
    const body = Buffer.from(parts[3]!, "base64url");
    body[0] = body[0]! ^ 1;
    parts[3] = body.toString("base64url");
    expect(openSkillTestValue("case", A, parts.join("."))).toBeNull();
    expect(openSkillTestValue("case", A, "v1.r.x")).toBeNull();
    expect(openSkillTestValue("case", A, null)).toBeNull();

    vi.stubEnv("REPORT_WRITE_KEY", "another-key");
    expect(openSkillTestValue("case", A, sealed)).toBeNull();
  });

  it("falls back to the service role key and reports when neither is set", () => {
    vi.stubEnv("REPORT_WRITE_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const sealed = sealSkillTestValue("spec", A, SPEC)!;
    expect(sealed.split(".")[1]).toBe("s");
    expect(openSkillTestValue("spec", A, sealed)).toEqual(SPEC);

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(canSealSkillTests()).toBe(false);
    expect(sealSkillTestValue("spec", A, SPEC)).toBeNull();
  });
});

describe("what a trainee can see of a test", () => {
  beforeEach(() => vi.stubEnv("REPORT_WRITE_KEY", "test-report-key"));
  afterEach(() => vi.unstubAllEnvs());

  it("stores only the visit context and locale in the clear", () => {
    const visible = traineeVisibleSnapshot({
      locale: "ar-JO",
      therapyCourse: CASE.therapy_course!,
    });
    expect(Object.keys(visible).sort()).toEqual(["locale", "therapy_course"]);
  });

  it("opens the case on the server and keeps the visit context", () => {
    const row = {
      skill_test_assignment_id: A,
      sealed_case: sealSkillTestCase(A, CASE),
      clinical_snapshot: traineeVisibleSnapshot({
        locale: "en-US",
        therapyCourse: { ...CASE.therapy_course!, session_number: 2 },
      }),
    };
    const opened = withSkillTestCase(row);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.session.clinical_snapshot?.primary_diagnosis.slug).toBe("ptsd");
    expect(opened.session.clinical_snapshot?.therapy_course?.session_number).toBe(2);

    expect(withSkillTestCase({ ...row, sealed_case: null }).ok).toBe(false);
    const practice = { clinical_snapshot: CASE };
    expect(withSkillTestCase(practice)).toEqual({ ok: true, session: practice });
  });

  it("sends the browser a patient without prompts, labels or clinical core", () => {
    const avatar = {
      id: "p1",
      schema_version: 2,
      locale: "en-US",
      language: "en",
      direction: "ltr",
      name: "Maya",
      disorder: "ptsd",
      age: 30,
      gender: "female",
      portrait_url: null,
      persona_prompt: "You have PTSD",
      system_prompt: "Diagnosis: PTSD",
      ideal_guidelines: { ideal_approach: "trauma-focused" },
      rubric: [{ id: "r" }],
      dialect: null,
      voice_id: "v",
      stt_lang: "en",
      tts_lang: "en",
      fallback_replies: ["since the accident…"],
      personality: { persona_prompt: "PTSD" },
      clinical_core: { disorder: "ptsd" },
    } as unknown as ResolvedAvatar;
    const safe = traineeSafeAvatar(avatar);
    expect(JSON.stringify(safe)).not.toMatch(/ptsd|trauma|accident/i);
    expect(safe.name).toBe("Maya");
    expect(safe.voice_id).toBe("v");
  });

  it("gives the voice a pace and energy, not the disorder", () => {
    const hint = examSpeechHint(CASE);
    expect(Object.keys(hint).sort()).toEqual(["energy", "pace"]);
  });
});
