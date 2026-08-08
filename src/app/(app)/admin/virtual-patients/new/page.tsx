import { requireAdmin } from "@/lib/auth";
import { CreateVirtualPatientWizard } from "@/components/admin/virtual-patients/CreateVirtualPatientWizard";

export default async function NewVirtualPatientPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <CreateVirtualPatientWizard />
    </main>
  );
}
