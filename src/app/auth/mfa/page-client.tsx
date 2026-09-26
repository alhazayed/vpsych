"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";
import { adminMfaReturnPath } from "@/lib/admin-mfa";

export default function MfaChallengePage({
  factorId,
  nextPath,
}: {
  factorId: string;
  nextPath: string;
}) {
  const router = useRouter();
  const t = useTranslations("auth.mfa");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setError(t("invalidFormat"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setLoading(false);
      setError(t("challengeFailed"));
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: trimmed,
    });
    setLoading(false);
    if (verifyError) {
      setError(t("invalidCode"));
      setCode("");
      return;
    }

    router.push(adminMfaReturnPath(nextPath));
    router.refresh();
  }

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
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

      <main className="flex min-h-screen w-full items-center justify-center px-4 py-24">
        <section className="w-full max-w-md rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-8 shadow-sm">
          <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
            {t("challengeTitle")}
          </h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {t("challengeBody")}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                {t("codeLabel")}
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
                placeholder="••••••"
                aria-label={t("codeLabel")}
                disabled={loading}
                autoFocus
              />
            </label>

            {error ? (
              <p className="text-sm text-[var(--error)]" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn-primary w-full rounded-xl py-3"
              disabled={loading || code.length !== 6}
            >
              {loading ? t("verifying") : t("verify")}
            </button>
          </form>

          <button
            type="button"
            onClick={() => void onSignOut()}
            className="mt-6 w-full text-sm text-[var(--on-surface-variant)] underline-offset-2 hover:underline"
          >
            {t("signOut")}
          </button>
        </section>
      </main>
    </div>
  );
}
