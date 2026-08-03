import { absoluteUrl, getSiteOrigin, SITE_NAME } from "@/lib/seo/site";

export type FaqItem = { question: string; answer: string };

export function organizationSchema() {
  const origin = getSiteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: origin,
    logo: absoluteUrl("/icon-512.png"),
    description:
      "VPsych provides AI-powered standardized patient simulations for mental health professional training.",
    sameAs: [] as string[],
  };
}

export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: getSiteOrigin(),
    description:
      "Bilingual (English/Arabic) clinical assessment platform with AI patient avatars, competency tracking, and instructor analytics.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

/** Educational training org — not a claim of a licensed hospital. */
export function medicalOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    name: SITE_NAME,
    url: getSiteOrigin(),
    description:
      "Educational simulation platform for psychiatric and psychotherapy skills training. Not a clinical care provider.",
    medicalSpecialty: "Psychiatric",
  };
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function articleSchema(opts: {
  title: string;
  description: string;
  path?: string;
  datePublished?: string;
  dateModified?: string;
  inLanguage?: string;
}) {
  const url = absoluteUrl(opts.path ?? "/");
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/icon-512.png"),
      },
    },
    datePublished: opts.datePublished ?? "2026-07-30",
    dateModified: opts.dateModified ?? new Date().toISOString().slice(0, 10),
    inLanguage: opts.inLanguage ?? "en",
  };
}

export function breadcrumbSchema(
  crumbs: { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: getSiteOrigin(),
    inLanguage: ["en", "ar"],
  };
}
