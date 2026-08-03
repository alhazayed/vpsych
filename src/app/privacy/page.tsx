import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-semibold text-[var(--on-surface)]">
        {t("title")}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--on-surface-variant)]">
        {t("body")}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium"
        >
          {t("home")}
        </Link>
        <Link
          href="/login"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
        >
          {t("signIn")}
        </Link>
      </div>
    </main>
  );
}
