import type { Metadata } from "next";
import { Inter, Montserrat, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { localeDirection, type AppLocale } from "@/i18n/config";
import "./globals.css";

const headline = Montserrat({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const arabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
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
  const dir = localeDirection(locale);

  // Only attach Arabic font CSS variable on AR locales so EN pages do not
  // preload Noto Sans Arabic (saves a render-critical font request).
  const fontVars = [
    headline.variable,
    body.variable,
    locale === "ar" ? arabic.variable : null,
    mono.variable,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${fontVars} h-full antialiased`}
    >
      <body
        className={`min-h-full flex flex-col font-[family-name:var(--font-body)] ${
          locale === "ar" ? "font-arabic" : ""
        }`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
