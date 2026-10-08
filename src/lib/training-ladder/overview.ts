/**
 * What the trainee's training pages show: each active program patient with
 * its avatar identity, the trainee's attempts and the derived progress.
 * Read-only; RLS limits attempts to the trainee's own (or an admin's view).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  avatarDisplayName,
  avatarLocalNameSelect,
} from "@/lib/avatars/localized-name";
import { loadLadderAttempts } from "@/lib/training-ladder/persist";
import {
  LADDER_PATIENTS,
  type LadderPatient,
} from "@/lib/training-ladder/program";
import {
  ladderProgress,
  type LadderAttemptRow,
  type LadderProgress,
} from "@/lib/training-ladder/progress";

export type LadderAvatar = {
  id: string;
  name: string;
  /**
   * The name the patient goes by in the UI locale: the natively authored
   * personality's own name (Ethan Cole is أحمد حدّاد in Arabic). Falls back
   * to `name`.
   */
  display_name: string;
  age: number | null;
  gender: string | null;
  portrait_url: string | null;
};

export type LadderPatientOverview = {
  patient: LadderPatient;
  avatar: LadderAvatar;
  attempts: LadderAttemptRow[];
  progress: LadderProgress;
};

export type LadderOverview =
  | { available: true; patients: LadderPatientOverview[] }
  | { available: false };

export async function loadLadderOverview(
  supabase: SupabaseClient,
  therapistId: string,
  uiLocale: string,
): Promise<LadderOverview> {
  const { data: programRows, error } = await supabase
    .from("training_ladder_patients")
    .select(
      `key, avatar_id, avatars(id, name, age, gender, portrait_url, is_active, ${avatarLocalNameSelect(uiLocale)})`,
    )
    .eq("is_active", true);
  if (error) {
    console.warn("[training-ladder] program load failed", {
      error: error.message,
    });
    return { available: false };
  }
  type AvatarRow = Omit<LadderAvatar, "display_name"> & {
    is_active: boolean;
    local_name: string | null;
  };
  const rows = (programRows ?? []) as unknown as Array<{
    key: string;
    avatars: AvatarRow | AvatarRow[] | null;
  }>;
  const attempts = await loadLadderAttempts(supabase, { therapistId });
  if (!attempts.available) return { available: false };

  const patients: LadderPatientOverview[] = [];
  for (const row of rows) {
    const patient = LADDER_PATIENTS.find((p) => p.key === row.key);
    const avatar = Array.isArray(row.avatars) ? row.avatars[0] : row.avatars;
    if (!patient || !avatar?.is_active) continue;
    const mine = attempts.attempts.filter((a) => a.patient_key === patient.key);
    patients.push({
      patient,
      avatar: {
        id: avatar.id,
        name: avatar.name,
        display_name: avatarDisplayName(avatar),
        age: avatar.age ?? null,
        gender: avatar.gender ?? null,
        portrait_url: avatar.portrait_url ?? null,
      },
      attempts: mine,
      progress: ladderProgress(mine),
    });
  }
  patients.sort((a, b) => a.patient.slot - b.patient.slot);
  return { available: true, patients };
}
