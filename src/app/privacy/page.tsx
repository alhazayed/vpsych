import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-6 py-16 outline-none"
    >
      <p className="mb-2 text-sm text-[var(--on-surface-variant)]">
        <Link href="/" className="text-[var(--primary)] hover:underline">
          VPsych
        </Link>
      </p>
      <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold text-[var(--primary)]">
        {t("privacy.title")}
      </h1>
      <p className="mt-4 leading-7 text-[var(--on-surface-variant)]">
        {t("privacy.body")}
      </p>
      <ul className="mt-6 list-disc space-y-2 ps-5 text-[var(--on-surface-variant)]">
        <li>{t("privacy.points.1")}</li>
        <li>{t("privacy.points.2")}</li>
        <li>{t("privacy.points.3")}</li>
      </ul>

      <section className="mt-12 border-t border-[var(--outline-variant)] pt-10">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--primary)]">
          {t("clinical.title")}
        </h2>
        <p className="mt-3 leading-7 text-[var(--on-surface-variant)]">
          {t("clinical.body")}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--primary)]">
          {t("educational.title")}
        </h2>
        <p className="mt-3 leading-7 text-[var(--on-surface-variant)]">
          {t("educational.body")}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--primary)]">
          {t("ai.title")}
        </h2>
        <p className="mt-3 leading-7 text-[var(--on-surface-variant)]">
          {t("ai.body")}
        </p>
      </section>

      <p className="mt-10 text-sm text-[var(--on-surface-variant)]">
        <Link href="/terms" className="text-[var(--primary)] hover:underline">
          {t("terms.title")}
        </Link>
      </p>
    </main>
  );
}
