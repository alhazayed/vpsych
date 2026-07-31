import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/avatars");

  const t = await getTranslations("landing");
  const year = new Date().getFullYear();

  const FEATURES = [
    {
      icon: "psychology",
      title: t("features.items.simulations.title"),
      body: t("features.items.simulations.body"),
    },
    {
      icon: "face_6",
      title: t("features.items.avatars.title"),
      body: t("features.items.avatars.body"),
    },
    {
      icon: "assignment_turned_in",
      title: t("features.items.feedback.title"),
      body: t("features.items.feedback.body"),
    },
    {
      icon: "analytics",
      title: t("features.items.analytics.title"),
      body: t("features.items.analytics.body"),
    },
    {
      icon: "monitoring",
      title: t("features.items.progress.title"),
      body: t("features.items.progress.body"),
    },
    {
      icon: "translate",
      title: t("features.items.bilingual.title"),
      body: t("features.items.bilingual.body"),
    },
  ];

  const STEPS = [
    {
      n: "1",
      title: t("how.steps.1.title"),
      body: t("how.steps.1.body"),
    },
    {
      n: "2",
      title: t("how.steps.2.title"),
      body: t("how.steps.2.body"),
    },
    {
      n: "3",
      title: t("how.steps.3.title"),
      body: t("how.steps.3.body"),
    },
  ];

  const TESTIMONIALS = [
    {
      quote: t("testimonials.items.1.quote"),
      name: t("testimonials.items.1.name"),
      role: t("testimonials.items.1.role"),
      initials: "SK",
    },
    {
      quote: t("testimonials.items.2.quote"),
      name: t("testimonials.items.2.name"),
      role: t("testimonials.items.2.role"),
      initials: "JW",
    },
    {
      quote: t("testimonials.items.3.quote"),
      name: t("testimonials.items.3.name"),
      role: t("testimonials.items.3.role"),
      initials: "LA",
    },
  ];

  const FAQS = [
    { q: t("faq.items.1.q"), a: t("faq.items.1.a") },
    { q: t("faq.items.2.q"), a: t("faq.items.2.a") },
    { q: t("faq.items.3.q"), a: t("faq.items.3.a") },
    { q: t("faq.items.4.q"), a: t("faq.items.4.a") },
  ];

  const STATS = [
    ["10,000+", t("stats.sessions")],
    ["500+", t("stats.cases")],
    ["25+", t("stats.competencies")],
    ["95%", t("stats.satisfaction")],
  ] as const;

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
                href="#pricing"
                className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
              >
                {t("nav.pricing")}
              </a>
              <a
                href="#about"
                className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
              >
                {t("nav.about")}
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
            <LanguageSwitcher compact />
            <Link
              href="/login"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary-container)_10%,transparent)] sm:inline"
            >
              {t("nav.login")}
            </Link>
            <Link href="/signup" className="btn-primary">
              {t("nav.getStarted")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative mx-auto max-w-[1280px] overflow-hidden px-6 pb-20 pt-12 md:px-8 md:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="z-10 fade-in-up">
              <span className="mb-4 inline-block rounded-full bg-[var(--secondary-fixed)] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--on-secondary-fixed-variant)]">
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
                <a href="#features" className="btn-secondary px-8 py-3">
                  <span className="material-symbols-outlined">play_circle</span>
                  {t("hero.watchDemo")}
                </a>
              </div>
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
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-6 transition hover:-translate-y-1 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.08)]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary-container)_20%,transparent)] text-[var(--primary)]">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {f.icon}
                  </span>
                </div>
                <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                  {f.title}
                </h3>
                <p className="mt-2 text-base text-[var(--on-surface-variant)]">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-6 py-16 text-center md:px-8">
          <h2 className="mb-10 font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)] md:text-2xl md:font-semibold">
            {t("how.title")}
          </h2>
          <div className="relative">
            <div className="absolute start-0 top-1/2 -z-10 hidden h-0.5 w-full bg-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] md:block" />
            <div className="grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="flex flex-col items-center rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-8 shadow-sm"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] font-bold text-white shadow-md">
                    {s.n}
                  </div>
                  <h4 className="mb-3 font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--primary)]">
                    {s.title}
                  </h4>
                  <p className="text-[var(--on-surface-variant)]">{s.body}</p>
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
          <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-8 px-6 text-center lg:grid-cols-4 md:px-8">
            {STATS.map(([value, label]) => (
              <div key={label}>
                <div className="font-[family-name:var(--font-headline)] text-4xl font-bold tracking-tight md:text-5xl">
                  {value}
                </div>
                <div className="mt-2 text-sm font-medium uppercase tracking-widest opacity-80">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-6 py-16 md:px-8">
          <h2 className="mb-10 text-center font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--primary)]">
            {t("testimonials.title")}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <div
                key={item.name}
                className="rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface-container-low)] p-6"
              >
                <p className="mb-6 italic text-[var(--on-surface-variant)]">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-fixed)] font-bold text-[var(--primary)]">
                    {item.initials}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--primary)]">
                      {item.name}
                    </div>
                    <div className="text-xs text-[var(--on-surface-variant)]">
                      {item.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          id="pricing"
          className="mx-auto max-w-[1280px] px-6 py-16 md:px-8"
        >
          <div className="mb-10 text-center">
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--primary)]">
              {t("pricing.title")}
            </h2>
            <p className="mt-2 text-[var(--on-surface-variant)]">
              {t("pricing.subtitle")}
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-8">
              <div className="mb-2 text-sm font-medium text-[var(--on-surface-variant)]">
                {t("pricing.free.name")}
              </div>
              <div className="mb-6 font-[family-name:var(--font-headline)] text-5xl font-bold text-[var(--primary)]">
                {t("pricing.free.price")}
              </div>
              <ul className="mb-8 w-full space-y-2 text-[var(--on-surface-variant)]">
                {(["1", "2", "3"] as const).map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                      check_circle
                    </span>
                    {t(`pricing.free.features.${k}`)}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn-secondary w-full py-3">
                {t("pricing.free.cta")}
              </Link>
            </div>

            <div className="z-10 flex scale-105 flex-col items-center rounded-[14px] border-2 border-[var(--primary)] bg-[var(--surface-container-highest)] p-8 shadow-xl">
              <div className="mb-2 rounded-full bg-[var(--secondary-container)] px-3 py-1 text-xs font-semibold text-[var(--on-secondary-container)]">
                {t("pricing.mostPopular")}
              </div>
              <div className="mb-2 text-sm font-medium text-[var(--on-surface-variant)]">
                {t("pricing.pro.name")}
              </div>
              <div className="mb-6 font-[family-name:var(--font-headline)] text-5xl font-bold text-[var(--primary)]">
                {t("pricing.pro.price")}
                <span className="text-lg font-normal">
                  {t("pricing.perMonth")}
                </span>
              </div>
              <ul className="mb-8 w-full space-y-2 text-[var(--on-surface-variant)]">
                {(["1", "2", "3"] as const).map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                      check_circle
                    </span>
                    {t(`pricing.pro.features.${k}`)}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn-primary w-full py-3 shadow-lg">
                {t("pricing.pro.cta")}
              </Link>
            </div>

            <div className="flex flex-col items-center rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-8">
              <div className="mb-2 text-sm font-medium text-[var(--on-surface-variant)]">
                {t("pricing.institution.name")}
              </div>
              <div className="mb-6 mt-2 font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
                {t("pricing.institution.price")}
              </div>
              <ul className="mb-8 w-full space-y-2 text-[var(--on-surface-variant)]">
                {(["1", "2", "3"] as const).map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[var(--primary)]">
                      check_circle
                    </span>
                    {t(`pricing.institution.features.${k}`)}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn-secondary w-full py-3">
                {t("pricing.institution.cta")}
              </Link>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-6 py-16 md:px-8">
          <h2 className="mb-10 text-center font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--primary)]">
            {t("faq.title")}
          </h2>
          <div className="space-y-4">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group cursor-pointer rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)] bg-[var(--surface)] p-6"
              >
                <summary className="flex list-none items-center justify-between font-bold text-[var(--primary)]">
                  {item.q}
                  <span className="material-symbols-outlined transition group-open:rotate-180">
                    expand_more
                  </span>
                </summary>
                <p className="mt-4 text-[var(--on-surface-variant)]">{item.a}</p>
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
            <h5 className="mb-4 font-bold text-[var(--primary)]">
              {t("footer.product")}
            </h5>
            <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
              <li>
                <a href="#features" className="hover:text-[var(--primary)]">
                  {t("footer.features")}
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-[var(--primary)]">
                  {t("footer.pricing")}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="mb-4 font-bold text-[var(--primary)]">
              {t("footer.resources")}
            </h5>
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
            <h5 className="mb-4 font-bold text-[var(--primary)]">
              {t("footer.company")}
            </h5>
            <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
              <li>
                <a href="#about" className="hover:text-[var(--primary)]">
                  {t("footer.aboutUs")}
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
