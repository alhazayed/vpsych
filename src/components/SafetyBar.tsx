"use client";

import { useTranslations } from "next-intl";

export function SafetyBar({
  visible,
  message,
  onDiscard,
  onSave,
}: {
  visible: boolean;
  message: string;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const t = useTranslations("common.safety");

  return (
    <footer
      className={`fixed bottom-0 start-0 end-0 z-[60] flex h-16 items-center justify-end gap-4 border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 shadow-md transition-transform duration-300 md:start-64 md:px-8 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="me-auto flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
        <span className="material-symbols-outlined text-[var(--error)]">
          report_problem
        </span>
        <span className="font-medium">{message}</span>
      </div>
      <button
        type="button"
        onClick={onDiscard}
        className="px-4 py-2 text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
      >
        {t("discard")}
      </button>
      <button type="button" onClick={onSave} className="btn-primary rounded-xl">
        {t("confirmSave")}
      </button>
    </footer>
  );
}
