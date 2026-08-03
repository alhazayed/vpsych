import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";
import LoginPage from "./page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo");
  const canonical = absoluteUrl("/login");
  return {
    title: t("loginTitle"),
    description: t("loginDescription"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/login", "en"),
        ar: hreflangUrl("/login", "ar"),
        "x-default": canonical,
      },
    },
    openGraph: {
      title: t("loginTitle"),
      description: t("loginDescription"),
      url: canonical,
    },
    robots: { index: true, follow: true },
  };
}

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <Suspense
      fallback={
        <main className="p-8 text-[var(--on-surface-variant)]">{t("loading")}</main>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
