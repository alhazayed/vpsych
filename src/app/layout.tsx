import type { Metadata } from "next";
import { Newsreader, Source_Sans_3, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { localeDirection, type AppLocale } from "@/i18n/config";
import "./globals.css";

// "Case file" design: Newsreader serif for English headings and names, Noto
// Kufi Arabic for Arabic headings, Source Sans 3 and Noto Sans Arabic for
// text. Kufi is declared in globals.css, not here: --font-headline puts it
// first, limited to Arabic code points, because next/font's "Newsreader
// Fallback" is local(Times New Roman), which has Arabic glyphs on Windows and
// macOS and would otherwise catch Arabic headings before Kufi.
const serifLatin = Newsreader({
  variable: "--font-serif-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Self-hosted (Noto Sans Arabic v33, arabic subset, variable 400-700; SIL
// OFL). Fetching Arabic from Google Fonts at build time broke Turbopack
// builds whenever Google served /l/font?kit=…&skey=… URLs ("next/font/google
// queries have exactly one entry").
const arabic = localFont({
  src: "./fonts/NotoSansArabic-arabic-variable.woff2",
  variable: "--font-arabic",
  weight: "400 700",
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
      className={`${serifLatin.variable} ${body.variable} ${arabic.variable} ${mono.variable} h-full antialiased`}
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
