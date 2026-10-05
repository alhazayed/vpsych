"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const t = useTranslations("common.errorBoundary");

  useEffect(() => {
    console.error("[app-shell-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-[640px] px-4 py-12 md:px-8">
      <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
        {t("segmentTitle")}
      </h1>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
        {isAdmin ? t("segmentBodyAdmin") : t("segmentBodyLearner")}
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-[var(--outline)]" dir="ltr">
          {t("reference", { digest: error.digest })}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
        >
          {t("retry")}
        </button>
        <Link
          href={isAdmin ? "/admin" : "/sessions"}
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium"
        >
          {isAdmin ? t("adminOverview") : t("mySessions")}
        </Link>
      </div>
    </div>
  );
}
