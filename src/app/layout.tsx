import type { Metadata } from "next";
import { Newsreader, Source_Sans_3, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { localeDirection, type AppLocale } from "@/i18n/config";
import "./globals.css";

// "Case file" design: Newsreader serif for English headings and names, Noto
// Kufi Arabic for Arabic headings, Source Sans 3 and Noto Sans Arabic for
// text. Both Arabic fonts are declared in globals.css, not here:
// --font-headline and --font-text put them first, limited to Arabic code
// points, because next/font's fallback faces (local Times New Roman for
// Newsreader, local Arial for Source Sans 3) have Arabic glyphs on Windows
// and macOS and would otherwise catch Arabic text first.
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
      className={`${serifLatin.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
