import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const FEATURE_KEYS = [
  { key: "simulations", icon: "psychology" },
  { key: "avatars", icon: "face_6" },
  { key: "feedback", icon: "assignment_turned_in" },
  { key: "analytics", icon: "analytics" },
  { key: "progress", icon: "monitoring" },
  { key: "bilingual", icon: "translate" },
] as const;

const STEP_KEYS = ["1", "2", "3"] as const;

const FAQ_KEYS = ["1", "2", "3", "4"] as const;

// Plain facts about how the platform works. No usage numbers, testimonials
// or prices: none of those exist yet, and a clinical-training product must
// not present invented figures as evidence.
const FACT_KEYS = [
  { key: "approval", icon: "verified_user" },
  { key: "bilingual", icon: "translate" },
  { key: "notValidated", icon: "info" },
] as const;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/avatars");

  const t = await getTranslations("landing");
  const year = new Date().getFullYear();

  return (
    <div className="overflow-x-hidden bg-[var(--surface)] text-[var(--on-surface)]">
      <header className="sticky top-0 z-50 border-b border-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 md:px-8">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="font-[family-name:var(--font-headline)] text-xl font-bold tracking-tight text-[var(--primary)]"
            >
              VPsych
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              <a
                href="#features"
                className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
              >
                {t("nav.features")}
              </a>
              <a
                href="#faq"
                className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
              >
                {t("nav.resources")}
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary-container)_10%,transparent)] sm:px-4"
            >
              {t("nav.login")}
            </Link>
            <Link href="/signup" className="btn-primary whitespace-nowrap">
              {t("nav.getStarted")}
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <section className="relative mx-auto max-w-[1280px] overflow-hidden px-6 pb-20 pt-12 md:px-8 md:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="z-10 fade-in-up">
              <span className="mb-4 inline-block rounded-full bg-[var(--secondary-container)] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--on-secondary-container)]">
                {t("hero.badge")}
              </span>
              <h1 className="font-[family-name:var(--font-headline)] text-4xl font-bold leading-tight tracking-tight text-[var(--primary)] md:text-5xl md:leading-[1.15]">
                {t("hero.title")}
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-7 text-[var(--on-surface-variant)]">
                {t("hero.body")}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/signup" className="btn-primary px-8 py-3 shadow-lg">
                  {t("hero.startFree")}
                </Link>
                <a href="#how" className="btn-secondary px-8 py-3">
                  {t("hero.howItWorks")}
                </a>
              </div>
              <p className="mt-4 max-w-xl text-sm text-[var(--on-surface-variant)]">
                {t("hero.approvalNote")}
              </p>
            </div>
            <div className="relative mt-4 lg:mt-0 fade-in-up">
              <div className="absolute -end-12 -top-12 -z-10 h-64 w-64 rounded-full bg-[color-mix(in_srgb,var(--secondary-container)_10%,transparent)] blur-3xl" />
              <div className="overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)] shadow-2xl">
                <Image
                  src="/stitch/landing-hero.png"
                  alt={t("hero.imageAlt")}
                  width={1376}
                  height={768}
                  className="h-auto w-full object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto my-16 max-w-[1280px] rounded-[32px] border border-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)] bg-[var(--surface-container-lowest)] px-6 py-16 shadow-sm md:px-8"
        >
          <div className="mb-10 text-center">
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
              {t("features.title")}
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-[var(--on-surface-variant)]">
              {t("features.subtitle")}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURE_KEYS.map((f) => (
              <div
                key={f.key}
                className="rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-6 transition hover:-translate-y-1 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.08)]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary-container)_20%,transparent)] text-[var(--primary)]">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                    aria-hidden
                  >
                    {f.icon}
                  </span>
                </div>
                <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                  {t(`features.items.${f.key}.title`)}
                </h3>
                <p className="mt-2 text-base text-[var(--on-surface-variant)]">
                  {t(`features.items.${f.key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="how"
          className="mx-auto max-w-[1280px] px-6 py-16 text-center md:px-8"
        >
          <h2 className="mb-10 font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)] md:text-2xl md:font-semibold">
            {t("how.title")}
          </h2>
          <div className="relative">
            <div className="absolute start-0 top-1/2 -z-10 hidden h-0.5 w-full bg-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] md:block" />
            <div className="grid gap-8 md:grid-cols-3">
              {STEP_KEYS.map((n) => (
                <div
                  key={n}
                  className="flex flex-col items-center rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-8 shadow-sm"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] font-bold text-white shadow-md">
                    {n}
                  </div>
                  <h3 className="mb-3 font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--primary)]">
                    {t(`how.steps.${n}.title`)}
                  </h3>
                  <p className="text-[var(--on-surface-variant)]">
                    {t(`how.steps.${n}.body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] shadow-lg">
            <Image
              src="/stitch/workflow.png"
              alt={t("how.imageAlt")}
              width={1376}
              height={768}
              className="h-auto w-full object-cover"
            />
          </div>
        </section>

        <section className="bg-[var(--primary)] py-16 text-white" id="about">
          <div className="mx-auto grid max-w-[1280px] gap-8 px-6 md:grid-cols-3 md:px-8">
            {FACT_KEYS.map((fact) => (
              <div key={fact.key}>
                <span
                  className="material-symbols-outlined text-3xl opacity-90"
                  aria-hidden
                >
                  {fact.icon}
                </span>
                <h3 className="mt-3 font-[family-name:var(--font-headline)] text-lg font-semibold">
                  {t(`facts.${fact.key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-6 opacity-90">
                  {t(`facts.${fact.key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-6 py-16 md:px-8">
          <h2 className="mb-10 text-center font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--primary)]">
            {t("faq.title")}
          </h2>
          <div className="space-y-4">
            {FAQ_KEYS.map((key) => (
              <details
                key={key}
                className="group cursor-pointer rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-6"
              >
                <summary className="flex list-none items-center justify-between font-bold text-[var(--primary)]">
                  {t(`faq.items.${key}.q`)}
                  <span
                    className="material-symbols-outlined transition group-open:rotate-180"
                    aria-hidden
                  >
                    expand_more
                  </span>
                </summary>
                <p className="mt-4 text-[var(--on-surface-variant)]">
                  {t(`faq.items.${key}.a`)}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface-container-low)] pb-8 pt-16">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-6 md:grid-cols-4 md:px-8">
          <div>
            <div className="mb-4 font-[family-name:var(--font-headline)] text-lg font-bold text-[var(--primary)]">
              VPsych
            </div>
            <p className="max-w-xs text-sm text-[var(--on-surface-variant)]">
              {t("footer.tagline")}
            </p>
          </div>
          <div>
            <h2 className="mb-4 text-base font-bold text-[var(--primary)]">{t("footer.product")}</h2>
            <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
              <li>
                <a href="#features" className="hover:text-[var(--primary)]">
                  {t("footer.features")}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="mb-4 text-base font-bold text-[var(--primary)]">{t("footer.resources")}</h2>
            <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
              <li>
                <a href="#faq" className="hover:text-[var(--primary)]">
                  {t("footer.faq")}
                </a>
              </li>
              <li>
                <Link href="/login" className="hover:text-[var(--primary)]">
                  {t("footer.signIn")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="mb-4 text-base font-bold text-[var(--primary)]">{t("footer.company")}</h2>
            <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
              <li>
                <a href="#how" className="hover:text-[var(--primary)]">
                  {t("footer.howItWorks")}
                </a>
              </li>
              <li>
                <Link href="/signup" className="hover:text-[var(--primary)]">
                  {t("footer.getStarted")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-[1280px] flex-col items-center justify-between gap-4 border-t border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] px-6 pt-6 md:flex-row md:px-8">
          <p className="text-xs text-[var(--on-surface-variant)] opacity-70">
            {t("footer.copyright", { year })}
          </p>
        </div>
      </footer>
    </div>
  );
}
