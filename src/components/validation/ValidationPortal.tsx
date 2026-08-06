"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Props = {
  isAuthenticated: boolean;
  initiallyUnlocked: boolean;
};

export function ValidationPortal({
  isAuthenticated,
  initiallyUnlocked,
}: Props) {
  const t = useTranslations("validation");
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(initiallyUnlocked);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitePending, startInvite] = useTransition();
  const [launchPending, startLaunch] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/validation/invite", {
          method: "GET",
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { unlocked?: boolean };
        if (data.unlocked) setUnlocked(true);
      } catch {
        // Cookie check is best-effort; form still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canLaunch = consent && (isAuthenticated || unlocked);

  function redeemInvite() {
    setInviteError(null);
    startInvite(async () => {
      try {
        const res = await fetch("/api/validation/invite", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as { error?: string; unlocked?: boolean };
        if (!res.ok) {
          setInviteError(data.error ?? t("access.invalidCode"));
          return;
        }
        setUnlocked(true);
        setInviteError(null);
      } catch {
        setInviteError(t("access.networkError"));
      }
    });
  }

  function launch() {
    if (!canLaunch) return;
    startLaunch(() => {
      if (isAuthenticated) {
        router.push("/avatars");
        return;
      }
      // Guests with a valid invite go to signup; returning experts use Sign in.
      router.push("/signup?next=/avatars");
    });
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--surface)] text-[var(--on-surface)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--primary-fixed)_55%,transparent),transparent_70%)]"
      />

      <header className="relative z-10 border-b border-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-headline)] text-xl font-bold tracking-tight text-[var(--primary)]"
          >
            VPsych
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            {isAuthenticated ? (
              <Link
                href="/avatars"
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary-container)_10%,transparent)]"
              >
                {t("nav.app")}
              </Link>
            ) : (
              <Link
                href="/login?next=/avatars"
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary-container)_10%,transparent)]"
              >
                {t("nav.signIn")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="relative z-10 outline-none">
        <section className="mx-auto max-w-3xl px-6 pb-10 pt-12 fade-in-up">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary-container)]">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-headline)] text-3xl font-semibold leading-tight text-[var(--primary)] md:text-4xl">
            {t("hero.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--on-surface-variant)]">
            {t("hero.body")}
          </p>
        </section>

        <section className="mx-auto max-w-3xl space-y-8 px-6 pb-16">
          <article className="rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[var(--clinical-shadow)] md:p-8">
            <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
              {t("purpose.title")}
            </h2>
            <p className="mt-3 leading-7 text-[var(--on-surface-variant)]">
              {t("purpose.body")}
            </p>
            <ul className="mt-4 list-disc space-y-2 ps-5 text-[var(--on-surface-variant)]">
              <li>{t("purpose.focus.1")}</li>
              <li>{t("purpose.focus.2")}</li>
              <li>{t("purpose.focus.3")}</li>
              <li>{t("purpose.focus.4")}</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[var(--clinical-shadow)] md:p-8">
            <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
              {t("expectations.title")}
            </h2>
            <p className="mt-3 leading-7 text-[var(--on-surface-variant)]">
              {t("expectations.body")}
            </p>
            <ol className="mt-4 list-decimal space-y-3 ps-5 text-[var(--on-surface-variant)]">
              <li>{t("expectations.steps.1")}</li>
              <li>{t("expectations.steps.2")}</li>
              <li>{t("expectations.steps.3")}</li>
              <li>{t("expectations.steps.4")}</li>
              <li>{t("expectations.steps.5")}</li>
            </ol>
            <p className="mt-4 text-sm leading-6 text-[var(--on-surface-variant)]">
              {t("expectations.limitations")}
            </p>
          </article>

          <article className="rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[var(--clinical-shadow)] md:p-8">
            <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
              {t("consent.title")}
            </h2>
            <p className="mt-3 leading-7 text-[var(--on-surface-variant)]">
              {t("consent.body")}
            </p>
            <ul className="mt-4 space-y-3 text-[var(--on-surface-variant)]">
              {(["1", "2", "3", "4", "5"] as const).map((key) => (
                <li key={key} className="flex gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]"
                    aria-hidden
                  />
                  <span>{t(`consent.items.${key}`)}</span>
                </li>
              ))}
            </ul>
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--surface-container-low)] p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--primary)]"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="text-sm leading-6 text-[var(--on-surface)]">
                {t("consent.checkbox")}
              </span>
            </label>
          </article>

          <article className="rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[var(--clinical-shadow)] md:p-8">
            <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
              {t("access.title")}
            </h2>
            <p className="mt-3 leading-7 text-[var(--on-surface-variant)]">
              {isAuthenticated ? t("access.signedInBody") : t("access.body")}
            </p>

            {!isAuthenticated && (
              <div className="mt-6 space-y-4">
                {unlocked ? (
                  <p
                    className="rounded-xl bg-[color-mix(in_srgb,var(--primary-fixed)_40%,transparent)] px-4 py-3 text-sm text-[var(--primary)]"
                    role="status"
                  >
                    {t("access.unlocked")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label
                        htmlFor="invite-code"
                        className="mb-1.5 block text-sm font-medium text-[var(--on-surface)]"
                      >
                        {t("access.codeLabel")}
                      </label>
                      <input
                        id="invite-code"
                        name="invite-code"
                        autoComplete="off"
                        spellCheck={false}
                        className="field-input w-full"
                        placeholder={t("access.codePlaceholder")}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            redeemInvite();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-secondary shrink-0"
                      disabled={invitePending || !code.trim()}
                      onClick={redeemInvite}
                    >
                      {invitePending
                        ? t("access.verifying")
                        : t("access.verifyCode")}
                    </button>
                  </div>
                )}
                {inviteError && (
                  <p className="text-sm text-[var(--error)]" role="alert">
                    {inviteError}
                  </p>
                )}
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {t("access.orAccount")}{" "}
                  <Link
                    href="/login?next=/avatars"
                    className="font-medium text-[var(--primary)] hover:underline"
                  >
                    {t("nav.signIn")}
                  </Link>
                  {" · "}
                  <Link
                    href="/signup?next=/avatars"
                    className="font-medium text-[var(--primary)] hover:underline"
                  >
                    {t("access.createAccount")}
                  </Link>
                </p>
              </div>
            )}
          </article>

          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary-fixed)_28%,var(--surface-container-lowest))] p-6 md:p-8">
            <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--primary)]">
              {t("launch.title")}
            </h2>
            <p className="mt-2 leading-7 text-[var(--on-surface-variant)]">
              {t("launch.body")}
            </p>
            {!canLaunch && (
              <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
                {!consent
                  ? t("launch.needConsent")
                  : t("launch.needAccess")}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canLaunch || launchPending}
                onClick={launch}
              >
                {launchPending ? t("launch.starting") : t("launch.cta")}
              </button>
              {!isAuthenticated && unlocked && (
                <Link
                  href="/login?next=/avatars"
                  className="btn-secondary text-center"
                >
                  {t("launch.existingAccount")}
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] px-6 py-8 text-center text-sm text-[var(--on-surface-variant)]">
        <p>{t("footer.disclaimer")}</p>
        <p className="mt-2">
          © {year} VPsych ·{" "}
          <Link href="/privacy" className="hover:underline">
            {t("footer.privacy")}
          </Link>
          {" · "}
          <Link href="/terms" className="hover:underline">
            {t("footer.terms")}
          </Link>
        </p>
      </footer>
    </div>
  );
}
