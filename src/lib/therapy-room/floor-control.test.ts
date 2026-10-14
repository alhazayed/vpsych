import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BARGE_IN_DEFAULTS,
  FLOOR_TAKE_MIN_SPEECH_MS,
  HELD_REPLY_MAX_AGE_MS,
  floorControlEnabled,
  floorReplyAction,
  heldReplyPlayable,
} from "@/lib/therapy-room";

describe("floor control decisions", () => {
  it("follows the barge-in flag and the trainee's interrupt-by-speaking switch", () => {
    expect(floorControlEnabled({ bargeInEnabled: true, bargeInByVoice: true })).toBe(true);
    expect(floorControlEnabled({ bargeInEnabled: true, bargeInByVoice: false })).toBe(false);
    expect(floorControlEnabled({ bargeInEnabled: false, bargeInByVoice: true })).toBe(false);
  });

  it("needs more sustained speech than barge-in (nothing is playing yet)", () => {
    expect(FLOOR_TAKE_MIN_SPEECH_MS).toBeGreaterThan(BARGE_IN_DEFAULTS.minSpeechMs);
  });

  it("marks the reply unheard once a real turn superseded the floor-take", () => {
    expect(
      floorReplyAction({
        pending: null,
        replyGeneration: 3,
        state: "WAITING_GPT",
        openCaptureSpeechMs: null,
      }),
    ).toBe("unheard");
    expect(
      floorReplyAction({
        pending: { generation: 5, captureEnded: true },
        replyGeneration: 3,
        state: "LISTENING",
        openCaptureSpeechMs: 0,
      }),
    ).toBe("unheard");
  });

  it("never speaks over the therapist while the floor-take is still open", () => {
    // Floor-take capture not finished yet (the mic may still be opening).
    expect(
      floorReplyAction({
        pending: { generation: 3, captureEnded: false },
        replyGeneration: 3,
        state: "LISTENING",
        openCaptureSpeechMs: null,
      }),
    ).toBe("hold");
    // Fresh capture already hearing speech.
    expect(
      floorReplyAction({
        pending: { generation: 3, captureEnded: true },
        replyGeneration: 3,
        state: "LISTENING",
        openCaptureSpeechMs: 120,
      }),
    ).toBe("hold");
    // Being transcribed.
    expect(
      floorReplyAction({
        pending: { generation: 3, captureEnded: true },
        replyGeneration: 3,
        state: "PROCESSING_STT",
        openCaptureSpeechMs: null,
      }),
    ).toBe("hold");
  });

  it("voices the reply when the floor-take came to nothing and the room is silent", () => {
    expect(
      floorReplyAction({
        pending: { generation: 3, captureEnded: true },
        replyGeneration: 3,
        state: "LISTENING",
        openCaptureSpeechMs: 0,
      }),
    ).toBe("play");
  });

  it("drops a held reply once the conversation has moved on", () => {
    expect(heldReplyPlayable({ heldAt: 1000, now: 1000 + HELD_REPLY_MAX_AGE_MS })).toBe(true);
    expect(heldReplyPlayable({ heldAt: 1000, now: 1001 + HELD_REPLY_MAX_AGE_MS })).toBe(false);
  });
});

describe("floor control wiring (Therapy Room)", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/therapy-room/TherapyRoomSession.tsx"),
    "utf8",
  );

  it("is gated on the interrupt-by-speaking switch", () => {
    expect(src).toMatch(
      /floorControlEnabled\(\{\s*bargeInEnabled: BARGE_IN_ENABLED,\s*bargeInByVoice: bargeInByVoiceRef\.current,/,
    );
  });

  it("closes the floor mic whenever the room leaves WAITING_GPT", () => {
    expect(src).toMatch(/if \(result\.to !== "WAITING_GPT"\) stopFloorMonitor\(\);/);
  });

  it("records an unvoiced reply as unheard (heard_chars 0)", () => {
    const fn = src.slice(src.indexOf("const markReplyUnheard"), src.indexOf("const playHeldReply"));
    expect(fn).toMatch(/heardChars: 0/);
  });

  it("starts the floor monitor on both the streamed and the classic reply path", () => {
    expect(src.match(/startFloorMonitor\(\s*generation,/g)?.length).toBe(2);
  });
});
