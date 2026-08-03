import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AEO_FAQS, type FaqCategory } from "@/lib/aeo/knowledge";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo/schema";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aeo");
  const canonical = absoluteUrl("/faq");
  return {
    title: t("faqTitle"),
    description: t("faqDescription"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/faq", "en"),
        ar: hreflangUrl("/faq", "ar"),
        "x-default": canonical,
      },
    },
    openGraph: {
      title: t("faqTitle"),
      description: t("faqDescription"),
      url: canonical,
      type: "website",
    },
  };
}

const CATEGORIES: FaqCategory[] = [
  "product",
  "medical",
  "educational",
  "clinical",
];

export default async function FaqPage() {
  const t = await getTranslations("aeo");

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <JsonLd
        data={[
          faqPageSchema(
            AEO_FAQS.map((f) => ({
              question: f.question,
              answer: f.answer,
            })),
          ),
          breadcrumbSchema([
            { name: "VPsych", path: "/" },
            { name: t("faqTitle"), path: "/faq" },
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
            <Link href="/about" className="text-[var(--primary)] hover:underline">
              {t("navAbout")}
            </Link>
            <LanguageSwitcher compact />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
          {t("faqTitle")}
        </h1>
        <p className="mt-3 text-[var(--on-surface-variant)]">{t("faqDescription")}</p>

        {CATEGORIES.map((cat) => {
          const items = AEO_FAQS.filter((f) => f.category === cat);
          return (
            <section
              key={cat}
              className="mt-10"
              aria-labelledby={`faq-${cat}`}
            >
              <h2
                id={`faq-${cat}`}
                className="text-xl font-semibold text-[var(--primary)]"
              >
                {t(`faqCategories.${cat}`)}
              </h2>
              <div className="mt-4 space-y-4">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-5"
                  >
                    <h3 className="font-semibold text-[var(--primary)]">
                      {item.question}
                    </h3>
                    <p className="mt-2 leading-7 text-[var(--on-surface-variant)]">
                      {item.answer}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
