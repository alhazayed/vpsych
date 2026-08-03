import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo");
  const canonical = absoluteUrl("/site-map");
  return {
    title: t("sitemapTitle"),
    description: t("sitemapDescription"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/site-map", "en"),
        ar: hreflangUrl("/site-map", "ar"),
        "x-default": canonical,
      },
    },
    openGraph: {
      title: t("sitemapTitle"),
      description: t("sitemapDescription"),
      url: canonical,
      type: "website",
    },
  };
}

const LINKS = [
  { href: "/", key: "home" as const },
  { href: "/about", key: "about" as const },
  { href: "/faq", key: "faq" as const },
  { href: "/contact", key: "contact" as const },
  { href: "/research", key: "research" as const },
  { href: "/clinical", key: "clinical" as const },
  { href: "/help", key: "help" as const },
  { href: "/pricing", key: "pricing" as const },
  { href: "/terms", key: "terms" as const },
  { href: "/privacy", key: "privacy" as const },
  { href: "/login", key: "login" as const },
  { href: "/signup", key: "signup" as const },
  { href: "/llms.txt", key: "llms" as const },
  { href: "/knowledge-graph.json", key: "knowledgeGraph" as const },
  { href: "/citations.json", key: "citations" as const },
  { href: "/rss.xml", key: "rss" as const },
  { href: "/sitemap.xml", key: "xmlSitemap" as const },
  { href: "/robots.txt", key: "robots" as const },
] as const;

export default async function HtmlSitemapPage() {
  const t = await getTranslations("seo");

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <JsonLd
        data={breadcrumbSchema([
          { name: "VPsych", path: "/" },
          { name: t("sitemapTitle"), path: "/site-map" },
        ])}
      />
      <header className="border-b border-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-headline)] text-lg font-bold text-[var(--primary)]"
          >
            VPsych
          </Link>
          <LanguageSwitcher compact />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
          {t("sitemapTitle")}
        </h1>
        <p className="mt-3 text-[var(--on-surface-variant)]">
          {t("sitemapDescription")}
        </p>
        <nav aria-label={t("sitemapTitle")} className="mt-8">
          <ul className="space-y-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  {t(`links.${link.key}`)}
                </Link>
                <span className="ms-2 text-sm text-[var(--on-surface-variant)]">
                  {link.href}
                </span>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-10 text-sm text-[var(--on-surface-variant)]">
          {t("privateNote")}
        </p>
      </main>
    </div>
  );
}
