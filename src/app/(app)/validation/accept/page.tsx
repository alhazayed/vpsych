"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, Suspense, type FormEvent } from "react";
import { useTranslations } from "next-intl";

function AcceptForm() {
  const t = useTranslations("cvp.accept");
  const params = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [credentials, setCredentials] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [consent, setConsent] = useState(false);
  const [agreement, setAgreement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/cvp/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          credentials,
          specialty,
          acceptConsent: consent,
          acceptAgreement: agreement,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? t("error"));
        return;
      }
      router.push("/validation");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="clinical-card mx-auto max-w-lg space-y-4 p-6">
      <div>
        <label className="mb-1 block text-sm font-medium">{t("token")}</label>
        <input
          className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("credentials")}</label>
        <input
          className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
          value={credentials}
          onChange={(e) => setCredentials(e.target.value)}
          placeholder={t("credentialsPh")}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("specialty")}</label>
        <input
          className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder={t("specialtyPh")}
        />
      </div>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        {t("consent")}
      </label>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreement}
          onChange={(e) => setAgreement(e.target.checked)}
          required
        />
        {t("agreement")}
      </label>
      {error ? (
        <p className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary h-11 w-full" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}

export default function AcceptInvitePage() {
  const t = useTranslations("cvp.accept");
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-2 text-center font-[family-name:var(--font-headline)] text-2xl font-semibold">
        {t("title")}
      </h1>
      <p className="mb-8 text-center text-sm text-[var(--on-surface-variant)]">
        {t("subtitle")}
      </p>
      <Suspense fallback={<p className="text-center text-sm">{t("loading")}</p>}>
        <AcceptForm />
      </Suspense>
    </main>
  );
}
