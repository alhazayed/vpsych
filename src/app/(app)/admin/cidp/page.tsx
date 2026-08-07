import { requireAdmin } from "@/lib/auth";
import { CidpDashboardPanel } from "@/components/enterprise/CidpDashboardPanel";

export default async function AdminCidpPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-8">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
          CIDP operations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          Controlled Institutional Deployment dashboards — system, clinical
          simulation counts, institution, research, security, and executive
          KPIs. No patient-identifiable information.
        </p>
      </section>
      <CidpDashboardPanel />
    </main>
  );
}
