"use client";

/**
 * Last-resort error UI when the root layout itself fails.
 * Must define its own <html>/<body> (Next.js requirement).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f4f1",
          color: "#1c1917",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          {/* The root layout (and next-intl) failed, so show both locales. */}
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>VPsych unavailable</h1>
          <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 12 }}>
            A critical error occurred. Reload to try again.
          </p>
          <h2 dir="rtl" lang="ar" style={{ fontSize: 20, marginBottom: 8 }}>
            تعذّر تشغيل VPsych
          </h2>
          <p
            dir="rtl"
            lang="ar"
            style={{ fontSize: 14, opacity: 0.75, marginBottom: 12 }}
          >
            حدث خطأ جسيم. أعد التحميل للمحاولة مجدداً.
          </p>
          {error.digest ? (
            <p
              dir="ltr"
              style={{ fontSize: 12, opacity: 0.6, marginBottom: 20, fontFamily: "monospace" }}
            >
              {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 8,
              padding: "10px 16px",
              background: "#0f766e",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload · إعادة التحميل
          </button>
        </main>
      </body>
    </html>
  );
}
