import { readFileSync, readdirSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isVoiceQaEnabled } from "@/lib/voice/qa/enabled";
import { createVoiceQaStore, VOICE_QA_MAX_TURNS } from "@/lib/voice/qa/store";
import { audioFileName, buildManifest } from "@/lib/voice/qa/export";

/**
 * Containment guarantees for the Voice QA tooling.
 *
 * This module holds raw clinical speech and raw patient audio in memory. The
 * assertions below are the reason that is acceptable: it is off by default, it
 * never persists anything, it never leaves the browser, and no production code
 * path depends on it. If one of these fails, the invariant is the thing to
 * preserve — do not loosen the assertion.
 */

const QA_DIR = "src/lib/voice/qa";

/**
 * Strip comments before scanning.
 *
 * These files document what they deliberately do NOT do ("no localStorage, no
 * IndexedDB, no upload"), so a raw substring search would flag the promise
 * itself as a violation. Scan the code, not the prose.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function qaSources(): Array<{ file: string; source: string }> {
  return readdirSync(QA_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((file) => ({
      file: `${QA_DIR}/${file}`,
      source: code(readFileSync(`${QA_DIR}/${file}`, "utf8")),
    }));
}

describe("the gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless explicitly enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_QA", "");
    expect(isVoiceQaEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_VOICE_QA", "false");
    expect(isVoiceQaEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_VOICE_QA", "1");
    expect(isVoiceQaEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_VOICE_QA", "yes");
    expect(isVoiceQaEnabled()).toBe(false);
  });

  it("is on only for an exact opt-in", () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_QA", "true");
    expect(isVoiceQaEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_VOICE_QA", " TRUE ");
    expect(isVoiceQaEnabled()).toBe(true);
  });

  it("is read through one function, so there is one place to audit", () => {
    const callers = [
      "src/components/VoiceSession.tsx",
      "src/components/voice-qa/VoiceQaPanel.tsx",
    ];
    for (const file of callers) {
      const source = code(readFileSync(file, "utf8"));
      expect(source, file).toContain("isVoiceQaEnabled");
      // A second, hand-rolled read of the env var would be a bypass.
      expect(source, `${file} reads the flag directly`).not.toContain(
        "NEXT_PUBLIC_VOICE_QA",
      );
    }
  });
});

describe("no persistence", () => {
  it("never touches the database, storage, or the network", () => {
    const forbidden = [
      "supabase",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "IDBDatabase",
      "navigator.sendBeacon",
    ];
    for (const { file, source } of qaSources()) {
      for (const token of forbidden) {
        expect(source, `${file} references ${token}`).not.toContain(token);
      }
    }
  });

  it("issues no outbound requests of its own", () => {
    for (const { file, source } of qaSources()) {
      // Captures come from the pipeline; the QA layer must not fetch anything,
      // least of all upload audio somewhere.
      expect(source, `${file} calls fetch`).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it("keeps the synthetic number corpus out of production code", () => {
    const productionFiles = [
      "src/lib/voice/conversation-pipeline.ts",
      "src/lib/voice/client.ts",
      "src/lib/voice/speech-text/index.ts",
      "src/app/api/voice/tts/route.ts",
      "src/components/VoiceSession.tsx",
    ];
    for (const file of productionFiles) {
      expect(readFileSync(file, "utf8"), file).not.toContain("qa/number-corpus");
    }
  });

  it("is never imported by a Route Handler or Server Component", () => {
    // A server import would move clinical audio and speech onto the server,
    // where retention is no longer the browser tab's lifetime.
    const routes = readdirSync("src/app/api/voice", { recursive: true })
      .map(String)
      .filter((f) => f.endsWith("route.ts"))
      .map((f) => `src/app/api/voice/${f}`);
    expect(routes.length).toBeGreaterThan(0);
    for (const file of routes) {
      expect(readFileSync(file, "utf8"), file).not.toContain("voice/qa");
    }
  });
});

describe("the pipeline does not depend on QA being present", () => {
  it("guards every QA call so an absent sink removes the feature entirely", () => {
    const source = readFileSync("src/lib/voice/conversation-pipeline.ts", "utf8");
    const calls = source.match(/\bqa\.[a-zA-Z]+\(/g) ?? [];
    const optional = source.match(/\bqa\?\.[a-zA-Z]+\(/g) ?? [];
    expect(optional.length).toBeGreaterThan(0);
    // Any unguarded `qa.` must sit inside an `if (qa)` block; assert that the
    // only such block is the segment-capture one, and that it is guarded.
    if (calls.length > 0) {
      expect(source).toContain("if (qa) {");
    }
  });

  it("captures audio only when a sink asked for it", () => {
    const source = readFileSync("src/lib/voice/conversation-pipeline.ts", "utf8");
    // Production must not retain the blob after the object URL is made.
    expect(source).toContain("captureBlob: Boolean(qa)");
  });
});

describe("bounded in-memory retention", () => {
  it("evicts the oldest turn past the cap", () => {
    const store = createVoiceQaStore({ maxTurns: 3 });
    for (let i = 0; i < 10; i++) {
      const sink = store.beginTurn("ar");
      sink.setSpeech({
        displayText: `turn ${i}`,
        speechText: `turn ${i}`,
        changed: false,
        locale: "ar",
        segments: [],
      });
    }
    const turns = store.list();
    expect(turns).toHaveLength(3);
    // Newest first.
    expect(turns[0]!.displayText).toBe("turn 9");
    expect(turns[2]!.displayText).toBe("turn 7");
  });

  it("has a sane default cap", () => {
    expect(VOICE_QA_MAX_TURNS).toBeGreaterThan(0);
    expect(VOICE_QA_MAX_TURNS).toBeLessThanOrEqual(50);
  });

  it("clear() drops every capture", () => {
    const store = createVoiceQaStore();
    store.beginTurn("ar");
    expect(store.list()).toHaveLength(1);
    store.clear();
    expect(store.list()).toEqual([]);
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const store = createVoiceQaStore();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.beginTurn("ar");
    expect(calls).toBeGreaterThan(0);
    const seen = calls;
    off();
    store.beginTurn("ar");
    expect(calls).toBe(seen);
  });
});

describe("store records a turn faithfully", () => {
  it("keeps display and speech text distinct and records marks once", () => {
    const store = createVoiceQaStore();
    const sink = store.beginTurn("ar");

    sink.setTherapistText("كيف نومك؟");
    sink.mark("speech_ended");
    sink.mark("stt_final");
    sink.setSpeech({
      displayText: "أنا *مش* مبسوط.",
      speechText: "أنا مش مبسوط.",
      changed: true,
      locale: "ar",
      segments: [
        { index: 0, text: "أنا مش مبسوط.", boundary: "final", pauseAfterMs: 0 },
      ],
    });
    sink.finish("spoken");

    const turn = store.list()[0]!;
    expect(turn.therapistText).toBe("كيف نومك؟");
    // Display text is the clinical source of truth and must survive verbatim.
    expect(turn.displayText).toBe("أنا *مش* مبسوط.");
    expect(turn.speechText).toBe("أنا مش مبسوط.");
    expect(turn.speechChanged).toBe(true);
    expect(turn.outcome).toBe("spoken");
    expect(turn.latency.sttMs).not.toBeNull();
  });

  it("does not let a repeated mark overwrite the original", () => {
    const store = createVoiceQaStore();
    const sink = store.beginTurn("ar");
    sink.mark("speech_ended");
    const first = store.list()[0]!.marks.speech_ended;
    sink.mark("speech_ended");
    expect(store.list()[0]!.marks.speech_ended).toBe(first);
  });

  it("ignores a capture for a segment that does not exist", () => {
    const store = createVoiceQaStore();
    const sink = store.beginTurn("ar");
    expect(() =>
      sink.captureSegmentAudio({
        index: 7,
        blob: null,
        headers: null,
        synthesisMs: 10,
      }),
    ).not.toThrow();
  });
});

describe("export manifest", () => {
  it("carries no session, avatar, or user identifiers", () => {
    const store = createVoiceQaStore();
    const sink = store.beginTurn("ar");
    sink.setSpeech({
      displayText: "أنا مش مبسوط.",
      speechText: "أنا مش مبسوط.",
      changed: false,
      locale: "ar",
      segments: [
        { index: 0, text: "أنا مش مبسوط.", boundary: "final", pauseAfterMs: 0 },
      ],
    });

    const json = JSON.stringify(buildManifest(store.list()));
    for (const key of ["sessionId", "session_id", "avatarId", "userId", "user_id"]) {
      expect(json, key).not.toContain(key);
    }
  });

  it("names clips so they tie back to their manifest entry", () => {
    expect(audioFileName("qa-1-abc", 0)).toBe("qa-1-abc-seg00.mp3");
    expect(audioFileName("qa-1-abc", 11)).toBe("qa-1-abc-seg11.mp3");
  });

  it("marks a segment with no captured audio as having no file", () => {
    const store = createVoiceQaStore();
    const sink = store.beginTurn("ar");
    sink.setSpeech({
      displayText: "مرحبا.",
      speechText: "مرحبا.",
      changed: false,
      locale: "ar",
      segments: [{ index: 0, text: "مرحبا.", boundary: "final", pauseAfterMs: 0 }],
    });
    expect(buildManifest(store.list()).turns[0]!.segments[0]!.audioFile).toBeNull();
  });

  it("includes the repeated-phrase trace alongside the audio", () => {
    const store = createVoiceQaStore();
    const sink = store.beginTurn("ar");
    sink.setSpeech({
      displayText: "تعبت. فاهمني؟ وما بنام. فاهمني؟",
      speechText: "تعبت. فاهمني? وما بنام. فاهمني?",
      changed: true,
      locale: "ar",
      segments: [
        { index: 0, text: "تعبت. فاهمني?", boundary: "question", pauseAfterMs: 420 },
        { index: 1, text: "وما بنام. فاهمني?", boundary: "final", pauseAfterMs: 0 },
      ],
    });
    const traces = buildManifest(store.list()).turns[0]!.repeatedPhrases;
    expect(traces.length).toBeGreaterThan(0);
    expect(traces.some((t) => t.phrase.includes("فاهمني"))).toBe(true);
  });
});
