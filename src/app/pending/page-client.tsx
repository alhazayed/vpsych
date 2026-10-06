"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";

export default function PendingApprovalScreen({
  status,
  email,
}: {
  status: "pending" | "rejected" | "unknown";
  email: string;
}) {
  const router = useRouter();
  const t = useTranslations("auth.pending");
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function checkAgain() {
    setChecking(true);
    setError(null);
    router.refresh();
    // refresh() has no completion signal; release the button shortly after.
    window.setTimeout(() => setChecking(false), 1500);
  }

  async function signOut() {
    setSigningOut(true);
    setError(null);
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.push("/login");
      router.refresh();
    } catch {
      setError(t("signOutFailed"));
      setSigningOut(false);
    }
  }

  const title =
    status === "rejected"
      ? t("rejectedTitle")
      : status === "unknown"
        ? t("unknownTitle")
        : t("title");
  const body =
    status === "rejected"
      ? t("rejectedBody")
      : status === "unknown"
        ? t("unknownBody")
        : t("body");

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
            VPsych
          </span>
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="flex min-h-screen w-full items-center justify-center px-4 py-24">
        <section className="w-full max-w-md rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-8 shadow-sm">
          <span
            className="material-symbols-outlined text-[40px] text-[var(--primary)]"
            aria-hidden
          >
            {status === "rejected" ? "block" : "hourglass_top"}
          </span>
          <h1 className="mt-3 font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
            {title}
          </h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{body}</p>
          {email ? (
            <p className="mt-4 text-sm">
              {t("signedInAs")}{" "}
              <span className="font-semibold" dir="ltr">
                {email}
              </span>
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 text-sm text-[var(--error)]" role="alert">
              {error}
            </p>
          ) : null}

          {status !== "rejected" ? (
            <button
              type="button"
              className="btn-primary mt-8 w-full rounded-xl py-3"
              onClick={checkAgain}
              disabled={checking || signingOut}
              aria-busy={checking}
            >
              {checking ? t("checking") : t("checkAgain")}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            aria-busy={signingOut}
            className="mt-6 w-full text-sm text-[var(--on-surface-variant)] underline-offset-2 hover:underline"
          >
            {signingOut ? t("signingOut") : t("signOut")}
          </button>
        </section>
      </main>
    </div>
  );
}
