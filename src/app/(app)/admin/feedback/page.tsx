import { requireAdmin } from "@/lib/auth";
import { AdminFeedbackPanel } from "@/components/enterprise/AdminFeedbackPanel";

export default async function AdminFeedbackPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <section className="mb-8">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
          Feedback queue
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          Institutional pilot feedback triage — faculty, residents, researchers,
          administrators, and IT. Ops/enterprise owned; no patient cognition.
        </p>
      </section>
      <AdminFeedbackPanel />
    </main>
  );
}
