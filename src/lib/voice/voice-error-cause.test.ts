import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";
import {
  VOICE_STAGES,
  voiceErrorCause,
  type VoiceErrorCause,
} from "@/lib/voice/voice-diagnostics";

describe("voiceErrorCause", () => {
  it("never shows server setup codes to the trainee as such", () => {
    expect(voiceErrorCause({ stage: "tts", code: "TTS_AUTH", status: 401 })).toBe("serviceSetup");
    expect(voiceErrorCause({ stage: "stt", code: "OPENAI_AUTH" })).toBe("serviceSetup");
  });

  it("maps codes that used to show as 'unknown error'", () => {
    expect(voiceErrorCause({ stage: "tts", code: "TTS_TIMEOUT", status: 504 })).toBe("serviceFailed");
    expect(voiceErrorCause({ stage: "stt", code: "STT_LIVE_FAILED" })).toBe("serviceFailed");
    expect(voiceErrorCause({ stage: "message", code: "stream_disconnected" })).toBe("network");
  });

  it("uses status for rate limits and sign-out, and mic names only on the mic stage", () => {
    expect(voiceErrorCause({ stage: "message", status: 429 })).toBe("rateLimited");
    expect(voiceErrorCause({ stage: "message", status: 401 })).toBe("signedOut");
    expect(voiceErrorCause({ stage: "mic", code: "NotAllowedError" })).toBe("micDenied");
    expect(voiceErrorCause({ stage: "message", code: "AbortError" })).toBe("generic");
  });

  it("has an EN and AR string for every cause and stage", () => {
    const causes: VoiceErrorCause[] = [
      "rateLimited", "signedOut", "dailyLimit", "serviceSetup", "serviceFailed",
      "noSpeech", "recordingRejected", "micDenied", "micMissing", "micFailed",
      "autoplayBlocked", "playbackFailed", "network", "generic",
    ];
    for (const m of [en, ar]) {
      const vt = m.therapyRoom.voiceTurn as unknown as {
        causes: Record<string, string>;
        stages: Record<string, string>;
      };
      for (const c of causes) expect(vt.causes[c], c).toBeTruthy();
      for (const st of VOICE_STAGES) expect(vt.stages[st], st).toBeTruthy();
    }
  });
});
