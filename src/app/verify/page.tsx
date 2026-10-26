import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeCertificateNumber,
  verifyCertificateNumber,
  type VerifyResult,
} from "@/lib/certificate-registry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("verify");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

async function check(code: string): Promise<VerifyResult | "rate_limited"> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const limited = await rateLimit(`cert-verify:${ip}`, 60, 60 * 60 * 1000);
  if (!limited.ok) return "rate_limited";
  return verifyCertificateNumber(await createClient(), code);
}

/**
 * Public certificate check. Anyone holding a printed Vtraining certificate
 * (or its QR link) can confirm the number is recorded and not revoked.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const t = await getTranslations("verify");
  const locale = await getLocale();
  const raw = (await searchParams).code;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 64) ?? "";
  const result = code ? await check(code) : null;
  const shownNumber = normalizeCertificateNumber(code) ?? code;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--on-surface)]">
      <header className="flex w-full items-center justify-between px-4 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2" aria-label={t("home")}>
          <Image
            src="/vtraining-logo.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg object-cover"
            priority
          />
          <span className="font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--primary)]">
            Vtraining
          </span>
        </Link>
        <LanguageSwitcher />
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 outline-none">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{t("intro")}</p>

        <form method="get" action="/verify" className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-sm font-medium">{t("label")}</span>
            <input
              name="code"
              defaultValue={shownNumber}
              required
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              placeholder="VT-XXXX-XXXX-XXXX"
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-base tabular-nums tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
            />
          </label>
          <button type="submit" className="btn-primary min-h-11 px-6">
            {t("submit")}
          </button>
        </form>

        <div aria-live="polite" className="mt-6">
          {result ? <Outcome result={result} number={shownNumber} locale={locale} t={t} /> : null}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-[var(--on-surface-variant)]">
          {t("disclaimer")}
        </p>
      </main>
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"verify">>>;

function Outcome({
  result,
  number,
  locale,
  t,
}: {
  result: VerifyResult | "rate_limited";
  number: string;
  locale: string;
  t: T;
}) {
  if (result === "rate_limited") return <Notice tone="error">{t("rateLimited")}</Notice>;
  if (result.status === "invalid") return <Notice tone="error">{t("invalid")}</Notice>;
  if (result.status === "unavailable") return <Notice tone="error">{t("unavailable")}</Notice>;
  if (result.status === "not_found") {
    return <Notice tone="error">{t("notFound", { number })}</Notice>;
  }

  const c = result.certificate;
  const valid = result.status === "valid";
  return (
    <section
      className={`rounded-2xl border-2 bg-[var(--surface-container-lowest)] p-5 ${
        valid ? "border-[var(--primary)]" : "border-[var(--error)]"
      }`}
    >
      <p
        className={`flex items-center gap-2 text-lg font-semibold ${
          valid ? "text-[var(--primary)]" : "text-[var(--error)]"
        }`}
      >
        <span aria-hidden className="material-symbols-outlined text-[24px]">
          {valid ? "verified" : "block"}
        </span>
        {valid ? t("valid") : t("revoked")}
      </p>
      {!valid && c.revokedAt ? (
        <p className="mt-1 text-sm text-[var(--error)]">
          {t("revokedOn", { date: formatDate(c.revokedAt, locale) })}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
        <dt className="text-[var(--on-surface-variant)]">{t("recipient")}</dt>
        <dd className="font-semibold" dir="auto">
          {c.recipientName ?? t("nameMissing")}
        </dd>
        <dt className="text-[var(--on-surface-variant)]">{t("program")}</dt>
        <dd>{t("programName")}</dd>
        {c.institutionName ? (
          <>
            <dt className="text-[var(--on-surface-variant)]">{t("institute")}</dt>
            <dd dir="auto">{c.institutionName}</dd>
          </>
        ) : null}
        <dt className="text-[var(--on-surface-variant)]">{t("issued")}</dt>
        <dd>{formatDate(c.issuedAt, locale)}</dd>
        <dt className="text-[var(--on-surface-variant)]">{t("number")}</dt>
        <dd dir="ltr" className="text-start tabular-nums">
          {c.number}
        </dd>
      </dl>
    </section>
  );
}

function Notice({ tone, children }: { tone: "error"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className="rounded-xl border border-[var(--error)] bg-[var(--surface-container-lowest)] p-4 text-sm text-[var(--error)]"
    >
      {children}
    </p>
  );
}
