import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
        404
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-semibold text-[var(--on-surface)]">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
        The page you requested does not exist or is no longer available.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium"
        >
          Home
        </Link>
        <Link
          href="/avatars"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
        >
          Patient library
        </Link>
      </div>
    </main>
  );
}
