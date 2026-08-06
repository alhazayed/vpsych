"use client";

import { useTranslations } from "next-intl";
import { formatTimer } from "@/lib/session-timer";

export function RoomTimer({
  remaining,
  elapsed,
  mode,
  hidden,
  paused,
  onToggleMode,
  onToggleHidden,
}: {
  remaining: number;
  elapsed: number;
  mode: "elapsed" | "remaining";
  hidden: boolean;
  paused?: boolean;
  onToggleMode?: () => void;
  onToggleHidden?: () => void;
}) {
  const t = useTranslations("therapyRoom.timer");
  if (hidden) {
    return (
      <button
        type="button"
        className="trm-timer trm-timer--hidden"
        onClick={onToggleHidden}
        aria-label={t("show")}
      >
        <span className="material-symbols-outlined text-[16px]">schedule</span>
      </button>
    );
  }

  const seconds = mode === "remaining" ? remaining : elapsed;
  const time = formatTimer(seconds);
  const urgent = mode === "remaining" && remaining <= 300;

  return (
    <div
      className={`trm-timer ${urgent ? "trm-timer--urgent" : ""} ${paused ? "trm-timer--paused" : ""}`}
      aria-live="polite"
      aria-label={
        mode === "remaining"
          ? t("remainingAria", { time })
          : t("elapsedAria", { time })
      }
    >
      <button
        type="button"
        className="trm-timer__value"
        onClick={onToggleMode}
        title={t("toggleMode")}
      >
        {time}
      </button>
      <button
        type="button"
        className="trm-timer__hide"
        onClick={onToggleHidden}
        aria-label={t("hide")}
      >
        <span className="material-symbols-outlined text-[14px]">visibility_off</span>
      </button>
    </div>
  );
}
