import { requireAdmin } from "@/lib/auth";
import { CidpDashboardPanel } from "@/components/enterprise/CidpDashboardPanel";
import { Phase14ReadinessPanel } from "@/components/enterprise/Phase14ReadinessPanel";
import { Phase15AuthorizationPanel } from "@/components/enterprise/Phase15AuthorizationPanel";
import { Phase16ExecutionPanel } from "@/components/enterprise/Phase16ExecutionPanel";

export default async function AdminCidpPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-8">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
          CIDP operations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          Controlled Institutional Deployment execution evidence — Phase 16
          reports Evidence Pending for missing drills, pilots, and outcomes.
          Never fabricates operational evidence. GO for CIDP · NO-GO for GA
          until all Phase 16 gates PASS with verified observations.
        </p>
      </section>
      <CidpDashboardPanel />
      <Phase16ExecutionPanel />
      <Phase14ReadinessPanel />
      <Phase15AuthorizationPanel />
    </main>
  );
}
