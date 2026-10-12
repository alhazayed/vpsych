import type { Metadata } from "next";
import { IBM_Plex_Sans, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { localeDirection, type AppLocale } from "@/i18n/config";
import "./globals.css";

// "Consulting room" design: IBM Plex Sans and IBM Plex Sans Arabic are one
// family drawn for both scripts, so English and Arabic carry the same weight.
// Headings and body share it; the headline variable is kept so existing
// font-display classes keep working.
const plex = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const headline = IBM_Plex_Sans({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Self-hosted (IBM Plex Sans Arabic v15, arabic subset; SIL OFL).
// Fetching Arabic from Google Fonts at build time broke Turbopack builds
// whenever Google served /l/font?kit=…&skey=… URLs ("next/font/google queries
// have exactly one entry").
const arabic = localFont({
  src: [
    { path: "./fonts/IBMPlexSansArabic-arabic-400.woff2", weight: "400" },
    { path: "./fonts/IBMPlexSansArabic-arabic-500.woff2", weight: "500" },
    { path: "./fonts/IBMPlexSansArabic-arabic-600.woff2", weight: "600" },
    { path: "./fonts/IBMPlexSansArabic-arabic-700.woff2", weight: "700" },
  ],
  variable: "--font-arabic",
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as AppLocale;
  const messages = await getMessages();
  const tCommon = await getTranslations("common");
  const dir = localeDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${headline.variable} ${plex.variable} ${arabic.variable} ${mono.variable} h-full antialiased`}
    >
      <body
        className={`min-h-full flex flex-col font-[family-name:var(--font-body)] ${
          locale === "ar" ? "font-arabic" : ""
        }`}
      >
        {/* Pages mark their main content with id="main-content". */}
        <a href="#main-content" className="skip-link">
          {tCommon("skipToContent")}
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
