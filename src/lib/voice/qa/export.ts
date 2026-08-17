/**
 * Browser-local export of captured QA turns.
 *
 * Everything leaves through the user's own download folder. Nothing is
 * uploaded, and the manifest deliberately carries no session id, avatar id, or
 * user id — it is a voice artefact, not a clinical record.
 *
 * `buildManifest` is pure so it can be tested; the download side is a thin
 * DOM wrapper over it.
 */

import { traceRepeatedPhrases } from "@/lib/voice/qa/phrase-trace";
import type { VoiceQaTurn } from "@/lib/voice/qa/types";

export type VoiceQaManifest = {
  exportedAt: string;
  turnCount: number;
  turns: Array<{
    id: string;
    startedAt: string;
    locale: string;
    outcome: string | null;
    therapistText: string | null;
    displayText: string | null;
    speechText: string | null;
    speechChanged: boolean | null;
    latency: VoiceQaTurn["latency"];
    segments: Array<{
      index: number;
      audioFile: string | null;
      text: string;
      boundary: string;
      pauseAfterMs: number;
      byteLength: number | null;
      durationSec: number | null;
      synthesisMs: number | null;
      provider: string;
      voiceId: string | null;
      model: string | null;
      voiceProfileId: string | null;
      voiceSource: string | null;
      emotion: string | null;
      cached: boolean | null;
    }>;
    repeatedPhrases: ReturnType<typeof traceRepeatedPhrases>;
  }>;
};

/** Stable, filesystem-safe name tying a clip back to its manifest entry. */
export function audioFileName(turnId: string, segmentIndex: number): string {
  return `${turnId}-seg${String(segmentIndex).padStart(2, "0")}.mp3`;
}

export function buildManifest(turns: VoiceQaTurn[]): VoiceQaManifest {
  return {
    exportedAt: new Date().toISOString(),
    turnCount: turns.length,
    turns: turns.map((turn) => ({
      id: turn.id,
      startedAt: turn.startedAt,
      locale: turn.locale,
      outcome: turn.outcome,
      therapistText: turn.therapistText,
      displayText: turn.displayText,
      speechText: turn.speechText,
      speechChanged: turn.speechChanged,
      latency: turn.latency,
      segments: turn.segments.map((segment) => ({
        index: segment.index,
        audioFile: segment.blob ? audioFileName(turn.id, segment.index) : null,
        text: segment.text,
        boundary: segment.boundary,
        pauseAfterMs: segment.pauseAfterMs,
        byteLength: segment.byteLength,
        durationSec: segment.durationSec,
        synthesisMs: segment.synthesisMs,
        provider: segment.provider,
        voiceId: segment.voiceId,
        model: segment.model,
        voiceProfileId: segment.voiceProfileId,
        voiceSource: segment.voiceSource,
        emotion: segment.emotion,
        cached: segment.cached,
      })),
      repeatedPhrases: traceRepeatedPhrases({
        displayText: turn.displayText ?? "",
        speechText: turn.speechText ?? "",
        segments: turn.segments.map((s) => s.text),
      }),
    })),
  };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadManifest(turns: VoiceQaTurn[]): void {
  const manifest = buildManifest(turns);
  downloadBlob(
    new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
    `vpsych-voice-qa-${Date.now()}.json`,
  );
}

/**
 * Download the manifest plus every captured clip.
 *
 * One file per segment rather than a zip: no archiving dependency, and the
 * segment boundaries stay audible as separate files, which is exactly what is
 * under evaluation.
 */
export function downloadTurnAudio(turn: VoiceQaTurn): void {
  for (const segment of turn.segments) {
    if (!segment.blob) continue;
    downloadBlob(segment.blob, audioFileName(turn.id, segment.index));
  }
}

export function downloadAll(turns: VoiceQaTurn[]): void {
  downloadManifest(turns);
  for (const turn of turns) downloadTurnAudio(turn);
}
