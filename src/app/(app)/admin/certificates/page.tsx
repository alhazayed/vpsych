import { getLocale, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  CertificateDesigner,
  type CertificateTrainee,
} from "@/components/admin/CertificateDesigner";
import {
  LADDER_LEVEL_COUNT,
  LADDER_PATIENTS,
  loadAllLadderAttempts,
  summarizeTraineeLadders,
} from "@/lib/training-ladder";
import type { CertificateLocale } from "@/lib/certificate-template";

async function certificateTemplate(locale: CertificateLocale) {
  const t = await getTranslations({ locale, namespace: "admin.certificates" });
  return {
    defaults: {
      heading: t("defaults.heading"),
      intro: t("defaults.intro"),
      achievement: t("defaults.achievement"),
      signatoryTitle: t("defaults.signatoryTitle"),
    },
    sheet: {
      date: t("sheet.date"),
      reference: t("sheet.reference"),
      inPartnershipWith: t("sheet.inPartnershipWith"),
      disclaimer: t("sheet.disclaimer"),
      signature: t("sheet.signature"),
    },
  };
}

/**
 * Pass certificate designer: the admin sets the wording, institute and
 * signatories, previews the sheet and prints it. Trainees are offered with
 * their Training Program progress so the admin can see who passed; nothing
 * is written to the database.
 */
export default async function AdminCertificatesPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.certificates");
  const tHome = await getTranslations("admin.home");
  const tLearners = await getTranslations("admin.learners");
  const uiLocale = (await getLocale()) === "ar" ? "ar" : "en";

  const [en, ar, loaded, institutes] = await Promise.all([
    certificateTemplate("en"),
    certificateTemplate("ar"),
    loadAllLadderAttempts(supabase),
    supabase.from("institutions").select("name").eq("is_active", true).order("name").limit(200),
  ]);
  if (institutes.error) {
    console.warn("[admin/certificates] institutions load failed", { error: institutes.error.message });
  }

  const ladders = loaded.available ? summarizeTraineeLadders(loaded.attempts) : [];
  const names = new Map<string, string>();
  let namesFailed = false;
  const ids = ladders.map((l) => l.therapistId);
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids.slice(i, i + 100));
    if (error) {
      console.warn("[admin/certificates] trainee names load failed", { error: error.message });
      namesFailed = true;
      break;
    }
    for (const p of data ?? []) {
      if (p.display_name?.trim()) names.set(p.id, p.display_name.trim());
    }
  }

  const trainees: CertificateTrainee[] = ladders
    .map((l) => ({
      id: l.therapistId,
      name: names.get(l.therapistId) ?? t("unnamed"),
      patientsCompleted: Object.values(l.patients).filter((p) => p.progress.completed).length,
      levelsCleared: l.clearedLevels,
    }))
    .sort((a, b) => b.patientsCompleted - a.patientsCompleted || b.levelsCleared - a.levelsCleared);

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: tLearners("title"), href: "/admin/learners" },
          { label: t("title") },
        ]}
      />
      {!loaded.available || namesFailed ? (
        <p role="alert" className="clinical-card p-4 text-sm text-[var(--error)]">
          {t("traineesFailed")}
        </p>
      ) : null}
      <CertificateDesigner
        templates={{ en, ar }}
        trainees={trainees}
        totals={{
          patients: LADDER_PATIENTS.length,
          levels: LADDER_PATIENTS.length * LADDER_LEVEL_COUNT,
        }}
        institutions={(institutes.data ?? []).map((r) => r.name).filter(Boolean)}
        initialLocale={uiLocale}
      />
    </main>
  );
}
