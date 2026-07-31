"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth.login");
  const next = searchParams.get("next") ?? "/avatars";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    void remember;
    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--on-surface)]">
      <header className="absolute start-0 top-0 z-50 flex w-full items-center justify-between px-4 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/vpsych-logo.png"
            alt="VPsych"
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg object-cover"
            priority
          />
          <span className="hidden font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--primary)] sm:inline">
            {t("platformName")}
          </span>
        </Link>
        <div className="flex items-center gap-4 md:gap-8">
          <LanguageSwitcher />
          <div className="hidden items-center gap-8 md:flex">
            <span className="text-base font-medium text-[var(--on-surface-variant)]">
              {t("support")}
            </span>
            <Link href="/signup" className="btn-primary rounded-xl px-6">
              {t("requestAccess")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex min-h-screen w-full">
        <section className="relative hidden flex-col justify-end overflow-hidden bg-[var(--primary-fixed)] p-16 md:flex md:w-[60%]">
          <Image
            src="/stitch/login-hero.png"
            alt={t("heroAlt")}
            fill
            className="object-cover"
            priority
          />
          <div className="relative z-10 max-w-2xl fade-in-up">
            <div className="rounded-3xl border border-white/30 bg-white/40 p-10 shadow-2xl backdrop-blur-md">
              <h1 className="font-[family-name:var(--font-headline)] text-4xl font-semibold leading-tight tracking-tight text-[var(--primary)] lg:text-5xl">
                {t("heroTitle")}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-[#35485f] opacity-90">
                {t("heroBody")}
              </p>
              <div className="mt-8 flex items-center gap-4">
                <div className="flex -space-x-3 rtl:space-x-reverse">
                  {["JD", "AS", "ML"].map((initials) => (
                    <div
                      key={initials}
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[var(--surface-container)] text-xs font-bold text-[var(--primary)]"
                    >
                      {initials}
                    </div>
                  ))}
                </div>
                <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  {t("trusted")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center bg-[var(--surface)] px-6 py-24 md:w-[40%] md:px-12">
          <div className="w-full max-w-md fade-in-up">
            <div className="mb-10 flex justify-center md:hidden">
              <Image
                src="/vpsych-logo.png"
                alt="VPsych"
                width={48}
                height={48}
                className="h-12 w-12 rounded-lg object-cover"
              />
            </div>
            <div className="mb-10 text-center md:text-start">
              <h2 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
                {t("welcome")}
              </h2>
              <p className="mt-2 text-base text-[var(--on-surface-variant)]">
                {t("subtitle")}
              </p>
            </div>

            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label
                  className="ms-1 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]"
                  htmlFor="email"
                >
                  {t("email")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className={`h-12 w-full rounded-xl border-2 bg-white px-4 text-base outline-none transition focus:border-[var(--primary)] ${
                    error
                      ? "border-[var(--error)]"
                      : "border-[var(--outline-variant)]"
                  }`}
                />
                {error && (
                  <p className="ms-1 text-xs font-medium text-[var(--error)]">
                    {error}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label
                    className="text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]"
                    htmlFor="password"
                  >
                    {t("password")}
                  </label>
                  <span className="cursor-default text-xs font-semibold text-[var(--primary)] opacity-60">
                    {t("forgotPassword")}
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-xl border-2 border-[var(--outline-variant)] bg-white px-4 pe-12 text-base outline-none transition focus:border-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]"
                    aria-label={
                      showPassword ? t("hidePassword") : t("showPassword")
                    }
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 px-1">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--outline-variant)] text-[var(--primary)]"
                />
                <span className="text-sm text-[var(--on-surface-variant)]">
                  {t("rememberMe")}
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-sm font-semibold uppercase tracking-wider text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        fill="currentColor"
                      />
                    </svg>
                    {t("authenticating")}
                  </>
                ) : (
                  t("signIn")
                )}
              </button>
            </form>

            <footer className="mt-12 text-center">
              <p className="text-base text-[var(--on-surface-variant)]">
                {t("noAccount")}{" "}
                <Link
                  href="/signup"
                  className="font-semibold text-[var(--secondary)] hover:underline"
                >
                  {t("createAccount")}
                </Link>
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 opacity-60">
                <span className="text-[11px] font-medium">{t("privacy")}</span>
                <span className="text-[11px] font-medium">{t("terms")}</span>
                <span className="text-[11px] font-medium">
                  {t("copyright", { year: new Date().getFullYear() })}
                </span>
              </div>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
