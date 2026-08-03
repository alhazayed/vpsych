import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { MarketingDocShell } from "@/components/MarketingDocShell";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  const canonical = absoluteUrl("/pricing");
  return {
    title: t("pricing.title"),
    description: t("pricing.subtitle"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/pricing", "en"),
        ar: hreflangUrl("/pricing", "ar"),
        "x-default": canonical,
      },
    },
  };
}

export default async function PricingPage() {
  const t = await getTranslations("landing");
  const tb = await getTranslations("brand");

  return (
    <MarketingDocShell
      nav={[
        { href: "/contact", label: tb("navContact") },
        { href: "/signup", label: tb("navSignup") },
      ]}
    >
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: t("pricing.title"),
            url: absoluteUrl("/pricing"),
            description: t("pricing.subtitle"),
          },
          breadcrumbSchema([
            { name: "VPsych", path: "/" },
            { name: t("pricing.title"), path: "/pricing" },
          ]),
        ]}
      />
      <article>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
          {t("pricing.title")}
        </h1>
        <p className="mt-3 text-lg text-[var(--on-surface-variant)]">
          {t("pricing.subtitle")}
        </p>
        <p className="mt-4 text-sm leading-6 text-[var(--on-surface-variant)]">
          {tb("pricingNote")}
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] p-6">
            <div className="text-sm text-[var(--on-surface-variant)]">
              {t("pricing.free.name")}
            </div>
            <div className="mt-2 font-[family-name:var(--font-headline)] text-4xl font-bold text-[var(--primary)]">
              {t("pricing.free.price")}
            </div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--on-surface-variant)]">
              {(["1", "2", "3"] as const).map((n) => (
                <li key={n}>{t(`pricing.free.features.${n}`)}</li>
              ))}
            </ul>
            <Link href="/signup" className="btn-secondary mt-6 inline-flex w-full justify-center py-3">
              {t("pricing.free.cta")}
            </Link>
          </div>

          <div className="rounded-[14px] border-2 border-[var(--primary)] p-6">
            <div className="text-xs font-semibold text-[var(--secondary)]">
              {t("pricing.mostPopular")}
            </div>
            <div className="mt-2 text-sm text-[var(--on-surface-variant)]">
              {t("pricing.pro.name")}
            </div>
            <div className="mt-2 font-[family-name:var(--font-headline)] text-4xl font-bold text-[var(--primary)]">
              {t("pricing.pro.price")}
              <span className="text-base font-normal">{t("pricing.perMonth")}</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--on-surface-variant)]">
              {(["1", "2", "3"] as const).map((n) => (
                <li key={n}>{t(`pricing.pro.features.${n}`)}</li>
              ))}
            </ul>
            <Link href="/signup" className="btn-primary mt-6 inline-flex w-full justify-center py-3">
              {t("pricing.pro.cta")}
            </Link>
          </div>

          <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] p-6">
            <div className="text-sm text-[var(--on-surface-variant)]">
              {t("pricing.institution.name")}
            </div>
            <div className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
              {t("pricing.institution.price")}
            </div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--on-surface-variant)]">
              {(["1", "2", "3"] as const).map((n) => (
                <li key={n}>{t(`pricing.institution.features.${n}`)}</li>
              ))}
            </ul>
            <Link href="/contact" className="btn-secondary mt-6 inline-flex w-full justify-center py-3">
              {t("pricing.institution.cta")}
            </Link>
          </div>
        </div>
      </article>
    </MarketingDocShell>
  );
}
