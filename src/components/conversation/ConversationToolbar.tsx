"use client";

type Props = {
  paused: boolean;
  avatarMuted: boolean;
  onPause: () => void;
  onResume: () => void;
  onMuteAvatar: () => void;
  onRepeat: () => void;
  onToggleNotes: () => void;
  onEnd: () => void;
  disabled?: boolean;
  labels: {
    pause: string;
    resume: string;
    mute: string;
    unmute: string;
    repeat: string;
    notes: string;
    end: string;
  };
};

/**
 * Floating conversation controls for hands-free mode.
 * Private notes are handled by the parent — never sent to the avatar.
 */
export function ConversationToolbar({
  paused,
  avatarMuted,
  onPause,
  onResume,
  onMuteAvatar,
  onRepeat,
  onToggleNotes,
  onEnd,
  disabled,
  labels,
}: Props) {
  return (
    <div
      className="fixed bottom-6 start-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]/95 px-3 py-2 shadow-lg backdrop-blur-md rtl:translate-x-1/2"
      role="toolbar"
      aria-label="Conversation controls"
    >
      <ToolButton
        onClick={paused ? onResume : onPause}
        disabled={disabled}
        icon={paused ? "play_arrow" : "pause"}
        label={paused ? labels.resume : labels.pause}
      />
      <ToolButton
        onClick={onMuteAvatar}
        disabled={disabled}
        icon={avatarMuted ? "volume_off" : "volume_up"}
        label={avatarMuted ? labels.unmute : labels.mute}
      />
      <ToolButton
        onClick={onRepeat}
        disabled={disabled}
        icon="replay"
        label={labels.repeat}
      />
      <ToolButton
        onClick={onToggleNotes}
        disabled={disabled}
        icon="edit_note"
        label={labels.notes}
      />
      <ToolButton
        onClick={onEnd}
        disabled={disabled}
        icon="call_end"
        label={labels.end}
        danger
      />
    </div>
  );
}

function ToolButton({
  onClick,
  disabled,
  icon,
  label,
  danger,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition disabled:opacity-50 ${
        danger
          ? "bg-[var(--error-container)] text-[var(--on-error-container)]"
          : "bg-[var(--surface-container)] text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
