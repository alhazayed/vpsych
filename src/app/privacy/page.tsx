import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { MarketingDocShell } from "@/components/MarketingDocShell";
import { getPrivacySections } from "@/lib/brand/legal-content";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";
import type { AppLocale } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  const canonical = absoluteUrl("/privacy");
  return {
    title: t("privacyTitle"),
    description: t("privacyDescription"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/privacy", "en"),
        ar: hreflangUrl("/privacy", "ar"),
        "x-default": canonical,
      },
    },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  const locale = (await getLocale()) as AppLocale;
  const sections = getPrivacySections(locale);

  return (
    <MarketingDocShell
      nav={[
        { href: "/terms", label: t("navTerms") },
        { href: "/contact", label: t("navContact") },
      ]}
    >
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: t("privacyTitle"),
            url: absoluteUrl("/privacy"),
            description: t("privacyDescription"),
            inLanguage: locale,
          },
          breadcrumbSchema([
            { name: "VPsych", path: "/" },
            { name: t("privacyTitle"), path: "/privacy" },
          ]),
        ]}
      />
      <article>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
          {t("privacyTitle")}
        </h1>
        <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
          {t("updated")}
        </p>
        <p className="mt-4 leading-7 text-[var(--on-surface-variant)]">
          {t("privacyLead")}
        </p>
        {sections.map((section) => (
          <section key={section.id} className="mt-10" aria-labelledby={section.id}>
            <h2
              id={section.id}
              className="text-xl font-semibold text-[var(--primary)]"
            >
              {section.heading}
            </h2>
            {section.body.map((p) => (
              <p key={p.slice(0, 40)} className="mt-3 leading-7">
                {p}
              </p>
            ))}
          </section>
        ))}
        <p className="mt-10 text-sm">
          <Link href="/terms" className="text-[var(--primary)] underline">
            {t("navTerms")}
          </Link>
        </p>
      </article>
    </MarketingDocShell>
  );
}
