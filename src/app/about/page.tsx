import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  aeoMedicalOrganizationSchema,
  aeoOrganizationSchema,
  aeoSoftwareSchema,
  ENTITY_RELATIONSHIPS,
  VPSYCH_ENTITY,
} from "@/lib/aeo/knowledge";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aeo");
  const canonical = absoluteUrl("/about");
  return {
    title: t("aboutTitle"),
    description: t("aboutDescription"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/about", "en"),
        ar: hreflangUrl("/about", "ar"),
        "x-default": canonical,
      },
    },
    openGraph: {
      title: t("aboutTitle"),
      description: t("aboutDescription"),
      url: canonical,
      type: "article",
    },
  };
}

export default async function AboutPage() {
  const t = await getTranslations("aeo");
  const e = VPSYCH_ENTITY;

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <JsonLd
        data={[
          aeoOrganizationSchema(),
          aeoSoftwareSchema(),
          aeoMedicalOrganizationSchema(),
          breadcrumbSchema([
            { name: "VPsych", path: "/" },
            { name: t("aboutTitle"), path: "/about" },
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
          <nav aria-label="Secondary" className="flex items-center gap-4 text-sm">
            <Link href="/faq" className="text-[var(--primary)] hover:underline">
              {t("navFaq")}
            </Link>
            <Link href="/site-map" className="text-[var(--primary)] hover:underline">
              {t("navSitemap")}
            </Link>
            <LanguageSwitcher compact />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <article>
          <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
            {t("aboutTitle")}
          </h1>
          <p className="mt-4 text-lg text-[var(--on-surface-variant)]">{e.tagline}</p>

          <section className="mt-10" aria-labelledby="company">
            <h2 id="company" className="text-xl font-semibold text-[var(--primary)]">
              {t("sections.company")}
            </h2>
            <p className="mt-3 leading-7">{t("companyBody")}</p>
          </section>

          <section className="mt-10" aria-labelledby="product">
            <h2 id="product" className="text-xl font-semibold text-[var(--primary)]">
              {t("sections.product")}
            </h2>
            <p className="mt-3 leading-7">{e.purpose}</p>
          </section>

          <section className="mt-10" aria-labelledby="purpose">
            <h2 id="purpose" className="text-xl font-semibold text-[var(--primary)]">
              {t("sections.purpose")}
            </h2>
            <p className="mt-3 leading-7">{e.educationalPurpose}</p>
          </section>

          <section className="mt-10" aria-labelledby="users">
            <h2 id="users" className="text-xl font-semibold text-[var(--primary)]">
              {t("sections.users")}
            </h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 leading-7">
              {e.targetUsers.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </section>

          <section className="mt-10" aria-labelledby="features">
            <h2 id="features" className="text-xl font-semibold text-[var(--primary)]">
              {t("sections.features")}
            </h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 leading-7">
              {e.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>

          <section className="mt-10" aria-labelledby="evidence">
            <h2 id="evidence" className="text-xl font-semibold text-[var(--primary)]">
              {t("sections.evidence")}
            </h2>
            <p className="mt-3 leading-7">{e.clinicalEvidenceStance}</p>
            <ul className="mt-3 list-disc space-y-2 ps-5 leading-7">
              {e.notClaims.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>

          <section className="mt-10" aria-labelledby="entities">
            <h2 id="entities" className="text-xl font-semibold text-[var(--primary)]">
              {t("sections.entities")}
            </h2>
            <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
              {t("entitiesIntro")}
            </p>
            <ul className="mt-3 space-y-2 font-mono text-sm leading-6">
              {ENTITY_RELATIONSHIPS.map((r) => (
                <li key={`${r.subject}-${r.predicate}-${r.object}`}>
                  {r.subject} —[{r.predicate}]→ {r.object}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10" aria-labelledby="ai-docs">
            <h2 id="ai-docs" className="text-xl font-semibold text-[var(--primary)]">
              {t("sections.aiDocs")}
            </h2>
            <ul className="mt-3 list-disc space-y-2 ps-5">
              <li>
                <Link href="/llms.txt" className="text-[var(--primary)] underline">
                  /llms.txt
                </Link>
              </li>
              <li>
                <Link
                  href="/knowledge-graph.json"
                  className="text-[var(--primary)] underline"
                >
                  /knowledge-graph.json
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-[var(--primary)] underline">
                  /faq
                </Link>
              </li>
            </ul>
          </section>
        </article>
      </main>
    </div>
  );
}
