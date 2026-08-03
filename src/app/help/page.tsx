import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { MarketingDocShell } from "@/components/MarketingDocShell";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  const canonical = absoluteUrl("/help");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/help", "en"),
        ar: hreflangUrl("/help", "ar"),
        "x-default": canonical,
      },
    },
  };
}

const TOPICS = [
  { href: "/faq", key: "faq" as const },
  { href: "/clinical", key: "clinical" as const },
  { href: "/research", key: "research" as const },
  { href: "/pricing", key: "pricing" as const },
  { href: "/contact", key: "contact" as const },
  { href: "/terms", key: "terms" as const },
  { href: "/privacy", key: "privacy" as const },
] as const;

export default async function HelpPage() {
  const t = await getTranslations("help");

  return (
    <MarketingDocShell
      nav={[
        { href: "/faq", label: t("navFaq") },
        { href: "/contact", label: t("navContact") },
      ]}
    >
      <JsonLd
        data={breadcrumbSchema([
          { name: "VPsych", path: "/" },
          { name: t("title"), path: "/help" },
        ])}
      />
      <article>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg leading-8 text-[var(--on-surface-variant)]">
          {t("lead")}
        </p>

        <section className="mt-10" aria-labelledby="audiences">
          <h2 id="audiences" className="text-xl font-semibold text-[var(--primary)]">
            {t("audiencesHeading")}
          </h2>
          <ul className="mt-3 list-disc space-y-2 ps-5 leading-7">
            <li>{t("audiences.learner")}</li>
            <li>{t("audiences.faculty")}</li>
            <li>{t("audiences.institution")}</li>
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="topics">
          <h2 id="topics" className="text-xl font-semibold text-[var(--primary)]">
            {t("topicsHeading")}
          </h2>
          <ul className="mt-4 space-y-3">
            {TOPICS.map((topic) => (
              <li key={topic.href}>
                <Link
                  href={topic.href}
                  className="text-[var(--primary)] underline"
                >
                  {t(`topics.${topic.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </MarketingDocShell>
  );
}
