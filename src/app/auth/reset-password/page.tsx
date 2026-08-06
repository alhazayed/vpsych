import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import ResetPasswordPage from "./page-client";

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <Suspense
      fallback={
        <main className="p-8 text-[var(--on-surface-variant)]">{t("loading")}</main>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
