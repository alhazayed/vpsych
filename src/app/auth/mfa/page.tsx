import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireAdminIdentity } from "@/lib/auth";
import {
  adminMfaEnrollHref,
  adminMfaReturnPath,
  hasAdminMfaAssurance,
} from "@/lib/admin-mfa";
import { redirect } from "next/navigation";
import MfaChallengePage from "./page-client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { supabase } = await requireAdminIdentity();
  const params = await searchParams;
  const next = adminMfaReturnPath(params.next);

  let currentLevel: string | null = null;
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    currentLevel = data?.currentLevel ?? null;
  } catch {
    currentLevel = null;
  }

  if (hasAdminMfaAssurance({ currentLevel, nextLevel: null })) {
    redirect(next);
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.filter((f) => f.status === "verified") ?? [];
  if (verified.length === 0) {
    redirect(adminMfaEnrollHref(next));
  }

  const t = await getTranslations("auth");
  return (
    <Suspense
      fallback={
        <main className="p-8 text-[var(--on-surface-variant)]">{t("loading")}</main>
      }
    >
      <MfaChallengePage
        factorId={verified[0]!.id}
        nextPath={next}
      />
    </Suspense>
  );
}
