"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { fontVariables } from "./fonts";
import "./globals.css";

/**
 * Last-resort error UI when the root layout itself fails.
 * Must define its own <html>/<body> (Next.js requirement), so it brings its
 * own fonts and globals.css to keep the Case file look.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full items-center justify-center px-4 py-16">
        {/* React hoists this into <head>; the root layout's metadata is gone. */}
        <title>Vtraining unavailable</title>
        {/* The root layout (and next-intl) failed, so show both locales. */}
        <main className="w-full max-w-md rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-8 shadow-[0_10px_30px_rgba(27,42,65,0.08)]">
          <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
            Vtraining unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
            A critical error occurred. Reload to try again.
          </p>
          <div dir="rtl" lang="ar" className="mt-6 border-t border-[var(--outline-variant)] pt-6">
            <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
              تعذّر تشغيل Vtraining
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
              حدث خطأ جسيم. أعد التحميل للمحاولة مجدداً.
            </p>
          </div>
          {error.digest ? (
            <p dir="ltr" className="mt-6 font-mono text-xs text-[var(--outline)]">
              {error.digest}
            </p>
          ) : null}
          <button type="button" onClick={reset} className="btn-primary mt-6 w-full">
            Reload · إعادة التحميل
          </button>
        </main>
      </body>
    </html>
  );
}
