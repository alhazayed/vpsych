"use client";

import { useTranslations } from "next-intl";
import type {
  ConversationState,
  ConversationStatusKey,
} from "@/lib/therapy-room";

/**
 * Always-visible conversation status for hands-free Therapy Room.
 * Screen-reader friendly; high-contrast mic indicator when listening.
 */
export function ConversationStatus({
  statusKey,
  fsmState,
  therapistSpeaking,
  onRetry,
}: {
  statusKey: ConversationStatusKey;
  fsmState: ConversationState;
  therapistSpeaking?: boolean;
  onRetry?: () => void;
}) {
  const t = useTranslations("therapyRoom.status");
  const showMic = fsmState === "LISTENING";
  const isError = fsmState === "ERROR" || statusKey === "error";

  return (
    <div
      className={`trm-status ${isError ? "is-error" : ""} ${showMic ? "is-listening" : ""}`}
      role="status"
      aria-live="polite"
      data-fsm={fsmState}
      data-status={statusKey}
    >
      {showMic && (
        <span
          className={`trm-status__mic ${therapistSpeaking ? "is-hot" : ""}`}
          aria-hidden
        />
      )}
      <span className="trm-status__label">{t(statusKey)}</span>
      {isError && onRetry && (
        <button
          type="button"
          className="trm-status__retry"
          onClick={onRetry}
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}
