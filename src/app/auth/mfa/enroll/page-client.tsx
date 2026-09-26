"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";
import { adminMfaReturnPath } from "@/lib/admin-mfa";

type EnrollState = {
  factorId: string;
  qrCode: string;
  /** Shown once for manual authenticator entry — never logged. */
  secret: string;
};

export default function MfaEnrollPage({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const t = useTranslations("auth.mfa");
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function startEnroll() {
      const supabase = createClient();

      // Clear orphan unverified factors so enroll can mint a fresh QR.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const orphans =
        existing?.all?.filter(
          (f) => f.factor_type === "totp" && f.status === "unverified",
        ) ?? [];
      for (const orphan of orphans) {
        await supabase.auth.mfa.unenroll({ factorId: orphan.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "VPsych Admin",
      });

      if (cancelled) return;

      if (enrollError || !data?.totp) {
        setBootError(t("enrollFailed"));
        setBooting(false);
        return;
      }

      // Do not console.log totp.secret or qr_code.
      setEnroll({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setBooting(false);
    }

    void startEnroll();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setError(null);
    const trimmed = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setError(t("invalidFormat"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
    if (challengeError || !challenge) {
      setLoading(false);
      setError(t("challengeFailed"));
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enroll.factorId,
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
            {t("enrollTitle")}
          </h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {t("enrollBody")}
          </p>

          {booting ? (
            <p className="mt-8 text-sm text-[var(--on-surface-variant)]">
              {t("preparing")}
            </p>
          ) : null}

          {bootError ? (
            <p className="mt-8 text-sm text-[var(--error)]" role="alert">
              {bootError}
            </p>
          ) : null}

          {enroll ? (
            <div className="mt-8 space-y-6">
              <div className="flex flex-col items-center gap-3">
                {/* qr_code is a data:image SVG/PNG from Supabase — render only, never log */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enroll.qrCode}
                  alt={t("qrAlt")}
                  width={192}
                  height={192}
                  className="rounded-lg bg-white p-2"
                />
                <p className="text-center text-xs text-[var(--on-surface-variant)]">
                  {t("manualSecretHint")}
                </p>
                <code className="break-all rounded-lg bg-[var(--surface)] px-3 py-2 font-mono text-xs tracking-wide text-[var(--on-surface)]">
                  {enroll.secret}
                </code>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
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
                  {loading ? t("verifying") : t("confirmEnroll")}
                </button>
              </form>
            </div>
          ) : null}

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
