/**
 * Presentation memory flags — does NOT extract, rank, or inject memories.
 *
 * Long-Term Patient Memory owns durable facts. Humanization only learns whether
 * prior-session continuity exists so it may allow the
 * `remembering_previous_sessions` *delivery* micro-behaviour (hesitation /
 * soft recall cadence) — never the facts themselves.
 */

import type { MemoryEngineOutput } from "@/lib/humanization/types";

export function memoryTick(params: {
  /** @deprecated Ignored — Patient Memory owns transcript extraction. */
  history?: unknown;
  /** @deprecated Ignored. */
  userMessage?: string;
  /** @deprecated Ignored. */
  therapistMove?: string;
  /** @deprecated Ignored — do not scrape case_memory for facts here. */
  caseMemory?: Record<string, unknown> | null;
  /** Set by the message route from Patient Memory retrieval hits. */
  hasPriorSessionMemory?: boolean;
}): MemoryEngineOutput {
  const hasPrior = Boolean(params.hasPriorSessionMemory);
  return {
    recalled_facts: [],
    prior_session_cues: hasPrior ? ["__prior_session_available__"] : [],
    topics_touched: [],
    imperfect_recall_ok: true,
    directives: [],
  };
}
