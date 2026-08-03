import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { authorSchema, contactPageSchema, GEO_BRAND } from "@/lib/geo/citations";
import { aeoOrganizationSchema } from "@/lib/aeo/knowledge";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("geo");
  const canonical = absoluteUrl("/contact");
  return {
    title: t("contactTitle"),
    description: t("contactDescription"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/contact", "en"),
        ar: hreflangUrl("/contact", "ar"),
        "x-default": canonical,
      },
    },
    openGraph: {
      title: t("contactTitle"),
      description: t("contactDescription"),
      url: canonical,
    },
  };
}

export default async function ContactPage() {
  const t = await getTranslations("geo");

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <JsonLd
        data={[
          aeoOrganizationSchema(),
          authorSchema(),
          contactPageSchema(),
          breadcrumbSchema([
            { name: "VPsych", path: "/" },
            { name: t("contactTitle"), path: "/contact" },
          ]),
        ]}
      />
      <header className="border-b border-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-headline)] text-lg font-bold text-[var(--primary)]"
          >
            VPsych
          </Link>
          <nav className="flex items-center gap-4 text-sm" aria-label="Secondary">
            <Link href="/about" className="text-[var(--primary)] hover:underline">
              {t("navAbout")}
            </Link>
            <LanguageSwitcher compact />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <article>
          <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
            {t("contactTitle")}
          </h1>
          <p className="mt-3 text-[var(--on-surface-variant)]">
            {t("contactDescription")}
          </p>

          <section className="mt-10" aria-labelledby="email">
            <h2 id="email" className="text-xl font-semibold text-[var(--primary)]">
              {t("emailHeading")}
            </h2>
            <p className="mt-3 leading-7">
              <a
                className="text-[var(--primary)] underline"
                href={`mailto:${GEO_BRAND.contactEmail}`}
              >
                {GEO_BRAND.contactEmail}
              </a>
            </p>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
              {t("languagesNote")}
            </p>
          </section>

          <section className="mt-10" aria-labelledby="topics">
            <h2 id="topics" className="text-xl font-semibold text-[var(--primary)]">
              {t("topicsHeading")}
            </h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 leading-7">
              <li>{t("topics.institutional")}</li>
              <li>{t("topics.support")}</li>
              <li>{t("topics.press")}</li>
              <li>{t("topics.research")}</li>
            </ul>
          </section>

          <section className="mt-10" aria-labelledby="docs">
            <h2 id="docs" className="text-xl font-semibold text-[var(--primary)]">
              {t("docsHeading")}
            </h2>
            <ul className="mt-3 list-disc space-y-2 ps-5">
              <li>
                <Link href="/about" className="text-[var(--primary)] underline">
                  /about
                </Link>
              </li>
              <li>
                <Link href="/research" className="text-[var(--primary)] underline">
                  /research
                </Link>
              </li>
              <li>
                <Link href="/clinical" className="text-[var(--primary)] underline">
                  /clinical
                </Link>
              </li>
            </ul>
          </section>
        </article>
      </main>
    </div>
  );
}
