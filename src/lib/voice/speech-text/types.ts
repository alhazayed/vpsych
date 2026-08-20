/**
 * Speech-text layer types.
 *
 * Hard invariant for this whole directory: the DISPLAY text (what is persisted
 * in `session_messages`, rendered in the transcript, and fed to assessment) is
 * NEVER produced or modified here. This layer only derives a SPEECH
 * representation that is handed to the TTS provider and then discarded.
 */

import type { SessionSpeechLocale } from "@/lib/voice/config";

export type SpeechSegment = {
  /** Pronunciation-oriented text handed to the TTS provider. */
  text: string;
  /**
   * Silence to insert AFTER this segment, in milliseconds. Always 0 for the
   * final segment so a turn never ends on dead air.
   */
  pauseAfterMs: number;
  /** Which boundary produced this segment — used by tests and telemetry. */
  boundary: SegmentBoundary;
};

export type SegmentBoundary =
  | "sentence"
  | "question"
  | "exclamation"
  | "clause"
  | "length"
  | "final";

export type PreparedSpeech = {
  /** Locale actually used to prepare the speech text. */
  locale: SessionSpeechLocale;
  /** Whole normalized utterance (segments joined) — used for single-shot TTS. */
  speechText: string;
  segments: SpeechSegment[];
  /** True when normalization changed anything at all. */
  normalized: boolean;
};

export type NormalizeResult = {
  text: string;
  /** True when the normalizer changed the input. */
  changed: boolean;
};

export type SegmentOptions = {
  /** Soft ceiling before a sentence is split at clause boundaries. */
  maxChars?: number;
  /**
   * Segments shorter than this are merged into a neighbour so short fillers
   * ("يعني", "I mean") never become their own audio request.
   */
  minChars?: number;
  /** Hard cap on segment count; excess is merged into the last segment. */
  maxSegments?: number;
  /** Multiplier applied to every pause budget (clinical pacing). */
  pauseScale?: number;
};
