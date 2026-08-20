"use client";

/**
 * Voice QA panel — DEVELOPMENT ONLY.
 *
 * Renders nothing unless `NEXT_PUBLIC_VOICE_QA=true`. Mounted inside the voice
 * session so a tester can, for each patient response:
 *
 *   - read DISPLAY TEXT and SPEECH TEXT side by side and see what changed
 *   - play back the exact audio the application played, per segment
 *   - see the latency breakdown and which stage dominated
 *   - see where a repeated phrase was introduced
 *
 * It only reads from the capture store. It never writes to the session, the
 * transcript, or the database, and it never re-synthesizes anything.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  downloadAll,
  downloadManifest,
  downloadTurnAudio,
  formatLatency,
  dominantStage,
  traceRepeatedPhrases,
  voiceQaStore,
  type VoiceQaTurn,
} from "@/lib/voice/qa";
import { isVoiceQaEnabled } from "@/lib/voice/qa/enabled";

/**
 * Playback URLs, keyed by blob identity.
 *
 * Module scope rather than a ref: a capture is mutated in place as its turn
 * progresses, so this is looked up during render, and creating an object URL
 * for a blob is idempotent per blob. Revoked together when the panel unmounts
 * or the tester clears the captures.
 */
const clipUrls = new Map<Blob, string>();

function clipUrl(blob: Blob): string {
  const existing = clipUrls.get(blob);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  clipUrls.set(blob, url);
  return url;
}

function revokeAllClipUrls(): void {
  for (const url of clipUrls.values()) URL.revokeObjectURL(url);
  clipUrls.clear();
}

const EMPTY: VoiceQaTurn[] = [];

function LatencyRow({ label, ms }: { label: string; ms: number | null }) {
  return (
    <div className="flex justify-between gap-4 font-mono text-[11px]">
      <span className="text-[var(--on-surface-variant)]">{label}</span>
      <span>{formatLatency(ms)}</span>
    </div>
  );
}

