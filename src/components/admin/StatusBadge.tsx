type StatusTone = "active" | "inactive" | "warning" | "info" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  active:
    "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]",
  inactive: "bg-[var(--surface-container)] text-[var(--on-surface-variant)]",
  warning:
    "bg-[color-mix(in_srgb,var(--secondary)_14%,transparent)] text-[var(--secondary)]",
  info: "bg-[var(--primary-fixed)] text-[var(--primary)]",
  neutral: "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]",
};

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}
