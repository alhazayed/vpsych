"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";

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

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function strengthLevel(password: string): "" | "weak" | "fair" | "good" | "strong" {
  const checks = passwordChecks(password);
  const score = Object.values(checks).filter(Boolean).length;
  if (!password) return "";
  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score === 3) return "good";
  return "strong";
}

function strengthMeta(level: ReturnType<typeof strengthLevel>) {
  if (!level) return { width: "0%", color: "var(--primary)" };
  if (level === "weak") return { width: "25%", color: "var(--error)" };
  if (level === "fair") return { width: "50%", color: "#F3650A" };
  if (level === "good") return { width: "75%", color: "var(--primary)" };
  return { width: "100%", color: "var(--primary)" };
}

export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations("auth.signup");
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
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const strengthKey = useMemo(() => strengthLevel(password), [password]);
  const strength = useMemo(() => strengthMeta(strengthKey), [strengthKey]);
  const dirty =
    firstName ||
    lastName ||
    email ||
    password ||
    confirmPassword ||
    country ||
    profession ||
    organization;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!acceptedTerms) {
      setError(t("errors.acceptTerms"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("errors.passwordShort"));
      return;
    }
    if (!checks.upper || !checks.number) {
      setError(t("errors.passwordShort"));
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    if (data.session) {
      router.push("/avatars");
      router.refresh();
      return;
    }
    setInfo(t("checkEmail"));
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
    setInfo(null);
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
                href="/login"
                className="rounded-[14px] border border-[var(--primary)] px-4 py-1.5 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary-fixed)]"
              >
                {t("nav.signIn")}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex flex-grow items-center justify-center px-5 py-8">
        <div className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-sm fade-in-up">
          <div className="border-b border-[var(--outline-variant)] bg-[color-mix(in_srgb,var(--surface-container-low)_50%,transparent)] p-6 md:p-8">
            <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold tracking-tight text-[#12273C]">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              {t("subtitle")}
            </p>
          </div>

          <form className="space-y-6 p-6 md:p-8" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  {t("fields.firstName")}
                </span>
                <input
                  required
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
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("placeholders.email")}
                  className="field-input h-11 pe-10"
                />
                <span className="material-symbols-outlined absolute end-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--outline-variant)]">
                  mail
                </span>
              </div>
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  {t("fields.password")}
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="field-input h-11 pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--outline-variant)]"
                    aria-label={
                      showPassword
                        ? tLogin("hidePassword")
                        : tLogin("showPassword")
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  {t("fields.confirmPassword")}
                </span>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="field-input h-11 pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--outline-variant)]"
                    aria-label={
                      showConfirm
                        ? tLogin("hidePassword")
                        : tLogin("showPassword")
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showConfirm ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </label>
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
              <div className="grid grid-cols-2 gap-y-1 pt-1 text-[11px] font-semibold">
                {(
                  [
                    ["length", "length"],
                    ["upper", "upper"],
                    ["number", "number"],
                    ["special", "special"],
                  ] as const
                ).map(([key, checkKey]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-1.5 ${
                      checks[key]
                        ? "text-[var(--primary)]"
                        : "text-[var(--on-surface-variant)]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {checks[key] ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    {t(`checks.${checkKey}`)}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  {t("fields.country")}
                </span>
                <select
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

            {error && <p className="text-sm text-[var(--error)]">{error}</p>}
            {info && <p className="text-sm text-[var(--primary)]">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--primary)] text-sm font-semibold uppercase tracking-wider text-white shadow-md transition hover:bg-[var(--primary-container)] disabled:opacity-60"
            >
              {loading ? t("creating") : t("submit")}
              <span className="material-symbols-outlined text-[20px]">
                arrow_forward
              </span>
            </button>
          </form>

          <div className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-6 text-center">
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("hasAccount")}{" "}
              <Link
                href="/login"
                className="ms-1 font-bold text-[var(--primary)] hover:underline"
              >
                {t("signIn")}
              </Link>
            </p>
          </div>
        </div>
      </main>

      {dirty && (
        <div className="fixed bottom-0 start-0 end-0 z-[60] flex h-16 items-center justify-between border-t border-[color-mix(in_srgb,var(--primary)_20%,transparent)] bg-[#12273C]/95 px-4 backdrop-blur-md md:px-10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary-fixed-dim)]">
              info
            </span>
            <p className="text-xs font-semibold text-white">
              {t("unsaved.title")}
            </p>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-semibold text-white/70 hover:text-white"
            >
              {t("unsaved.discard")}
            </button>
            <button
              type="button"
              onClick={() =>
                (
                  document.querySelector(
                    "form",
                  ) as HTMLFormElement | null
                )?.requestSubmit()
              }
              className="rounded-[14px] bg-[var(--primary)] px-6 py-2 text-xs font-semibold text-white"
            >
              {t("unsaved.saveContinue")}
            </button>
          </div>
        </div>
      )}

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
            <span>{t("footer.terms")}</span>
            <span>{t("footer.privacy")}</span>
            <span>{t("footer.support")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