function TurnCard({ turn }: { turn: VoiceQaTurn }) {
  const [open, setOpen] = useState(false);

  const traces = useMemo(
    () =>
      traceRepeatedPhrases({
        displayText: turn.displayText ?? "",
        speechText: turn.speechText ?? "",
        segments: turn.segments.map((s) => s.text),
      }),
    [turn.displayText, turn.speechText, turn.segments],
  );

  const dominant = dominantStage(turn.latency);
  const voiceIds = [
    ...new Set(turn.segments.map((s) => s.voiceId).filter(Boolean)),
  ];
  const models = [...new Set(turn.segments.map((s) => s.model).filter(Boolean))];

  return (
    <div className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-start"
      >
        <span className="truncate text-xs font-semibold">
          {turn.displayText?.slice(0, 60) ?? "(no response)"}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-[var(--on-surface-variant)]">
          {formatLatency(turn.latency.totalMs)} · {turn.segments.length} seg ·{" "}
          {turn.outcome ?? "…"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                Display text (clinical source of truth)
              </p>
              <p className="whitespace-pre-wrap rounded bg-[var(--surface-container)] p-2 text-xs">
                {turn.displayText}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                Speech text sent to TTS{" "}
                {turn.speechChanged === false && "(unchanged)"}
              </p>
              <p className="whitespace-pre-wrap rounded bg-[var(--surface-container)] p-2 text-xs">
                {turn.speechText}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
              Therapist turn
            </p>
            <p className="rounded bg-[var(--surface-container)] p-2 text-xs">
              {turn.therapistText ?? "—"}
            </p>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
              Segments and audio ({turn.locale}
              {voiceIds.length ? ` · voice ${voiceIds.join(", ")}` : ""}
              {models.length ? ` · ${models.join(", ")}` : ""})
            </p>
            <div className="space-y-2">
              {turn.segments.map((segment) => {
                const url = segment.blob ? clipUrl(segment.blob) : undefined;
                return (
                  <div
                    key={segment.index}
                    className="rounded bg-[var(--surface-container)] p-2"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 font-mono text-[10px] text-[var(--on-surface-variant)]">
                      <span>#{segment.index}</span>
                      <span>{segment.boundary}</span>
                      <span>pause {segment.pauseAfterMs}ms</span>
                      <span>
                        synth{" "}
                        {segment.synthesisMs === null
                          ? "—"
                          : `${segment.synthesisMs}ms`}
                      </span>
                      <span>
                        {segment.durationSec === null
                          ? "dur —"
                          : `dur ${segment.durationSec.toFixed(2)}s`}
                      </span>
                      <span>{segment.provider}</span>
                      {segment.cached && <span>cached</span>}
                    </div>
                    <p className="mt-1 text-xs">{segment.text}</p>
                    {url ? (
                      <audio
                        controls
                        preload="none"
                        src={url}
                        className="mt-1 h-8 w-full"
                      />
                    ) : (
                      <p className="mt-1 text-[10px] italic text-[var(--on-surface-variant)]">
                        no captured audio (browser fallback or interrupted)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                Response latency
                {dominant && ` · dominant: ${dominant.stage}`}
              </p>
              <div className="rounded bg-[var(--surface-container)] p-2">
                <LatencyRow label="STT" ms={turn.latency.sttMs} />
                <LatencyRow label="LLM" ms={turn.latency.llmMs} />
                <LatencyRow label="Speech text" ms={turn.latency.speechTextMs} />
                <LatencyRow
                  label="Thinking pause"
                  ms={turn.latency.thinkingPauseMs}
                />
                <LatencyRow
                  label="TTS first audio"
                  ms={turn.latency.ttsFirstAudioMs}
                />
                <LatencyRow
                  label="Playback start"
                  ms={turn.latency.playbackStartMs}
                />
                <LatencyRow label="Total" ms={turn.latency.totalMs} />
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                Repeated phrases
              </p>
              <div className="rounded bg-[var(--surface-container)] p-2 text-[11px]">
                {traces.length === 0 ? (
                  <p className="text-[var(--on-surface-variant)]">
                    none repeated in this turn
                  </p>
                ) : (
                  traces.map((trace) => (
                    <div key={trace.phrase} className="mb-1 last:mb-0">
                      <span className="font-semibold">{trace.phrase}</span>
                      <span className="font-mono text-[10px] text-[var(--on-surface-variant)]">
                        {" "}
                        model {trace.counts[0]?.count} · speech{" "}
                        {trace.counts[1]?.count} · segments{" "}
                        {trace.counts[2]?.count} → introduced at{" "}
                        {trace.introducedAt ?? "—"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => downloadTurnAudio(turn)}
            className="rounded border border-[var(--outline-variant)] px-2 py-1 text-[11px]"
          >
            Download this turn&apos;s audio
          </button>
        </div>
      )}
    </div>
  );
}

export function VoiceQaPanel() {
  const enabled = isVoiceQaEnabled();
  const [open, setOpen] = useState(false);

  // The store is an external mutable source; this is what it is for. `list()`
  // returns a stable reference between changes, so there is no render loop.
  const turns = useSyncExternalStore(
    voiceQaStore.subscribe,
    voiceQaStore.list,
    () => EMPTY,
  );

  useEffect(() => revokeAllClipUrls, []);

  if (!enabled) return null;

  return (
    <aside className="fixed bottom-0 end-0 z-[60] max-h-[70vh] w-full max-w-xl overflow-y-auto border-s border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-bold uppercase tracking-wide"
        >
          Voice QA · {turns.length} turn{turns.length === 1 ? "" : "s"}{" "}
          {open ? "▾" : "▸"}
        </button>
        {open && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadManifest(turns)}
              className="rounded border border-[var(--outline-variant)] px-2 py-1 text-[11px]"
            >
              Manifest
            </button>
            <button
              type="button"
              onClick={() => downloadAll(turns)}
              className="rounded border border-[var(--outline-variant)] px-2 py-1 text-[11px]"
            >
              Export all
            </button>
            <button
              type="button"
              onClick={() => {
                revokeAllClipUrls();
                voiceQaStore.clear();
              }}
              className="rounded border border-[var(--outline-variant)] px-2 py-1 text-[11px]"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {open && (
        <>
          <p className="mb-2 text-[10px] text-[var(--on-surface-variant)]">
            In-memory only. Audio is never persisted and is destroyed when this
            tab closes.
          </p>
          <div className="space-y-2">
            {turns.length === 0 ? (
              <p className="text-xs text-[var(--on-surface-variant)]">
                No captures yet — complete a patient turn.
              </p>
            ) : (
              turns.map((turn) => (
                <TurnCard key={turn.id} turn={turn} />
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}
