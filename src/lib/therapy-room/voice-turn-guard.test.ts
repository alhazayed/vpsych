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
    expect(text).toBeGreaterThan(-1);
    // Every speak call (streamed and classic) is preceded by a patient-text
    // update since the previous one.
    let from = 0;
    let speaks = 0;
    for (;;) {
      const speak = fn.indexOf("await speakPatient(", from);
      if (speak === -1) break;
      speaks += 1;
      expect(fn.slice(from, speak)).toMatch(/setLastPatientText\(/);
      from = speak + 1;
    }
    expect(speaks).toBeGreaterThan(0);
  });

  it("surfaces STT and message failures as a visible stage error", () => {
    const fn = body("processTherapistAudio");
    expect(fn).toMatch(/stage: "stt"/);
    expect(fn).toMatch(/stage: "message"/);
    expect(fn).toMatch(/describeVoiceError\(/);
  });

  it("keeps barge-in on by default and armed only after audio is playing", () => {
    // Off-by-default barge-in shipped as "barge-in doesn't work"; it can still
    // be switched off explicitly.
    expect(src).toMatch(
      /BARGE_IN_ENABLED = process\.env\.NEXT_PUBLIC_VOICE_BARGE_IN !== "false"/,
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

  it("hands the barge-in mic and onset audio to the next listen turn", () => {
    const speak = body("speakPatient");
    expect(speak).toMatch(/bargeInHandoffRef\.current = handoff \?\? null/);
    const listen = body("startListeningLoop");
    // Taken before any bail-out so an unused handoff is always released.
    expect(listen.indexOf("bargeInHandoffRef.current = null")).toBeLessThan(
      listen.indexOf("if (endingRef.current"),
    );
    expect(listen).toMatch(/stream: handoff\?\.stream/);
    expect(listen).toMatch(/preroll: handoff/);
    expect(listen).toMatch(/handoff\?\.release\(\)/);
  });

  it("offers a manual interrupt that works even with voice barge-in off", () => {
    const speak = body("speakPatient");
    const armIdx = speak.indexOf("if (!BARGE_IN_ENABLED");
    const manualIdx = speak.indexOf("interruptPatientRef.current = () => onBargeIn()");
    expect(manualIdx).toBeGreaterThan(-1);
    // The manual path is not behind the voice barge-in flag.
    expect(speak.slice(armIdx, armIdx + 80)).not.toMatch(/interruptPatientRef/);
    expect(body("handleControl")).toMatch(/case "interrupt":/);
  });

  it("reports patient audio unavailable instead of failing silently", () => {
    const fn = body("speakPatient");
    expect(fn).toMatch(/onUnavailable:/);
    expect(fn).toMatch(/markAudioUnavailable\(/);
  });
});
