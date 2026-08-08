import { requireAdmin } from "@/lib/auth";
import { VirtualPatientLibrary } from "@/components/admin/virtual-patients/VirtualPatientLibrary";

export default async function AdminVirtualPatientsPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-8">
      <VirtualPatientLibrary />
    </main>
  );
}
