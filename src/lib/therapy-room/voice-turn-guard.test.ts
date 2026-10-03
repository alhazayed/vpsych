/**
 * Source guardrails for the Therapy Room voice turn (TherapyRoomSession is a
 * client component and is not rendered in vitest). Each assertion pins a
 * regression that made a voice turn produce "nothing, nothing, nothing".
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  path.join(process.cwd(), "src/components/therapy-room/TherapyRoomSession.tsx"),
  "utf8",
);

function body(name: string): string {
  const start = src.indexOf(`const ${name} = useCallback(`);
  expect(start).toBeGreaterThan(-1);
  // Next component-level declaration (2-space indent) ends this callback.
  const next = src.indexOf("\n  const ", start + 10);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("TherapyRoomSession voice turn guardrails", () => {
  it("re-arms endingRef on mount so Strict Mode remounts can still listen", () => {
    const boot = src.slice(src.indexOf("// Boot: ambience"));
    expect(boot.indexOf("endingRef.current = false")).toBeGreaterThan(-1);
    expect(boot.indexOf("endingRef.current = false")).toBeLessThan(
      boot.indexOf('dispatch("START")'),
    );
  });

  it("shows the therapist transcript before calling the message API", () => {
    const fn = body("processTherapistAudio");
    const shown = fn.indexOf("setLastTherapistText(transcript)");
    const sent = fn.indexOf("submitConversationTurn(");
    expect(shown).toBeGreaterThan(-1);
    expect(shown).toBeLessThan(sent);
  });

  it("shows the patient text before TTS / playback starts", () => {
    const fn = body("processTherapistAudio");
    const text = fn.indexOf("setLastPatientText(turn.data.assistantMessage.content)");
    const speak = fn.indexOf("await speakPatient(");
    expect(text).toBeGreaterThan(-1);
    expect(text).toBeLessThan(speak);
  });

  it("surfaces STT and message failures as a visible stage error", () => {
    const fn = body("processTherapistAudio");
    expect(fn).toMatch(/stage: "stt"/);
    expect(fn).toMatch(/stage: "message"/);
    expect(fn).toMatch(/describeVoiceError\(/);
  });

  it("keeps barge-in opt-in and armed only after audio is playing", () => {
    expect(src).toMatch(
      /BARGE_IN_ENABLED = process\.env\.NEXT_PUBLIC_VOICE_BARGE_IN === "true"/,
    );
    const fn = body("speakPatient");
    // The monitor must not start before playback (it used to start during the
    // TTS fetch and could abort the patient's own clip).
    expect(fn.indexOf("startBargeInMonitor")).toBeGreaterThan(
      fn.indexOf("const armBargeIn"),
    );
    expect(fn).not.toMatch(/bargeInStopRef\.current = await startBargeInMonitor/);
    expect(fn).toMatch(/case "audio_playing":[\s\S]*armBargeIn\(\)/);
  });

  it("reports patient audio unavailable instead of failing silently", () => {
    const fn = body("speakPatient");
    expect(fn).toMatch(/onUnavailable:/);
    expect(fn).toMatch(/markAudioUnavailable\(/);
  });
});
