import type { MessageRole } from "@/lib/types";

/**
 * Phase 4 P0-1 — read-only Admin Test Conversation transcript.
 *
 * Renders persisted `session_messages` exactly as stored. Content is never
 * altered, regenerated, or re-inferred: no patient agent, no STT/TTS, no
 * assessment. Speaker roles keep the system / therapist / patient distinction.
 *
 * Authorization is enforced by the server page that renders this component
 * (`requireAdmin` + server-side admin-test marker check). This component is
 * presentation only and must never be treated as a security boundary.
 */

export type AdminTestTranscriptMessage = {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

const ROLE_STYLE: Record<MessageRole, string> = {
  system:
    "border-[var(--outline-variant)] bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]",
  user: "border-[var(--outline-variant)] bg-[var(--surface-container-low)] text-[var(--on-surface)]",
  assistant:
    "border-[var(--outline-variant)] bg-[var(--surface-container)] text-[var(--on-surface)]",
};

const ROLE_TONE: Record<MessageRole, string> = {
  system: "text-[var(--outline)]",
  user: "text-[var(--primary)]",
  assistant: "text-[var(--secondary)]",
};

export function AdminTestTranscript({
  messages,
  labels,
  locale,
}: {
  messages: AdminTestTranscriptMessage[];
  labels: {
    empty: string;
    roleSystem: string;
    roleUser: string;
    roleAssistant: string;
    turns: string;
  };
  locale: string;
}) {
  if (messages.length === 0) {
    return (
      <p className="clinical-card p-5 text-sm text-[var(--on-surface-variant)]">
        {labels.empty}
      </p>
    );
  }

  const roleLabel: Record<MessageRole, string> = {
    system: labels.roleSystem,
    user: labels.roleUser,
    assistant: labels.roleAssistant,
  };

  const time = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--on-surface-variant)]">{labels.turns}</p>
      <ol className="space-y-3">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border p-4 ${ROLE_STYLE[m.role]}`}
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.16em] ${ROLE_TONE[m.role]}`}
              >
                {roleLabel[m.role]}
              </span>
              <time
                dateTime={m.created_at}
                className="text-[11px] tabular-nums text-[var(--on-surface-variant)]"
              >
                {time.format(new Date(m.created_at))}
              </time>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {m.content}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
