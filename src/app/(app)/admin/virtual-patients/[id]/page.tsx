import { requireAdmin } from "@/lib/auth";
import { EditVirtualPatient } from "@/components/admin/virtual-patients/EditVirtualPatient";

type Ctx = { params: Promise<{ id: string }> };

export default async function EditVirtualPatientPage({ params }: Ctx) {
  await requireAdmin();
  const { id } = await params;
  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <EditVirtualPatient id={id} />
    </main>
  );
}
