"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
        An unexpected error interrupted this page. You can retry or return to
        the patient library.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
        >
          Try again
        </button>
        <Link
          href="/avatars"
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)]"
        >
          Patient library
        </Link>
      </div>
    </main>
  );
}
