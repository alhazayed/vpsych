import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  isMissingApprovalColumnError,
  resolveApprovalStatus,
  type ApprovalStatus,
} from "@/lib/account-approval";
import PendingApprovalScreen from "./page-client";

/**
 * The only app screen an account the superadmin has not approved can reach
 * (middleware + requireProfile send it here). Approved accounts are sent on.
 */
export default async function PendingApprovalPage() {
  const { supabase, user } = await requireUser();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  let status: ApprovalStatus | "unknown";
  if (isMissingApprovalColumnError(error)) status = "approved";
  else if (error || !profile) status = "unknown";
  else status = resolveApprovalStatus(profile);

  if (status === "approved") redirect("/avatars");

  return <PendingApprovalScreen status={status} email={user.email ?? ""} />;
}
