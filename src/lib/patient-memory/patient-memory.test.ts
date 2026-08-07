/**
 * Mission 4 — Long-Term Patient Memory tests.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  appendMemoryEntries,
  clearPatientMemoryMemoryForTests,
  compressMemoryStore,
  emptyPatientMemoryStore,
  extractFromTranscript,
  extractFromUtterance,
  formatMemoryPromptBlock,
  formatReferenceCues,
  hasEquivalentFact,
  injectMemoryIntoSystemPrompt,
  MEMORY_SOFT_CAP,
  needsCompression,
  prepareMemoryForTurn,
  retrieveMemories,
  runPatientMemoryAfterSession,
  seedFromPersonaIdentity,
  summarizeSessionIntoStore,
  type ExtractedCandidate,
  type PatientMemoryStore,
} from "@/lib/patient-memory";

afterEach(() => {
  clearPatientMemoryMemoryForTests();
});

function baseStore(): PatientMemoryStore {
  return emptyPatientMemoryStore({
    therapistId: "therapist-1",
    avatarId: "avatar-maya",
  });
}

describe("extract", () => {
  it("extracts medications, relationships, and occupation from patient speech", () => {
    const meds = extractFromUtterance(
      "I've been on sertraline for about six months now.",
      { role: "assistant" },
    );
    expect(meds.some((c) => c.category === "medication")).toBe(true);

    const rel = extractFromUtterance(
      "My father and I don't really talk anymore.",
      { role: "assistant" },
    );
    expect(rel.some((c) => c.category === "relationship")).toBe(true);

    const job = extractFromUtterance(
      "I work as a graphic designer mostly from home.",
      { role: "assistant" },
    );
    expect(job.some((c) => c.category === "occupation")).toBe(true);
  });

  it("records therapist questions as previous_session memories", () => {
    const asks = extractFromUtterance(
      "Tell me more about your father and how things are at home.",
      { role: "user" },
    );
    expect(asks.some((c) => c.category === "previous_session")).toBe(true);
    expect(asks[0]?.content.toLowerCase()).toMatch(/father|family|relationship/);
  });

  it("detects therapist mistakes and promises", () => {
    const mistake = extractFromUtterance(
      "That's not what I said — you misunderstood me last time.",
      { role: "assistant" },
    );
    expect(mistake.some((c) => c.category === "therapist_mistake")).toBe(true);

    const promise = extractFromUtterance(
      "You promised you'd check in about my sleep this week.",
      { role: "assistant" },
    );
    expect(promise.some((c) => c.category === "promise")).toBe(true);
  });

  it("extracts trauma, children, life events, and future plans", () => {
    expect(
      extractFromUtterance("I still get flashbacks from the accident.", {
        role: "assistant",
      }).some((c) => c.category === "trauma"),
    ).toBe(true);
    expect(
      extractFromUtterance("My daughter is starting school next month.", {
        role: "assistant",
      }).some((c) => c.category === "children"),
    ).toBe(true);
    expect(
      extractFromUtterance("I got laid off in March and moved apartments.", {
        role: "assistant",
      }).some((c) => c.category === "life_event"),
    ).toBe(true);
    expect(
      extractFromUtterance("I'm planning to go back to school next year.", {
        role: "assistant",
      }).some((c) => c.category === "future_plan"),
    ).toBe(true);
  });

  it("never invents facts from empty or tiny utterances", () => {
    expect(extractFromUtterance("ok", { role: "assistant" })).toEqual([]);
    expect(extractFromTranscript([])).toEqual([]);
  });

  it("seeds only from authored persona identity fields", () => {
    const seeds = seedFromPersonaIdentity({
      occupation: "Graphic designer",
      family_context: "Parents overseas",
      living_situation: "Lives with partner",
    });
    expect(seeds.every((s) => s.source === "persona_seed")).toBe(true);
    expect(seeds.some((s) => s.category === "occupation")).toBe(true);
    expect(seeds.some((s) => s.content.includes("Graphic designer"))).toBe(true);
  });
});

describe("store", () => {
  it("appends facts and refuses duplicates (no regenerated history)", () => {
    let store = baseStore();
    const candidates: ExtractedCandidate[] = [
      {
        category: "medication",
        content: "Medication mentioned: on sertraline",
        salience: 0.9,
        topics: ["medication"],
        source: "transcript",
        turn_index: 1,
      },
    ];
    const first = appendMemoryEntries(store, candidates, {
      sessionId: "sess-1",
    });
    expect(first.added).toHaveLength(1);
    store = first.store;

    const second = appendMemoryEntries(store, candidates, {
      sessionId: "sess-2",
    });
    expect(second.added).toHaveLength(0);
    expect(hasEquivalentFact(store, "Medication mentioned: on sertraline")).toBe(
      true,
    );
  });
});

describe("retrieval + prompt", () => {
  it("retrieves father-related prior session memory for a natural reference", () => {
    let store = baseStore();
    store = appendMemoryEntries(
      store,
      [
        {
          category: "previous_session",
          content: "Therapist asked about relationships / family: Tell me about your father",
          salience: 0.8,
          topics: ["father", "family", "previous_session"],
          source: "therapist_turn",
          turn_index: 2,
        },
        {
          category: "medication",
          content: "Medication mentioned: sertraline 50mg",
          salience: 0.92,
          topics: ["medication"],
          source: "transcript",
          turn_index: 4,
        },
      ],
      { sessionId: "sess-prior" },
    ).store;

    const result = retrieveMemories(store, "How have things been with your dad?");
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.promptBlock).toMatch(/LONG-TERM MEMORY/);
    expect(result.promptBlock).toMatch(/father|family/i);
    expect(result.promptBlock).toMatch(/never invent/i);

    const cues = formatReferenceCues(result.hits.map((h) => h.entry));
    expect(cues.some((c) => /last time|father|family/i.test(c))).toBe(true);
  });

  it("injects memory into system prompt without stacking duplicates", () => {
    const block = formatMemoryPromptBlock([
      {
        id: "1",
        category: "occupation",
        content: "Occupation: Graphic designer",
        source: "persona_seed",
        session_id: null,
        turn_index: null,
        salience: 0.85,
        topics: ["occupation"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    const once = injectMemoryIntoSystemPrompt("You are Maya.", block);
    expect(once).toMatch(/Graphic designer/);
    const twice = injectMemoryIntoSystemPrompt(once, block);
    expect(twice.match(/LONG-TERM MEMORY/g)?.length).toBe(1);
  });
});

describe("summarization", () => {
  it("persists session summary from real transcript without inventing", () => {
    const store = baseStore();
    const messages = [
      {
        role: "user",
        content: "Last week we talked — tell me more about your father.",
      },
      {
        role: "assistant",
        content: "My father and I don't talk. I'm still on sertraline.",
      },
      {
        role: "user",
        content: "You mentioned your job before — how is work?",
      },
      {
        role: "assistant",
        content: "I work as a graphic designer. I'm planning to go freelance next year.",
      },
    ];

    const result = summarizeSessionIntoStore(store, {
      sessionId: "sess-2",
      messages,
      startedAt: "2026-08-01T10:00:00Z",
      endedAt: "2026-08-01T10:40:00Z",
    });

    expect(result.addedCount).toBeGreaterThan(0);
    expect(result.summary?.session_id).toBe("sess-2");
    expect(result.summary?.summary).toMatch(/Remembered from this session/);
    expect(result.store.session_summaries).toHaveLength(1);

    // Idempotent — second summarize does not regenerate.
    const again = summarizeSessionIntoStore(result.store, {
      sessionId: "sess-2",
      messages,
    });
    expect(again.addedCount).toBe(0);
    expect(again.store.session_summaries).toHaveLength(1);
  });
});

describe("compression", () => {
  it("compresses over soft cap without dropping facts unmerged", () => {
    let store = baseStore();
    const candidates: ExtractedCandidate[] = [];
    for (let i = 0; i < MEMORY_SOFT_CAP + 25; i++) {
      candidates.push({
        category: i % 2 === 0 ? "life_event" : "other",
        content: `Life detail number ${i} about weekend plans and errands`,
        salience: 0.4,
        topics: ["life_event", `topic${i % 5}`],
        source: "transcript",
        turn_index: i,
      });
    }
    // Sticky high-salience trauma must survive as its own row.
    candidates.push({
      category: "trauma",
      content: "Trauma-related disclosure: flashbacks from the accident",
      salience: 0.98,
      topics: ["trauma"],
      source: "transcript",
      turn_index: 99,
    });

    store = appendMemoryEntries(store, candidates, { sessionId: "big" }).store;
    expect(needsCompression(store)).toBe(true);

    const beforeIds = new Set(store.entries.map((e) => e.id));
    const result = compressMemoryStore(store);
    expect(result.store.entries.length).toBeLessThan(store.entries.length);
    expect(result.removed).toBeGreaterThan(0);
    expect(
      result.store.entries.some((e) => e.category === "trauma"),
    ).toBe(true);

    // Every removed id should appear in some compressed_from list.
    const survivors = new Set(result.store.entries.map((e) => e.id));
    const folded = new Set(
      result.store.entries.flatMap((e) => e.compressed_from ?? []),
    );
    for (const id of beforeIds) {
      if (!survivors.has(id)) {
        expect(folded.has(id)).toBe(true);
      }
    }
  });
});

describe("session hooks (best-effort)", () => {
  it("prepareMemoryForTurn seeds persona and injects retrieval", async () => {
    const ctx = await prepareMemoryForTurn(null, {
      therapistId: "t1",
      avatarId: "a1",
      userMessage: "How is work going this week?",
      systemPrompt: "You are Maya.",
      identity: {
        occupation: "Graphic designer",
        family_context: "Parents overseas",
      },
    });
    expect(ctx.systemPrompt).toMatch(/LONG-TERM MEMORY|Graphic designer/);
    expect(ctx.store.entries.some((e) => e.source === "persona_seed")).toBe(
      true,
    );
  });

  it("runPatientMemoryAfterSession persists across sessions in memory fallback", async () => {
    const messages = [
      { role: "user", content: "Tell me about your father again." },
      {
        role: "assistant",
        content: "You asked me about my father last week. Still hard.",
      },
    ];

    const first = await runPatientMemoryAfterSession(null, {
      therapistId: "t1",
      avatarId: "a1",
      sessionId: "s1",
      messages,
      identity: { occupation: "Designer" },
    });
    expect(first.ok).toBe(true);
    expect(first.persisted).toBe("memory");
    expect(first.addedCount).toBeGreaterThan(0);

    const second = await runPatientMemoryAfterSession(null, {
      therapistId: "t1",
      avatarId: "a1",
      sessionId: "s2",
      messages: [
        { role: "user", content: "Any update on your medication?" },
        {
          role: "assistant",
          content: "I'm still on sertraline like I told you.",
        },
      ],
    });
    expect(second.ok).toBe(true);

    const turn = await prepareMemoryForTurn(null, {
      therapistId: "t1",
      avatarId: "a1",
      userMessage: "You asked me about my father — how is that?",
      systemPrompt: "You are Maya.",
    });
    expect(turn.store.session_summaries.length).toBeGreaterThanOrEqual(2);
    expect(turn.retrieval.promptBlock.length).toBeGreaterThan(0);
  });
});
