import { Suspense } from "react";
import LoginPage from "./page-client";

export default function Page() {
  return (
    <Suspense fallback={<main className="p-8 text-[var(--on-surface-variant)]">Loading…</main>}>
      <LoginPage />
    </Suspense>
  );
}
