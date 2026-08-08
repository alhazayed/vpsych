import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getVirtualPatient } from "@/lib/admin/virtual-patients";
import { EditVirtualPatient } from "@/components/admin/virtual-patients/EditVirtualPatient";

type Ctx = { params: Promise<{ id: string }> };

export default async function EditVirtualPatientPage({ params }: Ctx) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const result = await getVirtualPatient(supabase, id);
  if (!result.ok) notFound();

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <EditVirtualPatient
        id={id}
        initialItem={result.item}
        initialDraft={result.draft}
        initialSlug={result.avatar.slug ?? null}
      />
    </main>
  );
}
