"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-shell-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-[640px] px-4 py-12 md:px-8">
      <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
        This view failed to load
      </h1>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
        The authenticated workspace hit an unexpected error. Retry the view or
        continue from My Sessions.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
        >
          Retry
        </button>
        <Link
          href="/sessions"
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium"
        >
          My Sessions
        </Link>
      </div>
    </div>
  );
}
