import type { SupabaseClient } from "@supabase/supabase-js";
import type { Avatar } from "@/lib/types";
import type { VirtualPatientLifecycleStatus } from "@/lib/admin/virtual-patient-lifecycle";
import { isEditableLifecycle, readLifecycleStatus } from "./persist-lifecycle";

/**
 * Server-side gate for content mutations (avatar update, voice assign,
 * human personality save). Published/archived rows are immutable; restore
 * or duplicate first. Prefer this over UI-only disabling.
 *
 * Kept in a leaf module so personality-engine can import it without
 * creating a persist ↔ personality-engine cycle.
 */
export async function assertAvatarContentMutable(
  supabase: SupabaseClient,
  avatarId: string,
): Promise<
  | { ok: true; lifecycleStatus: VirtualPatientLifecycleStatus }
  | { ok: false; status: 404 | 409; error: string }
> {
  const { data, error } = await supabase
    .from("avatars")
    .select("id, lifecycle_status, is_active")
    .eq("id", avatarId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 404, error: "Avatar not found" };
  }

  const lifecycleStatus = readLifecycleStatus(data as unknown as Avatar);
  if (isEditableLifecycle(lifecycleStatus)) {
    return { ok: true, lifecycleStatus };
  }
  if (lifecycleStatus === "published") {
    return {
      ok: false,
      status: 409,
      error: "Published avatars are immutable; duplicate to create a new draft",
    };
  }
  return {
    ok: false,
    status: 409,
    error: "Archived avatars must be restored to draft before editing",
  };
}
