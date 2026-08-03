import { describe, expect, it } from "vitest";
import {
  anonymizeExportForResearch,
  type SubjectExportPayload,
} from "./dsar";
import { LEGAL_PATHS, SUBPROCESSORS } from "./constants";

describe("compliance constants", () => {
  it("exposes all required legal routes", () => {
    expect(LEGAL_PATHS.privacy).toBe("/legal/privacy");
    expect(LEGAL_PATHS.terms).toBe("/legal/terms");
    expect(LEGAL_PATHS.cookies).toBe("/legal/cookies");
    expect(LEGAL_PATHS.aiDisclosure).toBe("/legal/ai-disclosure");
    expect(LEGAL_PATHS.clinicalDisclaimer).toBe("/legal/clinical-disclaimer");
    expect(LEGAL_PATHS.educationalDisclaimer).toBe(
      "/legal/educational-disclaimer",
    );
  });

  it("lists AI/voice subprocessors", () => {
    expect(SUBPROCESSORS.map((s) => s.name)).toEqual(
      expect.arrayContaining(["OpenAI", "ElevenLabs", "Supabase", "Vercel"]),
    );
  });
});

describe("anonymizeExportForResearch", () => {
  it("strips identifiers and transcripts", () => {
    const payload: SubjectExportPayload = {
      exportedAt: "2026-08-03T00:00:00.000Z",
      retentionDaysDefault: 365,
      subject: {
        userId: "11111111-1111-1111-1111-111111111111",
        email: "learner@example.edu",
        profile: {
          display_name: "Ada Learner",
          role: "therapist",
          organization: "State U",
          preferred_language: "en",
        },
      },
      sessions: [
        {
          id: "sess-1",
          status: "completed",
          language: "en",
          started_at: "2026-01-01",
          ended_at: "2026-01-01",
        },
      ],
      messagesBySession: {
        "sess-1": [
          { role: "user", content: "secret transcript" },
          { role: "assistant", content: "reply" },
        ],
      },
      learnerProfile: { id: "lp-1" },
      competencies: [{ competency_id: "alliance", score: 80, samples: 2 }],
      notice: "n",
    };

    const anon = anonymizeExportForResearch(payload);
    const subject = anon.subject as {
      email: null;
      profile: { display_name: null; organization: null };
      cohortKey: string;
    };
    expect(subject.email).toBeNull();
    expect(subject.profile.display_name).toBeNull();
    expect(subject.profile.organization).toBeNull();
    expect(subject.cohortKey).toMatch(/^cohort_/);
    expect(anon.messageCounts).toEqual({ session_1: 2 });
    expect(JSON.stringify(anon)).not.toContain("secret transcript");
    expect(JSON.stringify(anon)).not.toContain("learner@example.edu");
  });
});
