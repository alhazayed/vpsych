import { requireAdmin } from "@/lib/auth";
import { SecurityKeysClient } from "./SecurityKeysClient";

export default async function AdminSecurityPage() {
  await requireAdmin();
  return <SecurityKeysClient />;
}
