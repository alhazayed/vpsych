import { describe, expect, it } from "vitest";
import {
  HCFI_VERSION,
  assertHcfiWeightMatrixValid,
  buildHcfiDashboard,
  buildHcfiOfflineCorpus,
  clearHcfiHistory,
  computeHumanConversationFidelityIndex,
  listHcfiHistory,
  recordHcfiHistory,
  HCFI_WEIGHT_MATRIX,
} from "@/lib/hcfi";
import {
  estimateTherapeuticAlliance,
  resolveClinicalVoiceSettings,
  speechProfileForDisorder,
} from "@/lib/conversation-fidelity";

describe("HCFI weights", () => {
  it("sums to 1.0 with ten Mission 20 dimensions", () => {
    expect(() => assertHcfiWeightMatrixValid()).not.toThrow();
    expect(HCFI_WEIGHT_MATRIX).toHaveLength(10);
    expect(HCFI_VERSION).toBe("1.0.0");
  });
});

describe("computeHumanConversationFidelityIndex", () => {
  it("penalizes AI tells and rewards natural depressed speech", () => {
    const good = computeHumanConversationFidelityIndex({
      disorder_slug: "mdd-recurrent-moderate",
      locale: "en-US",
      messages: [
        { role: "user", content: "How have you been feeling?" },
        {
          role: "assistant",
          content: "Um… tired. Heavy. I don't know. Work's just a lot.",
        },
        { role: "user", content: "That sounds hard. Tell me more." },
        {
          role: "assistant",
          content: "I guess I sleep too much and still feel empty.",
        },
      ],
      has_speech_profile: true,
      has_alliance_reactivity: true,
      has_cultural_cues: true,
      has_voice_settings: true,
      alliance_band: "high",
    });

    const bad = computeHumanConversationFidelityIndex({
      disorder_slug: "mdd-recurrent-moderate",
      locale: "en-US",
      messages: [
        { role: "user", content: "How have you been feeling?" },
        {
          role: "assistant",
          content:
            "As an AI, I understand you're asking about my mood. My diagnosis is MDD and I meet DSM criteria for anhedonia.",
        },
      ],
      has_speech_profile: false,
      has_alliance_reactivity: false,
      has_cultural_cues: false,
      has_voice_settings: false,
      persona_fallback: true,
      alliance_band: "low",
    });

    expect(good.overall).toBeGreaterThan(bad.overall);
    expect(good.overall).toBeGreaterThanOrEqual(70);
    expect(bad.subscores.find((s) => s.id === "natural_language")!.score).toBeLessThan(
      55,
    );
  });

  it("tracks history for dashboards", () => {
    clearHcfiHistory();
    const corpus = buildHcfiOfflineCorpus();
    for (const row of corpus) recordHcfiHistory(row);
    expect(listHcfiHistory().length).toBe(corpus.length);
    const dash = buildHcfiDashboard(listHcfiHistory());
    expect(dash.n).toBe(corpus.length);
    expect(dash.mean_overall).toBeGreaterThan(0);
    expect(dash.by_disorder.length).toBeGreaterThan(0);
  });
});

describe("Mission 20 conversation fidelity helpers", () => {
  it("maps disorders to clinically distinct speech profiles", () => {
    const mdd = speechProfileForDisorder("mdd-recurrent-moderate");
    const mania = speechProfileForDisorder("bipolar-mania");
    const psychosis = speechProfileForDisorder("schizophrenia");
    expect(mdd.pace).toBe("slow");
    expect(mania.pace).toBe("pressured");
    expect(psychosis.voice_hint).toBe("psychotic");
    expect(mania.behaviour_lines.join(" ")).toMatch(/Pressured|grandiosity/i);
  });

  it("estimates lower alliance for cold interrogative therapists", () => {
    const warm = estimateTherapeuticAlliance([
      { content: "That sounds really hard. Can you say more about the panic?" },
      { content: "Thank you for sharing that with me." },
    ]);
    const cold = estimateTherapeuticAlliance([
      { content: "Just answer yes or no. Why didn't you take your meds?" },
      { content: "According to DSM criteria you obviously have GAD. Calm down." },
    ]);
    expect(warm.score).toBeGreaterThan(cold.score);
    expect(cold.band).toBe("low");
  });

  it("resolves depressed voice settings as more stable / less styled", () => {
    const depressed = resolveClinicalVoiceSettings({
      speechProfile: speechProfileForDisorder("mdd-recurrent-moderate"),
    });
    const manic = resolveClinicalVoiceSettings({
      speechProfile: speechProfileForDisorder("bipolar-mania"),
    });
    expect(depressed.stability).toBeGreaterThan(manic.stability);
    expect(manic.style).toBeGreaterThan(depressed.style);
  });
});
