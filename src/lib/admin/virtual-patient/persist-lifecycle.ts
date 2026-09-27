import type { Avatar } from "@/lib/types";
import type { VirtualPatientLifecycleStatus } from "@/lib/admin/virtual-patient-lifecycle";

/** Read canonical lifecycle from an avatar row (with is_active fallback). */
export function readLifecycleStatus(
  avatar: Pick<Avatar, "lifecycle_status" | "is_active">,
): VirtualPatientLifecycleStatus {
  const raw = avatar.lifecycle_status;
  if (
    raw === "draft" ||
    raw === "testing" ||
    raw === "published" ||
    raw === "archived"
  ) {
    return raw;
  }
  return avatar.is_active ? "published" : "draft";
}

export function isEditableLifecycle(
  status: VirtualPatientLifecycleStatus,
): boolean {
  return status === "draft" || status === "testing";
}
