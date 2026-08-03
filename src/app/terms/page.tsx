import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { MarketingDocShell } from "@/components/MarketingDocShell";
import { getTermsSections } from "@/lib/brand/legal-content";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";
import type { AppLocale } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  const canonical = absoluteUrl("/terms");
  return {
    title: t("termsTitle"),
    description: t("termsDescription"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/terms", "en"),
        ar: hreflangUrl("/terms", "ar"),
        "x-default": canonical,
      },
    },
  };
}

export default async function TermsPage() {
  const t = await getTranslations("legal");
  const locale = (await getLocale()) as AppLocale;
  const sections = getTermsSections(locale);

  return (
    <MarketingDocShell
      nav={[
        { href: "/privacy", label: t("navPrivacy") },
        { href: "/contact", label: t("navContact") },
      ]}
    >
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: t("termsTitle"),
            url: absoluteUrl("/terms"),
            description: t("termsDescription"),
            inLanguage: locale,
          },
          breadcrumbSchema([
            { name: "VPsych", path: "/" },
            { name: t("termsTitle"), path: "/terms" },
          ]),
        ]}
      />
      <article>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
          {t("termsTitle")}
        </h1>
        <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
          {t("updated")}
        </p>
        <p className="mt-4 leading-7 text-[var(--on-surface-variant)]">
          {t("termsLead")}
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
          <Link href="/privacy" className="text-[var(--primary)] underline">
            {t("navPrivacy")}
          </Link>
        </p>
      </article>
    </MarketingDocShell>
  );
}
