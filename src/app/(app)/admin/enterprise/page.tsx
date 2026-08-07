import { requireAdmin } from "@/lib/auth";
import { AdminEnterprisePanel } from "@/components/enterprise/AdminEnterprisePanel";

export default async function AdminEnterprisePage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-8">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
          Enterprise Platform
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          Multi-tenant organization control plane — tenancy, RBAC, courses,
          certificates, analytics, security, and observability. Extends Stages
          1–9 without modifying patient cognition.
        </p>
      </section>
      <AdminEnterprisePanel />
    </main>
  );
}
