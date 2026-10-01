/**
 * Human Conversation Fidelity — response timing helpers (presentation only).
 *
 * Natural, not slow: the patient's onset timing already varies through the
 * persona/humanization pause (`voiceHints.pause_before_ms`) and the Therapy
 * Room thinking latency. Those values are authored upstream and are NOT
 * changed here. What this module fixes is WHEN they are measured:
 *
 *   before: user stops → STT → patient generation → [full pause] → TTS → audio
 *   after:  user stops ─┬─ STT → patient generation → TTS ──┐
 *                       └──────── pause (from end-of-speech) ┴→ audio
 *
 * Processing time counts toward the pause, so a persona pause never stacks
 * on top of pipeline latency, and no artificial delay is ever added.
 */

/** Hard ceiling (unchanged from the legacy pipeline clamp). */
export const MAX_PAUSE_BEFORE_MS = 6000;

/**
 * Remaining intentional pause before first audio.
 *
 * - No anchor → legacy semantics (full clamped pause).
 * - With anchor → pause minus time already elapsed since end-of-speech.
 */
export function effectivePauseBeforeMs(params: {
  pauseBeforeMs?: number | null;
  /** performance.now() at therapist end-of-speech. */
  anchorAt?: number | null;
  now: number;
}): number {
  const requested = Math.max(
    0,
    Math.min(MAX_PAUSE_BEFORE_MS, Number(params.pauseBeforeMs ?? 0) || 0),
  );
  if (requested === 0) return 0;
  if (params.anchorAt == null || !Number.isFinite(params.anchorAt)) {
    return Math.round(requested);
  }
  const elapsed = Math.max(0, params.now - params.anchorAt);
  return Math.max(0, Math.round(requested - elapsed));
}

/** Max characters of neighbouring context sent for TTS request stitching. */
export const STITCH_CONTEXT_CHARS = 300;

/**
 * Neighbouring text for one progressive chunk. Previous text is the tail of
 * everything already spoken in this reply; next text is the following chunk.
 * Context is never spoken — it only shapes intonation at the boundary.
 */
export function stitchingContextForChunk(
  chunks: readonly string[],
  index: number,
  maxChars: number = STITCH_CONTEXT_CHARS,
): { previousText?: string; nextText?: string } {
  if (chunks.length <= 1) return {};
  const out: { previousText?: string; nextText?: string } = {};
  if (index > 0) {
    const prev = chunks.slice(0, index).join(" ").trim();
    if (prev) out.previousText = tailAtWordBoundary(prev, maxChars);
  }
  const next = chunks[index + 1]?.trim();
  if (next) out.nextText = headAtWordBoundary(next, maxChars);
  return out;
}

function tailAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(text.length - maxChars);
  const space = slice.indexOf(" ");
  return space > 0 ? slice.slice(space + 1) : slice;
}

function headAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const space = slice.lastIndexOf(" ");
  return space > 0 ? slice.slice(0, space) : slice;
}
