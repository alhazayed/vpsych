import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSupervisor } from "@/lib/skill-tests/access";
import {
  isPatientCompatible,
  listAllowedComorbidities,
  listDisorderOptions,
} from "@/lib/skill-tests";
import { SkillTestForm } from "@/components/skill-tests/SkillTestForm";

export default async function NewSkillTestPage() {
  const { supabase } = await requireSupervisor();
  const t = await getTranslations("skillTests.supervise");

  const [{ data: traineeRows, error: traineeErr }, { data: avatarRows }] =
    await Promise.all([
      supabase.rpc("list_skill_test_trainees"),
      supabase
        .from("avatars")
        .select("id, name, age, gender")
        .eq("is_active", true)
        .order("name"),
    ]);
  if (traineeErr) console.warn("[supervise/new] trainees:", traineeErr.message);

  const trainees = (
    (traineeRows ?? []) as Array<{ id: string; display_name: string; email: string }>
  ).map((r) => ({ id: r.id, displayName: r.display_name, email: r.email }));
  const patients = (
    (avatarRows ?? []) as Array<{
      id: string;
      name: string;
      age: number | null;
      gender: string | null;
    }>
  );
  const disorders = listDisorderOptions().map((d) => ({
    slug: d.slug,
    allowedComorbidities: listAllowedComorbidities(d.slug),
    patientIds: patients
      .filter((p) => isPatientCompatible(d.slug, { age: p.age, gender: p.gender }))
      .map((p) => p.id),
  }));

  return (
    <main className="mx-auto max-w-[720px] px-4 py-8 md:px-8">
      <Link
        href="/supervise"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <span className="material-symbols-outlined text-[18px] rtl:rotate-180" aria-hidden>
          arrow_back
        </span>
        {t("back")}
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
        {t("newTitle")}
      </h1>
      <p className="mb-6 mt-2 text-sm text-[var(--on-surface-variant)]">{t("newIntro")}</p>
      {traineeErr ? (
        <p role="alert" className="clinical-card p-5 text-sm text-[var(--error)]">
          {t("loadError")}
        </p>
      ) : (
        <SkillTestForm
          trainees={trainees}
          patients={patients.map((p) => ({ id: p.id, name: p.name }))}
          disorders={disorders}
        />
      )}
    </main>
  );
}
