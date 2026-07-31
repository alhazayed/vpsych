"use client";

import { useTranslations } from "next-intl";
import { formatTimer } from "@/lib/session-timer";

export function SessionTimer({
  remaining,
  warningThreshold = 300,
}: {
  remaining: number;
  warningThreshold?: number;
}) {
  const t = useTranslations("session.timer");
  const urgent = remaining <= warningThreshold;
  const time = formatTimer(remaining);
  return (
    <div
      className={`rounded-full px-3 py-1 font-[family-name:var(--font-body)] text-xs font-semibold tabular-nums tracking-wider ${
        urgent
          ? "bg-[color-mix(in_srgb,var(--secondary)_12%,transparent)] text-[var(--secondary)]"
          : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
      }`}
      aria-live="polite"
      aria-label={t("ariaLabel", { time })}
    >
      <span className="me-2 inline-block h-2 w-2 rounded-full bg-current opacity-80" />
      {time}
    </div>
  );
}
