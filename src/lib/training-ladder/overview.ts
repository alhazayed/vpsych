/**
 * What the trainee's training pages show: each active program patient with
 * its avatar identity, the trainee's attempts and the derived progress.
 * Read-only; RLS limits attempts to the trainee's own (or an admin's view).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAvatarLocale } from "@/lib/avatars/resolve";
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

/**
 * Each avatar's own name in one personality locale
 * (`personalities[locale].identity.display_name`). Best effort: a failed
 * lookup leaves the canonical `avatars.name` in place.
 */
async function loadLocalizedNames(
  supabase: SupabaseClient,
  avatarIds: string[],
  uiLocale: string,
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const locale = normalizeAvatarLocale(uiLocale);
  if (avatarIds.length === 0 || !/^[a-z]{2}-[A-Z]{2}$/.test(locale)) return names;
  const { data, error } = await supabase
    .from("avatars")
    .select(`id, local_name:personalities->${locale}->identity->>display_name`)
    .in("id", avatarIds);
  if (error) {
    console.warn("[training-ladder] localized names load failed", {
      locale,
      error: error.message,
    });
    return names;
  }
  for (const row of (data ?? []) as unknown as Array<{
    id: string;
    local_name: string | null;
  }>) {
    const name = row.local_name?.trim();
    if (name) names.set(row.id, name);
  }
  return names;
}

export async function loadLadderOverview(
  supabase: SupabaseClient,
  therapistId: string,
  uiLocale: string,
): Promise<LadderOverview> {
  const { data: programRows, error } = await supabase
    .from("training_ladder_patients")
    .select("key, avatar_id, avatars(id, name, age, gender, portrait_url, is_active)")
    .eq("is_active", true);
  if (error) {
    console.warn("[training-ladder] program load failed", {
      error: error.message,
    });
    return { available: false };
  }
  type AvatarRow = Omit<LadderAvatar, "display_name"> & { is_active: boolean };
  const rows = (programRows ?? []) as unknown as Array<{
    key: string;
    avatars: AvatarRow | AvatarRow[] | null;
  }>;
  const avatarOf = (row: (typeof rows)[number]) =>
    Array.isArray(row.avatars) ? row.avatars[0] : row.avatars;
  const avatarIds = rows.flatMap((row) => {
    const id = avatarOf(row)?.id;
    return id ? [id] : [];
  });
  const [attempts, localizedNames] = await Promise.all([
    loadLadderAttempts(supabase, { therapistId }),
    loadLocalizedNames(supabase, avatarIds, uiLocale),
  ]);
  if (!attempts.available) return { available: false };

  const patients: LadderPatientOverview[] = [];
  for (const row of rows) {
    const patient = LADDER_PATIENTS.find((p) => p.key === row.key);
    const avatar = avatarOf(row);
    if (!patient || !avatar?.is_active) continue;
    const mine = attempts.attempts.filter((a) => a.patient_key === patient.key);
    patients.push({
      patient,
      avatar: {
        id: avatar.id,
        name: avatar.name,
        display_name: localizedNames.get(avatar.id) ?? avatar.name,
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
