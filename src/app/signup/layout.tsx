import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { absoluteUrl, hreflangUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo");
  const canonical = absoluteUrl("/signup");
  return {
    title: t("signupTitle"),
    description: t("signupDescription"),
    alternates: {
      canonical,
      languages: {
        en: hreflangUrl("/signup", "en"),
        ar: hreflangUrl("/signup", "ar"),
        "x-default": canonical,
      },
    },
    openGraph: {
      title: t("signupTitle"),
      description: t("signupDescription"),
      url: canonical,
    },
    robots: { index: true, follow: true },
  };
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
