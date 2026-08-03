import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function TermsPage() {
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
        {t("terms.title")}
      </h1>
      <p className="mt-4 leading-7 text-[var(--on-surface-variant)]">
        {t("terms.body")}
      </p>
      <ul className="mt-6 list-disc space-y-2 ps-5 text-[var(--on-surface-variant)]">
        <li>{t("terms.points.1")}</li>
        <li>{t("terms.points.2")}</li>
        <li>{t("terms.points.3")}</li>
      </ul>
      <p className="mt-8 text-sm text-[var(--on-surface-variant)]">
        <Link href="/privacy" className="text-[var(--primary)] hover:underline">
          {t("privacy.title")}
        </Link>
      </p>
    </main>
  );
}
