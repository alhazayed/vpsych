"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";
import {
  isPasswordPolicySatisfied,
  passwordChecks,
  passwordStrengthLevel,
} from "@/lib/password-policy";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { authErrorKey } from "@/lib/auth-error";

const COUNTRIES = [
  { value: "US", key: "us" },
  { value: "UK", key: "uk" },
  { value: "CA", key: "ca" },
  { value: "AU", key: "au" },
  { value: "SA", key: "sa" },
  { value: "AE", key: "ae" },
  { value: "EG", key: "eg" },
  { value: "JO", key: "jo" },
  { value: "Other", key: "other" },
] as const;

const PROFESSIONS = [
  { value: "Psychiatrist", key: "psychiatrist" },
  { value: "Psychologist", key: "psychologist" },
  { value: "Therapist", key: "therapist" },
  { value: "Resident", key: "resident" },
  { value: "Student", key: "student" },
  { value: "Other", key: "other" },
] as const;

function strengthMeta(level: ReturnType<typeof passwordStrengthLevel>) {
  if (!level) return { width: "0%", color: "var(--primary)" };
  if (level === "weak") return { width: "25%", color: "var(--error)" };
  if (level === "fair") return { width: "50%", color: "#F3650A" };
  if (level === "good") return { width: "75%", color: "var(--primary)" };
  return { width: "100%", color: "var(--primary)" };
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get("next"));
  const t = useTranslations("auth.signup");
  const tErr = useTranslations("auth.errors");
  const tLogin = useTranslations("auth.login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [country, setCountry] = useState("");
  const [profession, setProfession] = useState("");
  const [organization, setOrganization] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which field the current error is about, so it can be marked invalid.
  const [errorField, setErrorField] = useState<
    "password" | "confirm" | "terms" | "email" | null
  >(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const doneHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    // Move focus to the confirmation so keyboard and screen-reader users
    // land on what happens next instead of a form that is gone.
    if (submittedEmail) doneHeadingRef.current?.focus();
  }, [submittedEmail]);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const strengthKey = useMemo(
    () => passwordStrengthLevel(password),
    [password],
  );
  const strength = useMemo(() => strengthMeta(strengthKey), [strengthKey]);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorField(null);

    if (!acceptedTerms) {
      setError(t("errors.acceptTerms"));
      setErrorField("terms");
      return;
    }
    if (password !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      setErrorField("confirm");
      return;
    }
    if (!isPasswordPolicySatisfied(password)) {
      setError(t("errors.passwordPolicy"));
      setErrorField("password");
      return;
    }

    setLoading(true);
    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const supabase = createClient();
    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          country: country || null,
          profession: profession || null,
          organization: organization || null,
          newsletter,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (signError) {
      const key = authErrorKey(signError);
      setError(tErr(key));
      setErrorField(
        key === "weakPassword"
          ? "password"
          : key === "invalidEmail" || key === "alreadyRegistered"
            ? "email"
            : null,
      );
      return;
    }
    // With email confirmation on, Supabase answers an already-registered
    // address with a user that has no identities instead of an error.
    if (data.user && data.user.identities?.length === 0) {
      setError(tErr("alreadyRegistered"));
      setErrorField("email");
      return;
    }
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }
    setSubmittedEmail(email.trim());
    setPassword("");
    setConfirmPassword("");
  }

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setCountry("");
    setProfession("");
    setOrganization("");
    setAcceptedTerms(false);
    setNewsletter(false);
    setError(null);
    setErrorField(null);
    setSubmittedEmail(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <nav className="sticky top-0 z-50 border-b border-[var(--outline-variant)] bg-[var(--surface)]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-10">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/vpsych-logo.png"
              alt="VPsych"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md object-cover"
            />
            <span className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
              VPsych
            </span>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <LanguageSwitcher />
            <div className="hidden items-center gap-6 md:flex">
              <Link
                href="/#features"
                className="text-sm font-semibold tracking-wide text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
              >
                {t("nav.solutions")}
              </Link>
              <Link
                href="/#features"
                className="text-sm font-semibold tracking-wide text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
              >
                {t("nav.clinicalTools")}
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="rounded-[14px] border border-[var(--primary)] px-4 py-1.5 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary-fixed)]"
              >
                {t("nav.signIn")}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-grow items-center justify-center px-5 py-8 focus:outline-none"
      >
        <div className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-sm fade-in-up">
          <div className="border-b border-[var(--outline-variant)] bg-[color-mix(in_srgb,var(--surface-container-low)_50%,transparent)] p-6 md:p-8">
            <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold tracking-tight text-[#12273C]">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              {t("subtitle")}
            </p>
            {!submittedEmail && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--primary-fixed)] bg-[color-mix(in_srgb,var(--primary-fixed)_45%,transparent)] px-3 py-2 text-xs leading-relaxed text-[var(--on-surface)]">
                <span
                  className="material-symbols-outlined text-[18px] text-[var(--primary)]"
                  aria-hidden
                >
                  verified_user
                </span>
                <span>{t("approvalNotice")}</span>
              </p>
            )}
          </div>

          {submittedEmail ? (
            <section
              role="status"
              aria-labelledby="signup-done-title"
              className="space-y-5 p-6 md:p-8"
            >
              <span
                className="material-symbols-outlined text-[40px] text-[var(--primary)]"
                aria-hidden
              >
                mark_email_read
              </span>
              <h2
                id="signup-done-title"
                ref={doneHeadingRef}
                tabIndex={-1}
                className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)] focus:outline-none"
              >
                {t("done.title")}
              </h2>
              <p className="text-sm text-[var(--on-surface-variant)]">
                {t("done.sentTo")}{" "}
                <span className="font-semibold text-[var(--on-surface)]" dir="ltr">
                  {submittedEmail}
                </span>
              </p>
              <ol className="space-y-3 text-sm text-[var(--on-surface)]">
                {(["confirm", "approval", "signIn"] as const).map((step, i) => (
                  <li key={step} className="flex items-start gap-3">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-semibold text-[var(--on-primary)]"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span>{t(`done.steps.${step}`)}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-[var(--on-surface-variant)]">
                {t("done.noEmail")}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/login?next=${encodeURIComponent(next)}`}
                  className="btn-primary flex-1 justify-center"
                >
                  {t("done.toSignIn")}
                </Link>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary flex-1 justify-center"
                >
                  {t("done.startOver")}
                </button>
              </div>
            </section>
          ) : (
          <form className="space-y-6 p-6 md:p-8" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  {t("fields.firstName")}
                </span>
                <input
                  required
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t("placeholders.firstName")}
                  className="field-input h-11"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  {t("fields.lastName")}
                </span>
                <input
                  required
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t("placeholders.lastName")}
                  className="field-input h-11"
                />
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-xs font-semibold text-[var(--on-surface)]">
                {t("fields.email")}
              </span>
              {/* Email is always left-to-right, so the icon sits on the right
                  in Arabic too instead of covering the placeholder. */}
              <div className="relative" dir="ltr">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("placeholders.email")}
                  aria-invalid={errorField === "email" || undefined}
                  aria-describedby={
                    errorField === "email" ? "signup-error" : undefined
                  }
                  className="field-input h-11 pe-10"
                />
                <span
                  className="material-symbols-outlined pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--on-surface-variant)]"
                  aria-hidden
                >
                  mail
                </span>
              </div>
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm">
                <label
                  htmlFor="signup-password"
                  className="block text-xs font-semibold text-[var(--on-surface)]"
                >
                  {t("fields.password")}
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    aria-invalid={errorField === "password" || undefined}
                    aria-describedby={
                      errorField === "password"
                        ? "signup-error signup-password-checks"
                        : "signup-password-checks"
                    }
                    className="field-input h-11 pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-controls="signup-password"
                    aria-pressed={showPassword}
                    className="absolute end-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--on-surface-variant)]"
                    aria-label={
                      showPassword
                        ? tLogin("hidePassword")
                        : tLogin("showPassword")
                    }
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      aria-hidden
                    >
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <label
                  htmlFor="signup-confirm"
                  className="block text-xs font-semibold text-[var(--on-surface)]"
                >
                  {t("fields.confirmPassword")}
                </label>
                <div className="relative">
                  <input
                    id="signup-confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    aria-invalid={errorField === "confirm" || undefined}
                    aria-describedby={
                      errorField === "confirm"
                        ? "signup-error"
                        : undefined
                    }
                    className="field-input h-11 pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-controls="signup-confirm"
                    aria-pressed={showConfirm}
                    className="absolute end-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--on-surface-variant)]"
                    aria-label={
                      showConfirm
                        ? tLogin("hidePassword")
                        : tLogin("showPassword")
                    }
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      aria-hidden
                    >
                      {showConfirm ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] bg-[var(--surface-container-low)] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  {t("strength.label")}
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: strength.color }}
                >
                  {strengthKey ? t(`strength.${strengthKey}`) : ""}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-variant)]">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: strength.width,
                    backgroundColor: strength.color,
                  }}
                />
              </div>
              <ul
                id="signup-password-checks"
                className="grid grid-cols-2 gap-y-1 pt-1 text-[11px] font-semibold"
              >
                {(
                  [
                    ["length", "length"],
                    ["upper", "upper"],
                    ["number", "number"],
                    ["special", "special"],
                  ] as const
                ).map(([key, checkKey]) => (
                  <li
                    key={key}
                    className={`flex items-center gap-1.5 ${
                      checks[key]
                        ? "text-[var(--primary)]"
                        : "text-[var(--on-surface-variant)]"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[14px]"
                      aria-hidden
                    >
                      {checks[key] ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    {t(`checks.${checkKey}`)}
                    <span className="sr-only">
                      {checks[key] ? t("checks.met") : t("checks.notMet")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  {t("fields.country")}
                </span>
                <select
                  autoComplete="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="field-input h-11"
                >
                  <option value="">{t("placeholders.selectCountry")}</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {t(`countries.${c.key}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  {t("fields.profession")}
                </span>
                <select
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  className="field-input h-11"
                >
                  <option value="">{t("placeholders.selectProfession")}</option>
                  {PROFESSIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {t(`professions.${p.key}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-xs font-semibold text-[var(--on-surface)]">
                {t("fields.organization")}{" "}
                <span className="font-normal text-[var(--on-surface-variant)]">
                  {t("optional")}
                </span>
              </span>
              <input
                autoComplete="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder={t("placeholders.organization")}
                className="field-input h-11"
              />
            </label>

            <div className="space-y-3 pt-2">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  aria-invalid={errorField === "terms" || undefined}
                  aria-describedby={
                    errorField === "terms" ? "signup-error" : undefined
                  }
                  className="mt-0.5 h-5 w-5 rounded border-[var(--outline-variant)] text-[var(--primary)]"
                  required
                />
                <span className="text-xs leading-relaxed text-[var(--on-surface-variant)]">
                  {t("termsAgree")}
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-[var(--outline-variant)] text-[var(--primary)]"
                />
                <span className="text-xs leading-relaxed text-[var(--on-surface-variant)]">
                  {t("newsletter")}
                </span>
              </label>
            </div>

            {error && (
              <p
                id="signup-error"
                role="alert"
                className="text-sm text-[var(--error)]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--primary)] text-sm font-semibold uppercase tracking-wider text-white shadow-md transition hover:bg-[var(--primary-container)] disabled:opacity-60"
            >
              {loading ? t("creating") : t("submit")}
              <span
                className="material-symbols-outlined text-[20px] rtl:rotate-180"
                aria-hidden
              >
                arrow_forward
              </span>
            </button>
          </form>
          )}

          <div className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-6 text-center">
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("hasAccount")}{" "}
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="ms-1 font-bold text-[var(--primary)] hover:underline"
              >
                {t("signIn")}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-4">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 px-4 md:flex-row md:px-10">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-headline)] text-sm font-bold">
              VPsych
            </span>
            <span className="text-xs text-[var(--on-surface-variant)]">
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </span>
          </div>
          <div className="flex gap-6 text-xs text-[var(--on-surface-variant)]">
            <Link href="/terms" className="hover:underline">
              {t("footer.terms")}
            </Link>
            <Link href="/privacy" className="hover:underline">
              {t("footer.privacy")}
            </Link>
            <span>{t("footer.support")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function SignupPage() {
  const t = useTranslations("auth");
  return (
    <Suspense
      fallback={
        <main className="p-8 text-[var(--on-surface-variant)]">{t("loading")}</main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
