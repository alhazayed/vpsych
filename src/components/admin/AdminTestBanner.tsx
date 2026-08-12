"use client";

import { useTranslations } from "next-intl";
import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";

/**
 * Visible TEST MODE chrome. Banner text is driven by server session marker,
 * not by ?adminTest=1 query params.
 */
export function AdminTestBanner({
  clinicalSnapshot,
}: {
  clinicalSnapshot: unknown;
}) {
  const t = useTranslations("session.adminTest");
  if (!isAdminTestSnapshot(clinicalSnapshot)) return null;

  return (
    <div
      role="status"
      className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-high)] px-4 py-2 text-center"
    >
      <p className="text-xs font-semibold tracking-wide text-[var(--on-surface)]">
        {t("banner")}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--on-surface-variant)]">
        {t("hint")}
      </p>
    </div>
  );
}
