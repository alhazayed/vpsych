import { describe, expect, it } from "vitest";
import {
  buildPppDashboard,
  computeReviewerAnalytics,
  likertMeanToIndex,
  meanLikert,
} from "@/lib/ppp";
import type { PppSessionRating } from "@/lib/ppp";

function rating(
  partial: Partial<PppSessionRating> &
    Pick<
      PppSessionRating,
      | "clinical_realism"
      | "educational_value"
      | "conversation_naturalness"
      | "therapeutic_alliance"
      | "patient_believability"
      | "learning_impact"
    >,
): PppSessionRating {
  return {
    id: "r1",
    session_id: "s1",
    reviewer_id: "u1",
    voice_realism: null,
    arabic_quality: null,
    english_quality: null,
    used_voice: false,
    session_language: "en",
    free_text: null,
    created_at: "2026-08-06T00:00:00Z",
    ...partial,
  };
}

describe("likertMeanToIndex", () => {
  it("maps 1→0, 3→50, 5→100", () => {
    expect(likertMeanToIndex(1)).toBe(0);
    expect(likertMeanToIndex(3)).toBe(50);
    expect(likertMeanToIndex(5)).toBe(100);
  });

  it("returns null for empty", () => {
    expect(likertMeanToIndex(null)).toBeNull();
    expect(meanLikert([])).toBeNull();
  });
});

describe("computeReviewerAnalytics", () => {
  it("computes all indices from ratings", () => {
    const indices = computeReviewerAnalytics([
      rating({
        clinical_realism: 4,
        educational_value: 5,
        conversation_naturalness: 4,
        therapeutic_alliance: 3,
        patient_believability: 4,
        learning_impact: 5,
        voice_realism: 3,
        english_quality: 4,
        arabic_quality: null,
      }),
      rating({
        clinical_realism: 5,
        educational_value: 4,
        conversation_naturalness: 5,
        therapeutic_alliance: 4,
        patient_believability: 5,
        learning_impact: 4,
        voice_realism: null,
        english_quality: 5,
        arabic_quality: 4,
      }),
    ]);

    expect(indices.sample_size).toBe(2);
    expect(indices.voice_sample_size).toBe(1);
    expect(indices.arabic_sample_size).toBe(1);
    expect(indices.english_sample_size).toBe(2);
    expect(indices.educational_value_index).toBe(87.5);
    expect(indices.clinical_authenticity_index).toBe(87.5);
    expect(indices.arabic_quality_score).toBe(75);
    expect(indices.voice_realism_score).toBe(50);
  });

  it("returns nulls when no ratings", () => {
    const empty = computeReviewerAnalytics([]);
    expect(empty.sample_size).toBe(0);
    expect(empty.clinical_authenticity_index).toBeNull();
    expect(empty.voice_realism_score).toBeNull();
  });
});

describe("buildPppDashboard", () => {
  it("aggregates reviewer workflow metrics", () => {
    const dash = buildPppDashboard({
      reviewers: [{ is_active: true }, { is_active: false }],
      sessions: [
        {
          id: "s1",
          status: "completed",
          started_at: "2026-08-06T10:00:00Z",
          ended_at: "2026-08-06T10:20:00Z",
          max_duration_sec: 2400,
          message_count: 24,
        },
        {
          id: "s2",
          status: "active",
          started_at: "2026-08-06T11:00:00Z",
          ended_at: null,
          max_duration_sec: 2400,
          message_count: 4,
        },
      ],
      ratings: [
        rating({
          clinical_realism: 4,
          educational_value: 5,
          conversation_naturalness: 4,
          therapeutic_alliance: 4,
          patient_believability: 4,
          learning_impact: 5,
        }),
      ],
      cqi: [
        { severity: "high", status: "open" },
        { severity: "wishlist", status: "resolved" },
      ],
      opportunities: [
        { opportunity_type: "curriculum_gap" },
        { opportunity_type: "curriculum_gap" },
        { opportunity_type: "strong_teaching_moment" },
      ],
      featureRequests: [
        { theme: "voice", title: "Lower TTS latency" },
        { theme: "voice", title: "More Arabic voices" },
        { theme: "assessment", title: "Trainee-visible reports" },
      ],
      blindScores: [
        { overall_realism: 4, would_use_in_training: true },
        { overall_realism: 3, would_use_in_training: false },
      ],
      now: new Date("2026-08-06T12:00:00Z"),
    });

    expect(dash.reviewers.total).toBe(2);
    expect(dash.reviewers.active).toBe(1);
    expect(dash.sessions.completed).toBe(1);
    expect(dash.sessions.completion_rate_pct).toBe(50);
    expect(dash.sessions.avg_conversation_length).toBe(14);
    expect(dash.ratings.avg_realism).toBe(4);
    expect(dash.issues.total).toBe(2);
    expect(dash.issues.open).toBe(1);
    expect(dash.educational_opportunities.total).toBe(3);
    expect(dash.feature_requests.common[0]?.theme).toBe("voice");
    expect(dash.blind_scores.would_use_pct).toBe(50);
    expect(dash.indices.sample_size).toBe(1);
    expect(dash.disclaimer).toMatch(/not validated/i);
  });
});
