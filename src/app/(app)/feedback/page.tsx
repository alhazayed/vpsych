import { requireProfile } from "@/lib/auth";
import { InstitutionalFeedbackForm } from "@/components/enterprise/InstitutionalFeedbackForm";

export default async function FeedbackPage() {
  await requireProfile();

  return (
    <main className="mx-auto max-w-[720px] px-4 py-8 md:px-8">
      <section className="mb-8">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
          Institutional feedback
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          Structured pilot feedback for Controlled Institutional Deployment.
          Severity, category, reproducibility, and suggested action are
          required for triage. Do not include PHI.
        </p>
      </section>
      <InstitutionalFeedbackForm />
    </main>
  );
}
