/**
 * Turns a streamed patient turn (SSE `sentence` / `regenerating` / `done`)
 * into the parts the Therapy Room speaks. Presentation only: it never
 * decides what the patient says, only when already-released text is voiced.
 *
 * Two parts at most, so a reply has one audio seam:
 *   1. the first sentence the server released early (it passed the speech
 *      release gate: no digit, no authored medication name), spoken while
 *      the rest of the reply is still being generated and validated;
 *   2. the rest of the FINAL reply — the validated, persisted text from
 *      `done` — after the first sentence.
 *
 * If the draft that sentence came from is discarded (`regenerating`), that
 * part is cut and the whole final reply is spoken instead. If nothing was
 * released early (the gate held it, or the server fell back to the classic
 * generator), the final reply is spoken as one part, exactly as before.
 */

import type { SpeechSegment, SpeechSegmentSource } from "@/lib/voice/conversation-pipeline";

export type StreamedReplySpeech = {
  /** A sentence event (any attempt). */
  sentence: (s: { text: string; attempt: number }) => void;
  /** A regenerating event: drafts older than `attempt` are discarded. */
  regenerating: (attempt: number) => void;
  /** The validated, persisted reply — or null when the turn failed. */
  finish: (finalText: string | null) => void;
  source: SpeechSegmentSource;
};

/** Where `first` ends inside `final`, or -1 when `final` does not open with it. */
export function endOfLeadingSentence(final: string, first: string): number {
  const f = first.trim();
  if (!f) return -1;
  const start = final.length - final.trimStart().length;
  return final.startsWith(f, start) ? start + f.length : -1;
}

export function createStreamedReplySpeech(
  opts: {
    /** Resolves when the first part may start (clinical thinking pause). */
    notBefore?: Promise<void>;
  } = {},
): StreamedReplySpeech {
  let attempt = 1;
  let first: { text: string; attempt: number; cut: AbortController } | null = null;
  let firstCut = false;
  let calls = 0;
  let finished = false;
  let finalText: string | null = null;

  let wakeFirst: (() => void) | null = null;
  const firstReady = new Promise<void>((resolve) => {
    wakeFirst = resolve;
  });
  let wakeFinal: (() => void) | null = null;
  const finalReady = new Promise<void>((resolve) => {
    wakeFinal = resolve;
  });

  const wholeReply = (): SpeechSegment | null =>
    finalText && finalText.trim() ? { text: finalText.trim(), offset: 0 } : null;

  return {
    sentence(s) {
      if (finished || s.attempt < attempt) return;
      attempt = s.attempt;
      if (first || calls > 1) return;
      const text = s.text.trim();
      if (!text) return;
      first = { text, attempt: s.attempt, cut: new AbortController() };
      wakeFirst?.();
    },
    regenerating(next) {
      if (next <= attempt) return;
      attempt = next;
      if (first && first.attempt < next && !firstCut) {
        firstCut = true;
        first.cut.abort();
      }
    },
    finish(text) {
      if (finished) return;
      finished = true;
      finalText = text;
      wakeFirst?.();
      wakeFinal?.();
    },
    source: {
      async next() {
        calls += 1;
        if (calls === 1) {
          await Promise.all([firstReady, opts.notBefore]);
          if (first && !firstCut) {
            return { text: first.text, offset: 0, cut: first.cut.signal };
          }
          // Nothing released early (or already discarded): whole reply.
          calls = 2;
          await finalReady;
          return wholeReply();
        }
        if (calls === 2) {
          await finalReady;
          if (finalText == null) return null;
          if (!first || firstCut) return wholeReply();
          const end = endOfLeadingSentence(finalText, first.text);
          // The final reply should open with the sentence already spoken; if
          // it unexpectedly does not, speak the final reply in full.
          if (end < 0) return wholeReply();
          const rest = finalText.slice(end);
          const text = rest.trim();
          if (!text) return null;
          return { text, offset: end + (rest.length - rest.trimStart().length) };
        }
        return null;
      },
    },
  };
}
