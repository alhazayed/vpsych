import { requireAdmin } from "@/lib/auth";
import { listVirtualPatients } from "@/lib/admin/virtual-patients";
import { VirtualPatientLibrary } from "@/components/admin/virtual-patients/VirtualPatientLibrary";

export default async function AdminVirtualPatientsPage() {
  const { supabase } = await requireAdmin();
  const result = await listVirtualPatients(supabase);
  const initialItems = result.ok ? result.items : [];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-8">
      <VirtualPatientLibrary initialItems={initialItems} />
    </main>
  );
}
