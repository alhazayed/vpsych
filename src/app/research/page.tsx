import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  authorSchema,
  GEO_BRAND,
  GEO_CITATIONS,
  howToCiteVpsych,
  researchArticleSchema,
  scholarlyCitationSchemas,
} from "@/lib/geo/citations";
import { aeoOrganizationSchema, aeoSoftwareSchema } from "@/lib/aeo/knowledge";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("geo");
  const canonical = absoluteUrl("/research");
  return {
    title: t("researchTitle"),
    description: t("researchDescription"),
    authors: [{ name: "VPsych Editorial", url: absoluteUrl("/about") }],
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/research", "en"),
        ar: hreflangUrl("/research", "ar"),
        "x-default": canonical,
      },
    },
    openGraph: {
      title: t("researchTitle"),
      description: t("researchDescription"),
      url: canonical,
      type: "article",
    },
  };
}

export default async function ResearchPage() {
  const t = await getTranslations("geo");
  const cite = howToCiteVpsych();

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <JsonLd
        data={[
          aeoOrganizationSchema(),
          aeoSoftwareSchema(),
          authorSchema(),
          researchArticleSchema(),
          ...scholarlyCitationSchemas(),
          breadcrumbSchema([
            { name: "VPsych", path: "/" },
            { name: t("researchTitle"), path: "/research" },
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
            <Link href="/clinical" className="text-[var(--primary)] hover:underline">
              {t("navClinical")}
            </Link>
            <LanguageSwitcher compact />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <article>
          <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
            {t("researchTitle")}
          </h1>
          <p id="geo-summary" className="mt-4 text-lg leading-8 text-[var(--on-surface-variant)]">
            {GEO_BRAND.oneLiner}
          </p>

          <section className="mt-10" aria-labelledby="stance">
            <h2 id="stance" className="text-xl font-semibold text-[var(--primary)]">
              {t("evidenceHeading")}
            </h2>
            <p className="mt-3 leading-7">{t("evidenceBody")}</p>
          </section>

          <section className="mt-10" aria-labelledby="how-to-cite">
            <h2 id="how-to-cite" className="text-xl font-semibold text-[var(--primary)]">
              {t("citeHeading")}
            </h2>
            <p className="mt-3 text-sm text-[var(--on-surface-variant)]">{t("citeIntro")}</p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-[var(--surface-container-low)] p-4 text-xs leading-5">
              {cite.apa}
            </pre>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--surface-container-low)] p-4 text-xs leading-5">
              {cite.bibtex}
            </pre>
          </section>

          <section className="mt-10" aria-labelledby="refs">
            <h2 id="refs" className="text-xl font-semibold text-[var(--primary)]">
              {t("refsHeading")}
            </h2>
            <p className="mt-3 text-sm text-[var(--on-surface-variant)]">{t("refsIntro")}</p>
            <ol className="mt-4 list-decimal space-y-6 ps-5">
              {GEO_CITATIONS.map((c) => (
                <li key={c.id} id={c.id} className="leading-7">
                  <strong>
                    {c.authors} ({c.year}).
                  </strong>{" "}
                  <em>{c.title}</em>. {c.venue}.
                  {c.url ? (
                    <>
                      {" "}
                      <a
                        href={c.url}
                        className="text-[var(--primary)] underline"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {c.url}
                      </a>
                    </>
                  ) : null}
                  <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                    <span className="font-semibold uppercase tracking-wide">
                      {c.kind}
                    </span>
                    {" — "}
                    {c.howVpsychRelates}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <p className="mt-10 text-sm">
            <Link href="/citations.json" className="text-[var(--primary)] underline">
              /citations.json
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
