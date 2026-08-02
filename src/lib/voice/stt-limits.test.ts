import { describe, expect, it } from "vitest";
import {
  isAllowedSttMime,
  MAX_STT_AUDIO_BYTES,
} from "@/lib/voice/stt";

describe("STT upload limits", () => {
  it("caps audio size at 10 MiB", () => {
    expect(MAX_STT_AUDIO_BYTES).toBe(10 * 1024 * 1024);
  });

  it("allows common browser audio MIME types", () => {
    expect(isAllowedSttMime("audio/webm")).toBe(true);
    expect(isAllowedSttMime("audio/wav")).toBe(true);
    expect(isAllowedSttMime("video/webm;codecs=opus")).toBe(true);
    expect(isAllowedSttMime("")).toBe(true);
  });

  it("rejects non-audio MIME types", () => {
    expect(isAllowedSttMime("application/pdf")).toBe(false);
    expect(isAllowedSttMime("image/png")).toBe(false);
    expect(isAllowedSttMime("text/plain")).toBe(false);
  });
});
