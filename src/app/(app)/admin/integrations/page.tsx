import { requireAdmin } from "@/lib/auth";
import { ApiIntegrationsClient } from "./ApiIntegrationsClient";

export default async function AdminIntegrationsPage() {
  await requireAdmin();
  return <ApiIntegrationsClient />;
}
