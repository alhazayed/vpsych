"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";
import {
  isPasswordPolicySatisfied,
  passwordChecks,
  passwordStrengthLevel,
} from "@/lib/password-policy";

function strengthMeta(level: ReturnType<typeof passwordStrengthLevel>) {
  if (!level) return { width: "0%", color: "var(--primary)" };
  if (level === "weak") return { width: "25%", color: "var(--error)" };
  if (level === "fair") return { width: "50%", color: "#F3650A" };
  if (level === "good") return { width: "75%", color: "var(--primary)" };
  return { width: "100%", color: "var(--primary)" };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useTranslations("auth.resetPassword");
  const tSignup = useTranslations("auth.signup");
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const strengthKey = useMemo(
    () => passwordStrengthLevel(password),
    [password],
  );
  const strength = useMemo(() => strengthMeta(strengthKey), [strengthKey]);

  useEffect(() => {
    let cancelled = false;
    async function ensureSession() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setSessionError(t("sessionMissing"));
        setReady(true);
        return;
      }
      setReady(true);
    }
    void ensureSession();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password !== confirmPassword) {
      setError(tSignup("errors.passwordMismatch"));
      return;
    }
    if (!isPasswordPolicySatisfied(password)) {
      setError(tSignup("errors.passwordPolicy"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    if (updateError) {
      setLoading(false);
      setError(t("updateFailed"));
      return;
    }
    // Sign out so middleware does not bounce /login → /avatars; user must
    // prove the new password on the login form.
    await supabase.auth.signOut();
    setLoading(false);
    setInfo(t("success"));
    router.push("/login?reset=1");
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
        <LanguageSwitcher />
      </header>

      <main className="flex min-h-screen w-full items-center justify-center px-6 py-24">
        <div className="w-full max-w-md fade-in-up">
          <div className="mb-10 text-center md:text-start">
            <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
              {t("title")}
            </h1>
            <p className="mt-2 text-base text-[var(--on-surface-variant)]">
              {t("subtitle")}
            </p>
          </div>

          {!ready ? (
            <p className="text-[var(--on-surface-variant)]">{t("checking")}</p>
          ) : sessionError ? (
            <div className="space-y-6">
              <p
                className="rounded-xl border border-[var(--error)]/30 bg-[var(--error-container)]/40 px-3 py-2 text-sm text-[var(--error)]"
                role="alert"
              >
                {sessionError}
              </p>
              <Link
                href="/login"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-semibold uppercase tracking-wider text-white"
              >
                {t("backToLogin")}
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label
                  className="ms-1 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]"
                  htmlFor="password"
                >
                  {t("newPassword")}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <div className="space-y-2">
                <label
                  className="ms-1 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]"
                  htmlFor="confirmPassword"
                >
                  {t("confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border-2 border-[var(--outline-variant)] bg-white px-4 text-base outline-none transition focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-2 px-1">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  <span>{tSignup("strength.label")}</span>
                  <span>
                    {strengthKey
                      ? tSignup(`strength.${strengthKey}`)
                      : "—"}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: strength.width,
                      background: strength.color,
                    }}
                  />
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-1 text-xs text-[var(--on-surface-variant)]">
                  {(
                    [
                      ["length", checks.length],
                      ["upper", checks.upper],
                      ["number", checks.number],
                      ["special", checks.special],
                    ] as const
                  ).map(([key, ok]) => (
                    <li key={key} className={ok ? "text-[var(--primary)]" : ""}>
                      {ok ? "✓" : "○"} {tSignup(`checks.${key}`)}
                    </li>
                  ))}
                </ul>
              </div>

              {error && (
                <p
                  className="rounded-xl border border-[var(--error)]/30 bg-[var(--error-container)]/40 px-3 py-2 text-sm text-[var(--error)]"
                  role="alert"
                >
                  {error}
                </p>
              )}
              {info && (
                <p
                  className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary-fixed)]/40 px-3 py-2 text-sm text-[var(--primary)]"
                  role="status"
                >
                  {info}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-semibold uppercase tracking-wider text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? t("saving") : t("submit")}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
