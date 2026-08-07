import { requireAdmin } from "@/lib/auth";
import { AdminSupervisorPanel } from "@/components/supervisor/AdminSupervisorPanel";

export default async function AdminSupervisorPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-8">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
          Supervisor AI
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          Therapist evaluation framework overview. Observational only — never
          modifies patient cognition or clinical intelligence.
        </p>
      </section>
      <AdminSupervisorPanel />
    </main>
  );
}
