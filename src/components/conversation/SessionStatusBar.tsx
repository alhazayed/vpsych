"use client";

import type { SessionStatusKind } from "@/lib/conversation";

const FALLBACK: Record<SessionStatusKind, string> = {
  listening: "Listening",
  thinking: "Thinking",
  patientSpeaking: "Patient speaking",
  paused: "Paused",
  networkRetry: "Network retry",
  microphoneMuted: "Microphone muted",
  connectionLost: "Connection lost",
  ready: "Ready",
  finished: "Finished",
};

export function SessionStatusBar({
  status,
  label,
}: {
  status: SessionStatusKind;
  label?: string;
}) {
  const text = label ?? FALLBACK[status];
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-[4.75rem] z-40 -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div
        key={status}
        className="flex animate-[hfteFade_220ms_ease-out] items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]/95 px-4 py-1.5 text-xs font-semibold text-[var(--on-surface)] shadow-sm backdrop-blur-md"
        data-status={status}
      >
        <span
          className={`h-2 w-2 rounded-full transition-colors duration-300 ${dotClass(status)}`}
          aria-hidden
        />
        <span className="tracking-wide">{text}</span>
      </div>
    </div>
  );
}

function dotClass(status: SessionStatusKind): string {
  switch (status) {
    case "listening":
      return "bg-[var(--secondary)]";
    case "thinking":
      return "bg-[var(--tertiary)] animate-pulse";
    case "patientSpeaking":
      return "bg-[var(--primary)]";
    case "paused":
      return "bg-[var(--outline)]";
    case "networkRetry":
    case "connectionLost":
      return "bg-[var(--error)]";
    case "microphoneMuted":
      return "bg-[var(--on-surface-variant)]";
    default:
      return "bg-[var(--outline-variant)]";
  }
}
