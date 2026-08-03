import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const createServiceClientMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: (...args: unknown[]) => createServiceClientMock(...args),
}));

describe("persistLearnerUpdate ACE scoring", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    createServiceClientMock.mockReset();
    vi.resetModules();
  });

  it("calls apply_ace_session_progress via service role", async () => {
    createServiceClientMock.mockReturnValue({ rpc: rpcMock });
    rpcMock.mockResolvedValue({ error: null });

    const { persistLearnerUpdate } = await import("@/lib/ace/persist");
    await persistLearnerUpdate({} as never, {
      id: "learner-1",
      user_id: "user-1",
      training_level: "beginner",
      profession: "therapist",
      institution: null,
      language: "en",
      preferred_therapy_models: [],
      adaptive_mode: true,
      curriculum_mode: "automatic",
      min_competency_threshold: 70,
      max_difficulty: "expert",
      locked_diagnoses: [],
      locked_objectives: [],
      required_competencies: [],
      optional_competencies: [],
      completed_case_count: 3,
      learning_velocity: 1.2,
      confidence_score: 55,
      certification_status: "in_progress",
      competencies: [
        {
          competency_id: "empathy",
          score: 60,
          samples: 2,
          trend: 1,
          last_assessed_at: "2026-08-03T00:00:00.000Z",
          mastered_at: null,
        },
      ],
      metadata: {},
    }, { sessionId: "sess-1" });

    expect(createServiceClientMock).toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith(
      "apply_ace_session_progress",
      expect.objectContaining({
        p_learner_id: "learner-1",
        p_session_id: "sess-1",
        p_completed_case_count: 3,
      }),
    );
  });

  it("soft-skips when service role is unset", async () => {
    createServiceClientMock.mockReturnValue(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { persistLearnerUpdate } = await import("@/lib/ace/persist");
    await persistLearnerUpdate({} as never, {
      id: "learner-1",
      user_id: "user-1",
      training_level: "beginner",
      profession: "therapist",
      institution: null,
      language: "en",
      preferred_therapy_models: [],
      adaptive_mode: true,
      curriculum_mode: "automatic",
      min_competency_threshold: 70,
      max_difficulty: "expert",
      locked_diagnoses: [],
      locked_objectives: [],
      required_competencies: [],
      optional_competencies: [],
      completed_case_count: 0,
      learning_velocity: 0,
      confidence_score: 50,
      certification_status: "not_started",
      competencies: [],
      metadata: {},
    });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("SUPABASE_SERVICE_ROLE_KEY"),
    );
    warn.mockRestore();
  });
});
