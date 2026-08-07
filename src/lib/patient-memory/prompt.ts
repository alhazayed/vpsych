/**
 * Format retrieved long-term memory for the patient system prompt.
 * Instructs natural prior-session references without inventing facts.
 */

import type { MemoryEntry, SessionMemorySummary } from "./types";

export function formatMemoryPromptBlock(
  entries: MemoryEntry[],
  recentSummaries: SessionMemorySummary[] = [],
): string {
  if (entries.length === 0 && recentSummaries.length === 0) return "";

  const lines: string[] = [
    "LONG-TERM MEMORY (facts you actually remember — never invent beyond this list):",
  ];

  for (const e of entries) {
    lines.push(`- [${e.category}] ${e.content}`);
  }

  if (recentSummaries.length > 0) {
    lines.push("Prior session summaries (real history — do not regenerate):");
    for (const s of recentSummaries) {
      lines.push(`- Session ${s.session_id.slice(0, 8)}…: ${s.summary}`);
    }
  }

  lines.push(
    "When relevant, reference prior conversations naturally (e.g. \"You asked me about my father last week…\").",
    "Never claim memories that are not listed. Imperfect recall is OK; fabrication is not.",
  );

  return lines.join("\n");
}

/**
 * Short spoken cues the patient may use — grounded in retrieved entries only.
 */
export function formatReferenceCues(
  entries: MemoryEntry[],
  summaries: SessionMemorySummary[] = [],
): string[] {
  const cues: string[] = [];

  for (const e of entries) {
    if (e.category === "previous_session" || e.source === "therapist_turn") {
      const topic = e.topics.find((t) => t !== "previous_session") ?? "that";
      cues.push(`You asked me about ${topic} last time…`);
    }
    if (e.category === "promise") {
      cues.push(`You said you'd ${trimCue(e.content, 60)}`);
    }
    if (e.category === "therapist_mistake") {
      cues.push(`Last time you got that wrong — ${trimCue(e.content, 60)}`);
    }
    if (e.category === "medication") {
      cues.push(`About my medication — ${trimCue(e.content, 60)}`);
    }
  }

  if (summaries.length > 0 && cues.length === 0) {
    const last = summaries[summaries.length - 1]!;
    const theme = last.themes[0];
    if (theme) {
      cues.push(`Last week we talked about ${theme}…`);
    }
  }

  return [...new Set(cues)].slice(0, 5);
}

function trimCue(text: string, max: number): string {
  const t = text.replace(/^[^:]+:\s*/, "").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Append memory block to an assembled system prompt (idempotent marker).
 */
export function injectMemoryIntoSystemPrompt(
  systemPrompt: string,
  memoryBlock: string,
): string {
  const block = memoryBlock.trim();
  if (!block) return systemPrompt;
  const marker = "LONG-TERM MEMORY (facts you actually remember";
  if (systemPrompt.includes(marker)) {
    // Replace prior injection rather than stacking.
    return systemPrompt.replace(
      /LONG-TERM MEMORY \(facts you actually remember[\s\S]*?(?=\n\n|$)/,
      block,
    );
  }
  return `${systemPrompt.trim()}\n\n${block}`;
}
