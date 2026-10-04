"use client";

import { useTranslations } from "next-intl";
import {
  VOICE_STAGES,
  voiceStageLabel,
  type VoiceStageStatus,
  type VoiceTurnDiagnostics,
} from "@/lib/voice/voice-diagnostics";

const STAGE_MARK: Record<VoiceStageStatus, string> = {
  idle: "○",
  active: "●",
  ok: "✓",
  fail: "✗",
  skipped: "–",
};

/**
 * Always-visible turn captions + explicit failure lines for the Therapy Room.
 *
 * The therapist line appears as soon as STT returns (before /message), the
 * patient line as soon as /message returns (before TTS). Audio failures never
 * hide either line. The per-stage grid renders only when voice debugging is on
 * (development, NEXT_PUBLIC_VOICE_DEBUG=true, or ?voiceDebug=1).
 */
export function VoiceTurnPanel({
  therapistText,
  therapistPending,
  patientText,
  patientFallback,
  diagnostics,
  debug,
  onPlayAudio,
}: {
  therapistText: string | null;
  /** True while the therapist line is not yet saved by /message. */
  therapistPending: boolean;
  patientText: string | null;
  /** The reply came from persona fallback, not the model. */
  patientFallback: boolean;
  diagnostics: VoiceTurnDiagnostics;
  debug: boolean;
  onPlayAudio?: () => void;
}) {
  const t = useTranslations("therapyRoom.voiceTurn");
  const error = diagnostics.error;
  const audioUnavailable = diagnostics.audioUnavailable;
  const audioDegraded = diagnostics.audioDegraded;

  return (
    <>
      {(therapistText || patientText) && (
        <div className="trm-captions" aria-live="polite" data-testid="voice-captions">
          {therapistText && (
            <p
              className={`trm-captions__line trm-captions__line--you ${
                therapistPending ? "is-pending" : ""
              }`}
              data-testid="caption-therapist"
            >
              <span className="trm-captions__who">{t("you")}</span>
              <span dir="auto">{therapistText}</span>
            </p>
          )}
          {patientText && (
            <p
              className="trm-captions__line trm-captions__line--patient"
              data-testid="caption-patient"
            >
              <span className="trm-captions__who">{t("patient")}</span>
              <span dir="auto">{patientText}</span>
              {patientFallback && (
                <span className="trm-captions__tag">{t("fallbackReply")}</span>
              )}
            </p>
          )}
        </div>
      )}

      {(error || audioUnavailable || audioDegraded) && (
        <div className="trm-voice-alert" role="alert" data-testid="voice-alert">
          {error && <p data-testid="voice-error">{error.message}</p>}
          {!error && !audioUnavailable && audioDegraded && (
            <p data-testid="voice-audio-degraded">
              {t("fallbackVoice")} {audioDegraded.message}
            </p>
          )}
          {!error && audioUnavailable && (
            <p data-testid="voice-audio-unavailable">
              {t("audioUnavailable")} {audioUnavailable.message}
              {onPlayAudio && (
                <button
                  type="button"
                  className="trm-status__retry"
                  onClick={onPlayAudio}
                >
                  {t("playAudio")}
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {debug && (
        <aside
          className="trm-voice-debug"
          aria-label="Voice diagnostics"
          data-testid="voice-debug"
        >
          <div className="trm-voice-debug__title">
            VOICE · turn {diagnostics.turn}
          </div>
          <ul>
            {VOICE_STAGES.map((stage) => (
              <li
                key={stage}
                data-stage={stage}
                data-status={diagnostics.stages[stage]}
              >
                <span>{STAGE_MARK[diagnostics.stages[stage]]}</span>{" "}
                {voiceStageLabel(stage)}
              </li>
            ))}
          </ul>
          {Object.keys(diagnostics.facts).length > 0 && (
            <dl>
              {Object.entries(diagnostics.facts).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          <div data-testid="voice-debug-error">
            ERROR: {error?.message ?? audioUnavailable?.message ?? "none"}
          </div>
        </aside>
      )}
    </>
  );
}
