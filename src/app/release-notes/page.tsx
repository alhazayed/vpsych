import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { MarketingDocShell } from "@/components/MarketingDocShell";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("releaseNotes");
  const canonical = absoluteUrl("/release-notes");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/release-notes", "en"),
        ar: hreflangUrl("/release-notes", "ar"),
        "x-default": canonical,
      },
    },
  };
}

const VERSIONS = ["rc1", "m29", "m28", "m27", "m26"] as const;

export default async function ReleaseNotesPage() {
  const t = await getTranslations("releaseNotes");

  return (
    <MarketingDocShell
      nav={[
        { href: "/help", label: t("navHelp") },
        { href: "/about", label: t("navAbout") },
      ]}
    >
      <JsonLd
        data={breadcrumbSchema([
          { name: "VPsych", path: "/" },
          { name: t("title"), path: "/release-notes" },
        ])}
      />
      <article>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg leading-8 text-[var(--on-surface-variant)]">
          {t("lead")}
        </p>
        <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
          {t("statusNote")}
        </p>

        {VERSIONS.map((key) => (
          <section key={key} className="mt-10" aria-labelledby={key}>
            <h2
              id={key}
              className="text-xl font-semibold text-[var(--primary)]"
            >
              {t(`versions.${key}.title`)}
            </h2>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              {t(`versions.${key}.date`)}
            </p>
            <ul className="mt-3 list-disc space-y-2 ps-5 leading-7">
              {(["1", "2", "3"] as const).map((n) => (
                <li key={n}>{t(`versions.${key}.items.${n}`)}</li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-10 text-sm">
          <Link
            href="/launch-readiness.json"
            className="text-[var(--primary)] underline"
          >
            /launch-readiness.json
          </Link>
        </p>
      </article>
    </MarketingDocShell>
  );
}
