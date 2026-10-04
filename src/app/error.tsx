"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common.errorBoundary");
  useEffect(() => {
    console.error("[app-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
        {t("rootTitle")}
      </h1>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
        {t("rootBody")}
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-[var(--outline)]" dir="ltr">
          {t("reference", { digest: error.digest })}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
        >
          {t("retry")}
        </button>
        <Link
          href="/avatars"
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)]"
        >
          {t("patientLibrary")}
        </Link>
      </div>
    </main>
  );
}
