import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common.errorBoundary");
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
        404
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-semibold text-[var(--on-surface)]">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
        {t("notFoundBody")}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium"
        >
          {t("home")}
        </Link>
        <Link
          href="/avatars"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
        >
          {t("patientLibrary")}
        </Link>
      </div>
    </main>
  );
}
