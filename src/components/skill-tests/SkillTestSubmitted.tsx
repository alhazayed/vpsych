import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** End-of-session screen for a skill test: no transcript, no results. */
export async function SkillTestSubmitted({
  sessionNumber,
}: {
  sessionNumber: number | null;
}) {
  const t = await getTranslations("skillTests.complete");
  return (
    <main className="mx-auto max-w-lg px-4 py-12 text-center md:py-16">
      <span className="status-chip status-chip-done mb-4">{t("badge")}</span>
      <h1 className="mt-4 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
        {sessionNumber ? t("titleN", { n: sessionNumber }) : t("title")}
      </h1>
      <p className="mt-3 text-[var(--on-surface-variant)]">{t("body")}</p>
      <Link href="/tests" className="btn-primary mt-8 inline-flex">
        {t("back")}
      </Link>
    </main>
  );
}
