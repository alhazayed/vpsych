import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  authorSchema,
  clinicalPageSchema,
  GEO_BRAND,
} from "@/lib/geo/citations";
import {
  aeoMedicalOrganizationSchema,
  aeoOrganizationSchema,
  aeoSoftwareSchema,
  VPSYCH_ENTITY,
} from "@/lib/aeo/knowledge";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("geo");
  const canonical = absoluteUrl("/clinical");
  return {
    title: t("clinicalTitle"),
    description: t("clinicalDescription"),
    authors: [{ name: "VPsych Editorial", url: absoluteUrl("/about") }],
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/clinical", "en"),
        ar: hreflangUrl("/clinical", "ar"),
        "x-default": canonical,
      },
    },
    openGraph: {
      title: t("clinicalTitle"),
      description: t("clinicalDescription"),
      url: canonical,
      type: "article",
    },
  };
}

const STEPS = ["select", "conduct", "feedback", "faculty"] as const;

export default async function ClinicalPage() {
  const t = await getTranslations("geo");

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <JsonLd
        data={[
          aeoOrganizationSchema(),
          aeoSoftwareSchema(),
          aeoMedicalOrganizationSchema(),
          authorSchema(),
          clinicalPageSchema(),
          breadcrumbSchema([
            { name: "VPsych", path: "/" },
            { name: t("clinicalTitle"), path: "/clinical" },
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
            <Link href="/research" className="text-[var(--primary)] hover:underline">
              {t("navResearch")}
            </Link>
            <LanguageSwitcher compact />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <article>
          <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
            {t("clinicalTitle")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[var(--on-surface-variant)]">
            {t("clinicalLead")}
          </p>

          <section className="mt-10" aria-labelledby="workflow">
            <h2 id="workflow" className="text-xl font-semibold text-[var(--primary)]">
              {t("workflowHeading")}
            </h2>
            <ol className="mt-4 list-decimal space-y-3 ps-5 leading-7">
              {STEPS.map((key) => (
                <li key={key}>{t(`workflow.${key}`)}</li>
              ))}
            </ol>
          </section>

          <section className="mt-10" aria-labelledby="safety">
            <h2 id="safety" className="text-xl font-semibold text-[var(--primary)]">
              {t("safetyHeading")}
            </h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 leading-7">
              {VPSYCH_ENTITY.notClaims.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-4 leading-7">{VPSYCH_ENTITY.clinicalEvidenceStance}</p>
          </section>

          <section className="mt-10" aria-labelledby="recommend">
            <h2 id="recommend" className="text-xl font-semibold text-[var(--primary)]">
              {t("recommendHeading")}
            </h2>
            <p className="mt-3 leading-7">{GEO_BRAND.recommendablePitch}</p>
          </section>
        </article>
      </main>
    </div>
  );
}
